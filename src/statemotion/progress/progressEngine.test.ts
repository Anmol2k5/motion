// StateMotion — Phase 0.1 vertical slice: progress engine tests (TypeScript).
//
// Reads the SAME committed fixture as the C++ test (shared/schema/progress-fixtures.json).
// Neither implementation generates expected values for the other. Parity within 1e-6.

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { evaluateProgress } from './progressEngine.ts';
import { evaluateEasing, EasingMode, type EasingCurve } from './easing.ts';
import { ProgressMode, AlignmentMode } from '../../../shared/generated/parameterIds.ts';

let failures = 0;
function check(ok: boolean, name: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}
function maxErr(a: number, b: number): number {
  return Math.abs(a - b);
}

type Json = any;

// Strict fixture-number conversion (test-only). Accepts a real JSON number or one
// of the explicit sentinels "nan"/"inf"/"-inf". Any other string is rejected, never
// silently coerced. Mirrors the C++ parseFixtureNumber vocabulary exactly.
function parseFixtureNumber(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }
  switch (value) {
    case 'nan':
      return Number.NaN;
    case 'inf':
      return Number.POSITIVE_INFINITY;
    case '-inf':
      return Number.NEGATIVE_INFINITY;
    default:
      throw new Error(`Unknown numeric fixture sentinel: ${value}`);
  }
}

function getNum(o: Json, key: string, def = 0): number {
  if (!(key in o)) return def;
  return parseFixtureNumber(o[key]);
}
// fixture may store a non-finite field as an explicit sentinel string.
function getNumOrStr(o: Json, key: string): number {
  if (!(key in o)) return 0;
  return parseFixtureNumber(o[key]);
}

function inputFromFixture(inp: Json) {
  return {
    visibleElapsedSeconds: getNumOrStr(inp, 'visibleElapsedSeconds'),
    visibleDurationSeconds: getNumOrStr(inp, 'visibleDurationSeconds'),
    transitionDurationSeconds: getNumOrStr(inp, 'transitionDurationSeconds'),
    delaySeconds: getNumOrStr(inp, 'delaySeconds'),
    alignment: inp.alignment as AlignmentMode,
    mode: inp.mode as ProgressMode,
    manualProgress: getNumOrStr(inp, 'manualProgress'),
  };
}

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../shared/schema/progress-fixtures.json',
);
const fixture: Json = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

console.log('== progress engine fixture parity (TS) ==');

let n = 0;
for (const c of fixture.cases as Json[]) {
  const inp = inputFromFixture(c.input);
  const out = evaluateProgress(inp);
  const exp = c.expected;
  if ('ok' in exp && exp.ok === false) {
    const ok = !out.ok && out.error === 'NonFiniteInput';
    check(ok, `invalid: ${c.name}`);
  } else {
    const ok =
      out.ok &&
      maxErr(out.result.linearProgress, exp.linearProgress) < 1e-6 &&
      maxErr(out.result.easedProgress, exp.easedProgress) < 1e-6;
    check(ok, `fixture: ${c.name}`);
  }
  n++;
}
console.log(`    (${n} fixture cases)`);

// ---- focused fixture-number reader tests --------------------------------
console.log('== fixture-number reader (TS) ==');
{
  const num = parseFixtureNumber(1.25);
  check(Number.isFinite(num) && maxErr(num, 1.25) < 1e-12, 'reader: number -> same finite value');
  const nan = parseFixtureNumber('nan');
  check(Number.isNaN(nan) && !Number.isFinite(nan), 'reader: "nan" -> isNaN && !isFinite');
  const inf = parseFixtureNumber('inf');
  check(!Number.isFinite(inf) && inf > 0 && inf === Infinity, 'reader: "inf" -> +Infinity');
  const ninf = parseFixtureNumber('-inf');
  check(!Number.isFinite(ninf) && ninf < 0 && ninf === -Infinity, 'reader: "-inf" -> -Infinity');
  let threw = false;
  try { parseFixtureNumber('nonfinite'); } catch { threw = true; }
  check(threw, 'reader: unknown string -> throws');
}

// dense sampling
const dense = fixture.dense;
const samples: number = dense.samples;
const tol: number = dense.tolerance;
let allFinite = true;
let worst = 0;
for (let i = 0; i < samples; i++) {
  const q = i / (samples - 1);
  const out = evaluateProgress({
    visibleElapsedSeconds: q,
    visibleDurationSeconds: dense.visibleDurationSeconds,
    transitionDurationSeconds: dense.transitionDurationSeconds,
    delaySeconds: dense.delaySeconds,
    alignment: dense.alignment,
    mode: dense.mode,
    manualProgress: 0,
  });
  if (!out.ok || !Number.isFinite(out.result.easedProgress)) { allFinite = false; break; }
  const ref = evaluateEasing(EasingMode.EASE_IN_OUT, { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }, q);
  worst = Math.max(worst, maxErr(out.result.easedProgress, ref));
}
check(allFinite && worst < tol, `dense ${samples}-sample finite + easing within tolerance`);
console.log(`    (worst abs err ${worst.toExponential(2)})`);

console.log(`\n${failures ? 'FAILED' : 'ALL PASSED'}: ${failures} failures`);
process.exit(failures ? 1 : 0);
