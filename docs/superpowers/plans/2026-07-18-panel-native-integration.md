# Panel ↔ Native Effect Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the seam between the StateMotion UXP panel and the native StateMotion effect so presets (canonical values) are correctly converted to native parameter values on write, and native values are read back as canonical on create-from-instance — without touching the persisted parameter contract, renderer, progress engine, or either source feature branch.

**Architecture:** A pure, host-free `valueConversion.ts` maps canonical↔native by generated logical-ID constants (nativeType is only a validation guard). `UxpHostBridge` is the sole Premiere-touching module and performs marshal + conversion on `readLogical`/`writeLogical`. `PremiereAdapter` gains `readState(clip)` returning a metadata-excluded canonical config, wired to the existing create-preset repository. All real Premiere interactions remain NOT YET OPERATOR VERIFIED.

**Tech Stack:** TypeScript (panel), existing `tsc` + `vitest`/custom test runner (`tools/run-panel-tests.mjs`), Node 18+, no new dependencies.

## Global Constraints

- Do not change the persisted native parameter contract: disk IDs, wireNames, `schemaVersion` (1), `bindingRevision` (1), `parameterCount` (20). (verbatim from spec §3)
- Do not modify renderer or progress engine implementations. (spec §3)
- Do not add a new bundler, framework, or dependency. (spec §3)
- `HostBridge` interface stays logical-value based; conversion never leaks into `PremiereAdapter`, the planner, or `PresetRepository`. (spec §2)
- `EffectParameterMap` remains concerned only with logicalId → wireName → volatile runtime index; no value conversion. (spec §5)
- Presets store canonical values only; never native percentages/degrees. (spec §2)
- Starter preset names/design unchanged; only technically-invalid values fixed. (spec §11)
- Do not rename generated constants (`BINDING_REVISION` is a casing artifact, not a bug). (spec §12)
- Host-dependent gates recorded as NOT YET OPERATOR VERIFIED. (spec §13)
- Work only on branch `feat/panel-native-integration` inside worktree `E:\motion-panel-integration`. (task §24)

---

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

### Task 2: Convert values inside UxpHostBridge read/write

**Files:**
- Modify: `src/statemotion/panel/src/host/uxpHost.ts:73-90` (readLogical/writeLogical)
- Test: `src/statemotion/panel/src/host/uxpHost.test.ts`

**Interfaces:**
- Consumes: `toNative`, `toCanonical` from `./valueConversion.ts`; `getBinding` from generated bindings; existing `findEffect`, `enumerateParamIndex`, `resolveClip` helpers in same file.
- Produces: `UxpHostBridge` whose `readLogical`/`writeLogical` now perform conversion; interface signatures in `HostBridge` (`readLogical`, `writeLogical`) unchanged.

The host `setValue`/`getValue` work with native shapes. POINT native shape is unknown/unverified — keep marshal in this module only. For write: `const native = toNative(logicalId, value, binding); prop.setValue(marshal(native));`. For read: `const native = unmarshal(raw); return toCanonical(logicalId, native, binding);`.

- [ ] **Step 1: Write/extend failing test in uxpHost.test.ts**

