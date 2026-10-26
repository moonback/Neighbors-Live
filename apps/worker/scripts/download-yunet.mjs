import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const url =
  process.env.YUNET_URL ??
  'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx';
const expectedSha256 =
  process.env.YUNET_SHA256 ?? '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4';
const modelPath = resolve(
  process.cwd(),
  process.env.FACE_MODEL_PATH || 'models/face_detection_yunet_2023mar.onnx',
);

let alreadyInstalled = false;
try {
  const existing = await readFile(modelPath);
  const existingSha256 = createHash('sha256').update(existing).digest('hex');
  if (existingSha256 !== expectedSha256) {
    throw new Error(
      `Existing YuNet model checksum mismatch at ${modelPath}: expected ${expectedSha256}, got ${existingSha256}`,
    );
  }
  console.log(`YuNet model already verified at ${modelPath}`);
  alreadyInstalled = true;
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
}

if (!alreadyInstalled) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YuNet download failed (${response.status}): ${url}`);

  const model = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash('sha256').update(model).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(`YuNet checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`);
  }

  await mkdir(dirname(modelPath), { recursive: true });
  await writeFile(modelPath, model, { flag: 'wx' });
  console.log(`Installed YuNet model at ${modelPath} (SHA-256 ${actualSha256})`);
}
