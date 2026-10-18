# StateMotion Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the documented StateMotion workflow and produce a verified development panel package, with Adobe host certification tracked separately.

**Architecture:** Retain the generated contract, C++ CPU engine, injectable host adapter and TypeScript panel. Repair renderer correctness first, then preset boundaries and transactions, then connect complete UI workflows and release tooling. Tasks have individual test and review boundaries; no rewrite is required.

**Tech Stack:** Node.js 24, TypeScript 5.9.3, esbuild, C++17/GCC 14.2, Adobe Premiere Pro API types 26.3.0; desktop validation additionally needs the Adobe Effect SDK, MSBuild and Premiere Pro 26.3.

**Spec:** `docs/superpowers/specs/2026-10-19-statemotion-completion-design.md`

## Global Constraints

- Use the existing isolated checkout `/workspace/motion`; do not create a worktree unless explicitly requested.
- Preserve effect match name, plugin ID, preset format identity, disk IDs, native types and canonical keys.
- Canonical values use normalized points, multiplier scale, radians and unit opacity. Convert at boundaries exactly once.
- Keep generated files deterministic; change their generator/schema only when a documented compatibility correction requires it.
- Keep TLS, package integrity and lockfile verification enabled. Do not add dependencies merely for convenience.
- GPU acceleration, licensing, cloud sync, telemetry, updater, macOS native port and consumer installer are outside this delivery.
- All regression failures must execute before their fixes. Preserve failure exit codes and report test counts honestly.
- Actual Adobe ABI and native release certification cannot be inferred from fake-host or SDK-free tests.

## Review Focus

- Backup write failure: original malformed library bytes remain intact and recovery stops (Task 5).
- Burst edits and changing selection: mutations serialize, canceled edits commit nothing, stale selection cannot be edited (Tasks 6–7).
- Future-format, malformed-value and legacy-unit imports: only explicitly supported inputs migrate or write (Task 4).
- Async tab/search completion arriving out of order: only the active view renders, query focus stays usable (Tasks 8–9).
- Non-square, transparent, tiny and zero-scale images: effects produce finite premultiplied pixels without invalid sampling (Tasks 1–3).

## File structure and ownership

- Renderer math remains under `src/statemotion/{progress,renderer}`; a new `renderer/frame_render.hpp` owns shared per-sample evaluation, separate from Adobe entry points.
- `panel/src/domain/parameterValues.ts` owns canonical parameter defaults/validation; `presetSchema.ts` owns file-format validation/migration.
- `panel/src/domain/presetStorage.ts` owns serialized disk mutations and recovery; UI never writes files directly.
- `panel/src/host/premiereAdapter.ts` owns operation serialization/reporting; `uxpHost.ts` owns staged host transactions.
- `panel/src/host/userInteraction.ts` owns injectable UXP pickers and panel dialogs. `panel/src/ui/operationStatus.ts` owns pending/result rendering.
- `panel/src/ui/inspector.ts`, `library.ts`, `manage.ts` retain their current responsibilities; `main.ts` owns active-view routing and live diagnostic state.
- `tools/verify-development.mjs` owns aggregate verification; `tools/package-panel.mjs` owns reproducible development packaging.

### Task 1: Native easing and bounded-property interpolation

**Files:** Modify `src/statemotion/progress/easing.cpp`, `easing.hpp`, `easing_test.cpp`, `src/statemotion/renderer/transform_state.hpp`, `transform_state_test.cpp`, `transform_render.cpp`, `transform_render_test.cpp`.

**Interfaces:** Keep `evaluateEasing(EasingMode, const EasingCurve&, double) -> double`, `interpolateCanonical(const TransformState&, const TransformState&, double) -> TransformState`, and `interpolate(const RendererTransformState&, const RendererTransformState&, double) -> RendererTransformState`.

- [ ] Add assertions that the existing spring fixture suite passes, `interpolateCanonical(A,B,1.2)` extrapolates position/scale/rotation, opacity remains in `[0,1]`, and non-finite progress produces finite deterministic output. Test a negative-scale endpoint and source/output dimensions `32x16`.
- [ ] Build the affected SDK-free suites with `g++ -std=c++17 -O2` and existing include/source lists from the audit; confirm fixture/interpolation assertions fail against the baseline.
- [ ] Remove the erroneous constant-return branch, retain residual normalization, and clamp physical properties individually rather than clamping every interpolation factor. Preserve manual-input clamping.
- [ ] Run the affected C++ suites and `node --experimental-transform-types src/statemotion/progress/progressEngine.test.ts`; require zero failures and fixture parity.
- [ ] Commit the easing/interpolation fix with its regression tests.

