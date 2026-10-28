'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { readSavedVideos, toggleSavedVideo, type SavedVideoRecord } from '@/lib/saved-videos';

export function SavedVideos() {
  const t = useTranslations('profile');
  const [videos, setVideos] = useState<SavedVideoRecord[]>(() => readSavedVideos());

  useEffect(() => {
    const handle = () => setVideos(readSavedVideos());
    window.addEventListener('storage', handle);
    window.addEventListener('nl-saved-videos-change', handle);
    return () => {
      window.removeEventListener('storage', handle);
      window.removeEventListener('nl-saved-videos-change', handle);
    };
  }, []);

  function removeSaved(id: string) {
    toggleSavedVideo(id);
    setVideos((current) => current.filter((video) => video.id !== id));
    window.dispatchEvent(new Event('nl-saved-videos-change'));
  }

  return (
    <section aria-labelledby="saved-videos" className="flex flex-col gap-3">
      <h2 id="saved-videos" className="text-lg font-semibold">
        {t('savedVideos')}
      </h2>
      {videos.length === 0 ? (
        <p className="text-fog">{t('emptySavedVideos')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {videos.map((video) => (
            <li
              key={video.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-panel"
            >
              <Link href={`/v/${video.id}`} className="block">
                {video.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed poster from feed
                  <img src={video.posterUrl} alt="" className="aspect-[9/16] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center bg-gradient-to-br from-accent/25 to-panel text-sm text-fog">
                    {video.category ?? 'Video'}
                  </div>
                )}
              </Link>
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-white">
                    {video.caption || video.authorName || `@${video.id}`}
                  </p>
                  {video.authorName && (
                    <p className="truncate text-xs text-fog">{video.authorName}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  className="min-h-0 px-2 py-1 text-xs"
                  onClick={() => removeSaved(video.id)}
                >
                  {t('removeSaved')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
