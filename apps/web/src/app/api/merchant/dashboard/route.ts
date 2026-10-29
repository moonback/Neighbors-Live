import { ApiError, fromDbError, json, requireUser, route } from '@/lib/api';
import { loadMerchantDashboard } from '@/lib/merchant-dashboard.server';
import { createClient } from '@/lib/supabase/server';

/** Approved merchant's own offers with measured counters only (null = not measured). */
export const GET = route(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: merchant, error } = await supabase
    .from('merchant_profiles')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (merchant?.status !== 'approved') throw new ApiError('forbidden', 403);
  return json(await loadMerchantDashboard(user.id));
});
