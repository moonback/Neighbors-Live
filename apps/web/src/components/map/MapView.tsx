'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { CATEGORIES, CATEGORY_COLORS, RADII_M, type Category } from '@nl/shared';
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { api } from '@/lib/client-api';
import { clientEnv } from '@/lib/env';
import { useLocation } from '@/lib/useLocation';
import { circlePolygon, zoomForRadius } from './geometry';

interface MapItem {
  id: string;
  category: Category;
  caption: string;
  coordinates: [number, number];
}
type MapFeature = {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; category: Category; caption: string };
};
type FC = { type: 'FeatureCollection'; features: MapFeature[] };
type Center = { lat: number; lng: number };

const colorExpression = [
  'match',
  ['get', 'category'],
  ...CATEGORIES.flatMap((c) => [c, CATEGORY_COLORS[c]]),
  '#9ca3af',
] as unknown as ExpressionSpecification;

export function MapView({ initialRadius }: { initialRadius: number }) {
  const t = useTranslations('map');
  const tf = useTranslations('feed');
  const tc = useTranslations('common');
  const { state: location, locate, dismiss } = useLocation();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [radius, setRadius] = useState(initialRadius);
  const [category, setCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');
  const [center, setCenter] = useState<Center | null>(null);
  const [pendingCenter, setPendingCenter] = useState<Center | null>(null);
  const [items, setItems] = useState<MapItem[]>([]);
  const [selected, setSelected] = useState<MapItem | null>(null);
  const [resultsState, setResultsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [retry, setRetry] = useState(0);

  const queryCenter = useMemo(
    () => center ?? (location.status === 'ok' ? { lat: location.lat, lng: location.lng } : null),
    [center, location],
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle
      ? items.filter((item) => item.caption.toLocaleLowerCase().includes(needle))
      : items;
  }, [items, search]);

  const moveTo = useCallback((point: Center, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [point.lng, point.lat], zoom: zoom ?? map.getZoom(), essential: false });
  }, []);

  // Create a browsable map without requiring location permission.
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false;
    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
      const map = new maplibregl.Map({
        container: container.current,
        style: clientEnv.NEXT_PUBLIC_MAP_STYLE_URL,
        center: [0, 20],
        zoom: 1.5,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on('load', () => {
        map.addSource('radius', {
          type: 'geojson',
          data: circlePolygon(48.86, 2.35, initialRadius),
        });
        map.addLayer({
          id: 'radius-fill',
          type: 'fill',
          source: 'radius',
          paint: { 'fill-color': '#facc15', 'fill-opacity': 0.07 },
        });
        map.addLayer({
          id: 'radius-line',
          type: 'line',
          source: 'radius',
          paint: { 'line-color': '#eab308', 'line-width': 1.5, 'line-opacity': 0.75 },
        });
        map.addSource('videos', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: 42,
          clusterMaxZoom: 17,
        });
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'videos',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#111827',
            'circle-stroke-color': '#facc15',
            'circle-stroke-width': 2,
            'circle-radius': ['step', ['get', 'point_count'], 17, 10, 23, 30, 29],
          },
        });
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'videos',
          filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 },
          paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
          id: 'points',
          type: 'circle',
          source: 'videos',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': colorExpression,
            'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 13, 9],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        });
        map.on('click', 'points', (e) => {
          const f = e.features?.[0] as MapFeature | undefined;
          if (!f) return;
          setSelected({ ...f.properties, coordinates: f.geometry.coordinates });
        });
        map.on('click', 'clusters', async (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const source = map.getSource('videos') as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(
            feature.properties.cluster_id as number,
          );
          map.easeTo({
            center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates,
            zoom,
          });
        });
        for (const layer of ['points', 'clusters']) {
          map.on('mouseenter', layer, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layer, () => {
            map.getCanvas().style.cursor = '';
          });
        }
        map.on('moveend', () => {
          const c = map.getCenter();
          const next = { lat: c.lat, lng: c.lng };
          setPendingCenter((old) =>
            old && Math.abs(old.lat - next.lat) < 0.002 && Math.abs(old.lng - next.lng) < 0.002
              ? null
              : next,
          );
        });
        mapRef.current = map;
        setLoaded(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [initialRadius]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
    },
    [],
  );

  useEffect(() => {
    if (location.status !== 'ok') return;
    const point = { lat: location.lat, lng: location.lng };
    if (loaded) moveTo(point, zoomForRadius(radius));
  }, [location, loaded, moveTo, radius]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !queryCenter) return;
    setResultsState('loading');
    (map.getSource('radius') as GeoJSONSource).setData(
      circlePolygon(queryCenter.lat, queryCenter.lng, radius),
    );
    const qs = new URLSearchParams({
      lat: String(queryCenter.lat),
      lng: String(queryCenter.lng),
      radius: String(radius),
    });
    if (category) qs.set('category', category);
    let alive = true;
    void api<FC>(`/api/map?${qs}`)
      .then((res) => {
        if (!alive) return;
        if (!res.ok) {
          setResultsState('error');
          return;
        }
        const mapped = res.data.features.map((f) => ({
          ...f.properties,
          coordinates: f.geometry.coordinates,
        }));
        setItems(mapped);
        (map.getSource('videos') as GeoJSONSource).setData(
          res.data as Parameters<GeoJSONSource['setData']>[0],
        );
        setResultsState('ready');
      })
      .catch(() => {
        if (alive) setResultsState('error');
      });
    return () => {
      alive = false;
    };
  }, [loaded, queryCenter, radius, category, retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !selected) return;
    map.setFeatureState({ source: 'videos', id: selected.id }, { selected: true });
    return () => {
      map.setFeatureState({ source: 'videos', id: selected.id }, { selected: false });
    };
  }, [loaded, selected]);

  useEffect(() => {
    const source = mapRef.current?.getSource('videos') as GeoJSONSource | undefined;
    if (!source || !loaded) return;
    source.setData({
      type: 'FeatureCollection',
      features: filteredItems.map((item) => ({
        type: 'Feature',
        id: item.id,
        geometry: { type: 'Point', coordinates: item.coordinates },
        properties: { id: item.id, category: item.category, caption: item.caption },
      })),
    });
  }, [filteredItems, loaded]);

  function searchThisArea() {
    if (!pendingCenter) return;
    const point = pendingCenter;
    setCenter(point);
    setPendingCenter(null);
    setSelected(null);
  }

  function selectItem(item: MapItem) {
    setSelected(item);
    moveTo(
      { lat: item.coordinates[1], lng: item.coordinates[0] },
      Math.max(mapRef.current?.getZoom() ?? 12, 14),
    );
  }

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] min-h-[32rem] w-full overflow-hidden bg-slate-100 text-slate-900">
      <h1 className="sr-only">{t('title')}</h1>
      <PermissionPrimer
        open={location.status === 'primer'}
        title={tf('location.primerTitle')}
        confirmLabel={tf('location.allow')}
        cancelLabel={tf('location.later')}
        onConfirm={() => void locate()}
        onCancel={dismiss}
      >
        <p>{tf('location.primerBody')}</p>
      </PermissionPrimer>

      <div ref={container} className="absolute inset-0" role="region" aria-label={t('title')} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 sm:p-5">
        <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-white/70 bg-white/95 p-3 shadow-lg shadow-slate-900/10 backdrop-blur-xl sm:p-4">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-yellow-300"
              aria-hidden="true"
            >
              ⌖
            </div>
            <label htmlFor="map-search" className="sr-only">
              {t('searchLabel')}
            </label>
            <input
              id="map-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-yellow-400"
            />
            {search && (
              <button
                type="button"
                aria-label={t('clearSearch')}
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500"
                onClick={() => setSearch('')}
              >
                ×
              </button>
            )}
            <span className="hidden rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-slate-800 md:inline">
              {t('localDiscovery')}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5" aria-label={t('filtersLabel')}>
            <Chip active={category === null} onClick={() => setCategory(null)}>
              {tf('filters.all')}
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                <span style={{ color: category === c ? undefined : CATEGORY_COLORS[c] }}>
                  <CategoryIcon category={c} />
                </span>
                {tc(`categories.${c}`)}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <aside className="absolute bottom-0 left-0 top-36 z-10 hidden w-[22rem] flex-col border-r border-slate-200 bg-white/95 shadow-xl backdrop-blur-xl lg:flex xl:w-[25rem]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-bold">{t('nearby')}</h2>
            <p className="mt-1 text-xs text-slate-500" aria-live="polite">
              {resultsState === 'loading'
                ? t('loading')
                : resultsState === 'ready'
                  ? t('count', { count: filteredItems.length })
                  : center
                    ? t('loadError')
                    : t('chooseArea')}
            </p>
          </div>
          <label className="sr-only" htmlFor="map-radius">
            {tf('filters.radius')}
          </label>
          <select
            id="map-radius"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500"
          >
            {RADII_M.map((r) => (
              <option key={r} value={r}>
                {tc(`radius.${r}`)}
              </option>
            ))}
          </select>
        </div>
        {resultsState === 'error' && (
          <div role="alert" className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {t('loadError')}{' '}
            <button className="ml-2 font-semibold underline" onClick={() => setRetry((v) => v + 1)}>
              {tc('actions.retry')}
            </button>
          </div>
        )}
        {resultsState === 'loading' && <p className="p-5 text-sm text-slate-500">{t('loading')}</p>}
        {resultsState === 'ready' && filteredItems.length === 0 && (
          <p className="p-5 text-sm text-slate-500">{search ? t('noSearchResults') : t('empty')}</p>
        )}
        <ul
          className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto"
          aria-label={t('nearby')}
        >
          {filteredItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={selected?.id === item.id}
                onClick={() => selectItem(item)}
                className={`flex min-h-20 w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-yellow-500 ${selected?.id === item.id ? 'bg-yellow-50' : ''}`}
              >
                <span
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                >
                  <CategoryIcon category={item.category} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-500">
                    {tc(`categories.${item.category}`)}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm font-medium">
                    {item.caption}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="absolute right-3 top-36 z-10 flex flex-col gap-2 sm:right-5">
        <button
          type="button"
          aria-label={t('zoomIn')}
          onClick={() => mapRef.current?.zoomIn()}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl font-semibold shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500"
        >
          +
        </button>
        <button
          type="button"
          aria-label={t('zoomOut')}
          onClick={() => mapRef.current?.zoomOut()}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl font-semibold shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500"
        >
          −
        </button>
        <button
          type="button"
          aria-label={t('locate')}
          onClick={() => void locate()}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-lg text-yellow-300 shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500"
        >
          ◎
        </button>
      </div>

      {pendingCenter && (
        <button
          type="button"
          onClick={searchThisArea}
          className="absolute right-16 top-[9.25rem] z-10 min-h-11 rounded-full bg-yellow-300 px-4 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-yellow-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 sm:right-20"
        >
          {t('searchThisArea')}
        </button>
      )}
      {(location.status === 'denied' || location.status === 'error') && (
        <div
          className="absolute bottom-24 left-3 right-3 z-10 rounded-2xl border border-amber-200 bg-white p-3 text-sm shadow-lg sm:left-auto sm:right-20 sm:max-w-sm"
          role="status"
        >
          {location.status === 'denied' ? tf('location.denied') : tf('location.needed')}
        </div>
      )}

      {selected && (
        <section
          className="absolute inset-x-3 bottom-24 z-20 mx-auto flex max-w-xl items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl lg:bottom-6 lg:left-[24rem] lg:right-6 lg:mx-0 lg:max-w-none xl:left-[27rem]"
          role="dialog"
          aria-label={tc(`categories.${selected.category}`)}
        >
          <span
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
            style={{ backgroundColor: CATEGORY_COLORS[selected.category] }}
          >
            <CategoryIcon category={selected.category} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {tc(`categories.${selected.category}`)}
            </p>
            <p className="mt-1 line-clamp-3 text-sm font-medium text-slate-900">
              {selected.caption}
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/?video=${selected.id}`}
                className="inline-flex min-h-11 items-center rounded-xl bg-yellow-300 px-4 text-sm font-bold text-slate-900 hover:bg-yellow-200"
              >
                {t('open')}
              </Link>
              <button
                type="button"
                onClick={() =>
                  moveTo(
                    { lat: selected.coordinates[1], lng: selected.coordinates[0] },
                    Math.max(mapRef.current?.getZoom() ?? 12, 14),
                  )
                }
                className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
              >
                {t('showOnMap')}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500"
            aria-label={tc('actions.close')}
            onClick={() => setSelected(null)}
          >
            ×
          </button>
        </section>
      )}

      <div className="pointer-events-none absolute bottom-1 right-2 z-10 rounded bg-white/80 px-2 py-0.5 text-[10px] text-slate-600">
        {t('attribution')}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {resultsState === 'ready'
          ? t('count', { count: filteredItems.length })
          : resultsState === 'loading'
            ? t('loading')
            : ''}
      </div>
      <div
        className="pointer-events-auto absolute bottom-0 left-0 right-0 z-10 max-h-[32vh] overflow-y-auto bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,.12)] lg:hidden"
        aria-label={t('nearby')}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <h2 className="text-sm font-bold">
            {selected ? tc(`categories.${selected.category}`) : t('nearby')}
          </h2>
          <span className="text-xs text-slate-500">
            {resultsState === 'ready'
              ? t('count', { count: filteredItems.length })
              : resultsState === 'loading'
                ? t('loading')
                : ''}
          </span>
          <label className="sr-only" htmlFor="map-radius-mobile">
            {tf('filters.radius')}
          </label>
          <select
            id="map-radius-mobile"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
          >
            {RADII_M.map((r) => (
              <option key={r} value={r}>
                {tc(`radius.${r}`)}
              </option>
            ))}
          </select>
        </div>
        {resultsState === 'error' && (
          <div className="px-4 pb-2 text-xs text-red-700" role="alert">
            {t('loadError')}{' '}
            <button onClick={() => setRetry((v) => v + 1)} className="font-bold underline">
              {tc('actions.retry')}
            </button>
          </div>
        )}
        {resultsState === 'ready' && filteredItems.length === 0 && (
          <p className="px-4 pb-4 text-sm text-slate-500">
            {search ? t('noSearchResults') : t('empty')}
          </p>
        )}
        {filteredItems.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            {filteredItems.slice(0, 30).map((item) => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className={`min-h-12 max-w-64 shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${selected?.id === item.id ? 'border-yellow-500 bg-yellow-50' : 'border-slate-200 bg-white'}`}
              >
                <span className="font-semibold">{tc(`categories.${item.category}`)}</span>
                <span className="mt-0.5 line-clamp-1 block text-slate-600">{item.caption}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500 ${active ? 'bg-slate-900 text-yellow-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );
}
