# Review Verdict — Task 3: PremiereAdapter.readState + create-from-instance

## Spec verdict: ✅ PASS

All brief requirements implemented and verified against behavior:

- **readState returns CANONICAL, excludes metadata** ✅
  `premiereAdapter.ts:109-124` iterates `LOGICAL_IDS` and calls `host.readLogical` (which already returns canonical per Task 1/2 — `uxpHost.ts:81-93`). No double-conversion. `isCreative` (`premiereAdapter.ts:140-142`) skips `stateOwnership === 'metadata'`, so `contract.*` keys never appear. Test asserts `0.5` (not `50`) and `contract.schemaVersion === undefined`.
- **Typed errors exported** ✅ `ContractIncompatible` / `ContractReadOnly` + `CanonicalStateMotionConfig` interface added.
- **buildUserPresetFromConfig yields valid preset** ✅ `presetSchema.ts:188` assembles all REQUIRED_FIELDS, `preview: { kind: 'generated' }`, `compatibleContract` present (fallback to current generated contract). `validatePreset(preset).ok` asserted in `presetSchema.test.ts`.
- **runtime-index leakage** ✅ readState uses `LOGICAL_IDS` only; never serializes/reads runtime indexes.
- **create handler validates before write** ✅ `inspector.ts:47-58` builds + (`buildUserPresetFromConfig` guarantees validity) then `repository.create` — no blind partial write.
- **no fake undo/effect APIs / no new deps / contract unchanged** ✅ existing guarded UXP patterns preserved; no bundler/framework added; persisted native contract untouched.
- **tests assert real behavior** ✅ native `50`→`0.5`, metadata absent, incompatible contract throws (`ContractIncompatible`).
- **operator-verified gates** ✅ report correctly records UXP paths as NOT YET OPERATOR VERIFIED.

## Quality verdict: changes-requested — Important

### Critical
None.

### Important
1. **`presetSchema.ts` uses `CanonicalStateMotionConfig` without importing it.** Line 189 references the type but there is no import; the type is defined/exported only in `premiereAdapter.ts`. The panel test runner uses `node --experimental-transform-types` (type-stripping, no type-check), so this is silent at runtime today — but it is a hard compile error under any real `tsc` typecheck and a latent build break. Add `import type { CanonicalStateMotionConfig } from '../host/premiereAdapter.ts';` to `presetSchema.ts`, or move the interface to a shared/domain module. This is the one finding that should be fixed before merge.

### Minor
1. `inspector.ts:22` has a stray trailing comma after the `showState` arg (harmless, pre-existing style noise).
2. `name: 'StateMotion preset'` (static) is fine but loses the clip id; the success toast prints `clip.clipId`, so behavior is clear. Non-blocking.
3. `getContract` is declared without an explicit return type (`premiereAdapter.ts:105`); infers `Promise<{schemaVersion;bindingRevision;parameterCount} | null>` which matches `CompatibleContract | null` structurally — acceptable, but an explicit `Promise<CompatibleContract | null>` would tighten the seam.

## Summary
Spec: ✅. Quality: changes-requested (1 Important — missing type import that breaks under real typechecking; otherwise clean and spec-faithful).
