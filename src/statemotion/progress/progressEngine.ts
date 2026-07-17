// StateMotion — Phase 0.1 vertical slice: progress engine (TypeScript).
//
// Host-independent preview-side mirror of the C++ engine (ticket 015: separate
// implementations, shared reviewed fixtures, parity within 1e-6). Reuses the
// generated enum values from parameterIds.ts — no duplicated numbers.
//
// Knows nothing about Premiere / UXP / Adobe APIs.

import { ProgressMode, AlignmentMode } from '../../../shared/generated/parameterIds.ts';

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export type ProgressErrorCode = 'None' | 'NonFiniteInput';

export interface ProgressInput {
  visibleElapsedSeconds: number;
  visibleDurationSeconds: number;
  transitionDurationSeconds: number;
  delaySeconds: number;
  alignment: AlignmentMode;
  mode: ProgressMode;
  manualProgress: number;
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
      eased = 0;
      break;
    case ProgressMode.HoldB:
      eased = 1;
      break;
    case ProgressMode.Manual:
    case ProgressMode.AToB:
      eased = smoothstep(linear);
      break;
    case ProgressMode.BToA:
      eased = 1 - smoothstep(linear);
      break;
    case ProgressMode.AToBToA:
      eased = linear <= 0.5 ? smoothstep(2 * linear) : 1 - smoothstep(2 * linear - 1);
      break;
    case ProgressMode.BToAToB:
      eased = linear <= 0.5 ? 1 - smoothstep(2 * linear) : smoothstep(2 * linear - 1);
      break;
  }
  return { ok: true, error: 'None', result: { linearProgress: linear, easedProgress: eased } };
}
