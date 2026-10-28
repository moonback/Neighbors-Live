import { beforeEach, describe, expect, it } from 'vitest';
import { getMapViewport, setMapViewport } from './viewport';

describe('in-memory map viewport', () => {
  beforeEach(() => setMapViewport(null));

  it('keeps the most recent view available during client navigation', () => {
    const viewport = { latitude: 48.8566, longitude: 2.3522, zoom: 13 };

    setMapViewport(viewport);

    expect(getMapViewport()).toEqual(viewport);
  });

  it('does not persist a viewport when the map has not been visited', () => {
    expect(getMapViewport()).toBeNull();
  });

  it('can clear the view after the user resets the map session', () => {
    setMapViewport({ latitude: 48, longitude: 2, zoom: 11 });

    setMapViewport(null);

    expect(getMapViewport()).toBeNull();
  });
});
