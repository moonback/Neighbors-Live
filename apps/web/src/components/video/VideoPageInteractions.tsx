'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Comments } from '@/components/feed/Comments';
import type { FeedItem } from '@/lib/feed';
import { api } from '@/lib/client-api';

export function VideoPageInteractions({
  item,
  signedIn,
  creatorHref,
}: {
  item: FeedItem;
  signedIn: boolean;
  creatorHref: string;
}) {
  const t = useTranslations('video');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [useful, setUseful] = useState({ reacted: item.reacted, count: item.usefulCount });
  const [usefulPending, setUsefulPending] = useState(false);

  async function toggleUseful() {
    if (!signedIn || usefulPending) return;
    setUsefulPending(true);
    const res = await api<{ reacted: boolean; usefulCount: number }>(
      `/api/videos/${item.id}/useful`,
      { method: useful.reacted ? 'DELETE' : 'POST', body: {} },
    );
    if (res.ok) {
      setUseful({ reacted: res.data.reacted, count: res.data.usefulCount });
    } else {
      setToast(t('usefulError'));
      window.setTimeout(() => setToast(null), 3000);
    }
    setUsefulPending(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast(t('shared'));
      window.setTimeout(() => setToast(null), 2000);
    } catch {
      setToast(t('shareError'));
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  function shareTo(platform: 'facebook' | 'whatsapp' | 'x') {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(item.caption);
    const destinations = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    };
    window.open(destinations[platform], '_blank', 'noopener,noreferrer');
  }

  async function share() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: item.caption, url: window.location.href });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setToast(t('shareError'));
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="mt-auto">
      <div className="flex items-center gap-5 border-y border-white/10 py-4">
        <button
          type="button"
          onClick={() => void toggleUseful()}
          disabled={!signedIn || usefulPending}
          aria-pressed={useful.reacted}
          aria-label={t(useful.reacted ? 'removeUseful' : 'markUseful')}
          title={!signedIn ? t('publicPage.signInToReact') : undefined}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${useful.reacted ? 'text-emerald-400' : ''}`}
            fill={useful.reacted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 11h10a3 3 0 0 0 2.9-2.2l2-7A3 3 0 0 0 19 8h-5l.8-3.1A2.4 2.4 0 0 0 12.5 2L7 10" />
          </svg>
          {useful.count}
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
          </svg>
          {item.commentCount}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.7 10.7 6.6-4.4m-6.6 9.4 6.6 2.6" />
          </svg>
          {t('share')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 py-3">
        <button
          type="button"
          onClick={() => shareTo('facebook')}
          aria-label="Facebook"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold"
        >
          f
        </button>
        <button
          type="button"
          onClick={() => shareTo('whatsapp')}
          aria-label="WhatsApp"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold"
        >
          WA
        </button>
        <button
          type="button"
          onClick={() => shareTo('x')}
          aria-label="X"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold"
        >
          X
        </button>
        <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <label className="sr-only" htmlFor="public-video-link">
            {t('publicPage.shareLink')}
          </label>
          <input
            id="public-video-link"
            readOnly
            value={`/v/${item.id}`}
            className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-fog sm:w-40 sm:flex-none"
          />
          <button
            type="button"
            onClick={() => void copyLink()}
            className="min-h-10 shrink-0 rounded-full border border-white/15 px-4 text-sm font-semibold transition-colors hover:bg-white/10"
          >
            {t('publicPage.copyLink')}
          </button>
        </div>
      </div>

      <nav aria-label={t('publicPage.contentTabs')} className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="min-h-12 border-b-2 border-white px-3 text-sm font-semibold"
        >
          {t('publicPage.comments', { count: item.commentCount })}
        </button>
        <Link
          href={creatorHref}
          className="inline-flex min-h-12 items-center px-3 text-sm text-fog hover:text-white"
        >
          {t('publicPage.creatorVideos')}
        </Link>
      </nav>
      <section aria-label={t('publicPage.commentsSection')} className="pt-4">
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="flex min-h-11 w-full items-center rounded-full bg-white/[0.07] px-4 text-left text-sm text-fog"
        >
          {t('commentsPanel.placeholder')}
        </button>
      </section>
      {toast && (
        <p role="status" className="mt-3 text-center text-sm text-fog">
          {toast}
        </p>
      )}
      <Comments
        videoId={commentsOpen ? item.id : null}
        signedIn={signedIn}
        onClose={() => setCommentsOpen(false)}
      />
    </div>
  );
}
