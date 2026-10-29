import { sanitizeText } from '@nl/shared';
import { z } from 'zod';
import { ApiError, fromDbError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

function normalizeWebsite(value: string) {
  const trimmed = sanitizeText(value).trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizePhone(value: string) {
  const digits = sanitizeText(value)
    .replace(/[^\d+()\-\s.]/g, '')
    .trim();
  return digits.length > 30 ? digits.slice(0, 30) : digits;
}

const contactSchema = z.object({
  description: z.string().transform(sanitizeText).pipe(z.string().max(280)).default(''),
  website: z.string().transform(sanitizeText).pipe(z.string().max(200)).default(''),
  phone: z.string().transform(sanitizeText).pipe(z.string().max(30)).default(''),
  address: z.string().transform(sanitizeText).pipe(z.string().max(200)).default(''),
  openingHours: z.string().transform(sanitizeText).pipe(z.string().max(200)).default(''),
});

const schema = contactSchema.extend({
  businessName: z.string().transform(sanitizeText).pipe(z.string().min(2).max(80)),
});

function contactColumns(input: z.infer<typeof contactSchema>) {
  const website = normalizeWebsite(input.website);
  if (website && !/^https?:\/\//i.test(website)) throw new ApiError('invalid_website', 422);
  if (website) {
    try {
      new URL(website);
    } catch {
      throw new ApiError('invalid_website', 422);
    }
  }
  return {
    description: input.description,
    website,
    phone: normalizePhone(input.phone),
    address: sanitizeText(input.address).trim(),
    opening_hours: sanitizeText(input.openingHours).trim(),
  };
}

/** Merchant application (pending until an admin approves it). */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, schema);
  const columns = contactColumns(body);
  const supabase = await createClient();
  const res = await supabase
    .from('merchant_profiles')
    .insert({ user_id: user.id, business_name: body.businessName, ...columns });
  if (res.error?.code === '23505') throw new ApiError('conflict', 409);
  unwrap(res);
  return json({ status: 'pending' }, 201);
});

/** Approved merchant edits description and contacts; the name stays as reviewed by an admin. */
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const columns = contactColumns(await parseBody(req, contactSchema));
  const supabase = await createClient();
  const { data: merchant, error } = await supabase
    .from('merchant_profiles')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (merchant?.status !== 'approved') throw new ApiError('forbidden', 403);
  unwrap(await supabase.from('merchant_profiles').update(columns).eq('user_id', user.id));
  return json({ status: 'approved' });
});
