// Kept free of h3-js so client bundles that only need schemas do not ship it.

export interface LatLng {
  lat: number;
  lng: number;
}

export function isPlausiblePosition({ lat, lng }: LatLng): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // (0,0) is the classic "no fix" value returned by broken GPS stacks.
  return !(Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6);
}
