### Task 5 Report — EffectParameterMap shuffle test

**Status:** DONE

**Commits:**
- `4edc82ef1f3297c2741f6d7591c5c194107068d6` — test(panel): cover EffectParameterMap shuffle + missing/duplicate wireName

**Test command:** `node tools/run-panel-tests.mjs`
**Result:** ALL TEST SUITES PASSED (13) — full panel suite green.

**Tests added** (`src/statemotion/panel/src/domain/parameterMap.test.ts`):
1. `resolves all 20 logical ids by stable wireName in shuffled runtime order` — randomizes runtime order, asserts resolution is by wireName not position (run 3 PASS direct).
2. `missing wireName resolves undefined` — `transition.manualProgress` → undefined when host enumerate returns undefined.
3. `unknown extra param ignored, duplicate wireName first wins` — `transition.mode` → 0, distinct `transition.alignment` → 1.

**Notes:** Brief used vitest-style `test`/`expect`; repo uses `node:assert`, so tests were adapted to the existing `node:assert` + IIFE style (consistent with `valueConversion.test.ts`), no new deps. Implementation (`parameterMap.ts`) untouched as required.

**Concerns:** None.
