'use client';

import { COMMENT_MAX } from '@nl/shared';
import { useFormatter, useTranslations, useNow } from 'next-intl';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Button, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';
import { Sheet } from './Sheet';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  author: { username: string | null; avatar_color: string } | null;
}

interface Page {
  comments: Comment[];
  nextBefore: string | null;
}

export function Comments({
  videoId,
  signedIn,
  onClose,
}: {
  videoId: string | null;
  signedIn: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('video.commentsPanel');
  const tc = useTranslations('common.actions');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const errorText = useErrorText();
  const [comments, setComments] = useState<Comment[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    void api<Page>(`/api/videos/${videoId}/comments`).then((res) => {
      if (!alive || !res.ok) return;
      setComments(res.data.comments);
      setNext(res.data.nextBefore);
    });
    return () => {
      alive = false;
    };
  }, [videoId]);

  async function more() {
    if (!videoId || !next) return;
    const res = await api<Page>(
      `/api/videos/${videoId}/comments?before=${encodeURIComponent(next)}`,
    );
    if (res.ok) {
      setComments((c) => [...c, ...res.data.comments]);
      setNext(res.data.nextBefore);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!videoId || !body.trim()) return;
    setError(null);
    const res = await api<Comment>(`/api/videos/${videoId}/comments`, { body: { body } });
    if (!res.ok) return setError(errorText(res.error));
    setComments((c) => [res.data, ...c]);
    setBody('');
  }

  async function remove(id: string) {
    const res = await api(`/api/comments/${id}`, { method: 'DELETE', body: {} });
    if (res.ok) setComments((c) => c.filter((x) => x.id !== id));
  }

  return (
    <Sheet open={videoId !== null} title={t('title')} onClose={onClose} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        {signedIn ? (
          <form onSubmit={send} className="flex gap-2">
            <label htmlFor="comment-body" className="sr-only">
              {t('placeholder')}
            </label>
            <input
              id="comment-body"
              className={inputClass}
              maxLength={COMMENT_MAX}
              placeholder={t('placeholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <Button type="submit" disabled={!body.trim()}>
              {t('send')}
            </Button>
          </form>
        ) : (
          <Notice>{t('login')}</Notice>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        {comments.length === 0 ? (
          <p className="text-fog">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar
                  username={c.author?.username ?? null}
                  color={c.author?.avatar_color ?? '#64748b'}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fog">
                    @{c.author?.username} · {format.relativeTime(new Date(c.created_at), now)}
                  </p>
                  <p className="whitespace-pre-line break-words">{c.body}</p>
                </div>
                {c.mine && (
                  <button
                    type="button"
                    className="self-start text-xs text-fog underline"
                    onClick={() => remove(c.id)}
                  >
                    {t('delete')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {next && (
          <Button variant="ghost" onClick={more}>
            {t('more')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
