import { expand, iou } from './geometry.ts';
import type { Box } from './types.ts';

interface Track {
  box: Box;
  vx: number;
  vy: number;
  /** Frames since the last matching detection. */
  missed: number;
}

export interface TrackerOptions {
  /** Frames a track survives without detection (covers detector misses and skipped frames). */
  ttl: number;
  /** IoU needed to associate a detection with an existing track. */
  matchIou: number;
  /** Safety margin added around every blurred box (fraction of its size per side). */
  margin: number;
}

/**
 * Simple IoU tracker: associates detections with tracks, extrapolates motion with a constant
 * velocity while a face is not detected, and keeps blurring for `ttl` frames after it was lost.
 */
export class BoxTracker {
  private tracks: Track[] = [];
  private readonly opts: TrackerOptions;

  constructor(opts: Partial<TrackerOptions> = {}) {
    this.opts = { ttl: 8, matchIou: 0.2, margin: 0.25, ...opts };
  }

  /** Advances one frame. Pass `detections` when the detector ran on this frame, else null. */
  step(detections: Box[] | null): Box[] {
    for (const t of this.tracks) {
      t.box = { ...t.box, x: t.box.x + t.vx, y: t.box.y + t.vy };
      t.missed += 1;
    }
    if (detections) {
      const free = new Set(this.tracks);
      for (const d of [...detections].sort((a, b) => b.score - a.score)) {
        let best: Track | undefined;
        let bestIou = this.opts.matchIou;
        for (const t of free) {
          const v = iou(t.box, d);
          if (v >= bestIou) {
            best = t;
            bestIou = v;
          }
        }
        if (best) {
          free.delete(best);
          // Per-frame displacement since the last detection, smoothed.
          const lastX = best.box.x - best.missed * best.vx;
          const lastY = best.box.y - best.missed * best.vy;
          best.vx = 0.5 * best.vx + (0.5 * (d.x - lastX)) / best.missed;
          best.vy = 0.5 * best.vy + (0.5 * (d.y - lastY)) / best.missed;
          best.box = d;
          best.missed = 0;
        } else {
          this.tracks.push({ box: d, vx: 0, vy: 0, missed: 0 });
        }
      }
    }
    this.tracks = this.tracks.filter((t) => t.missed <= this.opts.ttl);
    return this.tracks.map((t) => expand(t.box, this.opts.margin));
  }
}
