import { describe, expect, it } from 'vitest';
import { expand, iou, letterboxBgr, nms } from './blur/geometry.ts';
import { pixelate } from './blur/pixelate.ts';
import { createPlateDetector, decodeYoloSingleClass } from './blur/plates.ts';
import { BoxTracker } from './blur/tracker.ts';
import { decodeYunet, tiles } from './blur/yunet.ts';
import { loadEnv } from './env.ts';
import { targetSize } from './media/ffmpeg.ts';
import { alertMessage, noticeMessage } from './notify.ts';
import { bucketFor, isProtected } from './storage.ts';

const box = (x: number, y: number, w = 10, h = 10, score = 0.9) => ({ x, y, w, h, score });

describe('geometry', () => {
  it('computes IoU', () => {
    expect(iou(box(0, 0), box(0, 0))).toBe(1);
    expect(iou(box(0, 0), box(20, 20))).toBe(0);
    expect(iou(box(0, 0), box(5, 0))).toBeCloseTo(50 / 150);
  });

  it('suppresses overlapping boxes keeping the best score', () => {
    const kept = nms([box(0, 0, 10, 10, 0.6), box(1, 1, 10, 10, 0.9), box(50, 50)], 0.3);
    expect(kept).toHaveLength(2);
    expect(kept[0]?.score).toBe(0.9);
  });

  it('expands boxes symmetrically', () => {
    expect(expand(box(10, 10, 10, 20), 0.25)).toMatchObject({ x: 7.5, y: 5, w: 15, h: 30 });
  });

  it('letterboxes into a BGR CHW tensor', () => {
    const data = new Uint8Array(4 * 2 * 3);
    for (let i = 0; i < 8; i += 1) data.set([200, 100, 50], i * 3); // RGB
    const { tensor, scale } = letterboxBgr({ data, width: 4, height: 2 }, 8);
    expect(scale).toBe(2);
    const plane = 64;
    expect(tensor[0]).toBeCloseTo(50); // B plane first
    expect(tensor[plane]).toBeCloseTo(100);
    expect(tensor[2 * plane]).toBeCloseTo(200);
    expect(tensor[7 * 8 + 7]).toBe(0); // padding below the 8×4 image
  });
});

describe('YuNet decoding', () => {
  it('decodes a single confident anchor at stride 32', () => {
    const empty = (n: number, k = 1) => new Float32Array(n * k);
    const cls32 = empty(400);
    const obj32 = empty(400);
    const bbox32 = empty(400, 4);
    const idx = 3 * 20 + 5; // row 3, col 5
    cls32[idx] = 0.81;
    obj32[idx] = 1;
    bbox32.set([0.5, 0.5, Math.log(2), Math.log(3)], idx * 4);
    const boxes = decodeYunet(
      {
        cls: [empty(6400), empty(1600), cls32],
        obj: [empty(6400), empty(1600), obj32],
        bbox: [empty(6400, 4), empty(1600, 4), bbox32],
      },
      0.5,
    );
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.score).toBeCloseTo(0.9);
    // cx = (5 + .5) * 32 = 176, w = 64 → x = 144; cy = 112, h = 96 → y = 64
    expect(boxes[0]?.x).toBeCloseTo(144);
    expect(boxes[0]?.y).toBeCloseTo(64);
    expect(boxes[0]?.w).toBeCloseTo(64);
    expect(boxes[0]?.h).toBeCloseTo(96);
  });
});

describe('tiles', () => {
  it('covers the long side with overlapping tiles and keeps pixel offsets', () => {
    const width = 1280;
    const height = 4;
    const data = new Uint8Array(width * height * 3);
    for (let x = 0; x < width; x += 1) data[x * 3] = x % 251;
    const [a, b] = tiles({ data, width, height }, 2, 64);
    expect(a?.x).toBe(0);
    expect(a?.frame.width).toBe(704);
    expect((b?.x ?? 0) + (b?.frame.width ?? 0)).toBe(1280);
    // first pixel of tile b equals the source pixel at its offset
    expect(b?.frame.data[0]).toBe((b?.x ?? 0) % 251);
  });
});

describe('plates', () => {
  it('decodes a YOLO single-class head', () => {
    const anchors = 3;
    const data = new Float32Array(5 * anchors);
    data.set([100, 0, 0], 0); // cx
    data.set([50, 0, 0], anchors); // cy
    data.set([40, 0, 0], 2 * anchors); // w
    data.set([20, 0, 0], 3 * anchors); // h
    data.set([0.8, 0.1, 0.2], 4 * anchors); // score
    const boxes = decodeYoloSingleClass(data, anchors, 0.35);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ x: 80, y: 40, w: 40, h: 20 });
  });

  it('is disabled unless explicitly enabled with a model', async () => {
    expect((await createPlateDetector(false, '/x.onnx')).enabled).toBe(false);
    expect((await createPlateDetector(true, undefined)).enabled).toBe(false);
  });
});

