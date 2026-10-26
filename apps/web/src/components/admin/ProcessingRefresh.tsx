'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Refreshes the server-rendered queue while the admin is watching it. */
export function ProcessingRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
