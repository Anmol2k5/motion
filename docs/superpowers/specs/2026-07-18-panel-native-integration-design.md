# Panel ↔ Native Effect Integration Design

**Date:** 2026-07-18
**Branch:** `feat/panel-native-integration` (worktree `E:\motion-panel-integration`)
**Base:** `feat/native-transform-integration` @ `05330b9` + merged `feat/preset-panel`
**Status of both feature lines:** code-complete, automated-test-green, **Premiere host boundaries UNVERIFIED** (operator-deferred). This milestone does not change that status.

## 1. Problem

The panel and the native effect were built on a shared parameter contract, but the
seam between them was never completed:

- Presets store **canonical** values (per `parameter-contract.json`):
  - `transition.manualProgress` → normalized 0..1
  - `transform.position.a/b`, `transform.anchor.a/b` → normalized 0..1 point
  - `transform.scaleX/Y.a/b` → multiplier
  - `transform.rotation.a/b` → radians
  - `transform.opacity.a/b` → 0..1
  - `transition.durationSeconds` / `transition.delaySeconds` → seconds
  - `transition.mode` / `transition.alignment` → enum integer
- The native C++ effect (`statemotion_native_adapter.hpp`) reads **native** values:
  - POINT → percent 0..100 (top-left)
  - scale/opacity → percent
  - rotation → degrees
  - manualProgress → 0..100
  - duration/delay → seconds (identity)
  - mode/alignment → enum integer (identity)

The panel's `UxpHostBridge.writeLogical` wrote the canonical logical value
**straight into `prop.setValue(value)` with no conversion** — a real defect.
`readLogical` was a stub returning `undefined`. Therefore the panel could not
correctly drive the native effect, and "create preset from instance" could not
read state back.

## 2. Goals (in scope)

1. A pure, host-free conversion layer mirroring the C++ adapter math.
2. Canonical→native on write, native→canonical on read, confined to the single
   Premiere-touching module (`uxpHost.ts`). `HostBridge` stays logical-value
   based; conversion never leaks into `PremiereAdapter`, the planner, or the
   preset repository.
3. `PremiereAdapter.readState(clip)` → `CanonicalStateMotionConfig` for
   create-from-instance; metadata params excluded.
4. Connect the existing Inspector + create-preset flow to `readState`.
5. Keep `EffectParameterMap` concerned ONLY with logicalId → wireName → volatile
   runtime index (no value conversion).
6. Fix the starter presets that store native-shaped values (degrees/percent)
   so they store true canonical values.
7. Comprehensive pure unit tests; existing panel + native suites stay green.
8. Host gates recorded as **NOT YET OPERATOR VERIFIED**.

## 3. Out of scope (Ponytail boundaries)

- No change to the persisted native parameter contract (disk IDs, wireNames,
  `bindingRevision`, `schemaVersion`, `parameterCount`).
- No new bundler, framework, or dependency.
- No CEP fallback, no GPU/CUDA/Metal, no crop/mask/stroke/glow/shadow/motion
  blur, no custom easing.
- No change to the renderer or progress engine.
- No merge/rebase of `main` or the two source feature branches.
- No claim that Premiere read/write/apply works until operator-verified.

## 4. Architecture of the conversion seam

```
Premiere host-specific value shape (POINT object/array, etc.)
        │  marshal
        ▼
UxpHostBridge  (the ONLY Premiere-touching module)
        │  native StateMotion value (number | string)
        ▼
valueConversion.ts  (pure; StateMotion-owned types only)
        │  canonical logical value
        ▼
HostBridge.readLogical / writeLogical  (logical-value contract)
        │
        ▼
PremiereAdapter  (never sees native %, degrees)
        │
        ▼
preset repository  (canonical only)
```

- `HostBridge.writeLogical(clip, logicalId, canonicalValue)` — the adapter still
  passes **canonical** values. `UxpHostBridge` converts canonical→native
  internally using `valueConversion.toNative`, then marshals to the host shape
  and calls `setValue`.
- `HostBridge.readLogical(clip, logicalId)` — `UxpHostBridge` reads the
  native host shape, marshals to a native value, converts native→canonical via
  `valueConversion.toCanonical`, returns canonical.
