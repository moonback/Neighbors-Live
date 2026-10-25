'use client';

import { useCallback, useEffect, useState } from 'react';
import { currentPosition } from '@/lib/platform';

export type LocationState =
  | { status: 'unknown' }
  | { status: 'primer' }
  | { status: 'locating' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'error' };

const PRIMED_KEY = 'nl-location-primed';

function readPrimed(): boolean {
  try {
    return localStorage.getItem(PRIMED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Viewer position for feed/map queries. The explanation screen is shown before the first
 * system prompt; afterwards the position is re-read on each visit. Nothing is persisted.
 * `?lat=&lng=` overrides it (manual exploration, demos and tests).
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: 'unknown' });

  const locate = useCallback(async () => {
    setState({ status: 'locating' });
    try {
      localStorage.setItem(PRIMED_KEY, '1');
    } catch {
      /* private mode: the primer will simply show again next time */
    }
    try {
      const pos = await currentPosition();
      setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e) {
      setState({ status: (e as GeolocationPositionError).code === 1 ? 'denied' : 'error' });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (params.has('lat') && Number.isFinite(lat) && Number.isFinite(lng)) {
        setState({ status: 'ok', lat, lng });
      } else if (readPrimed()) {
        void locate();
      } else {
        setState({ status: 'primer' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locate]);

  return { state, locate, dismiss: () => setState({ status: 'error' }) };
}
