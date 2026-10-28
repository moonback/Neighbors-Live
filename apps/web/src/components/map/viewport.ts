export interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

let viewport: MapViewport | null = null;

export function getMapViewport(): MapViewport | null {
  return viewport;
}

export function setMapViewport(next: MapViewport | null): void {
  viewport = next;
}
