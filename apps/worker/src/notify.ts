import type { Pool } from 'pg';
import webpush from 'web-push';
import type { WorkerEnv } from './env.ts';

interface OutboxRow {
  id: number;
  kind: 'alert_nearby' | 'video_rejected' | 'video_removed' | 'moderation_warning';
  user_id: string | null;
  video_id: string | null;
  payload: { note?: string };
}

interface Target {
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Texts of system notifications (French UI; the payload stays small and position-free). */
export function alertMessage(captions: string[], videoIds: string[], site: string): PushMessage {
  const first = captions[0]?.trim() || 'Nouvelle alerte';
  return captions.length === 1
    ? {
        title: 'Alerte près de chez vous',
        body: first,
        url: `${site}/v/${videoIds[0]}`,
        tag: 'alerts',
      }
    : {
        title: `${captions.length} alertes près de chez vous`,
        body: `${first} et ${captions.length - 1} autre${captions.length > 2 ? 's' : ''}`,
        url: `${site}/?category=alert`,
        tag: 'alerts',
      };
}

export function noticeMessage(row: OutboxRow, site: string): PushMessage {
  switch (row.kind) {
    case 'video_rejected':
      return {
        title: 'Vidéo non publiée',
        body: 'Le traitement de votre vidéo a échoué. Vous pouvez la refilmer.',
        url: `${site}/me`,
        tag: 'video-status',
      };
    case 'video_removed':
      return {
        title: 'Vidéo retirée',
        body: 'Un modérateur a retiré votre vidéo. Vous pouvez contester la décision.',
        url: `${site}/me/decisions`,
        tag: 'moderation',
      };
    default:
      return {
        title: 'Avertissement de la modération',
        body: row.payload.note || 'Merci de relire les règles de la communauté.',
        url: `${site}/me/decisions`,
        tag: 'moderation',
      };
  }
}

export class Notifier {
  private readonly db: Pool;
  private readonly site: string;
  private readonly log: (msg: string, extra?: Record<string, unknown>) => void;

  constructor(
    db: Pool,
    env: WorkerEnv,
    log: (msg: string, extra?: Record<string, unknown>) => void,
  ) {
    this.db = db;
    this.site = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
    this.log = log;
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );
  }

  private async send(target: Target, message: PushMessage): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(message),
        { TTL: 3600, urgency: 'normal' },
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The browser dropped the subscription: forget it.
        await this.db.query('delete from public.push_subscriptions where id = $1', [
          target.subscription_id,
        ]);
      } else {
        this.log('push failed', { status, error: String(error) });
      }
    }
  }

  /** Drains one batch of the outbox. Alerts of the batch are grouped per user. */
  async drain(): Promise<number> {
    const { rows } = await this.db.query<OutboxRow>('select * from public.claim_outbox(200)');
    if (rows.length === 0) return 0;

    const alertIds = rows
      .filter((r) => r.kind === 'alert_nearby' && r.video_id)
      .map((r) => r.video_id as string);
    if (alertIds.length > 0) {
      const { rows: recipients } = await this.db.query<
        Target & { video_ids: string[]; captions: string[] }
      >('select * from public.claim_alert_recipients($1::uuid[])', [alertIds]);
      await Promise.all(
        recipients.map((r) => this.send(r, alertMessage(r.captions, r.video_ids, this.site))),
      );
      this.log('alerts pushed', { alerts: alertIds.length, devices: recipients.length });
    }

    for (const row of rows.filter((r) => r.kind !== 'alert_nearby' && r.user_id)) {
      const { rows: targets } = await this.db.query<Target>(
        'select * from public.user_push_targets($1)',
        [row.user_id],
      );
      await Promise.all(targets.map((t) => this.send(t, noticeMessage(row, this.site))));
    }
    return rows.length;
  }
}
