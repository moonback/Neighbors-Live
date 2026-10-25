// Manual verification of the face pipeline on real media (run inside the worker container):
//   node scripts/check-blur.ts image <file.jpg>                    → prints detected faces
//   node scripts/check-blur.ts video <in> <out.mp4> <poster.jpg>   → full blur + transcode
import { spawnSync } from 'node:child_process';
import { YunetFaceDetector } from '../src/blur/yunet.ts';
import { blurAndTranscode } from '../src/media/pipeline.ts';

const [mode, input, output, poster] = process.argv.slice(2);
const model = process.env.FACE_MODEL_PATH ?? 'models/face_detection_yunet_2023mar.onnx';
const detector = await YunetFaceDetector.load(model);

if (mode === 'image' && input) {
  const size = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      input,
    ],
    { encoding: 'utf8' },
  );
  const [width = 0, height = 0] = size.stdout.trim().split(',').map(Number);
  const raw = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', input, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    {
      maxBuffer: 1 << 28,
    },
  );
  const started = Date.now();
  const faces = await detector.detect({ data: new Uint8Array(raw.stdout), width, height });
  console.log(JSON.stringify({ width, height, ms: Date.now() - started, faces }, null, 2));
} else if (mode === 'video' && input && output && poster) {
  const started = Date.now();
  const stats = await blurAndTranscode(input, output, poster, {
    detectors: [detector],
    detectEvery: 2,
  });
  console.log(JSON.stringify({ ...stats, ms: Date.now() - started }));
} else {
  console.error('usage: check-blur.ts image <file> | video <in> <out.mp4> <poster.jpg>');
  process.exit(2);
}
