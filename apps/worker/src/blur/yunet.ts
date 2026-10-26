import * as ort from 'onnxruntime-node';
import { letterboxBgr, nms } from './geometry.ts';
import type { Box, Detector, Frame } from './types.ts';

const INPUT = 640;
const STRIDES = [8, 16, 32] as const;

export interface YunetOutputs {
  cls: Float32Array[];
  obj: Float32Array[];
  bbox: Float32Array[];
}

/**
 * Decodes YuNet (opencv_zoo face_detection_yunet_2023mar) raw outputs into boxes in the
 * 640×640 input space. Same maths as OpenCV's FaceDetectorYN.
 */
export function decodeYunet(out: YunetOutputs, minScore: number): Box[] {
  const boxes: Box[] = [];
  STRIDES.forEach((stride, s) => {
    const cols = INPUT / stride;
    const cls = out.cls[s];
    const obj = out.obj[s];
    const bbox = out.bbox[s];
    if (!cls || !obj || !bbox) return;
    for (let i = 0; i < cls.length; i += 1) {
      const c = Math.min(1, Math.max(0, cls[i] ?? 0));
      const o = Math.min(1, Math.max(0, obj[i] ?? 0));
      const score = Math.sqrt(c * o);
      if (score < minScore) continue;
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cx = (col + (bbox[i * 4] ?? 0)) * stride;
      const cy = (row + (bbox[i * 4 + 1] ?? 0)) * stride;
      const w = Math.exp(bbox[i * 4 + 2] ?? 0) * stride;
      const h = Math.exp(bbox[i * 4 + 3] ?? 0) * stride;
      boxes.push({ x: cx - w / 2, y: cy - h / 2, w, h, score });
    }
  });
  return boxes;
}

/** Splits a frame into `n` overlapping tiles along its long side. */
export function tiles(
  frame: Frame,
  n: number,
  overlap: number,
): Array<{ x: number; y: number; frame: Frame }> {
  const horizontal = frame.width >= frame.height;
  const long = horizontal ? frame.width : frame.height;
  const size = Math.ceil(long / n) + overlap;
  const out: Array<{ x: number; y: number; frame: Frame }> = [];
  for (let i = 0; i < n; i += 1) {
    const start = Math.max(0, Math.min(long - size, i * Math.ceil(long / n) - overlap / 2));
    const x = horizontal ? start : 0;
    const y = horizontal ? 0 : start;
    const w = horizontal ? size : frame.width;
    const h = horizontal ? frame.height : size;
    const data = new Uint8Array(w * h * 3);
    for (let row = 0; row < h; row += 1) {
      const from = ((y + row) * frame.width + x) * 3;
      data.set(frame.data.subarray(from, from + w * 3), row * w * 3);
    }
    out.push({ x, y, frame: { data, width: w, height: h } });
  }
  return out;
}

export class YunetFaceDetector implements Detector {
  readonly name = 'face-yunet';
  readonly enabled = true;
  private readonly session: ort.InferenceSession;
  private readonly minScore: number;

  private constructor(session: ort.InferenceSession, minScore: number) {
    this.session = session;
    this.minScore = minScore;
  }

  static async load(modelPath: string, minScore = 0.5): Promise<YunetFaceDetector> {
    const session = await ort.InferenceSession.create(modelPath, { intraOpNumThreads: 2 });
    return new YunetFaceDetector(session, minScore);
  }

  /**
   * Whole frame plus overlapping tiles along the long side: downscaling a 1280 px frame to
   * 640 px halves small faces below YuNet's ~10 px floor, tiles keep them near full size.
   */
  async detect(frame: Frame, settings?: { minScore: number }): Promise<Box[]> {
    const minScore = settings?.minScore ?? this.minScore;
    const boxes = await this.detectOnce(frame, minScore);
    const long = Math.max(frame.width, frame.height);
    if (long > INPUT * 1.25) {
      for (const tile of tiles(frame, 2, 64)) {
        for (const b of await this.detectOnce(tile.frame, minScore))
          boxes.push({ ...b, x: b.x + tile.x, y: b.y + tile.y });
      }
    }
    return nms(boxes, 0.3);
  }

  private async detectOnce(frame: Frame, minScore: number): Promise<Box[]> {
    const { tensor, scale } = letterboxBgr(frame, INPUT);
    const result = await this.session.run({
      input: new ort.Tensor('float32', tensor, [1, 3, INPUT, INPUT]),
    });
    const pick = (name: string) => result[name]?.data as Float32Array;
    const boxes = decodeYunet(
      {
        cls: STRIDES.map((s) => pick(`cls_${s}`)),
        obj: STRIDES.map((s) => pick(`obj_${s}`)),
        bbox: STRIDES.map((s) => pick(`bbox_${s}`)),
      },
      minScore,
    );
    return nms(boxes, 0.3).map((b) => ({
      x: b.x / scale,
      y: b.y / scale,
      w: b.w / scale,
      h: b.h / scale,
      score: b.score,
    }));
  }
}
