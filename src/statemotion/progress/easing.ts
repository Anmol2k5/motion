// StateMotion — easing evaluator (TypeScript mirror of src/statemotion/progress/easing.cpp).
// Host-independent. Single mathematical contract shared with C++. Both must be
// line-for-line equivalent and driven by shared/fixtures/easing-fixtures.json.

export enum EasingMode {
  LINEAR = 0,
  EASE_IN = 1,
  EASE_OUT = 2,
  EASE_IN_OUT = 3,
  CUSTOM = 4,
  SPRING = 5,
  BOUNCE = 6,
}

export interface EasingCurve {
  x1: number;
  y1: number;
  x2: number;
  y2: number;

  springFrequency: number;
  springDamping: number;
  springInitialVelocity: number;

  bounceCount: number;
  bounceHeightDecay: number;
  bounceTimeDecay: number;
  bounceHangTime: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const finite = (x: number): boolean => typeof x === 'number' && Number.isFinite(x);

function bezier1(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
function bezierX(t: number, x1: number, x2: number): number {
  return bezier1(t, 0, x1, x2, 1);
}
function bezierY(t: number, y1: number, y2: number): number {
  return bezier1(t, 0, y1, y2, 1);
}
function bezierXDeriv(t: number, x1: number, x2: number): number {
  const u = 1 - t;
  return 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
}

function solveBezierT(targetX: number, x1: number, x2: number): number {
  const tx = clamp01(targetX);
  if (tx <= 0) return 0;
  if (tx >= 1) return 1;
  let t = tx;
  for (let i = 0; i < 8; i++) {
    const x = bezierX(t, x1, x2);
    const d = bezierXDeriv(t, x1, x2);
    if (Math.abs(d) < 1e-6) break;
    const step = (x - tx) / d;
    const nt = t - step;
    if (nt < 0 || nt > 1) break;
    if (Math.abs(step) < 1e-9) return nt;
    t = nt;
  }
  let lo = 0;
  let hi = 1;
  t = tx;
  for (let i = 0; i < 40; i++) {
    const x = bezierX(t, x1, x2);
    if (Math.abs(x - tx) < 1e-9) return t;
    if (x < tx) lo = t;
    else hi = t;
    t = 0.5 * (lo + hi);
  }
  return t;
}

export function evaluateEasing(
  mode: EasingMode,
  curve: EasingCurve,
  linear: number,
): number {
  if (!finite(linear)) return 0;
  const x = clamp01(linear);

  switch (mode) {
    case EasingMode.LINEAR:
      return x;
    case EasingMode.EASE_IN:
      return x * x;
    case EasingMode.EASE_OUT: {
      const u = 1 - x;
      return 1 - u * u;
    }
    case EasingMode.EASE_IN_OUT:
      return x * x * (3 - 2 * x);
    case EasingMode.CUSTOM: {
      if (!Number.isFinite(curve.x1) || !Number.isFinite(curve.x2) || !Number.isFinite(curve.y1) || !Number.isFinite(curve.y2)) return x;
      const t = solveBezierT(x, curve.x1, curve.x2);
      return clamp01(bezierY(t, curve.y1, curve.y2));
    }
    case EasingMode.SPRING: {
      if (x <= 0.0) return 0.0;
      if (x >= 1.0) return 1.0;
      
      const freq = Math.max(0.01, curve.springFrequency ?? 1.0);
      const damping = Math.max(0.0, curve.springDamping ?? 0.5);
      const initVel = curve.springInitialVelocity ?? 0.0;
      const omega0 = 2.0 * Math.PI * freq;
      const zeta = damping;

      if (zeta < 1.0) {
        // Underdamped
        const omegaD = omega0 * Math.sqrt(1.0 - zeta * zeta);
        const c1 = 1.0;
        const c2 = (zeta * omega0 - initVel) / omegaD;
        const env = Math.exp(-zeta * omega0 * x);
        const raw = 1.0 - env * (c1 * Math.cos(omegaD * x) + c2 * Math.sin(omegaD * x));
        
        // Normalize so response(1) lands exactly at 1
        const env1 = Math.exp(-zeta * omega0 * 1.0);
        const raw1 = 1.0 - env1 * (c1 * Math.cos(omegaD * 1.0) + c2 * Math.sin(omegaD * 1.0));
        
        // Distribute error linearly
        const err = 1.0 - raw1;
        return raw + x * err;
      } else {
        // Critically damped or overdamped (fallback approximation)
        const c1 = 1.0;
        const c2 = omega0 - initVel;
        const raw = 1.0 - Math.exp(-omega0 * x) * (c1 + c2 * x);
        const raw1 = 1.0 - Math.exp(-omega0 * 1.0) * (c1 + c2 * 1.0);
        const err = 1.0 - raw1;
        return raw + x * err;
      }
    }
    case EasingMode.BOUNCE: {
      if (x <= 0.0) return 0.0;
      if (x >= 1.0) return 1.0;
      
      const count = Math.min(Math.max(Math.floor(curve.bounceCount ?? 3.0), 1), 8);
      const hDecay = Math.min(Math.max(curve.bounceHeightDecay ?? 0.5, 0.0), 1.0);
      const tDecay = Math.min(Math.max(curve.bounceTimeDecay ?? 0.5, 0.01), 1.0);
      
      // Calculate total time duration
      let totalT = 1.0; // initial fall
      let currentT = 1.0;
      for (let i = 0; i < count; ++i) {
          currentT *= tDecay;
          totalT += currentT * 2.0; // up and down
      }
      
      // Scale x to internal time
      let t = x * totalT;
      
      // Initial fall
      if (t <= 1.0) {
          return t * t;
      }
      
      t -= 1.0; // time since first bounce
      
      let currentH = 1.0;
      currentT = 1.0;
      
      for (let i = 0; i < count; ++i) {
          currentH *= hDecay;
          currentT *= tDecay;
          
          if (t <= currentT * 2.0) {
              // We are in this bounce
              // Map t to [-currentT, currentT]
              const localT = t - currentT;
              // Normalized time [-1, 1]
              const nT = localT / currentT;
              // Parabola: 1 - currentH * (1 - nT^2)
              return 1.0 - currentH * (1.0 - nT * nT);
          }
          t -= currentT * 2.0;
      }
      
      return 1.0; // past last bounce
    }
  }
  return x;
}
