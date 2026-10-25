import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/session';

export default async function MePage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/me');
  if (!viewer.username) redirect('/bienvenue?next=/me');
  redirect(`/u/${viewer.username}`);
}