```ts
// add to uxpHost.test.ts
import { UxpHostBridge } from './uxpHost';
import { getBinding } from '../../../../../shared/generated/parameterBindings.ts';

test('writeLogical converts canonical -> native before setValue', async () => {
  const written: Record<string, unknown> = {};
  const bridge = new UxpHostBridge();
  // minimal fake app with one StateMotion effect exposing a setValue that records native value
  (globalThis as any).app = {
    project: { activeSequence: { videoTracks: [{ clips: [{ nodeId: 'c1', components: [{ matchName: 'AE.io.github.anmol2k5.statemotion.effect', properties: { numProperties: 1, getProperty: (i: number) => ({ displayName: 'SM Manual Progress', setValue: (v: unknown) => { written['transition.manualProgress'] = v; } }) } }] }] } } },
  };
  await bridge.writeLogical({ clipId: 'c1' }, 'transition.manualProgress', 0.5);
  expect(written['transition.manualProgress']).toBe(50); // native percent, not 0.5
});

test('readLogical converts native -> canonical', async () => {
  const bridge = new UxpHostBridge();
  (globalThis as any).app = {
    project: { activeSequence: { videoTracks: [{ clips: [{ nodeId: 'c1', components: [{ matchName: 'AE.io.github.anmol2k5.statemotion.effect', properties: { numProperties: 1, getProperty: (i: number) => ({ displayName: 'SM Manual Progress', getValue: () => 50 }) } }] }] } } },
  };
  const v = await bridge.readLogical({ clipId: 'c1' }, 'transition.manualProgress');
  expect(v).toBe(0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: panel test command on `uxpHost.test.ts`
Expected: FAIL (writeLogical still writes 0.5 raw; readLogical returns undefined).

- [ ] **Step 3: Implement conversion in uxpHost.ts**

Replace `readLogical`/`writeLogical` (lines 73-90) with:

```ts
  // Marshal a StateMotion native value into the host-specific shape. POINT object
  // shape is host-specific and UNVERIFIED; keep this tiny transform here only.
  private marshalNative(_logicalId: string, native: number | string | { x: number; y: number }): unknown {
    return native; // identity until Premiere POINT shape is operator-verified
  }
  private unmarshalNative(_logicalId: string, raw: unknown): number | string | { x: number; y: number } {
    return raw as number | string | { x: number; y: number };
  }

  async readLogical(clip: ClipRef, logicalId: string): Promise<number | string | undefined> {
    const binding = getBinding(logicalId);
    if (!binding) return undefined;
    const effect = await this.findEffect(clip);
    if (!effect) return undefined;
    const wireName = logicalIdToWireName(logicalId);
    const index = wireName ? await this.enumerateParamIndex(clip, wireName) : undefined;
    if (index === undefined) return undefined;
    const prop = effect.properties?.getProperty?.(index);
    if (!prop || typeof prop.getValue !== 'function') return undefined;
    const native = this.unmarshalNative(logicalId, prop.getValue());
    return toCanonical(logicalId, native as any, binding);
  }

  async writeLogical(clip: ClipRef, logicalId: string, value: number | string): Promise<void> {
    const binding = getBinding(logicalId);
    if (!binding) throw new Error(`Unknown logical ID ${logicalId}`);
    const effect = await this.findEffect(clip);
    if (!effect) throw new Error('StateMotion effect not found on clip');
    const wireName = logicalIdToWireName(logicalId);
    const index = wireName ? await this.enumerateParamIndex(clip, wireName) : undefined;
    if (index === undefined) throw new Error(`Cannot resolve parameter ${logicalId} on clip`);
    const prop = effect.properties?.getProperty?.(index);
    if (!prop || typeof prop.setValue !== 'function') {
      throw new Error(`UXP setValue unavailable for ${logicalId} (unverified host API)`);
    }
    const native = toNative(logicalId, value, binding);
    prop.setValue(this.marshalNative(logicalId, native));
  }
```

Add import at top of `uxpHost.ts`:
```ts
import { toNative, toCanonical } from './valueConversion';
```

- [ ] **Step 4: Run test to verify it passes**

Run: panel test command
Expected: PASS (new tests + existing uxpHost tests).

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/panel/src/host/uxpHost.ts src/statemotion/panel/src/host/uxpHost.test.ts
git commit -m "fix(panel): convert canonical<->native in UxpHostBridge read/write"
```

---

### Task 3: PremiereAdapter.readState + create-from-instance

**Files:**
- Modify: `src/statemotion/panel/src/host/premiereAdapter.ts` (add `readState`, typed errors)
- Test: `src/statemotion/panel/src/host/premiereAdapter.test.ts`
- Modify: `src/statemotion/panel/src/ui/inspector.ts` (wire "Create preset from selection")
- Possibly modify: `src/statemotion/panel/src/domain/presetStorage.ts` only if a `buildPresetFromConfig` helper is needed (otherwise build inline in adapter or a small `starter`/`domain` factory).

**Interfaces:**
- Produces:
  - `class ContractIncompatible extends Error`
  - `class ContractReadOnly extends Error`
  - `interface CanonicalStateMotionConfig { parameters: Record<string, number | string>; }`
  - `PremiereAdapter.readState(clip: ClipRef): Promise<CanonicalStateMotionConfig>`
- Consumes: existing `checkCompatibility`, `CompaLevel` from `../domain/compatibility.ts`; `getBinding` (for `stateOwnership !== 'metadata'` filter) from generated bindings; `HostBridge.getContract`, `readLogical`; existing `PresetRepository.create` (already exists, validates + writes).

`readState` flow (spec §8): locate valid instance → validate contract (throw if Incompatible/ReadOnly) → build `EffectParameterMap` → for each creative logical ID (`stateOwnership !== 'metadata'`) call `host.readLogical(clip, id)` → collect canonical → return `{ parameters }` (metadata excluded).

