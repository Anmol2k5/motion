// StateMotion Preset Panel — bundle build via esbuild.
// UXP requires a single bundled JS (it cannot resolve a TS module graph).
// Run: npm install && npm run build
// Output: dist/main.js (referenced by index.html after rewrite).

import { build } from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const panelDir = path.resolve(root, 'src', 'statemotion', 'panel');

const outDir = path.resolve(panelDir, 'dist');
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.resolve(panelDir, 'src', 'main.ts')],
  bundle: true,
  outfile: path.resolve(outDir, 'main.js'),
  format: 'esm',
  target: 'es2020',
  loader: { '.css': 'css' },
  // The generated contract mirror and bundled presets are static TS; bundle them.
  logLevel: 'info',
});

console.log('Built src/statemotion/panel/dist/main.js');
