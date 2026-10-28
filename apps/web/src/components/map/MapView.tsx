'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { CATEGORIES, CATEGORY_COLORS, type Category } from '@nl/shared';
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/client-api';
import { clientEnv } from '@/lib/env';
import { useNeighborhoodFilters } from '@/lib/useNeighborhoodFilters';
import { useLocation } from '@/lib/useLocation';
import { circlePolygon, zoomForRadius } from './geometry';
import { MapFiltersDialog } from './MapFiltersDialog';
import { getMapViewport, setMapViewport } from './viewport';

interface Selected {
  id: string;
  category: Category;
  caption: string;
}

type FC = { type: 'FeatureCollection'; features: unknown[] };

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
  const markerRef = useRef<Marker | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const skipFirstViewportAdjustmentRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const {
    radius,
    setRadius,
    category,
    setCategory,
    reset: resetFilters,
    customized: filtersCustomized,
    ready: filtersReady,
  } = useNeighborhoodFilters(initialRadius, null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [resultsState, setResultsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  const lat = location.status === 'ok' ? location.lat : null;
  const lng = location.status === 'ok' ? location.lng : null;

  // Create the map once a position is known.
  useEffect(() => {
    if (lat === null || lng === null || !container.current || mapRef.current) return;
    let cancelled = false;
    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
      const savedViewport = getMapViewport();
      skipFirstViewportAdjustmentRef.current = savedViewport !== null;
      const map = new maplibregl.Map({
        container: container.current,
        style: clientEnv.NEXT_PUBLIC_MAP_STYLE_URL,
        center: savedViewport ? [savedViewport.longitude, savedViewport.latitude] : [lng, lat],
        zoom: savedViewport?.zoom ?? zoomForRadius(radius),
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on('moveend', () => {
        const center = map.getCenter();
        setMapViewport({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() });
      });
      map.on('load', () => {
        map.addSource('radius', { type: 'geojson', data: circlePolygon(lat, lng, radius) });
        map.addLayer({
          id: 'radius-fill',
          type: 'fill',
          source: 'radius',
          paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.08 },
        });
        map.addLayer({
          id: 'radius-line',
          type: 'line',
          source: 'radius',
          paint: { 'line-color': '#2563eb', 'line-width': 2 },
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
            'circle-color': '#141a2c',
            'circle-stroke-color': '#2563eb',
            'circle-stroke-width': 2,
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
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
            'circle-radius': 9,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        });
        map.on('click', 'points', (e) => {
          const p = e.features?.[0]?.properties as Selected | undefined;
          if (p) setSelected({ id: p.id, category: p.category, caption: p.caption });
        });
        map.on('click', 'clusters', async (e) => {
          const feature = e.features?.[0];
          const source = map.getSource('videos') as GeoJSONSource;
          if (!feature) return;
          const zoom = await source.getClusterExpansionZoom(
            feature.properties.cluster_id as number,
          );
          map.easeTo({
            center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates,
            zoom,
          });
        });
        for (const layer of ['points', 'clusters']) {
          map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
        }
        markerRef.current = new maplibregl.Marker({ color: '#2563eb' })
          .setLngLat([lng, lat])
          .addTo(map);
        setLoaded(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, radius]);

  useEffect(() => () => mapRef.current?.remove(), []);

  // Data + radius overlay follow the position, radius and category filter.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !filtersReady || !map || lat === null || lng === null) return;
    setResultsState('loading');
    (map.getSource('radius') as GeoJSONSource).setData(circlePolygon(lat, lng, radius));
    markerRef.current?.setLngLat([lng, lat]);
    const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) });
    if (category) qs.set('category', category);
    let alive = true;
    void api<FC>(`/api/map?${qs}`)
      .then((res) => {
        if (!alive) return;
        if (!res.ok) {
          setResultsState('error');
          return;
        }
        (map.getSource('videos') as GeoJSONSource).setData(
          res.data as Parameters<GeoJSONSource['setData']>[0],
        );
        setCount(res.data.features.length);
        setResultsState('ready');
      })
      .catch(() => {
        if (alive) setResultsState('error');
      });
    return () => {
      alive = false;
    };
  }, [loaded, filtersReady, lat, lng, radius, category, retry]);

  function relocate() {
    void locate();
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || lat === null || lng === null) return;
    const previous = lastLocationRef.current;
    const locationChanged = previous !== null && (previous.lat !== lat || previous.lng !== lng);
    lastLocationRef.current = { lat, lng };

    if (skipFirstViewportAdjustmentRef.current) {
      skipFirstViewportAdjustmentRef.current = false;
      return;
    }

    map.flyTo({
      center: locationChanged ? [lng, lat] : map.getCenter(),
      zoom: zoomForRadius(radius),
    });
  }, [loaded, lat, lng, radius]);

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] w-full">
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

      <div ref={container} className="h-full w-full" role="region" aria-label={t('title')} />

      {(location.status === 'denied' || location.status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Notice kind="error">
            {location.status === 'denied' ? tf('location.denied') : tf('location.needed')}
          </Notice>
          <Button onClick={() => void locate()}>{tf('location.allow')}</Button>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <Button
          variant="secondary"
          className="rounded-full shadow-lg"
          onClick={() => setFiltersOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          aria-label={`${t('filters.button')}${category || radius !== initialRadius ? `, ${t('filters.active')}` : ''}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M7 12h10m-7 6h4" />
            <circle cx="8" cy="6" r="1.5" fill="currentColor" />
            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
            <circle cx="11" cy="18" r="1.5" fill="currentColor" />
          </svg>
          {t('filters.button')}
          {(category || radius !== initialRadius) && (
            <span className="ml-1 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          )}
        </Button>
        <p
          className="glass max-w-[55%] rounded-full px-3 py-2 text-right text-xs empty:hidden"
          role="status"
          aria-live="polite"
        >
          {resultsState === 'ready' && count !== null
            ? t('count', { count, radius: tc(`radius.${radius}`) })
            : resultsState === 'loading'
              ? t('loading', { radius: tc(`radius.${radius}`) })
              : null}
        </p>
      </div>

      <MapFiltersDialog
        open={filtersOpen}
        category={category}
        radius={radius}
        canReset={filtersCustomized}
        onCategoryChange={setCategory}
        onRadiusChange={setRadius}
        onReset={resetFilters}
        onClose={() => setFiltersOpen(false)}
      />

      {resultsState === 'error' && (
        <div
          role="alert"
          className="absolute inset-x-3 top-16 z-10 flex items-center justify-between gap-3 rounded-2xl border border-alert/50 bg-ink/95 p-3 shadow-xl"
        >
          <p className="text-sm">{t('loadError')}</p>
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={() => setRetry((value) => value + 1)}
          >
            {tc('actions.retry')}
          </Button>
        </div>
      )}

      <Button
        variant="secondary"
        className="absolute bottom-6 right-3 rounded-full"
        onClick={relocate}
        aria-label={t('locate')}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {t('locate')}
      </Button>
      <p className="absolute bottom-1 left-3 text-[10px] text-fog">{t('attribution')}</p>

      {selected && (
        <div
          className="glass absolute inset-x-3 bottom-20 flex items-start gap-3 rounded-3xl p-3 shadow-2xl shadow-black/40"
          role="dialog"
          aria-label={tc(`categories.${selected.category}`)}
        >
          <span
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS[selected.category] }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{tc(`categories.${selected.category}`)}</p>
            <p className="line-clamp-2 text-sm text-fog">{selected.caption}</p>
            <Link
              href={`/?video=${encodeURIComponent(selected.id)}&category=${selected.category}&radius=${radius}&fromMap=1`}
              className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-accent px-3 font-semibold text-ink"
            >
              {t('open')}
            </Link>
          </div>
          <button
            type="button"
            className="h-11 w-11 text-xl"
            aria-label={tc('actions.close')}
            onClick={() => setSelected(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
