import { cellToLatLng, getHexagonEdgeLengthAvg, gridDisk, latLngToCell, UNITS } from 'h3-js';
import { H3_REALTIME_RES, H3_ZONE_RES } from './constants.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isPlausiblePosition({ lat, lng }: LatLng): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // (0,0) is the classic "no fix" value returned by broken GPS stacks.
  return !(Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6);
}

/** Rejects moves faster than `maxSpeedMps` (default ~250 km/h) between two publications. */
export function isPlausibleMove(
  prev: LatLng & { at: Date },
  next: LatLng & { at: Date },
  maxSpeedMps = 70,
): boolean {
  const seconds = Math.max(1, (next.at.getTime() - prev.at.getTime()) / 1000);
  return haversineMeters(prev, next) / seconds <= maxSpeedMps;
}

export const zoneCell = ({ lat, lng }: LatLng): string => latLngToCell(lat, lng, H3_ZONE_RES);

export function zoneCenter(cell: string): LatLng {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/** Realtime topic cells (res 7) whose union covers a disk of `radiusM` around the point. */
export function realtimeCells({ lat, lng }: LatLng, radiusM: number): string[] {
  const edge = getHexagonEdgeLengthAvg(H3_REALTIME_RES, UNITS.m);
  const k = Math.ceil(radiusM / (edge * 1.5)) + 1;
  return gridDisk(latLngToCell(lat, lng, H3_REALTIME_RES), k);
}

export const realtimeCell = ({ lat, lng }: LatLng): string =>
  latLngToCell(lat, lng, H3_REALTIME_RES);

/** Public distances are bucketed to 100 m so they cannot be used to trilaterate a video. */
export const bucketDistance = (meters: number): number =>
  Math.max(100, Math.round(meters / 100) * 100);