- The pure converter receives/returns **StateMotion-owned** values
  (`number` or `{x,y}` point). It must NOT assume a Premiere POINT return
  shape — that marshal/unmarshal lives only in `UxpHostBridge`.

## 5. Conversion selector — nativeType is a VALIDATION GUARD, not the sole selector

`FLOAT_SLIDER` is semantically ambiguous (seconds vs percent vs 0..1), so the
conversion kind is selected by the **generated logical-ID constant**, never by a
raw string comparison scattered through the code. The conversion table:

| Logical family (generated const) | nativeType | Canonical → Native | Native → Canonical |
|---|---|---|---|
| `transition.mode` / `transition.alignment` | POPUP | identity integer | identity integer |
| `transition.durationSeconds` | FLOAT_SLIDER | identity number | identity number |
| `transition.delaySeconds` | FLOAT_SLIDER | identity number | identity number |
| `transition.manualProgress` | FLOAT_SLIDER | `v * 100` | `v / 100` |
| `transform.position.a/b` | POINT | `{x*100, y*100}` (token `frameCenter`/`sourceCenter` → `50,50`) | `{x/100, y/100}` |
| `transform.anchor.a/b` | POINT | same as position | same |
| `transform.scaleX/Y.a/b` | FLOAT_SLIDER | `v * 100` | `v / 100` |
| `transform.rotation.a/b` | ANGLE | `v * 180/π` | `v * π/180` |
| `transform.opacity.a/b` | FLOAT_SLIDER | `v * 100` | `clamp(v/100, 0, 1)` |

The selector maps each **logical ID** to one of these semantics. `nativeType` is
checked against the expected type for that logical ID; a mismatch throws a typed
error (`ConversionTypeMismatch`). An unknown logical ID throws
`UnknownLogicalId`.

POINT canonical value may be either a normalized `{x,y}` or the string token
`frameCenter` / `sourceCenter` (resolved via the same rule as
`statemotion_point_default.hpp`). The pure converter handles both; the host marshal
only deals with the numeric percent point the native side uses.

## 6. Pure module `src/host/valueConversion.ts`

- `type Point = { x: number; y: number };`
- `type NativeValue = number | string | Point;` (string only for POINT tokens)
- `toNative(logicalId: string, canonical: number | string, binding): NativeValue`
- `toCanonical(logicalId: string, native: number | string, binding): number | string`
- A `LOGICAL_CONVERSION` map: `Record<string, 'identity' | 'percent' | 'degrees' | 'point'>`
  keyed by logical ID (from `LOGICAL_IDS`), populated from the generated
  bindings + the table above. No raw string literals in call sites.
- Typed errors: `UnknownLogicalId`, `ConversionTypeMismatch`.
- Mirrors `statemotion_native_adapter.hpp` math exactly (π constant, ×100, clamp).
- No imports of UXP / Premiere objects; no `globalThis`; no DOM.

## 7. `UxpHostBridge` changes (minimal)

- `writeLogical`: resolve binding; `const native = toNative(logicalId, value, binding)`;
  marshal native → host shape; `prop.setValue(marshaled)`. Guard: if `toNative`
  throws, surface typed error (do not blind-write).
- `readLogical`: resolve binding; read native host shape → `const native = unmarshal(...)`;
  `return toCanonical(logicalId, native, binding)`.
- POINT marshal: native percent point `{x:number,y:number}` → host object/array
  (exact shape documented as UNVERIFIED; guarded). Tokens are converted before
  marshal (canonical token → `50,50`).

`HostBridge` interface signature unchanged (logical values). `PremiereAdapter`
unchanged except the new `readState` method.

## 8. `PremiereAdapter.readState(clip)`

1. Locate valid StateMotion instance (`findEffect` / `hasStateMotionEffect`).
2. Validate contract via `checkCompatibility(host.getContract(clip))`.
   - `Incompatible` → throw `ContractIncompatible`.
   - `ReadOnly` → throw `ContractReadOnly` (cannot author a canonical preset
     from an unknown/older contract safely).
