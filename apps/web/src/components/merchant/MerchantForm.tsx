'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

export function MerchantForm() {
  const t = useTranslations('merchant');
  const errorText = useErrorText();
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api('/api/merchant', {
      body: { businessName, description, website, phone, address },
    });
    if (!res.ok) return setError(errorText(res.error));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
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
      {error && <Notice kind="error">{error}</Notice>}
      <Button type="submit" disabled={businessName.trim().length < 2}>
        {t('submit')}
      </Button>
    </form>
  );
}
