import { feedQuerySchema } from '@nl/shared';
import { json, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

const querySchema = feedQuerySchema.pick({ lat: true, lng: true, radius: true, category: true });

/** GeoJSON of active videos around a point (fuzzed positions), clustered client-side. */
export const GET = route(async (req) => {
  const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows = unwrap(
    await adminClient().rpc('map_videos', {
      p_lat: q.lat,
      p_lng: q.lng,
      p_radius_m: q.radius,
      p_category: q.category,
    }),
  );
  return json({
    type: 'FeatureCollection',
    features: (rows ?? []).map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: { type: 'Point', coordinates: [r.public_lng, r.public_lat] },
      properties: { id: r.id, category: r.category, caption: r.caption },
    })),
  });
});
