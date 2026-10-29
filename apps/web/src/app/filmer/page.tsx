import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CaptureFlow } from '@/components/capture/CaptureFlow';
import { getViewer } from '@/lib/session';
import { adminClient } from '@/lib/supabase/admin';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('capture'))('title') };
}

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/filmer');
  if (!viewer.username) redirect('/bienvenue?next=/filmer');
  const { data: merchant } = await adminClient()
    .from('merchant_profiles')
    .select('status')
    .eq('user_id', viewer.id)
    .maybeSingle();
  const isMerchant = merchant?.status === 'approved';
  const { category } = await searchParams;
  return (
    <main id="main">
      <CaptureFlow
        isMerchant={isMerchant}
        initialCategory={isMerchant && category === 'shop' ? 'shop' : 'alert'}
      />
    </main>
  );
}