### Task 2: Actual stroke and glow compositing

**Files:** Modify `src/statemotion/renderer/transform_render.h`, `transform_render.cpp`, `transform_render_test.cpp`; create `src/statemotion/renderer/effect_render_test.cpp`.

**Interfaces:** Keep `plan(const RendererTransformState&, int, int) -> CpuRenderPlan` and `render(const CpuRenderPlan&, Sampler, void*, int, int, Pixel*) -> void`. Renderer scratch buffers remain internal; callers retain output ownership.

- [ ] Add pixel assertions: stroke adds nonzero RGBA outside the crop rectangle; two-color gradient changes with angle/phase; glow adds alpha around an opaque synthetic shape; disabled/zero effects exactly match baseline. Include rounded crop, transparent source, `1x1`, `32x16`, source bounds and premultiplied channel checks.
- [ ] Compile/run the new test against the current renderer; confirm enabled stroke/glow assertions fail.
- [ ] Compute mask-boundary stroke in source space, interpolate both endpoint colors, use separable filtering for glow alpha, and composite shadow/glow/stroke/content in that order. Bound scratch allocations and filter radii to usable frame dimensions.
- [ ] Run all renderer tests; require finite in-range alpha, no changes in disabled baselines, and expected changed pixels. Record a representative CPU timing without claiming a real-time performance guarantee.
- [ ] Commit compositing and tests.

### Task 3: Shared frame evaluation and real blur tests

**Files:** Create `src/statemotion/renderer/frame_render.hpp`, `frame_render_test.cpp`; modify `src/statemotion/adobe/statemotion_effect.cpp` and SDK-free integration tests.

**Interfaces:** Define `FrameRenderInput` containing canonical A/B state, renderer FX A/B state, progress input, render dimensions, shutter interval and sample count. Export `renderFrame(const FrameRenderInput&, Sampler, void*, int, int, Pixel*) -> void` in namespace `statemotion`; Adobe code translates SDK params into this input.

- [ ] Add assertions that one sample matches `render`, a translated shape with shutter sampling covers more than its unblurred support, zero shutter equals one sample, and crop/stroke/glow properties agree in single/multiple-sample paths. Verify finite output for invalid/zero dimensions and near-zero scale.
- [ ] Compile/run the new frame test; confirm it fails before implementation.
- [ ] Extract common sample evaluation from the duplicated native paths. Render complete evaluated frames per sample with normalized weights; preserve the current source-frame sampling limitation explicitly.
- [ ] Run all SDK-free renderer, progress and native integration suites. Native SDK translation remains a desktop compile gate if SDK unavailable.
- [ ] Commit shared evaluation and tests.

### Task 4: Canonical validation and explicit migrations

**Files:** Create `src/statemotion/panel/src/domain/parameterValues.ts`, `parameterValues.test.ts`; modify `presetSchema.ts`, `presetSchema.test.ts`, `backcompat.test.ts`, `compatibility.ts`, `compatibility.test.ts`, `host/valueConversion.ts`, `host/valueConversion.test.ts`.

**Interfaces:** Export `canonicalDefault(logicalId: string): ParameterValue | undefined` and `validateParameterValues(values: unknown): ValidationResult`. Preserve public schema functions; `migratePreset(raw: unknown): StateMotionPreset` throws for unsupported format/version. `validatePreset(unknown): ValidationResult` never throws.

- [ ] Test null/object/array substitutions, unsafe IDs, metadata writes, NaN/infinite/out-of-range numbers, invalid colors/points/tokens, mixed-type string arrays, future schema/revision, and recognized legacy fixtures. Assert `deserializePreset` rejects schema 999 rather than relabeling it. Assert native defaults convert scale `100` to canonical `1` and opacity `100` to `1`.
- [ ] Run these test files with `node --experimental-transform-types`; observe the malformed/future/default failures first.
- [ ] Implement complete shape/value validation and a whitelist of historically evidenced migrations. Inspect generated contracts/history before encoding legacy unit transforms; remove fabricated compatibility fixtures instead of accepting arbitrary revisions. Preserve unknown optional fields after validation.
- [ ] Run the affected tests and `npm --prefix src/statemotion/panel run typecheck`. Require current bundled presets and legitimate historical fixtures to pass.
- [ ] Commit validation/migration changes.

### Task 5: Durable preset repository and collections

**Files:** Modify `src/statemotion/panel/src/domain/presetStorage.ts`, `presetStorage.test.ts`, `collections.ts`, `collections.test.ts`, `libraryModel.ts`, `libraryModel.test.ts`.

