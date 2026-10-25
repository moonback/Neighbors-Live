// Generates the 6 demo clips referenced by supabase/seed.sql (demo/clip-N.mp4 + .jpg) with the
// worker image's ffmpeg, then uploads them to the private `videos` bucket.
// Clips are synthetic (test pattern + label + tone): no third-party footage, no rights issue.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, '.demo-media');

const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const clips = [
  [1, 'Alerte', '0'],
  [2, 'Bon plan', '120'],
  [3, 'Événement', '260'],
  [4, 'Entraide', '200'],
  [5, 'Objet trouvé', '40'],
  [6, 'Commerce', '300'],
];

mkdirSync(outDir, { recursive: true });
const missing = clips.filter(([n]) => !existsSync(resolve(outDir, `clip-${n}.mp4`)));
if (missing.length > 0) {
  const script = missing
    .map(
      ([n, label, hue]) =>
        `ffmpeg -loglevel error -y -f lavfi -i "testsrc2=size=720x1280:rate=30,hue=h=${hue}:s=0.6,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='Neighbors Live - démo':fontcolor=white:fontsize=44:x=(w-tw)/2:y=h*0.12:box=1:boxcolor=black@0.5,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${label}':fontcolor=white:fontsize=72:x=(w-tw)/2:y=h*0.8:box=1:boxcolor=black@0.5" ` +
        `-f lavfi -i "sine=frequency=${440 + Number(n) * 40}:sample_rate=48000" -t 8 -c:v libx264 -preset veryfast -pix_fmt yuv420p -profile:v main -c:a aac -b:a 96k -shortest -movflags +faststart /out/clip-${n}.mp4 && ` +
        `ffmpeg -loglevel error -y -ss 1 -i /out/clip-${n}.mp4 -frames:v 1 -q:v 4 /out/clip-${n}.jpg`,
    )
    .join(' && ');
  const res = spawnSync(
    'docker',
    [
      'compose',
      'run',
      '--rm',
      '--no-deps',
      '-v',
      `${outDir}:/out`,
      '--entrypoint',
      'sh',
      'worker',
      '-c',
      script,
    ],
    { cwd: root, stdio: 'inherit', shell: false },
  );
  if (res.status !== 0) throw new Error('demo clip generation failed (is the worker image built?)');
}

for (const [n] of clips) {
  for (const [ext, type] of [
    ['mp4', 'video/mp4'],
    ['jpg', 'image/jpeg'],
  ]) {
    const body = readFileSync(resolve(outDir, `clip-${n}.${ext}`));
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/videos/demo/clip-${n}.${ext}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': type,
        'x-upsert': 'true',
      },
      body,
    });
    if (!res.ok) throw new Error(`upload clip-${n}.${ext}: ${res.status} ${await res.text()}`);
  }
}
console.log(`✔ ${clips.length} demo clips uploaded to storage (bucket "videos", folder demo/)`);
