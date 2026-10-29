'use client';

import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';
import type { MerchantDashboard as Dashboard, MerchantVideoStats } from '@/lib/merchant-dashboard';

const MEASURED = ['views', 'offerClicks', 'callClicks', 'directionsClicks'] as const;

/** Approved merchant's offers. Only recorded numbers are shown; null means "not measured". */
export function MerchantDashboard({ initial }: { initial: Dashboard }) {
  const t = useTranslations('merchant');
  const tv = useTranslations('video');
  const tp = useTranslations('profile');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const errorText = useErrorText();
  const [data, setData] = useState(initial);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const { quota, totals, videos } = data;

  const measuredLabel: Record<(typeof MEASURED)[number], string> = {
    views: t('dashboard.views'),
    offerClicks: tv('offerView'),
    callClicks: tv('callBusiness'),
    directionsClicks: tv('directions'),
  };

  async function withdraw(id: string) {
    if (!window.confirm(tp('withdrawConfirm'))) return;
    const res = await api(`/api/videos/${id}`, { method: 'DELETE', body: {} });
    if (!res.ok) return setMessage({ kind: 'error', text: errorText(res.error) ?? '' });
    const next = await api<Dashboard>('/api/merchant/dashboard');
    if (next.ok) setData(next.data);
    setMessage(
      next.ok
        ? { kind: 'success', text: tp('withdrawn') }
        : { kind: 'error', text: t('dashboard.loadError') },
    );
  }

  function offerLine(v: MerchantVideoStats) {
    if (!v.offerStatus) return null;
    return v.offerStatus === 'valid'
      ? tv('offerStatus.valid', {
          when: format.dateTime(new Date(v.expiresAt), { dateStyle: 'medium', timeStyle: 'short' }),
        })
      : tv(`offerStatus.${v.offerStatus}`);
  }

  return (
    <section aria-labelledby="merchant-dashboard" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="merchant-dashboard" className="text-lg font-semibold">
            {t('dashboard.title')}
          </h2>
          <p className="mt-1 text-sm text-fog">{t('dashboard.description')}</p>
          <p className="mt-1 text-sm">{t('quota', quota)}</p>
        </div>
        {quota.used < quota.quota ? (
          <Link
            href="/filmer?category=shop"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-ink"
          >
            {t('dashboard.prepare')}
          </Link>
        ) : (
          <p className="text-sm text-fog">{t('dashboard.quotaReached')}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(['active', 'expired', 'useful', 'comments', 'saves'] as const).map((key) => (
          <div key={key} className="rounded-xl border border-line bg-panel p-3">
            <dt className="text-xs text-fog">{t(`dashboard.totals.${key}`)}</dt>
            <dd className="text-xl font-bold">{format.number(totals[key])}</dd>
          </div>
        ))}
      </dl>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {videos.length === 0 && <p className="text-sm text-fog">{t('dashboard.empty')}</p>}

      <ul className="flex flex-col gap-2" aria-live="polite">
        {videos.map((v) => {
          const unmeasured = MEASURED.every((k) => v[k] === null);
          return (
            <li
              key={v.id}
              data-testid="merchant-offer"
              data-status={v.status}
              className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{v.caption || '—'}</p>
                  {v.offerTerms && <p className="text-sm text-fog">{v.offerTerms}</p>}
                  <p className="text-xs text-fog">
                    {tp(`status.${v.status}`)} · {format.relativeTime(new Date(v.createdAt), now)}
                    {offerLine(v) && <> · {offerLine(v)}</>}
                  </p>
                </div>
                {v.status !== 'removed' && (
                  <Button variant="ghost" className="text-sm" onClick={() => withdraw(v.id)}>
                    {tp('withdraw')}
                  </Button>
                )}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <li>
                  {t('dashboard.totals.useful')} : {format.number(v.useful)}
                </li>
                <li>
                  {t('dashboard.totals.comments')} : {format.number(v.comments)}
                </li>
                <li>
                  {t('dashboard.totals.saves')} : {format.number(v.saves)}
                </li>
                {unmeasured ? (
                  <li className="text-fog">
                    {t('dashboard.views')} : {t('dashboard.statsUnavailable')}
                  </li>
                ) : (
                  MEASURED.map((k) => (
                    <li key={k}>
                      {measuredLabel[k]} :{' '}
                      {v[k] === null ? t('dashboard.statsUnavailable') : format.number(v[k])}
                    </li>
                  ))
                )}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-fog">{t('dashboard.noPurchases')}</p>
    </section>
  );
}
