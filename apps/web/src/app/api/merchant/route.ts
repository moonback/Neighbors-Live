import { sanitizeText } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
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

const schema = z.object({
  businessName: z.string().transform(sanitizeText).pipe(z.string().min(2).max(80)),
  description: z.string().transform(sanitizeText).pipe(z.string().max(280)).default(''),
  website: z.string().transform(sanitizeText).pipe(z.string().max(200)).default(''),
  phone: z.string().transform(sanitizeText).pipe(z.string().max(30)).default(''),
  address: z.string().transform(sanitizeText).pipe(z.string().max(200)).default(''),
  openingHours: z.string().transform(sanitizeText).pipe(z.string().max(200)).default(''),
});

/** Merchant application (pending until an admin approves it). */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { businessName, description, website, phone, address, openingHours } = await parseBody(
    req,
    schema,
  );
  const normalizedWebsite = normalizeWebsite(website);
  const normalizedPhone = normalizePhone(phone);
  const normalizedAddress = sanitizeText(address).trim();
  const normalizedOpeningHours = sanitizeText(openingHours).trim();
  if (normalizedWebsite && !/^https?:\/\//i.test(normalizedWebsite)) {
    throw new ApiError('invalid_website', 422);
  }
  if (normalizedWebsite) {
    try {
      new URL(normalizedWebsite);
    } catch {
      throw new ApiError('invalid_website', 422);
    }
  }
  const supabase = await createClient();
  const res = await supabase.from('merchant_profiles').insert({
    user_id: user.id,
    business_name: businessName,
    description,
    website: normalizedWebsite,
    phone: normalizedPhone,
    address: normalizedAddress,
    opening_hours: normalizedOpeningHours,
  });
  if (res.error?.code === '23505') throw new ApiError('conflict', 409);
  unwrap(res);
  return json({ status: 'pending' }, 201);
});
