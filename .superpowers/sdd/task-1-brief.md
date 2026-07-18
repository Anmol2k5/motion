### Task 1: Pure canonical↔native conversion layer

**Files:**
- Create: `src/statemotion/panel/src/host/valueConversion.ts`
- Test: `src/statemotion/panel/src/host/valueConversion.test.ts`

**Interfaces:**
- Consumes: `getBinding(logicalId)` and `LOGICAL_IDS` from `../../../../../shared/generated/parameterBindings.ts`; `ParameterBinding` type from same.
- Produces:
  - `type SmPoint = { x: number; y: number };`
  - `type NativeValue = number | string | SmPoint;`
  - `class UnknownLogicalId extends Error`
  - `class ConversionTypeMismatch extends Error`
  - `toNative(logicalId: string, canonical: number | string, binding: ParameterBinding): NativeValue`
  - `toCanonical(logicalId: string, native: number | string, binding: ParameterBinding): number | string`
  - A non-exported `CONVERSION_KIND: Record<string, 'identity' | 'percent' | 'degrees' | 'point'>` keyed by logical ID (built from `LOGICAL_IDS` + the spec §5 table).

Conversion rules (mirror `statemotion_native_adapter.hpp`):
- `identity`: return value unchanged.
- `percent`: canonical→native `v*100`; native→canonical `v/100` (opacity additionally `clamp(v/100,0,1)`).
- `degrees`: canonical→native `v*180/Math.PI`; native→canonical `v*Math.PI/180`.
- `point`: canonical `{x,y}` or token string (`'frameCenter'`/`'sourceCenter'`) → native `{x:v*100, y:v*100}`; reverse `v/100`. Token resolve: `frameCenter`/`sourceCenter` → `{0.5,0.5}`.
- `nativeType` guard: if `binding.nativeType` disagrees with the expected type for the kind (e.g. kind `point` but `nativeType !== 'POINT'`, or kind `percent`/`degrees` but `nativeType !== 'FLOAT_SLIDER'`/`'ANGLE'`), throw `ConversionTypeMismatch`.
- Unknown logical ID (no binding) → throw `UnknownLogicalId`.

- [ ] **Step 1: Write the failing test**

```ts
// valueConversion.test.ts
import { toNative, toCanonical, UnknownLogicalId, ConversionTypeMismatch } from './valueConversion';
import { getBinding, PARAMETER_COUNT } from '../../../../../shared/generated/parameterBindings.ts';

const b = (id: string) => getBinding(id)!;

test('manualProgress 0..1 <-> 0..100', () => {
  expect(toNative('transition.manualProgress', 0.5, b('transition.manualProgress'))).toBe(50);
  expect(toNative('transition.manualProgress', 1, b('transition.manualProgress'))).toBe(100);
  expect(toCanonical('transition.manualProgress', 50, b('transition.manualProgress'))).toBe(0.5);
  expect(toCanonical('transition.manualProgress', 100, b('transition.manualProgress'))).toBe(1);
});

test('duration/delay identity round trip', () => {
  expect(toNative('transition.durationSeconds', 2.5, b('transition.durationSeconds'))).toBe(2.5);
  expect(toCanonical('transition.delaySeconds', 0, b('transition.delaySeconds'))).toBe(0);
});

test('scale multiplier <-> percent', () => {
  expect(toNative('transform.scaleX.a', 1.3, b('transform.scaleX.a'))).toBe(130);
  expect(toCanonical('transform.scaleX.a', 130, b('transform.scaleX.a'))).toBeCloseTo(1.3);
  expect(toCanonical('transform.scaleX.a', 50, b('transform.scaleX.a'))).toBeCloseTo(0.5);
});

test('opacity 0..1 <-> percent (canonical clamps to 0..1)', () => {
  expect(toNative('transform.opacity.a', 1, b('transform.opacity.a'))).toBe(100);
  expect(toCanonical('transform.opacity.a', 50, b('transform.opacity.a'))).toBe(0.5);
  expect(toCanonical('transform.opacity.a', 250, b('transform.opacity.a'))).toBe(1);
});

test('rotation radians <-> degrees', () => {
  expect(toNative('transform.rotation.a', Math.PI / 2, b('transform.rotation.a'))).toBeCloseTo(90);
  expect(toNative('transform.rotation.a', -Math.PI / 4, b('transform.rotation.a'))).toBeCloseTo(-45);
  expect(toCanonical('transform.rotation.a', 180, b('transform.rotation.a'))).toBeCloseTo(Math.PI);
});

test('point normalized <-> percent, token resolves', () => {
  expect(toNative('transform.position.a', { x: 0.5, y: 0.5 }, b('transform.position.a'))).toEqual({ x: 50, y: 50 });
  expect(toNative('transform.position.a', 'frameCenter', b('transform.position.a'))).toEqual({ x: 50, y: 50 });
  expect(toCanonical('transform.position.a', { x: 100, y: 100 }, b('transform.position.a'))).toEqual({ x: 1, y: 1 });
});

test('popup enum identity', () => {
  expect(toNative('transition.mode', 3, b('transition.mode'))).toBe(3);
  expect(toCanonical('transition.mode', 5, b('transition.mode'))).toBe(5);
});

test('unknown logical id throws', () => {
  expect(() => toNative('nope', 1, { nativeType: 'FLOAT_SLIDER' } as any)).toThrow(UnknownLogicalId);
});

test('logicalId/nativeType disagreement throws', () => {
  // rotation kind expects ANGLE; feed a FLOAT_SLIDER binding
  expect(() => toNative('transform.rotation.a', 1, b('transform.scaleX.a'))).toThrow(ConversionTypeMismatch);
});

test('all 20 logical ids have a conversion kind', () => {
  for (const id of LOGICAL_IDS) expect(() => toNative(id, 1, b(id))).not.toThrow(UnknownLogicalId);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd E:\motion-panel-integration\src\statemotion\panel && npx tsx tools/run-panel-tests.mjs src/host/valueConversion.test.ts` (or the project's test command)
Expected: FAIL — module `valueConversion` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// valueConversion.ts
// Pure canonical<->native conversion for StateMotion logical parameters.
// Mirrors src/statemotion/adobe/statemotion_native_adapter.hpp math.
// Host-free: receives/returns only StateMotion-owned values.

import { getBinding, LOGICAL_IDS, type ParameterBinding } from '../../../../../shared/generated/parameterBindings.ts';

export interface SmPoint { x: number; y: number; }
export type NativeValue = number | string | SmPoint;

export class UnknownLogicalId extends Error {
  constructor(public logicalId: string) { super(`Unknown logical ID: ${logicalId}`); }
}
export class ConversionTypeMismatch extends Error {
  constructor(public logicalId: string, public expected: string, public actual: string) {
    super(`Conversion type mismatch for ${logicalId}: expected ${expected}, got ${actual}`);
  }
}

type Kind = 'identity' | 'percent' | 'degrees' | 'point';

// Logical ID -> conversion kind. Built from the generated contract so no raw
// string literals are scattered at call sites. nativeType is a validation guard,
// not the selector (FLOAT_SLIDER is semantically ambiguous).
const CONVERSION_KIND: Record<string, Kind> = {};
for (const id of LOGICAL_IDS) {
  if (id === 'transition.mode' || id === 'transition.alignment') CONVERSION_KIND[id] = 'identity';
  else if (id === 'transition.durationSeconds' || id === 'transition.delaySeconds') CONVERSION_KIND[id] = 'identity';
  else if (id === 'transition.manualProgress') CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('transform.scale')) CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('transform.rotation')) CONVERSION_KIND[id] = 'degrees';
  else if (id.startsWith('transform.opacity')) CONVERSION_KIND[id] = 'percent';
  else if (id.startsWith('transform.position') || id.startsWith('transform.anchor')) CONVERSION_KIND[id] = 'point';
}

