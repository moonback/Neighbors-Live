import type { Box, Frame } from './types.ts';

/**
 * Irreversibly pixelates the boxes in place: each box is split into ~`blocks` cells across,
 * every cell is replaced by its mean colour.
 */
export function pixelate(frame: Frame, boxes: Box[], blocks = 6): void {
  const { data, width, height } = frame;
  for (const box of boxes) {
    const x0 = Math.max(0, Math.floor(box.x));
    const y0 = Math.max(0, Math.floor(box.y));
    const x1 = Math.min(width, Math.ceil(box.x + box.w));
    const y1 = Math.min(height, Math.ceil(box.y + box.h));
    if (x1 <= x0 || y1 <= y0) continue;
    const cell = Math.max(4, Math.ceil((x1 - x0) / blocks));
    for (let cy = y0; cy < y1; cy += cell) {
      for (let cx = x0; cx < x1; cx += cell) {
        const ex = Math.min(x1, cx + cell);
        const ey = Math.min(y1, cy + cell);
        let r = 0;
        let g = 0;
        let b = 0;
        const n = (ex - cx) * (ey - cy);
        for (let y = cy; y < ey; y += 1) {
          for (let x = cx; x < ex; x += 1) {
            const i = (y * width + x) * 3;
            r += data[i] ?? 0;
            g += data[i + 1] ?? 0;
            b += data[i + 2] ?? 0;
          }
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        for (let y = cy; y < ey; y += 1) {
          for (let x = cx; x < ex; x += 1) {
            const i = (y * width + x) * 3;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
        }
      }
    }
  }
}