describe('tracker', () => {
  it('keeps blurring a face for ttl frames after the detector loses it', () => {
    const t = new BoxTracker({ ttl: 3, margin: 0 });
    expect(t.step([box(10, 10)])).toHaveLength(1);
    expect(t.step(null)).toHaveLength(1);
    expect(t.step([])).toHaveLength(1);
    expect(t.step(null)).toHaveLength(1);
    expect(t.step(null)).toHaveLength(0);
  });

  it('follows a moving face between detections', () => {
    const t = new BoxTracker({ margin: 0 });
    t.step([box(0, 0)]);
    t.step(null);
    t.step([box(4, 0)]); // moved 4 px over 2 frames
    const predicted = t.step(null)[0];
    expect(predicted?.x).toBeGreaterThan(4);
    expect(t.step([box(6, 0)])).toHaveLength(1); // same track, no duplicate
  });

  it('applies the privacy margin', () => {
    const t = new BoxTracker({ margin: 0.25 });
    expect(t.step([box(10, 10, 20, 20)])[0]).toMatchObject({ x: 5, y: 5, w: 30, h: 30 });
  });
});

describe('pixelate', () => {
  it('replaces pixels inside the box by block means and leaves the rest untouched', () => {
    const width = 16;
    const height = 8;
    const data = new Uint8Array(width * height * 3);
    for (let i = 0; i < data.length; i += 1) data[i] = (i * 37) % 256;
    const before = Uint8Array.from(data);
    pixelate({ data, width, height }, [box(0, 0, 8, 8)], 2);
    const px = (arr: Uint8Array, x: number, y: number) =>
      Array.from(arr.subarray((y * width + x) * 3, (y * width + x) * 3 + 3));
    expect(px(data, 0, 0)).toEqual(px(data, 3, 3)); // same 4×4 block
    expect(px(data, 0, 0)).not.toEqual(px(before, 0, 0));
    expect(px(data, 12, 4)).toEqual(px(before, 12, 4));
  });

  it('clamps boxes outside the frame', () => {
    const data = new Uint8Array(4 * 4 * 3).fill(10);
    expect(() => pixelate({ data, width: 4, height: 4 }, [box(-10, -10, 100, 100)])).not.toThrow();
  });
});

describe('media helpers', () => {
  it('caps output at 720p with even dimensions and honours rotation', () => {
    expect(targetSize(1920, 1080, 0)).toEqual({ width: 1280, height: 720 });
    expect(targetSize(1920, 1080, 90)).toEqual({ width: 720, height: 1280 });
    expect(targetSize(641, 361, 0)).toEqual({ width: 642, height: 362 });
  });

  it('routes paths to buckets and protects demo media', () => {
    const user = '7b0f8f9e-6c2d-4c1a-9a51-3b6c1c3e2f10';
    const video = '1b0f8f9e-6c2d-4c1a-9a51-3b6c1c3e2f10';
    expect(bucketFor(`${user}/${video}.webm`)).toBe('raw-videos');
    expect(bucketFor(`${video}.mp4`)).toBe('videos');
    expect(isProtected('demo/clip-1.mp4')).toBe(true);
  });
});

describe('notifications', () => {
  it('groups alerts into one message', () => {
    expect(alertMessage(['Fuite d’eau'], ['a'], 'https://x').url).toBe('https://x/v/a');
    const grouped = alertMessage(['Fuite', 'Panne', 'Chien'], ['a', 'b', 'c'], 'https://x');
    expect(grouped.title).toBe('3 alertes près de chez vous');
    expect(grouped.body).toBe('Fuite et 2 autres');
  });

  it('builds moderation notices without position data', () => {
    const msg = noticeMessage(
      {
        id: 1,
        kind: 'moderation_warning',
        user_id: 'u',
        video_id: 'v',
        payload: { note: 'Floutez la plaque' },
      },
      'https://x',
    );
    expect(msg.body).toBe('Floutez la plaque');
  });
});

describe('env', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@h:5432/db',
    SUPABASE_URL: 'http://localhost:1',
    SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(30),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'x'.repeat(30),
    VAPID_PRIVATE_KEY: 'x'.repeat(30),
    VAPID_SUBJECT: 'mailto:a@b.c',
  };
  it('applies safe defaults (faces on, plates off)', () => {
    const env = loadEnv(base);
    expect(env.FACE_BLUR_ENABLED).toBe(true);
    expect(env.PLATE_BLUR_ENABLED).toBe(false);
    expect(env.PLATE_MODEL_PATH).toBeUndefined();
  });
  it('rejects an incomplete configuration', () => {
    expect(() => loadEnv({ ...base, DATABASE_URL: 'mysql://nope' })).toThrow();
  });
});
