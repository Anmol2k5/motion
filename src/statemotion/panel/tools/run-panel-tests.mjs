// StateMotion Preset Panel — run all domain/host tests.
// Run: npm test   (or node tools/run-panel-tests.mjs)

import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const root = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const base = path.resolve(root, 'src', 'statemotion', 'panel', 'src');
const tests = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.test.ts')) tests.push(p);
  }
}
walk(base);

let failed = 0;
for (const t of tests.sort()) {
  process.stdout.write(`--- ${path.relative(root, t)} ---\n`);
  try {
    const out = execFileSync('node', ['--experimental-transform-types', t], { cwd: root, stdio: 'pipe' });
    process.stdout.write(out.toString());
  } catch (e) {
    failed++;
    process.stdout.write((e.stdout ?? '').toString());
    process.stderr.write((e.stderr ?? '').toString());
  }
}
console.log(failed === 0 ? `\nALL TEST SUITES PASSED (${tests.length})` : `\n${failed} SUITE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
