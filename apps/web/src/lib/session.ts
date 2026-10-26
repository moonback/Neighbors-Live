import { cache } from 'react';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface Viewer {
  id: string;
  email: string | undefined;
  username: string | null;
  bio: string;
  avatarColor: string;
  avatarPath: string | null;
  coverPath: string | null;
  role: 'user' | 'merchant' | 'admin';
  reputation: number;
  banned: boolean;
  isModerator: boolean;
  moderatedCells: string[];
  settings: { defaultRadius: number; locale: string; notifyAlerts: boolean; onboarded: boolean };
}

/** The verified signed-in user with profile, settings and roles (deduplicated per request). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const admin = adminClient();
  const [profile, settings, zones] = await Promise.all([
    admin
      .from('profiles')
      .select('username, bio, avatar_color, avatar_path, cover_path, role, reputation, banned_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_settings')
      .select('default_radius, locale, notify_alerts, onboarded_at')
      .eq('user_id', user.id)
      .single(),
    admin.from('zone_moderators').select('h3_cell').eq('user_id', user.id),
  ]);
  if (!profile.data) return null;
  const cells = (zones.data ?? []).map((z) => z.h3_cell);
  return {
    id: user.id,
    email: user.email,
    username: profile.data.username,
    bio: profile.data.bio,
    avatarColor: profile.data.avatar_color,
    avatarPath: profile.data.avatar_path,
    coverPath: profile.data.cover_path,
    role: profile.data.role,
    reputation: profile.data.reputation,
    banned: profile.data.banned_at !== null,
    isModerator: cells.length > 0 || profile.data.role === 'admin',
    moderatedCells: cells,
    settings: {
      defaultRadius: settings.data?.default_radius ?? 1000,
      locale: settings.data?.locale ?? 'fr',
      notifyAlerts: settings.data?.notify_alerts ?? true,
      onboarded: Boolean(settings.data?.onboarded_at),
    },
  };
});
