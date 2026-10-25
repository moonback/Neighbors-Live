'use client';

import { useTranslations } from 'next-intl';

/** Maps an API error code to a translated sentence (falls back to the generic message). */
export function useErrorText() {
  const t = useTranslations('common.errors');
  return (code: string | null | undefined) => {
    if (!code) return null;
    return t.has(code) ? t(code) : t('generic');
  };
}
