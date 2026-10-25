import { json, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

/** GDPR export (art. 15/20): everything we hold about the user, including their own positions. */
export const GET = route(async () => {
  const user = await requireUser();
  const data = unwrap(await adminClient().rpc('export_my_data', { p_user: user.id }));
  const date = new Date().toISOString().slice(0, 10);
  return json({ ...((data as object) ?? {}), email: user.email }, 200, {
    'Content-Disposition': `attachment; filename="neighbors-live-export-${date}.json"`,
  });
});
