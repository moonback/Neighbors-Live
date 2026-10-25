import { sanitizeText } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  businessName: z.string().transform(sanitizeText).pipe(z.string().min(2).max(80)),
  description: z.string().transform(sanitizeText).pipe(z.string().max(280)).default(''),
});

/** Merchant application (pending until an admin approves it). */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { businessName, description } = await parseBody(req, schema);
  const supabase = await createClient();
  const res = await supabase
    .from('merchant_profiles')
    .insert({ user_id: user.id, business_name: businessName, description });
  if (res.error?.code === '23505') throw new ApiError('conflict', 409);
  unwrap(res);
  return json({ status: 'pending' }, 201);
});
