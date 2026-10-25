// Copies runtime assets that bundlers do not emit into public/ (run before dev and build).
// MapLibre 6 loads its web worker from a separate module URL that Turbopack does not publish.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve('maplibre-gl/package.json'));
const out = resolve(import.meta.dirname, '../public');
mkdirSync(out, { recursive: true });
copyFileSync(resolve(pkg, 'dist/maplibre-gl-worker.mjs'), resolve(out, 'maplibre-gl-worker.mjs'));