const EXPECTED_NATIVE: Record<Kind, string> = {
  identity: 'POPUP', // enums; also seconds pass-through uses FLOAT_SLIDER — guarded below
  percent: 'FLOAT_SLIDER',
  degrees: 'ANGLE',
  point: 'POINT',
};

function resolvePoint(canonical: number | string): SmPoint {
  if (typeof canonical === 'string') {
    if (canonical === 'frameCenter' || canonical === 'sourceCenter') return { x: 0.5, y: 0.5 };
    throw new ConversionTypeMismatch(String(canonical), 'point token', 'unknown token');
  }
  return canonical as SmPoint;
}

function guard(logicalId: string, kind: Kind, binding: ParameterBinding): void {
  const expected = EXPECTED_NATIVE[kind];
  // identity: seconds (FLOAT_SLIDER) or enum (POPUP) both allowed
  if (kind === 'identity') {
    if (binding.nativeType !== 'FLOAT_SLIDER' && binding.nativeType !== 'POPUP') {
      throw new ConversionTypeMismatch(logicalId, 'FLOAT_SLIDER|POPUP', binding.nativeType);
    }
    return;
  }
  if (binding.nativeType !== expected) {
    throw new ConversionTypeMismatch(logicalId, expected, binding.nativeType);
  }
}

export function toNative(logicalId: string, canonical: number | string, binding: ParameterBinding): NativeValue {
  const b = getBinding(logicalId);
  if (!b) throw new UnknownLogicalId(logicalId);
  const kind = CONVERSION_KIND[logicalId];
  if (!kind) throw new UnknownLogicalId(logicalId);
  guard(logicalId, kind, binding);
  switch (kind) {
    case 'identity': return canonical as number;
    case 'percent': return (canonical as number) * 100;
    case 'degrees': return (canonical as number) * 180 / Math.PI;
    case 'point': {
      const p = resolvePoint(canonical);
      return { x: p.x * 100, y: p.y * 100 };
    }
  }
}

export function toCanonical(logicalId: string, native: number | string, binding: ParameterBinding): number | string {
  const b = getBinding(logicalId);
  if (!b) throw new UnknownLogicalId(logicalId);
  const kind = CONVERSION_KIND[logicalId];
  if (!kind) throw new UnknownLogicalId(logicalId);
  guard(logicalId, kind, binding);
  switch (kind) {
    case 'identity': return native as number;
    case 'percent': {
      const v = (native as number) / 100;
      return logicalId.startsWith('transform.opacity') ? Math.min(1, Math.max(0, v)) : v;
    }
    case 'degrees': return (native as number) * Math.PI / 180;
    case 'point': {
      const p = native as SmPoint;
      return { x: p.x / 100, y: p.y / 100 };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2
Expected: PASS (all valueConversion tests).

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/panel/src/host/valueConversion.ts src/statemotion/panel/src/host/valueConversion.test.ts
git commit -m "feat(panel): add pure canonical<->native conversion layer"
```

---

