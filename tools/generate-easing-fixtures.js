#!/usr/bin/env node
// StateMotion — easing fixture generator (dependency-free, stdlib only).
//
// Emits shared/fixtures/easing-fixtures.json: the SINGLE SOURCE OF TRUTH for
// C++ and TypeScript easing parity. Expected `eased` values are computed by an
// INDEPENDENT reference implementation here (closed-form named modes + a simple
// bisection cubic-Bezier solver), NOT by the production evaluators, so the
// fixture is a trustworthy contract.
//
// Usage: node tools/generate-easing-fixtures.js

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'shared', 'fixtures', 'easing-fixtures.json');

// --- independent reference ---
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function bezier1(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
function bezierX(t, x1, x2) { return bezier1(t, 0, x1, x2, 1); }
function bezierY(t, y1, y2) { return bezier1(t, 0, y1, y2, 1); }

// Reference cubic solver: bisection only (independent of prod Newton path).
function solveBezierTRef(targetX, x1, x2) {
  const tx = clamp01(targetX);
  if (tx <= 0) return 0;
  if (tx >= 1) return 1;
  let lo = 0, hi = 1, t = tx;
  for (let i = 0; i < 60; i++) {
    const x = bezierX(t, x1, x2);
    if (Math.abs(x - tx) < 1e-12) return t;
    if (x < tx) lo = t; else hi = t;
    t = 0.5 * (lo + hi);
  }
  return t;
}

function refEased(mode, curve, lin) {
  const x = clamp01(lin);
  switch (mode) {
    case 'LINEAR': return x;
    case 'EASE_IN': return x * x;
    case 'EASE_OUT': { const u = 1 - x; return 1 - u * u; }
    case 'EASE_IN_OUT': return x * x * (3 - 2 * x);
    case 'CUSTOM': {
      const t = solveBezierTRef(x, curve.x1, curve.x2);
      return clamp01(bezierY(t, curve.y1, curve.y2));
    }
    default: return x;
  }
}

const fixture = { tolerance: 1e-6, named: [], custom: [], invalid: [] };

// Named modes across a dense + boundary sweep.
const namedModes = ['LINEAR', 'EASE_IN', 'EASE_OUT', 'EASE_IN_OUT'];
for (const mode of namedModes) {
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    fixture.named.push({ mode, progress: p, eased: refEased(mode, null, p) });
  }
}

// Custom curves: identity (linear), symmetric-legacy, asymmetric, shallow, steep.
const customCurves = [
  { name: 'identity', x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
  { name: 'legacy', x1: 0.42, y1: 0.0, x2: 0.58, y2: 1.0 },
  { name: 'easeOutStrong', x1: 0.1, y1: 0.9, x2: 0.2, y2: 1.0 },
  { name: 'easeInStrong', x1: 0.8, y1: 0.0, x2: 0.9, y2: 0.1 },
  { name: 'symmetricMid', x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 },
];
for (const c of customCurves) {
  const curve = { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 };
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    fixture.custom.push({ curve: c.name, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, progress: p, eased: refEased('CUSTOM', curve, p) });
  }
}

// Invalid control points -> deterministic linear fallback. Control points are
// kept finite in JSON; the `invalid:true` flag tells the test to feed a
// non-finite value (NaN) to the evaluator to exercise the fallback path.
const invalidCurves = [
  { name: 'nanX1', x1: 0.42, y1: 0.0, x2: 0.58, y2: 1.0 },
  { name: 'negX1', x1: -0.5, y1: 0.0, x2: 0.58, y2: 1.0 },
];
for (const c of invalidCurves) {
  for (const p of [0.0, 0.25, 0.5, 1.0]) {
    fixture.invalid.push({ invalid: true, curve: c.name, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, progress: p, eased: clamp01(p) });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Wrote easing fixtures: ${fixture.named.length} named, ${fixture.custom.length} custom, ${fixture.invalid.length} invalid`);
