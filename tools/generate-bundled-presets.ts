// StateMotion — emit .stmpreset files from the bundled preset library.
// Run: node --experimental-transform-types tools/generate-bundled-presets.ts
// The TS array (src/statemotion/panel/src/starter/bundledPresets.ts) is the
// single source; .stmpreset files are generated artifacts for shipping and
// import/export testing.

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { BUNDLED_PRESETS } from '../src/statemotion/panel/src/starter/bundledPresets.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(here, '..', 'src', 'statemotion', 'panel', 'presets', 'bundled');

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const p of BUNDLED_PRESETS) {
  fs.writeFileSync(path.join(OUT_DIR, p.presetId + '.stmpreset'), JSON.stringify(p, null, 2));
}
console.log(`Wrote ${BUNDLED_PRESETS.length} .stmpreset files to ${OUT_DIR}`);
