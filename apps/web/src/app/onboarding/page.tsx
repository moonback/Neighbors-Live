import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { safeNext } from '@/lib/redirect';
import { getViewer } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('onboarding'))('value.title') };
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; step?: string }>;
}) {
  const { next, step } = await searchParams;
  const viewer = await getViewer();
  return (
    <Onboarding
      next={safeNext(next)}
      signedIn={Boolean(viewer)}
      initialStep={step === 'install' ? 2 : 0}
    />
  );
}
