// StateMotion — easing evaluator (TypeScript mirror of src/statemotion/progress/easing.cpp).
// Host-independent. Single mathematical contract shared with C++. Both must be
// line-for-line equivalent and driven by shared/fixtures/easing-fixtures.json.

export enum EasingMode {
  LINEAR = 0,
  EASE_IN = 1,
  EASE_OUT = 2,
  EASE_IN_OUT = 3,
  CUSTOM = 4,
}

export interface EasingCurve {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
      if (!finite(curve.x1) || !finite(curve.x2) || !finite(curve.y1) || !finite(curve.y2)) {
        return x; // invalid control points -> deterministic linear fallback
      }
      const t = solveBezierT(x, curve.x1, curve.x2);
      return clamp01(bezierY(t, curve.y1, curve.y2));
    }
  }
  return x;
}
