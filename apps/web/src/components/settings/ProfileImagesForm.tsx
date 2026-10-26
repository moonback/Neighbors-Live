'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Button, Card, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';
import { profileImageUrl } from '@/lib/profile-image';
import { browserClient } from '@/lib/supabase/browser';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function ProfileImagesForm({
  userId,
  username,
  avatarColor,
  avatarPath: initialAvatarPath,
  coverPath: initialCoverPath,
}: {
  userId: string;
  username: string;
  avatarColor: string;
  avatarPath: string | null;
  coverPath: string | null;
}) {
  const t = useTranslations('settings.profileImages');
  const ta = useTranslations('common.actions');
  const errorText = useErrorText();
  const router = useRouter();
  const avatarInput = useRef<HTMLInputElement>(null);
  const avatarCameraInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [coverPath, setCoverPath] = useState(initialCoverPath);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function upload(kind: 'avatar' | 'cover', file?: File) {
    if (!file) return;
    const extension = EXTENSION_BY_TYPE[file.type];
    if (!extension) {
      setStatus({ kind: 'error', text: t('unsupported') });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus({ kind: 'error', text: t('tooLarge') });
      return;
    }

    setStatus(null);
    setUploading(kind);
    const path = `${userId}/${kind}/${crypto.randomUUID()}.${extension}`;
    const supabase = browserClient();
    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });

    if (uploadError) {
      setStatus({ kind: 'error', text: errorText(uploadError.message) ?? t('uploadError') });
      setUploading(null);
      return;
    }

    const field = kind === 'avatar' ? 'avatarPath' : 'coverPath';
    const result = await api('/api/me/profile', { method: 'PATCH', body: { [field]: path } });
    if (!result.ok) {
      await supabase.storage.from('profile-images').remove([path]);
      setStatus({ kind: 'error', text: errorText(result.error) ?? t('uploadError') });
      setUploading(null);
      return;
    }

    if (kind === 'avatar') setAvatarPath(path);
    else setCoverPath(path);
    setStatus({ kind: 'success', text: t(kind === 'avatar' ? 'avatarSaved' : 'coverSaved') });
    setUploading(null);
    router.refresh();
  }

  async function remove(kind: 'avatar' | 'cover') {
    setStatus(null);
    setUploading(kind);
    const field = kind === 'avatar' ? 'avatarPath' : 'coverPath';
    const result = await api('/api/me/profile', { method: 'PATCH', body: { [field]: null } });
    if (!result.ok) {
      setStatus({ kind: 'error', text: errorText(result.error) ?? t('uploadError') });
    } else {
      if (kind === 'avatar') setAvatarPath(null);
      else setCoverPath(null);
      setStatus({ kind: 'success', text: t(kind === 'avatar' ? 'avatarRemoved' : 'coverRemoved') });
      router.refresh();
    }
    setUploading(null);
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <section className="flex items-center gap-4">
        <span className="rounded-full bg-accent p-1">
          <Avatar
            username={username}
            color={avatarColor}
            size={72}
            src={profileImageUrl(avatarPath)}
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <p className="font-medium">{t('avatar')}</p>
          <p className="text-xs text-fog">{t('avatarHint')}</p>
          <input
            ref={avatarInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={t('avatar')}
            onChange={(event) => {
              void upload('avatar', event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <input
            ref={avatarCameraInput}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            aria-label={t('takeAvatar')}
            onChange={(event) => {
              void upload('avatar', event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={uploading !== null}
              onClick={() => avatarInput.current?.click()}
            >
              {uploading === 'avatar' ? ta('loading') : t('chooseAvatar')}
            </Button>
            <Button
              variant="ghost"
              disabled={uploading !== null}
              onClick={() => avatarCameraInput.current?.click()}
            >
              {t('takeAvatar')}
            </Button>
          </div>
          {avatarPath && (
            <button
              type="button"
              className="min-h-11 text-sm text-fog underline"
              disabled={uploading !== null}
              onClick={() => void remove('avatar')}
            >
              {t('removeAvatar')}
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <p className="font-medium">{t('cover')}</p>
          <p className="text-xs text-fog">{t('coverHint')}</p>
        </div>
        <div className="relative aspect-[3/1] overflow-hidden rounded-2xl border border-line bg-ink">
          {coverPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- public profile image URL
            <img
              src={profileImageUrl(coverPath) ?? undefined}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-blue/20 via-accent/30 to-blue/10" />
          )}
        </div>
        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={t('cover')}
          onChange={(event) => {
            void upload('cover', event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={uploading !== null}
            onClick={() => coverInput.current?.click()}
          >
            {uploading === 'cover' ? ta('loading') : t('chooseCover')}
          </Button>
          {coverPath && (
            <Button
              variant="ghost"
              disabled={uploading !== null}
              onClick={() => void remove('cover')}
            >
              {t('removeCover')}
            </Button>
          )}
        </div>
      </section>
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
    </Card>
  );
}
