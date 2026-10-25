import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MapView } from '@/components/map/MapView';
import { getViewer } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('map'))('title') };
}

export default async function MapPage() {
  const viewer = await getViewer();
  return <MapView initialRadius={viewer?.settings.defaultRadius ?? 1000} />;
}
