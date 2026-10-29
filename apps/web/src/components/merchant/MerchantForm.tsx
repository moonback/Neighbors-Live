'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

export interface MerchantContact {
  description: string;
  website: string;
  phone: string;
  address: string;
  openingHours: string;
}

/** Application form, or contact edition for an approved merchant when `initial` is given. */
export function MerchantForm({ initial }: { initial?: MerchantContact }) {
  const t = useTranslations('merchant');
  const errorText = useErrorText();
  const router = useRouter();
  const editing = initial !== undefined;
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [openingHours, setOpeningHours] = useState(initial?.openingHours ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const contact = { description, website, phone, address, openingHours };
    const res = await api('/api/merchant', {
      ...(editing && { method: 'PATCH' }),
      body: editing ? contact : { businessName, ...contact },
    });
    if (!res.ok) return setError(errorText(res.error));
    setError(null);
    if (editing) setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {!editing && (
        <Field label={t('businessName')} htmlFor="m-name">
          <input
            id="m-name"
            className={inputClass}
            maxLength={80}
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </Field>
      )}
      <Field label={t('description')} htmlFor="m-desc">
        <textarea
          id="m-desc"
          className={`${inputClass} min-h-20`}
          maxLength={280}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('website')} htmlFor="m-website">
          <input
            id="m-website"
            type="url"
            className={inputClass}
            value={website}
            placeholder="https://"
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
        <Field label={t('phone')} htmlFor="m-phone">
          <input
            id="m-phone"
            className={inputClass}
            value={phone}
            maxLength={30}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>
      <Field label={t('address')} htmlFor="m-address">
        <input
          id="m-address"
          className={inputClass}
          value={address}
          maxLength={200}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>
      <Field label={t('openingHours')} htmlFor="m-hours">
        <input
          id="m-hours"
          className={inputClass}
          value={openingHours}
          maxLength={200}
          placeholder={t('openingHoursPlaceholder')}
          onChange={(e) => setOpeningHours(e.target.value)}
        />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      {saved && <Notice kind="success">{t('edit.saved')}</Notice>}
      <Button type="submit" disabled={!editing && businessName.trim().length < 2}>
        {editing ? t('edit.submit') : t('submit')}
      </Button>
    </form>
  );
}
