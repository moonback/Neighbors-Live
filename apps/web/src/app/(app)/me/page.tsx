import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/session';

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [viewer, { tab }] = await Promise.all([getViewer(), searchParams]);
  if (!viewer) redirect('/login?next=/me');
  if (!viewer.username) redirect('/bienvenue?next=/me');
  // The profile page validates the tab against its own allowlist.
  redirect(`/u/${viewer.username}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`);
}