**Interfaces:** Preserve `FsLike` and existing public repository methods. Add `getWarnings(): string[]` for sanitized recovery/skipped-file messages. Serialize mutations internally; generated IDs use a collision-resistant source plus on-disk existence checks. `LibraryModel.collections[id].presetIds` is collection membership authority.

- [ ] Convert async tests to awaited completion and add corrupted metadata backup, backup failure preserves original bytes, repeated/concurrent duplicate/import produces unique IDs, failed persistence preserves prior in-memory state, and deletion cleans favorites/recent/collections. Test filtering a bundled preset via library collection membership.
- [ ] Run storage/library tests; verify new failures and a summary printed only after assertions complete.
- [ ] Implement recovery backup-before-replacement, validated reads, serialized writes/IDs, sanitized warnings and metadata cleanup. Preserve original unsupported preset files.
- [ ] Run storage, collection, library and schema suites; require no lost/overwritten presets in injected failure tests.
- [ ] Commit persistence changes.

### Task 6: Serialized, cancelable host operations

**Files:** Modify `src/statemotion/panel/src/host/premiereAdapter.ts`, `uxpHost.ts`, `safeWrite.test.ts`, `premiereAdapter.test.ts`, `uxpHost.test.ts`, `valueConversion.ts`; add `transaction.test.ts`. Update HostBridge fakes for the explicit cancel interface.

**Interfaces:** Add `HostBridge.cancelUndo(): Promise<void>`. Add `PremiereAdapter.writeParameters(clip: ClipRef, values: Record<string, ParameterValue>): Promise<void>` and `runSelectionAction(action: 'swap' | 'remove', clips: ClipRef[]): Promise<ApplyReport>`. Keep single-parameter API delegating to the batch operation and retain `ApplyReport` fields.

- [ ] Test injected second-write failure commits no staged actions; a failed clip does not prevent the next clip succeeding; missing mapping fails the clip; a four-point curve is one commit; concurrent writes serialize; invalid preset queues no effect; changed selection blocks stale targeted edits.
- [ ] Run targeted host tests and observe baseline commit-on-error/nested-operation failures.
- [ ] Add adapter mutation queue and owned transaction lifecycle; validate before mutation, cancel on failure, and report per-clip results. Check actual parameter identity through the installed Adobe API/documentation instead of generated-position guessing. Verify native point/color/popup conventions before changing conversions; unresolved bindings fail closed.
- [ ] Run all host tests plus typecheck. Keep native transaction/ABI host tests explicitly unverified if Adobe cannot run here.
- [ ] Commit host safety changes.

### Task 7: Complete inspector and confirmed-state editing

**Files:** Modify `src/statemotion/panel/src/ui/inspector.ts`, `parameterControls.ts`, `components.ts`, `styles.css`; create `operationStatus.ts`, `inspector.test.ts`, `parameterControls.test.ts` and a small reusable injected DOM fixture under `panel/src/testing/`.

**Interfaces:** Inspector consumes `writeParameters`/`runSelectionAction` from Task 6 and canonical defaults from Task 4. Export `OperationStatus` with `run(action: () => Promise<void>): Promise<void>`; it owns pending/result presentation. Keep `InspectorView.render(container): Promise<void>`, `setRepository` and `setLastPreset`.

- [ ] Test visible controls for every creative binding family, point/angle/percent round trips including decimal inputs, manual progress, colors, capture from selected state, read failure disables controls, rejected write restores confirmed state, pending buttons disable, and curve changes submit one batch.
- [ ] Run inspector/control tests against baseline; confirm missing-control/write-state failures.
- [ ] Read one snapshot, render A/B transform and remaining color/manual controls, add preset capture with generated current contract, and route mutations through serialized operations. Label first-clip editing versus bulk actions. Use accessible accordion buttons and structured status.
- [ ] Run UI/domain/host tests, typecheck and build; require actual event-handler assertions rather than only HTML snapshots.
- [ ] Commit inspector workflow.

### Task 8: Library, collection management and UXP dialogs

**Files:** Create `src/statemotion/panel/src/host/userInteraction.ts`, `userInteraction.test.ts`, `ui/library.test.ts`, `ui/manage.test.ts`; modify `ui/library.ts`, `manage.ts`, `preview/previewCard.ts`, `previewCard.test.ts`, `domain/libraryModel.ts`, `starter/bundledPresets.ts`, `starter/bundledPresets.test.ts` and generated bundled preset files through the existing generator.

