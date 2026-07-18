# StateMotion Easing + Custom Curve System — Implementation Plan

**Date:** 2026-07-19
**Branch:** `feat/easing-system` (worktree `E:\motion-easing`)
**Based on:** `feat/panel-native-integration` @ `25b57e5`
**Spec:** `docs/superpowers/specs/2026-07-19-easing-system-design.md`

## Approach

Foundation-first. The contract + easing core are the mathematical source of truth
that everything depends on; implement those directly (no drift). Then dispatch
independent pieces as subagent tasks with TDD + pinned briefs, each reviewed.

## Tasks

### T1 — Contract + generator (foundation)
- Edit `shared/schema/parameter-contract.json`: add `EasingMode` enum (values 0–4,
  original labels), append 5 params (55–59) per spec, bump `bindingRevision` 1→2,
  set `contract.parameterCount` default 25 + `oldProjectDefault` 20.
- Edit `tools/generate-contract.js`: add `EasingMode` to `REQUIRED_ENUMS`.
- Run generator; update `shared/generated/*` + `docs/generated/parameter-contract.md`.
- Verify: `node tools/generate-contract.js --check` OK; existing contract tests pass.
- Commit: `feat(contract): register easing parameters + EasingMode enum`

### T2 — Easing core C++ (foundation)
- New `src/statemotion/progress/easing.hpp` + `easing.cpp`: `EasingMode` enum mirror,
  `EasingCurve`, `evaluateEasing()`, cubic Bezier solver (Newton + bisection fallback),
  deterministic invalid-input fallback.
- `progress_engine.cpp`: extend `ProgressInput` with `easing`+`curve`; replace
  `smoothstep` calls in `evaluateProgress` with `evaluateEasing`; Manual bypass;
  Hold exact. Delete `transform_render.cpp:evaluateCurve` (dead).
- `easing_test.cpp` (SDK-free): Linear/Ease In/Out/InOut/Custom, endpoints,
  monotonicity, invalid inputs, solver fallback.
- Commit: `feat(progress): add shared easing model + cubic bezier evaluator`

### T3 — Shared fixtures + C++/TS parity (foundation)
- New `shared/fixtures/easing-fixtures.json`: all named modes, multiple progress
  values, custom curves, boundaries, invalid cases (expected eased values computed
  from the C++ reference).
- Extend `progress_engine_test.cpp` and `progressEngine.test.ts` to consume fixtures
  with dense parity (1e-6 tolerance) across 0..1.
- Commit: `test: add easing fixtures + dense C++/TS parity`

### T4 — Easing core TS (mirror of T2)
- New `src/statemotion/progress/easing.ts`: identical algorithm to C++ `evaluateEasing`.
- `progressEngine.ts`: extend `ProgressInput`, replace `smoothstep` with
  `evaluateEasing`, Manual bypass, Hold exact.
- `progressEngine.test.ts`: fixture-driven parity.
- Commit: `feat(progress): add TS easing evaluator + engine integration`

### T5 — Panel value conversion
- `valueConversion.ts`: add `transition.easing` (POPUP identity) + 4 curve IDs
  (FLOAT_SLIDER identity, 0..1). Keyed by `LOGICAL_IDS`. `nativeType` guard.
- `valueConversion.test.ts`: every new logical ID both directions.
- Commit: `feat(panel): add easing canonical conversion`

### T6 — Native registration (.aex)
- `statemotion_effect.cpp`: register 5 params (POPUP labels `Linear|Ease In|Ease
  Out|Ease In Out|Custom`; FLOAT_SLIDER 0..1), extend `buildProgressInput` to read
  them into `ProgressInput`. Keep controls visible.
- `statemotion_host_time.hpp`: pass easing through `buildProgressInput`.
- `statemotion_native_adapter_test.cpp` / `statemotion_registration_test.cpp`:
  assert new diskIds + enum + oldProjectDefault.
- Rebuild AEX (build-test only; SDK env available).
- Commit: `feat(native): register easing parameters in effect`

### T7 — Preset schema + migration + readState/apply
- `presetSchema.ts`: include easing in `CanonicalStateMotionConfig`; migrate old
  presets → EASE_IN_OUT + legacy curve; migration unit tests.
- `premiereAdapter.ts` `readState`: read easing params; `buildUserPresetFromConfig`:
  write easing.
- `premiereAdapter.test.ts`: read/write round-trip.
- Commit: `feat(panel): migrate presets to easing model + readState`

### T8 — Panel UI easing control
- `inspector.ts`: Easing dropdown + 4 numeric inputs (Custom only). Original
  StateMotion labels.
- `inspector.test.ts` if applicable.
- Commit: `feat(panel): add easing inspector controls`

### T9 — Starter presets + previews
- `bundledPresets.ts`: assign EasingMode variety (no Custom); update
  `compatibleContract.parameterCount` to 25.
- `tools/generate-bundled-presets.ts`: regenerate `.stmpreset`.
- `bundledPresets.test.ts`: canonical easing values (+ existing `toNative` check).
- Commit: `feat(presets): assign easing choices to starter presets`

### T10 — Docs + ledger
- `docs/implementation/easing-system.md`: canonical/native rep, enum identity, Bezier
  solver, Manual semantics, migration, deferred host gates (all NOT YET OPERATOR
  VERIFIED).
- Update `docs/implementation/panel-native-integration.md` + native ledger to
  preserve verification debt and point at easing work.
- Commit: `docs: document easing system + deferred host gates`

## Review + verify
- `requesting-code-review` on full branch (focus: Bezier solver, X/Y confusion,
  C++/TS drift, accidental Manual easing, old-project migration regressions,
  generated contract drift, FLOAT_SLIDER semantics). Address via `receiving-code-review`.
- `verification-before-completion`: all easing fixtures pass; dense parity passes;
  progress tests pass; contract CHECK OK; 10 C++ suites pass; 13 panel suites pass;
  panel builds; generated outputs deterministic; no runtime indexes serialized;
  no SDK/binary committed; native AEX builds.

## Git
- Work only on `feat/easing-system`. Logical commits per task. Push branch, no merge.
