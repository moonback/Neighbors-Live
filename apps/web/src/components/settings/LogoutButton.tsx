'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { api } from '@/lib/client-api';

export function LogoutButton() {
  const t = useTranslations('auth');
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await api('/api/auth/logout', { method: 'POST', body: {} });
        router.replace('/');
        router.refresh();
      }}
    >
      {t('logout')}
    </Button>
  );
}
