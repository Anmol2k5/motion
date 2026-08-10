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

// Independent SPRING reference — damped harmonic oscillator step response.
// ODE: x'' + 2ζω₀x' + ω₀²x = ω₀²  with x(0)=0, x'(0)=v₀.
function refSpring(x, freq, damping, initVel) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const omega0 = 2 * Math.PI * Math.max(0.01, freq);
  const zeta = Math.max(0, damping);
  let rawAtX, rawAt1;
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const A = 1;
    const B = (zeta * omega0 - initVel) / omegaD;
    rawAtX = 1 - Math.exp(-zeta * omega0 * x) * (A * Math.cos(omegaD * x) + B * Math.sin(omegaD * x));
    rawAt1 = 1 - Math.exp(-zeta * omega0) * (A * Math.cos(omegaD) + B * Math.sin(omegaD));
  } else {
    const A = 1;
    const B = omega0 - initVel;
    rawAtX = 1 - Math.exp(-omega0 * x) * (A + B * x);
    rawAt1 = 1 - Math.exp(-omega0) * (A + B);
  }
  return rawAtX + x * (1 - rawAt1);
}

// Independent BOUNCE reference — piecewise parabolic inelastic ball model.
// Initial fall t², then geometrically decaying parabolic arcs at floor y=1.
function refBounce(x, count, hDecay, tDecay) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const n = Math.min(Math.max(Math.floor(count), 1), 8);
  const hd = clamp01(hDecay);
  const td = Math.min(Math.max(tDecay, 0.01), 1);
  let totalT = 1, segDur = 1;
  for (let i = 0; i < n; i++) { segDur *= td; totalT += segDur * 2; }
  let t = x * totalT;
  if (t <= 1) return t * t;
  t -= 1;
  let curH = 1, curDur = 1;
  for (let i = 0; i < n; i++) {
    curH *= hd;
    curDur *= td;
    if (t <= curDur * 2) {
      const nT = (t - curDur) / curDur;
      return 1 - curH * (1 - nT * nT);
    }
    t -= curDur * 2;
  }
  return 1;
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

const fixture = { tolerance: 1e-6, named: [], custom: [], invalid: [], regression: [], spring: [], bounce: [] };

// Named modes across a dense + boundary sweep.
const namedModes = ['LINEAR', 'EASE_IN', 'EASE_OUT', 'EASE_IN_OUT'];
for (const mode of namedModes) {
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    fixture.named.push({ mode, progress: p, eased: refEased(mode, null, p) });
  }
}

// Custom curves: identity (linear), smoothstep-equivalent (the legacy curve
// that MUST equal 3x²-2x³), asymmetric, shallow, steep.
const customCurves = [
  { name: 'identity', x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
  { name: 'smoothstep', x1: 1 / 3, y1: 0.0, x2: 2 / 3, y2: 1.0 },
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
  { name: 'nanX1', x1: 1 / 3, y1: 0.0, x2: 2 / 3, y2: 1.0 },
  { name: 'negX1', x1: -0.5, y1: 0.0, x2: 2 / 3, y2: 1.0 },
];
for (const c of invalidCurves) {
  for (const p of [0.0, 0.25, 0.5, 1.0]) {
    fixture.invalid.push({ invalid: true, curve: c.name, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, progress: p, eased: clamp01(p) });
  }
}

// Regression: CUSTOM curve (1/3,0,2/3,1) MUST equal 3x²-2x³ (legacy smoothstep)
// within strict tolerance. Driven independently; asserts the bezier solver and
// the named EASE_IN_OUT mode agree on the legacy visual behavior.
const smoothstep = (p) => { const x = clamp01(p); return x * x * (3 - 2 * x); };
const regressionCurve = { x1: 1 / 3, y1: 0.0, x2: 2 / 3, y2: 1.0 };
for (let i = 0; i <= 100; i++) {
  const p = i / 100;
  fixture.regression.push({
    case: 'customBezierEqualsSmoothstep',
    x1: regressionCurve.x1, y1: regressionCurve.y1, x2: regressionCurve.x2, y2: regressionCurve.y2,
    progress: p,
    eased: refEased('CUSTOM', regressionCurve, p),
    smoothstep: smoothstep(p),
  });
}

// Spring fixtures: 3 parameter combinations × 21 progress steps.
const springCombos = [
  { name: 'default',     springFrequency: 1.0, springDamping: 0.5, springInitialVelocity: 0.0 },
  { name: 'overdamped',  springFrequency: 1.0, springDamping: 1.5, springInitialVelocity: 0.0 },
  { name: 'bouncy',      springFrequency: 2.0, springDamping: 0.2, springInitialVelocity: 2.0 },
];
for (const combo of springCombos) {
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    fixture.spring.push({
      springFrequency: combo.springFrequency,
      springDamping: combo.springDamping,
      springInitialVelocity: combo.springInitialVelocity,
      progress: p,
      eased: refSpring(p, combo.springFrequency, combo.springDamping, combo.springInitialVelocity),
    });
  }
}

// Bounce fixtures: 3 parameter combinations × 21 progress steps.
const bounceCombos = [
  { name: 'default',    bounceCount: 3, bounceHeightDecay: 0.5, bounceTimeDecay: 0.5, bounceHangTime: 0.0 },
  { name: 'highCount',  bounceCount: 6, bounceHeightDecay: 0.3, bounceTimeDecay: 0.4, bounceHangTime: 0.0 },
  { name: 'lowCount',   bounceCount: 2, bounceHeightDecay: 0.8, bounceTimeDecay: 0.7, bounceHangTime: 0.0 },
];
for (const combo of bounceCombos) {
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    fixture.bounce.push({
      bounceCount: combo.bounceCount,
      bounceHeightDecay: combo.bounceHeightDecay,
      bounceTimeDecay: combo.bounceTimeDecay,
      bounceHangTime: combo.bounceHangTime,
      progress: p,
      eased: refBounce(p, combo.bounceCount, combo.bounceHeightDecay, combo.bounceTimeDecay),
    });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Wrote easing fixtures: ${fixture.named.length} named, ${fixture.custom.length} custom, ${fixture.invalid.length} invalid, ${fixture.spring.length} spring, ${fixture.bounce.length} bounce`);
