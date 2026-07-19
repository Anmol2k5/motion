// StateMotion — Phase 0.1 vertical slice: progress engine (TypeScript).
//
// Host-independent preview-side mirror of the C++ engine (ticket 015: separate
// implementations, shared reviewed fixtures, parity within 1e-6). Reuses the
// generated enum values from parameterIds.ts — no duplicated numbers.
//
// Knows nothing about Premiere / UXP / Adobe APIs.

import { ProgressMode, AlignmentMode } from '../../../shared/generated/parameterIds.ts';
import { EasingMode, type EasingCurve, evaluateEasing } from './easing.ts';

export type ProgressErrorCode = 'None' | 'NonFiniteInput';

export interface ProgressInput {
  visibleElapsedSeconds: number;
  visibleDurationSeconds: number;
  transitionDurationSeconds: number;
  delaySeconds: number;
  alignment: AlignmentMode;
  mode: ProgressMode;
  manualProgress: number;
  // Easing configuration. Named modes ignore `curve`; only CUSTOM uses it.
  easing: EasingMode;
  curve: EasingCurve;
}

export interface ProgressResult {
  linearProgress: number;
  easedProgress: number;
}

export interface ProgressOutput {
  ok: boolean;
  error: ProgressErrorCode;
  result: ProgressResult;
}

function clampLower0(v: number): number {
  return v < 0 ? 0 : v;
}

function finite(v: number): boolean {
  return Number.isFinite(v);
}

export function computeLinearProgress(
  alignment: AlignmentMode,
  elapsed: number,
  visibleDuration: number,
  transitionDuration: number,
  delay: number,
): number {
  elapsed = clampLower0(elapsed);
  delay = clampLower0(delay);
  transitionDuration = clampLower0(transitionDuration);

  if (alignment === AlignmentMode.EntireClip) {
    if (visibleDuration <= 0) return 1;
    return Math.min(1, Math.max(0, elapsed / visibleDuration));
  }
  if (alignment === AlignmentMode.ClipStart) {
    if (visibleDuration <= 0) return 0;
    const ws = Math.min(Math.max(delay, 0), visibleDuration);
    const we = Math.min(Math.max(delay + transitionDuration, 0), visibleDuration);
    if (we <= ws) return elapsed >= ws ? 1 : 0;
    return Math.min(1, Math.max(0, (elapsed - ws) / (we - ws)));
  }
  // ClipEnd
  if (visibleDuration <= 0) return 1;
  const we = Math.min(Math.max(visibleDuration - delay, 0), visibleDuration);
  const ws = Math.min(Math.max(visibleDuration - delay - transitionDuration, 0), visibleDuration);
  if (we <= ws) return elapsed >= ws ? 1 : 0;
  return Math.min(1, Math.max(0, (elapsed - ws) / (we - ws)));
}

export function evaluateProgress(input: ProgressInput): ProgressOutput {
  if (
    !finite(input.visibleElapsedSeconds) ||
    !finite(input.visibleDurationSeconds) ||
    !finite(input.transitionDurationSeconds) ||
    !finite(input.delaySeconds) ||
    !finite(input.manualProgress)
  ) {
    return { ok: false, error: 'NonFiniteInput', result: { linearProgress: 0, easedProgress: 0 } };
  }

  const easing = input.easing ?? EasingMode.EASE_IN_OUT;
  const curve = input.curve ?? { x1: 0.42, y1: 0.0, x2: 0.58, y2: 1.0 };

  let linear: number;
  if (input.mode === ProgressMode.Manual) {
    linear = Math.min(1, Math.max(0, input.manualProgress));
  } else {
    linear = computeLinearProgress(
      input.alignment,
      input.visibleElapsedSeconds,
      input.visibleDurationSeconds,
      input.transitionDurationSeconds,
      input.delaySeconds,
    );
  }

  let eased = 0;
  switch (input.mode) {
    case ProgressMode.HoldA:
      eased = 0; // exact endpoint, never eased
      break;
    case ProgressMode.HoldB:
      eased = 1; // exact endpoint, never eased
      break;
    case ProgressMode.Manual:
      // Manual mode bypasses automatic easing: manualProgress is the direct
      // normalized progress between A and B (deterministic midpoint).
      eased = linear;
      break;
    case ProgressMode.AToB:
      eased = evaluateEasing(easing, curve, linear);
      break;
    case ProgressMode.BToA:
      eased = 1 - evaluateEasing(easing, curve, linear);
      break;
    case ProgressMode.AToBToA:
      eased = linear <= 0.5
        ? evaluateEasing(easing, curve, 2 * linear)
        : 1 - evaluateEasing(easing, curve, 2 * linear - 1);
      break;
    case ProgressMode.BToAToB:
      eased = linear <= 0.5
        ? 1 - evaluateEasing(easing, curve, 2 * linear)
        : evaluateEasing(easing, curve, 2 * linear - 1);
      break;
  }
  return { ok: true, error: 'None', result: { linearProgress: linear, easedProgress: eased } };
}
