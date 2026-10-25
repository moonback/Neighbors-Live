import { z } from 'zod';
import {
  BIO_MAX,
  CAPTION_MAX,
  CATEGORIES,
  COMMENT_MAX,
  MAX_ACCURACY_M,
  MAX_RECORDING_MS,
  MAX_UPLOAD_BYTES,
  MERCHANT_DURATIONS_H,
  MODERATION_ACTIONS,
  RADII_M,
  REPORT_REASONS,
} from './constants.ts';
import { isPlausiblePosition } from './geo.ts';
import { sanitizeText } from './text.ts';

const cleanText = (max: number) => z.string().transform(sanitizeText).pipe(z.string().max(max));

export const categorySchema = z.enum(CATEGORIES);
export const radiusSchema = z.coerce
  .number()
  .int()
  .refine((r): r is (typeof RADII_M)[number] => (RADII_M as readonly number[]).includes(r), {
    message: 'radius_invalid',
  });

export const latLngSchema = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
  .refine(isPlausiblePosition, { message: 'position_invalid' });

export const fixSchema = latLngSchema.and(
  z.object({
    accuracy: z.number().positive().max(MAX_ACCURACY_M, { message: 'accuracy_too_low' }),
  }),
);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, { message: 'username_invalid' });

export const recordedMimeSchema = z.enum(['video/mp4', 'video/webm']);

export const createVideoSchema = z
  .object({
    category: categorySchema,
    caption: cleanText(CAPTION_MAX),
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number(),
    mimeType: recordedMimeSchema,
    durationMs: z
      .number()
      .int()
      .positive()
      .max(MAX_RECORDING_MS + 1_000),
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    eventEndsAt: z.iso.datetime({ offset: true }).optional(),
    merchantHours: z.union(MERCHANT_DURATIONS_H.map((h) => z.literal(h))).optional(),
  })
  .superRefine((v, ctx) => {
    const fix = fixSchema.safeParse({ lat: v.lat, lng: v.lng, accuracy: v.accuracy });
    if (!fix.success) {
      for (const issue of fix.error.issues)
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['lat'] });
    }
    if (v.category === 'event' && !v.eventEndsAt) {
      ctx.addIssue({ code: 'custom', message: 'event_end_required', path: ['eventEndsAt'] });
    }
    if (v.category === 'shop' && !v.merchantHours) {
      ctx.addIssue({
        code: 'custom',
        message: 'merchant_duration_required',
        path: ['merchantHours'],
      });
    }
  });
export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const feedQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: radiusSchema,
  category: categorySchema.optional(),
  cursor: z.string().max(200).optional(),
});

export const commentSchema = z.object({
  body: cleanText(COMMENT_MAX).pipe(z.string().min(1)),
});

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: cleanText(500).optional(),
});

export const moderationDecisionSchema = z
  .object({ action: z.enum(MODERATION_ACTIONS), note: cleanText(1000).default('') })
  .refine((d) => d.action !== 'remove' || d.note.length >= 3, {
    message: 'note_required',
    path: ['note'],
  });

export const appealSchema = z.object({ reason: cleanText(1000).pipe(z.string().min(10)) });

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  bio: cleanText(BIO_MAX).optional(),
  defaultRadius: radiusSchema.optional(),
  locale: z.enum(['fr', 'en']).optional(),
  notifyAlerts: z.boolean().optional(),
});

export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.url({ protocol: /^https$/ }),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
  zone: latLngSchema,
  radius: radiusSchema,
});

export interface FeedCursor {
  score: number;
  id: string;
  /** Reference time of the scores (ISO), so that pages stay consistent as time passes. */
  ref: string;
}

/** Opaque feed cursor: base64url(JSON [score, id, refTime]). */
export const encodeCursor = (c: FeedCursor): string =>
  Buffer.from(JSON.stringify([c.score, c.id, c.ref])).toString('base64url');

const cursorTuple = z.tuple([z.number(), z.uuid(), z.iso.datetime({ offset: true })]);
export function decodeCursor(cursor: string): FeedCursor | null {
  try {
    const parsed = cursorTuple.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    return parsed.success
      ? { score: parsed.data[0], id: parsed.data[1], ref: parsed.data[2] }
      : null;
  } catch {
    return null;
  }
}
