import { profileUpdateSchema } from '@nl/shared';
import { z } from 'zod';
import { json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { LOCALE_COOKIE } from '@/i18n/locales';
import { createClient } from '@/lib/supabase/server';

const schema = profileUpdateSchema
  .pick({ defaultRadius: true, locale: true, notifyAlerts: true })
  .extend({ onboarded: z.literal(true).optional() });

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, schema);
  const supabase = await createClient();
  const updated = unwrap(
    await supabase
      .from('user_settings')
      .update({
        ...(body.defaultRadius !== undefined && { default_radius: body.defaultRadius }),
        ...(body.locale !== undefined && { locale: body.locale }),
        ...(body.notifyAlerts !== undefined && { notify_alerts: body.notifyAlerts }),
        ...(body.onboarded && { onboarded_at: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('default_radius, locale, notify_alerts')
      .single(),
  );
  const res = json(updated);
  if (body.locale) {
    res.cookies.set(LOCALE_COOKIE, body.locale, {
      path: '/',
      maxAge: 31_536_000,
      sameSite: 'lax',
    });
  }
  return res;
});
