'use client';

import { SerwistProvider, useSerwist } from '@serwist/turbopack/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Registers the service worker (scope "/") and renders update / offline banners. */
export function PwaShell({ children, disable }: { children: ReactNode; disable: boolean }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={disable}
      options={{ scope: '/' }}
      reloadOnOnline={false}
    >
      {children}
      <UpdateBanner />
      <OfflineBanner />
    </SerwistProvider>
  );
}

function UpdateBanner() {
  const t = useTranslations('common.update');
  const { serwist } = useSerwist();
  const [waiting, setWaiting] = useState(false);
  const accepted = useRef(false);
  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setWaiting(true);
    // Reload only after the user accepted an update, not on the very first install.
    const onControlling = () => {
      if (accepted.current) window.location.reload();
    };
    serwist.addEventListener('waiting', onWaiting);
    serwist.addEventListener('controlling', onControlling);
    return () => {
      serwist.removeEventListener('waiting', onWaiting);
      serwist.removeEventListener('controlling', onControlling);
    };
  }, [serwist]);
  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-24 z-50 flex items-center gap-3 rounded-xl border border-line bg-panel p-3 shadow-xl"
    >
      <p className="flex-1 text-sm">{t('available')}</p>
      <button
        type="button"
        onClick={() => {
          accepted.current = true;
          serwist?.messageSkipWaiting();
        }}
        className="min-h-11 rounded-xl bg-accent px-3 font-semibold text-ink"
      >
        {t('reload')}
      </button>
    </div>
  );
}

function OfflineBanner() {
  const t = useTranslations('common.offline');
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const timer = setTimeout(update, 0);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-3 py-1.5 text-center text-sm font-semibold text-ink"
    >
      {t('banner')}
    </p>
  );
}
