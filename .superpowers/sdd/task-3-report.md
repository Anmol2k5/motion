### Task 3 Report: PremiereAdapter.readState + create-from-instance

**Status:** DONE

**Commits:**
- `a2fe6f5` feat(panel): add PremiereAdapter.readState + create-from-instance

**Test command:**
`node tools/run-panel-tests.mjs` (run from `src/statemotion/panel`)

**Result:** `ALL TEST SUITES PASSED (12)`

**What was implemented:**
- `premiereAdapter.ts`: added `readState(clip)` returning `CanonicalStateMotionConfig` (canonical values only, metadata excluded via `stateOwnership !== 'metadata'` filter); `getContract` passthrough; exported `ContractIncompatible` / `ContractReadOnly` classes and `CanonicalStateMotionConfig` interface.
- `presetSchema.ts`: added pure `buildUserPresetFromConfig(cfg, contract)` helper that always yields a `validatePreset`-passing preset (falls back to current generated contract when `contract` is null).
- `inspector.ts`: added `setRepository(repo)`, `repository` field, and a "Create preset from selection" button that reads state, builds a preset, and persists via `repository.create`.
- Tests: `premiereAdapter.test.ts` (4 cases incl. the two from the brief) and a `buildUserPresetFromConfig` self-validating case in `presetSchema.test.ts`.

**Concerns / notes:**
- `readState` does NOT convert native→canonical itself; it expects the `HostBridge.readLogical` (UxpHostBridge) to return canonical values, per Task 1/2. The test fake bridge reproduces that conversion with the real `toCanonical`.
- All real Premiere interactions (readLogical/findEffect/getContract) remain NOT YET OPERATOR VERIFIED — they rely on proposed/unverified UXP APIs; existing guarded patterns preserved.
- `inspector.ts` no longer imports `checkCompatibility`; the unused compat import was dropped during the edit (was only used by removed dead path).
- Persisted parameter contract unchanged; no new dependencies; renderer/progress/C++ untouched.

## FIX

**Status:** DONE — defect resolved.

**Commit:** `ca4f53c` fix(panel): move CanonicalStateMotionConfig to domain module to avoid build break

**Change:** Moved `CanonicalStateMotionConfig` interface from `premiereAdapter.ts` (host layer) into `presetSchema.ts` (domain layer) as an exported interface. `premiereAdapter.ts` now imports it via its existing `import type { ... } from '../domain/presetSchema.ts'`. `presetSchema.ts` remains host-free (no import from `../host/*`), eliminating the layering violation and the build-time "Cannot find name 'CanonicalStateMotionConfig'" error.

**Commands run:**
1. `node tools/run-panel-tests.mjs` (from `src/statemotion/panel`)
   - Result: `ALL TEST SUITES PASSED (12)` — including `premiereAdapter.test.ts` (readState/create flow) and `presetSchema.test.ts` (`buildUserPresetFromConfig produces a valid preset`). 0 failures.
2. Type-check to confirm the build break is gone: `tsc --noEmit` (typescript installed locally with `--no-save` for verification).
   - Result: **`Cannot find name 'CanonicalStateMotionConfig'` error GONE.** No errors reference `premiereAdapter.ts` or `presetSchema.ts` for that type.
   - Note: `npm run build` (`build-panel.mjs`) could NOT be executed end-to-end because `esbuild` is not installed (pre-existing, unrelated to this fix). The `tsc --noEmit` run surfaced only PRE-EXISTING, unrelated errors: missing `@types/node` (`node:assert` in *.test.ts), missing CSS side-effect module declaration (`main.ts` styles.css import), and two pre-existing value-conversion type issues in `valueConversion.ts`/`valueConversion.test.ts` and a `presetStorage.ts` `FsLike` re-export conflict. None relate to `CanonicalStateMotionConfig`.

**Build result:** `CanonicalStateMotionConfig` error — GONE (confirmed via tsc). Full `npm run build` blocked by missing `esbuild` dep (pre-existing, not in scope).

**Concerns:**
- The real panel `tsc` build still has pre-existing type errors unrelated to this fix (missing `@types/node`, CSS module declaration, valueConversion/presetStorage). These are out of scope for this single defect and were present before the change.
- `esbuild` is not installed in this environment, so `npm run build` cannot complete here; the fix was verified at the type level via `tsc --noEmit`, which is what would catch the original hard error.