- [ ] **Step 1: Write failing test**

```ts
// in premiereAdapter.test.ts
test('readState returns canonical creative config, excludes metadata', async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithState({
    'transition.manualProgress': 50,      // native -> canonical 0.5
    'transform.scaleX.b': 130,           // native -> canonical 1.3
    'transform.opacity.b': 100,          // native -> canonical 1
    'contract.schemaVersion': 1,
    'contract.parameterCount': 20,
    'contract.bindingRevision': 1,
  }));
  const cfg = await adapter.readState({ clipId: 'c1' });
  expect(cfg.parameters['transition.manualProgress']).toBe(0.5);
  expect(cfg.parameters['transform.scaleX.b']).toBeCloseTo(1.3);
  expect(cfg.parameters['transform.opacity.b']).toBe(1);
  expect(cfg.parameters['contract.schemaVersion']).toBeUndefined();
});

test('readState throws on incompatible contract', async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithContract({ schemaVersion: 2, bindingRevision: 1, parameterCount: 20 }));
  await expect(adapter.readState({ clipId: 'c1' })).rejects.toThrow();
});
```

(`fakeBridgeWithState` is a test double: `getContract` returns the 3 metadata native values mapped to a contract; `readLogical` converts native→canonical via the real `toCanonical`; `enumerateParamIndex` returns a stable index by wireName. Add a `fakeBridgeWithContract` helper for the incompatible case.)

- [ ] **Step 2: Run test to verify it fails**

Run: panel test command
Expected: FAIL (readState not defined).

- [ ] **Step 3: Implement readState in premiereAdapter.ts**

Add to `premiereAdapter.ts` (after `applyPresetToSelection`):

```ts
export class ContractIncompatible extends Error {
  constructor(public reasons: string[]) { super('Contract incompatible: ' + reasons.join('; ')); }
}
export class ContractReadOnly extends Error {
  constructor(public reasons: string[]) { super('Contract read-only: ' + reasons.join('; ')); }
}

export interface CanonicalStateMotionConfig {
  parameters: Record<string, number | string>;
}

// Pure filter: creative params only (exclude hidden metadata ownership).
function isCreative(logicalId: string): boolean {
  const b = getBinding(logicalId);
  return !!b && b.stateOwnership !== 'metadata';
}

async readState(clip: ClipRef): Promise<CanonicalStateMotionConfig> {
  const contract = await this.host.getContract(clip);
  const compat = checkCompatibility(contract);
  if (compat.level === CompatLevel.Incompatible) throw new ContractIncompatible(compat.reasons);
  if (compat.level === CompatLevel.ReadOnly) throw new ContractReadOnly(compat.reasons);
  if (!(await this.host.hasStateMotionEffect(clip))) throw new Error('No StateMotion effect on clip');

  const params: Record<string, number | string> = {};
  for (const id of LOGICAL_IDS) {
    if (!isCreative(id)) continue;            // never read metadata
    const v = await this.host.readLogical(clip, id);
    if (v === undefined) continue;
    params[id] = v;
  }
  return { parameters: params };
}
```

Add imports: `import { getBinding, LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';` (merge with existing compat import line).

- [ ] **Step 4: Run test to verify it passes**

Run: panel test command
Expected: PASS.

- [ ] **Step 5: Wire create-from-instance in inspector.ts**

Add a `getContract(clip: ClipRef)` passthrough method on `PremiereAdapter` that calls `this.host.getContract(clip)` (so the inspector can read `compatibleContract` without touching the host directly). Add `setRepository(repo: PresetRepository)` to `InspectorView`. In `render`, after the supported-summary block, add a "Create preset from selection" button:

```ts
const createBtn = el('button', { class: 'sm-btn', text: 'Create preset from selection' }) as HTMLButtonElement;
createBtn.addEventListener('click', async () => {
  try {
    const clip = supported[0];
    const cfg = await this.adapter.readState(clip);
    const contract = await this.adapter.getContract(clip);
    const preset = buildUserPresetFromConfig(cfg, contract);
    await this.repository.create(preset);
    showState(container, '✅', 'Preset created', `Saved "${preset.name}" from ${clip.clipId}.`);
  } catch (e) {
    showState(container, '⚠️', 'Create failed', String((e as Error).message));
  }
});
```

