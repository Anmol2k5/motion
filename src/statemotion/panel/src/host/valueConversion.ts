// Pure canonical<->native conversion for StateMotion logical parameters.
// Mirrors src/statemotion/adobe/statemotion_native_adapter.hpp math.
// Host-free: receives/returns only StateMotion-owned values.

import { getBinding, LOGICAL_IDS, type ParameterBinding } from '../../../../../shared/generated/parameterBindings.ts';
import type { ParameterValue } from '../domain/presetSchema.ts';

export interface SmPoint { x: number; y: number; }
export type NativeValue = number | string | boolean | SmPoint;

export class UnknownLogicalId extends Error {
  constructor(public logicalId: string) { super(`Unknown logical ID: ${logicalId}`); }
}
export class ConversionTypeMismatch extends Error {
  constructor(public logicalId: string, public expected: string, public actual: string) {
    super(`Conversion type mismatch for ${logicalId}: expected ${expected}, got ${actual}`);
  }
}

type Kind = 'identity' | 'percent' | 'degrees' | 'point' | 'boolean';

// Logical ID -> conversion kind. Built from the generated contract so no raw
// string literals are scattered at call sites. nativeType is a validation guard,
// not the selector (FLOAT_SLIDER is semantically ambiguous).
const CONVERSION_KIND: Record<string, Kind> = {};
for (const id of LOGICAL_IDS) {
  if (id.startsWith('contract.')) CONVERSION_KIND[id] = 'identity';
  else if (id === 'transition.mode' || id === 'transition.alignment') CONVERSION_KIND[id] = 'identity';
  else if (id === 'transition.easing') CONVERSION_KIND[id] = 'identity';
  else if (id.startsWith('transition.curve')) CONVERSION_KIND[id] = 'identity';
  else if (id === 'transition.durationSeconds' || id === 'transition.delaySeconds') CONVERSION_KIND[id] = 'identity';
  else if (id === 'transition.manualProgress') CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('transform.scale')) CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('transform.rotation')) CONVERSION_KIND[id] = 'degrees';
  else if (id.startsWith('transform.opacity')) CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('crop.')) CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('shadow.opacity')) CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('shadow.angle')) CONVERSION_KIND[id] = 'degrees';
  else if (id.startsWith('shadow.distance') || id.startsWith('shadow.softness')) CONVERSION_KIND[id] = 'identity';
  else if (id.startsWith('transform.position') || id.startsWith('transform.anchor')) CONVERSION_KIND[id] = 'point';
  else if (id.startsWith('transition.spring.') || id.startsWith('transition.bounce.')) CONVERSION_KIND[id] = 'identity';
  else if (id.startsWith('stroke.width') || id.startsWith('stroke.color') || id === 'stroke.gradientCycleSpeed') CONVERSION_KIND[id] = 'identity';
  else if (id.startsWith('glow.radius')) CONVERSION_KIND[id] = 'identity';
  else if (id.startsWith('stroke.gradientAngle')) CONVERSION_KIND[id] = 'degrees';
  else if (id.startsWith('stroke.enabled') || id.startsWith('glow.enabled')) CONVERSION_KIND[id] = 'boolean';
  else if (id.startsWith('glow.amount')) CONVERSION_KIND[id] = 'percent';
}

const EXPECTED_NATIVE: Record<Kind, string> = {
  // identity is NOT checked against this value; guard() special-cases it to
  // allow FLOAT_SLIDER (seconds) or POPUP (enums) or COLOR (strings). Entry kept for completeness.
  identity: 'FLOAT_SLIDER|POPUP|COLOR',
  percent: 'FLOAT_SLIDER',
  degrees: 'ANGLE',
  point: 'POINT',
  boolean: 'CHECKBOX',
};

function resolvePoint(canonical: ParameterValue): SmPoint {
  if (typeof canonical === 'string') {
    if (canonical === 'frameCenter' || canonical === 'sourceCenter') return { x: 0.5, y: 0.5 };
    throw new ConversionTypeMismatch(String(canonical), 'point token', 'unknown token');
  }
  return canonical as SmPoint;
}

function guard(logicalId: string, kind: Kind, binding: ParameterBinding): void {
  const expected = EXPECTED_NATIVE[kind];
  // identity: seconds (FLOAT_SLIDER) or enum (POPUP) or string (COLOR) all allowed
  if (kind === 'identity') {
    if (binding.nativeType !== 'FLOAT_SLIDER' && binding.nativeType !== 'POPUP' && binding.nativeType !== 'COLOR') {
      throw new ConversionTypeMismatch(logicalId, 'FLOAT_SLIDER|POPUP|COLOR', binding.nativeType);
    }
    return;
  }
  if (binding.nativeType !== expected) {
    throw new ConversionTypeMismatch(logicalId, expected, binding.nativeType);
  }
}

export function toNative(logicalId: string, canonical: ParameterValue, binding: ParameterBinding): NativeValue {
  const b = getBinding(logicalId);
  if (!b) throw new UnknownLogicalId(logicalId);
  const kind = CONVERSION_KIND[logicalId];
  if (!kind) throw new UnknownLogicalId(logicalId);
  guard(logicalId, kind, binding);
  switch (kind) {
    case 'identity': return canonical as NativeValue;
    case 'percent': return (canonical as number) * 100;
    case 'degrees': return (canonical as number) * 180 / Math.PI;
    case 'point': {
      const p = resolvePoint(canonical);
      return { x: p.x * 100, y: p.y * 100 };
    }
    case 'boolean': return (canonical === true ? 1 : 0); // native CHECKBOX expects 1 or 0
  }
}

export function toCanonical(logicalId: string, native: NativeValue, binding: ParameterBinding): ParameterValue {
  const b = getBinding(logicalId);
  if (!b) throw new UnknownLogicalId(logicalId);
  const kind = CONVERSION_KIND[logicalId];
  if (!kind) throw new UnknownLogicalId(logicalId);
  guard(logicalId, kind, binding);
  switch (kind) {
    case 'identity': return native as ParameterValue;
    case 'percent': {
      const v = (native as number) / 100;
      return (logicalId.startsWith('transform.opacity') || logicalId.startsWith('crop.') || logicalId.startsWith('glow.amount')) ? Math.min(1, Math.max(0, v)) : v;
    }
    case 'degrees': return (native as number) * Math.PI / 180;
    case 'point': {
      const p = native as SmPoint;
      const norm = { x: p.x / 100, y: p.y / 100 };
      // Center maps to the canonical 'frameCenter' token (spec: tokens are a
      // valid canonical form; bundled presets author centers as the token).
      if (Math.abs(norm.x - 0.5) < 1e-9 && Math.abs(norm.y - 0.5) < 1e-9) return 'frameCenter';
      return norm;
    }
    case 'boolean': return (native as number) !== 0;
  }
}
