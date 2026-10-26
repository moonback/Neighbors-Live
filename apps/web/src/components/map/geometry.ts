/** GeoJSON polygon approximating a circle of `radiusM` around a point (for the radius overlay). */
export function circlePolygon(lat: number, lng: number, radiusM: number, steps = 64) {
  const coords: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([
      lng + (radiusM * Math.cos(a)) / (111_320 * Math.cos((lat * Math.PI) / 180)),
      lat + (radiusM * Math.sin(a)) / 110_540,
    ]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  };
}

/** Zoom level showing the whole radius on a phone screen. */
export const zoomForRadius = (radiusM: number): number =>
  radiusM <= 300
    ? 15.5
    : radiusM <= 1000
      ? 14
      : radiusM <= 3000
        ? 12.4
        : radiusM <= 5000
          ? 11.6
          : 10.6;
