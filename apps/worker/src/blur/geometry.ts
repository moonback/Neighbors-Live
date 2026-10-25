import type { Box, Frame } from './types.ts';

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

/** Greedy non-maximum suppression, highest score first. */
export function nms(boxes: Box[], threshold: number): Box[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept: Box[] = [];
  for (const box of sorted) if (kept.every((k) => iou(k, box) < threshold)) kept.push(box);
  return kept;
}

/** Grows a box by `ratio` on each side (privacy margin for hair, ears, motion). */
export function expand(box: Box, ratio: number): Box {
  const dx = box.w * ratio;
  const dy = box.h * ratio;
  return { ...box, x: box.x - dx, y: box.y - dy, w: box.w + 2 * dx, h: box.h + 2 * dy };
}

export interface Letterbox {
  /** CHW float32 tensor data, BGR order, values 0..255 (YuNet convention). */
  tensor: Float32Array;
  scale: number;
}

/**
 * Resizes (bilinear) an RGB frame into a size×size square, top-left aligned and zero padded,
 * and converts it to a BGR CHW float tensor.
 */
export function letterboxBgr(frame: Frame, size: number): Letterbox {
  const scale = size / Math.max(frame.width, frame.height);
  const w = Math.max(1, Math.round(frame.width * scale));
  const h = Math.max(1, Math.round(frame.height * scale));
  const plane = size * size;
  const tensor = new Float32Array(3 * plane);
  const src = frame.data;
  const sw = frame.width;
  for (let y = 0; y < h; y += 1) {
    const fy = Math.min(frame.height - 1, (y + 0.5) / scale - 0.5);
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(frame.height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < w; x += 1) {
      const fx = Math.min(sw - 1, (x + 0.5) / scale - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = fx - x0;
      const i00 = (y0 * sw + x0) * 3;
      const i01 = (y0 * sw + x1) * 3;
      const i10 = (y1 * sw + x0) * 3;
      const i11 = (y1 * sw + x1) * 3;
      const o = y * size + x;
      for (let c = 0; c < 3; c += 1) {
        const top = (src[i00 + c] ?? 0) * (1 - wx) + (src[i01 + c] ?? 0) * wx;
        const bottom = (src[i10 + c] ?? 0) * (1 - wx) + (src[i11 + c] ?? 0) * wx;
        // RGB -> BGR planes.
        tensor[(2 - c) * plane + o] = top * (1 - wy) + bottom * wy;
      }
    }
  }
  return { tensor, scale };
}
