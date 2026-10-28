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
  author: { username: string | null; avatar_color: string; avatar_url: string | null } | null;
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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    void api<Page>(`/api/videos/${videoId}/comments`).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setComments(res.data.comments);
        setNext(res.data.nextBefore);
      } else {
        setError(errorText(res.error));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [errorText, reloadKey, videoId]);

  async function more() {
    if (!videoId || !next || loadingMore) return;
    setLoadingMore(true);
    const res = await api<Page>(
      `/api/videos/${videoId}/comments?before=${encodeURIComponent(next)}`,
    );
    if (res.ok) {
      setComments((c) => [...c, ...res.data.comments]);
      setNext(res.data.nextBefore);
    } else setError(errorText(res.error));
    setLoadingMore(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!videoId || !body.trim() || sending) return;
    setError(null);
    setSending(true);
    const res = await api<Comment>(`/api/videos/${videoId}/comments`, { body: { body } });
    if (!res.ok) setError(errorText(res.error));
    else {
      setComments((c) => [res.data, ...c]);
      setBody('');
    }
    setSending(false);
  }

  async function remove(id: string) {
    if (removing) return;
    setError(null);
    setRemoving(id);
    const res = await api(`/api/comments/${id}`, { method: 'DELETE', body: {} });
    if (res.ok) setComments((c) => c.filter((x) => x.id !== id));
    else setError(errorText(res.error));
    setRemoving(null);
  }

  return (
    <Sheet
      open={videoId !== null}
      title={t('title')}
      onClose={onClose}
      closeLabel={tc('close')}
      position="bottom"
    >
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
            <Button type="submit" disabled={!body.trim() || sending}>
              {sending ? tc('loading') : t('send')}
            </Button>
          </form>
        ) : (
          <Notice>{t('login')}</Notice>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        {error && comments.length === 0 && !loading && (
          <Button
            variant="ghost"
            onClick={() => {
              setLoading(true);
              setError(null);
              setComments([]);
              setNext(null);
              setReloadKey((key) => key + 1);
            }}
          >
            {tc('retry')}
          </Button>
        )}
        {loading ? (
          <p role="status" className="text-fog">
            {tc('loading')}
          </p>
        ) : comments.length === 0 && !error ? (
          <p className="text-fog">{t('empty')}</p>
        ) : comments.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar
                  username={c.author?.username ?? null}
                  color={c.author?.avatar_color ?? '#64748b'}
                  size={32}
                  src={c.author?.avatar_url}
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
                    className="min-h-11 self-start rounded-lg px-2 text-xs text-fog underline"
                    disabled={removing === c.id}
                    onClick={() => void remove(c.id)}
                  >
                    {removing === c.id ? tc('loading') : t('delete')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {next && (
          <Button variant="ghost" disabled={loadingMore} onClick={() => void more()}>
            {loadingMore ? tc('loading') : t('more')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
