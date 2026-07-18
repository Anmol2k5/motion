### Task 4 Report: Fix starter presets to store true canonical values

**Status:** DONE

**Commits:**
- `38235fd` — `fix(panel): store true canonical units in starter presets`
  - Modified `src/statemotion/panel/src/starter/bundledPresets.ts`
  - Modified `src/statemotion/panel/src/starter/bundledPresets.test.ts` (appended canonical-units assertions)
  - Regenerated 16 `.stmpreset` files under `src/statemotion/panel/presets/bundled/`

**Value fixes applied (canonical units):**
- `bundled-wipe-spin`: `transform.rotation.a: -8` → `-8 * Math.PI / 180` (≈ -0.139626).
- All `transform.opacity.b: 100` → `1`: soft-arrival, quiet-fade, rise-up, center-bloom, title-glow-rise.
- Also corrected two presets whose `transform.opacity.a` was `100` (non-canonical percent): soft-exit (`opacity.a` 100→1), drift-away (`opacity.a` 100→1). The brief's affected list named these for a different field, but the test asserts ALL opacity values are ≤1, so they were required to pass.
- `opacity.a: 0`, scale multipliers, and `frameCenter`/`sourceCenter` tokens left unchanged (already canonical).

**Test command + result:**
- `cd src/statemotion/panel && node tools/run-panel-tests.mjs`
- Result: `ALL TEST SUITES PASSED (12)`. New assertion `all bundled presets store true canonical units (radians / 0..1 opacity)` passes; confirmed FAIL before fix (opacity.b got 100), PASS after.

**Regenerate command + result:**
- `cd <repo root> && node --experimental-transform-types tools/generate-bundled-presets.ts`
- Result: `Wrote 16 .stmpreset files to E:\motion-panel-integration\src\statemotion\panel\presets\bundled`. Verified `bundled-wipe-spin.stmpreset` now stores `transform.rotation.a: -0.13962634015954636` and `transform.opacity.b: 1`.

**Concerns:**
- The brief's affected-list omitted soft-exit/drift-away's `opacity.a: 100`, but the canonical-units test (per brief Step 1) requires every opacity value ≤1, so those were fixed too. This is the correct canonical result; flagging in case the brief intended to leave them.
- `.stmpreset` files show git CRLF 'LF will be replaced' warnings — pre-existing line-ending normalization, not introduced by this change.
- No dependencies added, no renderer/progress/C++/contract changes.
