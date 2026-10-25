import { pushSubscribeSchema, zoneCell, zoneCenter } from '@nl/shared';
import { z } from 'zod';
import { json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Subscribes this browser to alerts for a zone. The submitted position is only used to pick the
 * H3 cell; what is stored is the cell and its centre, never the device position.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { subscription, zone, radius } = await parseBody(req, pushSubscribeSchema);
  const cell = zoneCell(zone);
  const center = zoneCenter(cell);
  // One row per browser endpoint: a browser previously used by another account is re-assigned.
  await adminClient().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  const supabase = await createClient();
  unwrap(
    await supabase.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      zone_cell: cell,
      zone_center: `SRID=4326;POINT(${center.lng} ${center.lat})`,
      radius_m: radius,
    }),
  );
  return json({ zoneCell: cell }, 201);
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.url() }));
  const supabase = await createClient();
  unwrap(
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint),
  );
  return json({ ok: true });
});
