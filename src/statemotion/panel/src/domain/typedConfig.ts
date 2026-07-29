// StateMotion Preset Panel — TypedStateConfig domain wrapper.
// Provides type-safe accessors with defaults for CanonicalStateMotionConfig.

import type { CanonicalStateMotionConfig, ParameterValue } from './presetSchema.ts';

export class TypedStateConfig {
  constructor(private config: CanonicalStateMotionConfig | null | undefined) {}

  getNumber(logicalId: string, fallback: number = 0): number {
    const val = this.config?.parameters?.[logicalId];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    return fallback;
  }

  getBoolean(logicalId: string, fallback: boolean = false): boolean {
    const val = this.config?.parameters?.[logicalId];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    return fallback;
  }

  getString(logicalId: string, fallback: string = ''): string {
    const val = this.config?.parameters?.[logicalId];
    if (typeof val === 'string') return val;
    return fallback;
  }

  getCurve(): [number, number, number, number] {
    const defaultCurve: [number, number, number, number] = [0.33, 0.0, 0.67, 1.0];
    const x1 = this.getNumber('transition.curveX1', defaultCurve[0]);
    const y1 = this.getNumber('transition.curveY1', defaultCurve[1]);
    const x2 = this.getNumber('transition.curveX2', defaultCurve[2]);
    const y2 = this.getNumber('transition.curveY2', defaultCurve[3]);
    return [x1, y1, x2, y2];
  }
}
