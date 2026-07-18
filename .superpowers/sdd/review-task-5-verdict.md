# Review Task 5 — EffectParameterMap shuffle test

**Task:** test-only (new test file). Spec: task-5-brief.md. Diff: 38235fd..4edc82e.

## Verdicts

- **Spec compliance: ✅**
- **Code quality: Approved** (with one non-blocking observation, see below)

## Confirmed checks
- Diff touches **ONLY** `parameterMap.test.ts` (1 file, +41). No change to `parameterMap.ts`, no contract change, no new deps. ✅
- `parameterMap.ts` implementation unchanged and matches the file read. ✅
- Test uses `node:assert` (`assert.strictEqual`) and genuinely asserts — no vacuous `pass()` before assertions. ✅
- `missing wireName -> undefined`: asserts `map.resolve('transition.manualProgress') === undefined` via an enumerate that returns `undefined` for that wireName. No throw, no blind index. ✅
- Runs green: `node --experimental-transform-types ...` → 3 PASS. ✅
- Imports resolve correctly: `LOGICAL_IDS` and `getBinding` exist in `shared/generated/parameterBindings.ts`; relative path from the test resolves to repo-root `shared/`. ✅

## Scrutiny: does the shuffle test prove position-independence?
**Partially.** The fixture is wireName-keyed end to end:
- `byWire[wireName] = i` builds the index table by wireName.
- `enumerate = (wireName) => byWire[wireName]` resolves wireName→index.
- `map.resolve(id)` → `getBinding(id).wireName` → `enumerate(wireName)`.

Because `enumerate` is already keyed by wireName (never by array position), a passing test cannot distinguish "resolves by wireName" from a hypothetical "resolves by position" implementation — the data never presents a position-based path. The behavior is, in fact, structurally guaranteed by the implementation (it never receives the param array), so the test still locks current behavior and is a valid regression guard. But the *claim* that it "proves position-independence" is stronger than the test demonstrates. This is a documentation/expectation gap, not a test failure.

## Critical / Important
- **None critical.**
- **Important (non-blocking):** The comment "Resolution must be by wireName, not position" overstates what the fixture proves; a fixture where runtime order/index deliberately diverges from wireName order (e.g., enumerate reads from a position-shuffled array indexed by wireName) would make the proof real. Current test is acceptable as a behavioral lock; flag only if the contract needs an explicit adversarial position test.

## Summary
Spec met exactly. Quality acceptable. One observation: the shuffle test is a valid regression lock but does not adversarially prove position-independence (the fixture is wireName-keyed throughout, so it cannot fail under a position-based resolver). No changes requested to approve.