`buildUserPresetFromConfig(cfg: CanonicalStateMotionConfig, contract: CompatibleContract | null): StateMotionPreset` is a small pure helper (add to `src/domain/presetSchema.ts`). It assembles a valid preset: `formatId`, `schemaVersion: CURRENT_SCHEMA_VERSION`, generated `presetId` (`'user-' + Date.now().toString(36)`), name `StateMotion <clipId>`, empty description/author `'StateMotion'`, ISO timestamps, empty tags, category `'Custom'`, empty collections, `compatibleContract` from the passed contract (fallback to current generated `{schemaVersion, bindingRevision, parameterCount}`), `parameters: cfg.parameters`, `preview: { kind: 'generated' }`. Assert `validatePreset(preset).ok` in its own test.

- [ ] **Step 6: Run full panel test suite**

Run: panel test command (all)
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/statemotion/panel/src/host/premiereAdapter.ts src/statemotion/panel/src/host/premiereAdapter.test.ts src/statemotion/panel/src/ui/inspector.ts
git commit -m "feat(panel): add PremiereAdapter.readState + create-from-instance"
```

---

### Task 4: Fix starter presets to store true canonical values

**Files:**
- Modify: `src/statemotion/panel/src/starter/bundledPresets.ts` (rotation + opacity values)
- Test: `src/statemotion/panel/src/starter/bundledPresets.test.ts`

**Interfaces:**
- Consumes: `BUNDLED_PRESETS` from same; `validatePreset` from `../domain/presetSchema.ts`; `toNative`/`toCanonical` from `../host/valueConversion.ts` (to assert the stored canonical values convert to sane native values).

Fix per spec §11:
- `bundled-wipe-spin`: `transform.rotation.a: -8` → `-8 * Math.PI / 180` (≈ `-0.139626`).
- All `transform.opacity.b: 100` → `1` (in: soft-arrival, quiet-fade, soft-exit, drift-away, center-bloom, title-glow-rise). `opacity.a: 0` already canonical.
- Position `'frameCenter'` tokens: unchanged (converter resolves to 0.5,0.5).

- [ ] **Step 1: Write failing test**

```ts
// bundledPresets.test.ts
import { BUNDLED_PRESETS } from './bundledPresets';
import { validatePreset } from '../domain/presetSchema';
import { getBinding, LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';
import { toNative } from '../host/valueConversion';

test('all bundled presets are valid and canonical-shaped', () => {
  for (const p of BUNDLED_PRESETS) {
    expect(validatePreset(p).ok).toBe(true);
    for (const [id, v] of Object.entries(p.parameters)) {
      // opacity must be 0..1 canonical, not percent
      if (id.startsWith('transform.opacity')) expect(v as number).toBeLessThanOrEqual(1);
      // rotation must be radians, not degrees (|rad| < ~6.3)
      if (id.startsWith('transform.rotation')) expect(Math.abs(v as number)).toBeLessThan(6.3);
      // every stored value must convert to a finite native value
      expect(() => toNative(id, v as any, getBinding(id)!)).not.toThrow();
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: panel test command
Expected: FAIL (opacity.b 100 > 1; rotation.a -8 not radians).

- [ ] **Step 3: Fix the values in bundledPresets.ts**

Apply the edits: `transform.rotation.a: -8` → `transform.rotation.a: -8 * Math.PI / 180`; change each `transform.opacity.b: 100` → `transform.opacity.b: 1`.

- [ ] **Step 4: Run test to verify it passes**

Run: panel test command
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/panel/src/starter/bundledPresets.ts src/statemotion/panel/src/starter/bundledPresets.test.ts
git commit -m "fix(panel): store true canonical units in starter presets"
```

> NOTE: the `.stmpreset` files under `presets/bundled/` are generated by `tools/generate-bundled-presets.ts` from `bundledPresets.ts`. After fixing `bundledPresets.ts`, regenerate them:
> Run: `cd E:\motion-panel-integration\src\statemotion\panel && node tools/generate-bundled-presets.ts`
> Then commit the regenerated `.stmpreset` files alongside `bundledPresets.ts`. Ensure the preset round-trip tests still pass.

---

### Task 5: EffectParameterMap shuffle test

**Files:**
- Test: `src/statemotion/panel/src/domain/parameterMap.test.ts` (new or extend existing)

**Interfaces:**
- Consumes: `EffectParameterMap` from `./parameterMap.ts`; `LOGICAL_IDS` from generated bindings.

- [ ] **Step 1: Write failing/covering test**

```ts
import { EffectParameterMap } from './parameterMap';
import { LOGICAL_IDS, getBinding } from '../../../../../shared/generated/parameterBindings.ts';

test('resolves all 20 logical ids by stable wireName in shuffled runtime order', () => {
  // Simulate the host returning params in a randomized runtime order, keyed by
  // wireName -> runtime index. Resolution must be by wireName, not position.
  const byWire: Record<string, number> = {};
  LOGICAL_IDS.forEach((id, i) => { byWire[getBinding(id)!.wireName] = i; });
  const shuffled = [...LOGICAL_IDS].sort(() => 0.5 - Math.random());
  const enumerate = (wireName: string) => byWire[wireName];

  const map = new EffectParameterMap(enumerate);
  for (const id of shuffled) {
    const expected = byWire[getBinding(id)!.wireName];
    expect(map.resolve(id)).toBe(expected);
  }
});

test('missing wireName resolves undefined', () => {
  const map = new EffectParameterMap((w) => (w === 'SM Manual Progress' ? undefined : 1));
  expect(map.resolve('transition.manualProgress')).toBeUndefined();
});

test('unknown extra param ignored, duplicate wireName first wins', () => {
  // duplicate wireName: enumerate returns the same index for two wireNames
  const map = new EffectParameterMap((w) => (w === 'SM Mode' ? 0 : 1));
  expect(map.resolve('transition.mode')).toBe(0);
  expect(map.resolve('transition.alignment')).toBe(1); // distinct wireName
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: panel test command
Expected: PASS (map logic already position-independent; this locks the behavior).

- [ ] **Step 3: Commit**

```bash
git add src/statemotion/panel/src/domain/parameterMap.test.ts
git commit -m "test(panel): cover EffectParameterMap shuffle + missing/duplicate wireName"
```

---

### Task 6: Host verification ledger + runbook doc

**Files:**
- Create/Modify: `docs/implementation/panel-native-integration.md`

**Interfaces:** none (docs only).

Populate the ledger table with all host-dependent gates marked **NOT YET OPERATOR VERIFIED** (panel load, reload, selection detection, existing-instance detection, effect application, no-duplicate, parameter read, parameter write, apply preset, undo, save/reopen, create-from-instance, favorites/collections persistence, import/export, multi-selection, unsupported-item errors, newer-contract read-only). Also record the carried-over native transform debt (build PASS, automated PASS, Premiere render UNVERIFIED, pixel-format UNVERIFIED, trim/reverse/freeze UNVERIFIED). Preserve the UXP capability matrix from `uxp-panel-development.md` noting which APIs are PROPOSED/UNVERIFIED.

- [ ] **Step 1: Write the ledger doc**

Use the table format from the task §20 host-verification-runbook list (A–R) plus the native debt section. Mark every real-host row `NOT YET OPERATOR VERIFIED`.

- [ ] **Step 2: Commit**

```bash
git add docs/implementation/panel-native-integration.md
git commit -m "docs(panel): add host integration verification ledger + runbook"
```

---

### Task 7: Full verification before completion

**Files:** none (verification only).

- [ ] **Step 1: Run all panel tests**

Run: `cd E:\motion-panel-integration/src/statemotion/panel && <panel test command>` (e.g. `npx tsx tools/run-panel-tests.mjs` or `npm test`)
Expected: 0 failures.

- [ ] **Step 2: Run shared contract tests**

Run: the generator/contract test (e.g. `node tools/generate-contract.test.js`) and any contract-check (`--check`).
Expected: PASS, no generated drift.

- [ ] **Step 3: Run native SDK-free C++ suites**

Run: `cmd /c E:\motion-panel-integration\.scratch\run_all_cpp.bat` (or the repo's equivalent).
Expected: 10 suites, ALL PASSED 0 failures.

- [ ] **Step 4: Build the UXP panel**

Run: the existing panel build (`tools/build-panel.mjs` / `npm run build`).
Expected: dev panel package produced; no type errors.

- [ ] **Step 5: Grep guards**

Confirm: no `runtime index`/`diskId` serialized in presets; no `setValue` outside `uxpHost.ts`; no renderer/progress changes in this branch diff vs `feat/native-transform-integration` except the integration merge + fixes.

- [ ] **Step 6: Commit any final verification-doc tweaks, push branch**

```bash
git push -u origin feat/panel-native-integration
```

Do NOT merge to main. Do NOT force-push.