3. Build `EffectParameterMap` (wireName → runtime index).
4. For each **creative** logical ID (`stateOwnership !== 'metadata'`),
   `const v = await host.readLogical(clip, logicalId)`; collect canonical values.
5. Return `CanonicalStateMotionConfig { parameters: Record<string, number|string> }`
   (metadata excluded).

## 9. Create-from-instance flow

```
selected compatible StateMotion instance
  → PremiereAdapter.readState(clip)
  → CanonicalStateMotionConfig
  → build StateMotionPreset (validatePreset-style, deterministic preview)
  → PresetRepository.addUserPreset(...)
```

Connected from the existing Inspector "Create preset from selection" affordance
(wired to `adapter.readState`). Preview uses the existing deterministic
`previewCard` generator.

## 10. `EffectParameterMap` — unchanged behavior, add shuffle test

Remains: logicalId → binding → wireName → volatile runtime index, cached.
New test: supply the 20 parameters in **shuffled** runtime order; assert every
logical ID resolves to its correct (position-independent) index. This proves
resolution is by stable wireName, not array position.

## 11. Starter preset correctness (Step 16)

Audit `bundledPresets.ts` against canonical units. Fix technically-invalid values
(do NOT change names/design):

- `bundled-wipe-spin`: `transform.rotation.a: -8` is degrees, not radians.
  Change to canonical radians `-8 * π/180` (≈ `-0.139626`).
- `bundled-soft-arrival`, `bundled-quiet-fade`, `bundled-soft-exit`,
  `bundled-drift-away`, `bundled-center-bloom`, `bundled-title-glow-rise`:
  `transform.opacity.b: 100` is percent, not 0..1. Change to `1`.
  (`opacity.a: 0` is already canonical-correct.)
- Position presets using `'frameCenter'` token: **keep** — the converter
  resolves the token to normalized `0.5,0.5`; this is a valid canonical form
  matching the native point-default contract. Do not expand the library.

## 12. `BINDING_REVISION` naming note

`shared/generated/parameterBindings.ts` exports `BINDING_REVISION` (uppercased
camelCase artifact of `tools/generate-contract.js`). The JSON field is
`bindingRevision`. All consumers use the constant, and `contract.bindingRevision`
(field) is compared against `BINDING_REVISION` (constant) correctly. **No bug.**
Do not rename generated constants.

## 13. Host verification ledger

All real Premiere interactions remain **NOT YET OPERATOR VERIFIED**:
panel load, selection detection, effect application, parameter read, parameter
write, apply preset, undo, save/reopen, create preset from instance, favorites/
collections persistence, import/export, multi-selection, unsupported-item errors,
newer-contract read-only. Native transform render + pixel-format + trim/reverse/
freeze timing also remain UNVERIFIED (carried from the source branch).

## 14. Tests to add

- `valueConversion.test.ts`: duration/delay identity round-trip; manualProgress
  `0→0, 0.5→50, 1→100` + reverse; scale `0.5→50, 1→100, 1.3→130` +
  reverse; opacity `0→0, 0.5→50, 1→100` + reverse **clamps canonical to
  0..1**; rotation `0→0, π/2→90, π→180, -π/4→-45` + reverse; POINT
  `{0,0}→{0,0}, {0.5,0.5}→{50,50}, {1,1}→{100,100}` (tokens resolved);
  popup enum identity; `UnknownLogicalId` for bad ID; `ConversionTypeMismatch`
  for logicalID/nativeType disagreement.
- `parameterMap.test.ts`: shuffled runtime order resolves all 20 by wireName;
  missing wireName → undefined; duplicate wireName → (policy) first wins / typed
  error; unknown extra param ignored.
- `premiereAdapter.test.ts`: `readState` returns canonical creative config,
  excludes metadata; incompatible/readonly contract → typed error; metadata
  never written by apply.

## 15. Commit plan (small logical units)

1. `feat(panel): add pure canonical<->native conversion layer`
2. `fix(panel): convert values in UxpHostBridge read/write`
3. `feat(panel): add PremiereAdapter.readState + create-from-instance`
4. `fix(panel): store true canonical units in starter presets`
5. `test(panel): cover conversion, map shuffle, readState`
6. `docs(panel): host integration verification ledger + runbook`
