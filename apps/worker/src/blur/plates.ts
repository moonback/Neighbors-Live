import * as ort from 'onnxruntime-node';
import { letterboxBgr, nms } from './geometry.ts';
import { DisabledDetector, type Box, type Detector, type Frame } from './types.ts';

const INPUT = 640;

/**
 * Decodes a single-class YOLOv8-style detection head, output shape [1, 5, N]
 * (cx, cy, w, h, score per anchor), in the 640×640 input space.
 */
export function decodeYoloSingleClass(
  data: Float32Array,
  anchors: number,
  minScore: number,
): Box[] {
  const boxes: Box[] = [];
  for (let i = 0; i < anchors; i += 1) {
    const score = data[4 * anchors + i] ?? 0;
    if (score < minScore) continue;
    const cx = data[i] ?? 0;
    const cy = data[anchors + i] ?? 0;
    const w = data[2 * anchors + i] ?? 0;
    const h = data[3 * anchors + i] ?? 0;
    boxes.push({ x: cx - w / 2, y: cy - h / 2, w, h, score });
  }
  return boxes;
}

/**
 * Licence plate detector. No reliable, openly licensed plate model is bundled with the project:
 * it only runs when an operator provides one (PLATE_MODEL_PATH, YOLOv8 single-class ONNX export,
 * 640×640 input). See docs/PRIVACY.md for the real coverage.
 */
export class OnnxPlateDetector implements Detector {
  readonly name = 'plate-yolo';
  readonly enabled = true;
  private readonly session: ort.InferenceSession;
  private readonly minScore: number;

  private constructor(session: ort.InferenceSession, minScore: number) {
    this.session = session;
    this.minScore = minScore;
  }

  static async load(modelPath: string, minScore = 0.35): Promise<OnnxPlateDetector> {
    return new OnnxPlateDetector(await ort.InferenceSession.create(modelPath), minScore);
  }

  async detect(frame: Frame): Promise<Box[]> {
    const { tensor, scale } = letterboxBgr(frame, INPUT);
    // YOLO models expect RGB normalised to 0..1: swap the BGR planes back and rescale.
    const plane = INPUT * INPUT;
    const rgb = new Float32Array(tensor.length);
    for (let c = 0; c < 3; c += 1) {
      const src = tensor.subarray((2 - c) * plane, (3 - c) * plane);
      for (let i = 0; i < plane; i += 1) rgb[c * plane + i] = (src[i] ?? 0) / 255;
    }
    const inputName = this.session.inputNames[0] ?? 'images';
    const outputName = this.session.outputNames[0] ?? 'output0';
    const result = await this.session.run({
      [inputName]: new ort.Tensor('float32', rgb, [1, 3, INPUT, INPUT]),
    });
    const out = result[outputName];
    if (!out) return [];
    const anchors = out.dims[2] ?? 0;
    const boxes = decodeYoloSingleClass(out.data as Float32Array, anchors, this.minScore);
    return nms(boxes, 0.4).map((b) => ({
      x: b.x / scale,
      y: b.y / scale,
      w: b.w / scale,
      h: b.h / scale,
      score: b.score,
    }));
  }
}

export async function createPlateDetector(
  enabled: boolean,
  modelPath: string | undefined,
): Promise<Detector> {
  if (!enabled || !modelPath) return new DisabledDetector('plate');
  return OnnxPlateDetector.load(modelPath);
}