**Interfaces:** `UserInteraction` provides `prompt(message: string, initial?: string): Promise<string | null>`, `confirm(message: string): Promise<boolean>`, `importPreset(): Promise<string | null>`, `exportPreset(filename: string, text: string): Promise<void>`. Inject it into views; picker cancel returns null. View apply/favorite callbacks return promises.

- [ ] Test scale/opacity `1` produces full-size/opaque preview, radians display correctly, two endpoint positions differ; movement-oriented starter presets contain a real position delta; capture/new preset uses current contract; collection rename/delete/membership/filter works for bundled/user files; rejected import/export/favorite reports failure; async search retains focus and rejects stale results.
- [ ] Run the new view/preview tests; observe wrong-unit/old-contract/incomplete-collection failures.
- [ ] Correct previews with canonical defaults, give movement-oriented original presets real normalized position endpoints, replace empty old-contract creation with capture workflow, implement collections against library metadata, and use UXP file pickers/in-panel dialogs. Await actions; avoid redrawing the search field on every keystroke.
- [ ] Run panel tests/typecheck/build; use injected picker/dialog fakes to distinguish cancel and failure.
- [ ] Commit library/management workflow.

### Task 9: Routing, diagnostics and entry assets

**Files:** Modify `src/statemotion/panel/src/main.ts`, `ui/diagnosticsView.ts`, `domain/diagnostics.ts`, `index.html`, `ui/styles.css`; add `ui/routing.test.ts`, `ui/diagnosticsView.test.ts`.

**Interfaces:** Main owns monotonic render-generation tokens and a `DiagnosticInput` snapshot updated by selection/operations. Views receive operation outcome callbacks rather than hardcoded diagnostics. Preserve existing diagnostic report API and privacy boundaries.

- [ ] Test delayed earlier tab render cannot replace active view, rejected selection reports error, successful apply alone updates recent history, diagnostics update on failure/success, clipboard absence reports unavailable, and HTML references emitted CSS/JS.
- [ ] Run targeted tests; observe baseline stale-render/constant-status/stylesheet failures.
- [ ] Wire active-view guards and awaited callbacks, real diagnostic state, tab keyboard navigation/focus, clipboard status and CSS loading. Keep runtime-observed capability separate from operator certification.
- [ ] Run all panel tests, typecheck and bundle; inspect package references and narrow-panel layout via the DOM fixture. Leave actual UXP layout as a desktop check.
- [ ] Commit panel bootstrap changes.

### Task 10: Reproducible validation, package and handoff

**Files:** Create `tools/verify-development.mjs`, `tools/package-panel.mjs`, `tools/package-panel.test.mjs`; modify `README.md`, `docs/releases/v0.1-alpha-installation.md`, `v0.1-alpha-host-status.md`, `v0.1-alpha-test-checklist.md` and the current audit.

**Interfaces:** From repo root, `node tools/verify-development.mjs` builds/runs SDK-free suites and all required JS/panel checks, exits nonzero on any failure, and writes current logs under ignored `build/verification/`. `node tools/package-panel.mjs` produces ignored `dist/statemotion-panel-dev.zip` with deterministic sorted contents/timestamps and entry-reference checks.

- [ ] Test packaging rejects missing assets and excludes node_modules/user data/native binaries; repeated builds of unchanged panel assets yield identical archive hashes. Test the validation runner preserves an injected failing child exit status and does not misreport a zero-suite run.
- [ ] Run tooling tests before implementation; confirm missing-command/reference failures.
- [ ] Implement verification and package commands without new runtime dependencies, update manifest-based install/version/platform instructions, and retain explicit unverified native gates. Retry website access when settings change; record only actually observed public behavior.
- [ ] Run `node tools/verify-development.mjs`, `node tools/package-panel.test.mjs`, `node tools/package-panel.mjs`, and `git diff --check`; inspect archive contents/hash and final status. No required Linux check may remain unexplained.
- [ ] Review changes against every spec section, fix regressions, update reusable environment instructions to new commands, and commit verified work. Report desktop SDK/native rebuild, binary hash, plugin load, timing, FX, undo, save/reopen and export as pending until operator evidence exists.

## Plan self-review

All specification sections map to tasks: identity/unit/ABI constraints (1,4,6), renderer/blur (1–3), transactions (6), full UI and presets (4–9), storage/collections (5,8), diagnostics/accessibility (7,9), repeatable tests/package/docs and host evidence (10). The five Review Focus failure classes each have explicit test owners. Interfaces used by later tasks are defined above. No task claims website parity or native certification from unavailable runtime evidence.

Execution recommendation: native, in this session. The tasks share canonical-value and transaction interfaces; one implementer can keep those consistent without repeated context handoffs. No subagents are authorized by this plan alone.
