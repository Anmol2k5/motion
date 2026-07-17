# Research Artifact: 002-verify-uxp-apis

**Ticket:** `002-verify-uxp-apis`
**Question:** Verify the exact Premiere UXP APIs needed to apply a native effect and edit its parameters, against the project spec's claimed API names.
**Resolved:** 2026-07-17
**Verdict:** ✅ SPEC CONFIRMED — all claimed API names exist in Premiere UXP v26.3.0 (the spec's target version). Minor signature nuances noted below.

---

## Question investigated

Determine whether the API surface referenced in the StateMotion spec (applying a native effect to a selected clip and editing its parameters, including keyframes) matches the actual Premiere UXP DOM shipped in the target version (Premiere 26.3). Flag any renaming, deprecation, or signature mismatch.

## Sources

- **Primary, authoritative — the installed/target 26.3 type declarations** (`@adobe/premierepro` v26.3.0, the package the spec targets). This is the canonical `.d.ts` and was locally available:
  - GitHub: `https://github.com/adobe/premierepro-types` — release **v26.3.0** (Jun 12, 2026), single bundled declaration file `src/premierepro.d.ts`.
  - Install: `npm i -D @adobe/premierepro` (ships type info only; runtime is the host module `premierepro`).
- **Premiere UXP docs (developer.adobe.com):**
  - Overview / module import & `getActiveProject` / `getActiveSequence`: `https://developer.adobe.com/premiere-pro/uxp/`
  - Premiere DOM API root (`require("premierepro")`): `https://developer.adobe.com/premiere-pro/uxp/ppro-reference/`
- Note: the per-class HTML doc pages under `/ppro-reference/classes/<Name>/` currently 404; the GitHub `.d.ts` is the reliable primary for exact signatures.

## Confirmed facts (verified against v26.3.0 `premierepro.d.ts`)

### 1. Module import — `require("premierepro")`
- Confirmed. Root of the API is accessed at `require('premierepro')` (docs + `.d.ts` root object).
- For TypeScript, the package recommends **type-only imports** (`import type {…} from '@adobe/premierepro'`) plus a runtime `const ppro = require('premierepro')`. So: `require("premierepro")` at runtime is correct; `import` is only for types. **No `import "premierepro"` for the runtime object.**
- Global helper at root: `app.Project` (static), `app.VideoFilterFactory` (static), `app.constants`, `app.core`.

### 2. `Project.getActiveProject()`, `project.getActiveSequence()`
- `app.Project.getActiveProject(): Promise<Project>` — confirmed (static on `Project` type).
- `project.getActiveSequence(): Promise<Sequence>` — confirmed (instance method on `Project`).
- Both async (return Promises). The spec's call forms are correct.

### 3. `sequence.getSelection()`, `TrackItemSelection.getTrackItems()`
- `sequence.getSelection(): Promise<TrackItemSelection>` — confirmed (instance method on `Sequence`, line ~3157).
- `TrackItemSelection.getTrackItems(): Promise<Array<VideoClipTrackItem | AudioClipTrackItem>>` — confirmed (line ~3985). Note it returns a **Promise** and a **union array** (video OR audio), not strictly `VideoClipTrackItem[]`. Filter/cast for video in practice.

### 4. `VideoClipTrackItem.getComponentChain()`
- `VideoClipTrackItem.getComponentChain(): Promise<VideoComponentChain>` — confirmed (line ~4212). Returns a Promise.
- (Audio analogue `AudioClipTrackItem.getComponentChain(): Promise<AudioComponentChain>` also exists.)

### 5. `VideoFilterFactory.createComponent(matchName)`
- `app.VideoFilterFactory.createComponent(matchName: string): Promise<VideoFilterComponent>` — confirmed (line ~4267). Static on the root factory object. Returns a Promise.
- Companion helpers: `getMatchNames(): Promise<string[]>`, `getDisplayNames(): Promise<string[]>` — useful to validate/lookup effect match names at runtime.
- Note: there is also a separate `createComponentByDisplayName(...)` on `Component` (audio side ~line 598) — not needed for video by matchName.

### 6. `VideoComponentChain.createAppendComponentAction()` / `createInsertComponentAction()` / `createRemoveComponentAction()`
All confirmed on `VideoComponentChain` (lines ~4223–4241):
- `createAppendComponentAction(component: Component | VideoFilterComponent): Action`
- `createInsertComponentAction(component: Component | VideoFilterComponent, componentInsertionIndex: number): Action` — **note the extra required `componentInsertionIndex` parameter** vs the spec's bare signature.
- `createRemoveComponentAction(component: Component | VideoFilterComponent): Action`
- These return an `Action` (synchronous, not a Promise) to be added to a `CompoundAction`.

### 7. `Component.getMatchName()`, `getParamCount()`, `getParam(index)`
All confirmed on `Component` (lines ~1116–1128):
- `getMatchName(): Promise<string>` — async.
- `getParamCount(): number` — **synchronous** (returns number, not a Promise).
- `getParam(paramIndex?: number): ComponentParam` — **synchronous**, returns `ComponentParam`. Index is **zero-based** and optional; if omitted, behavior is component-defined.

### 8. `ComponentParam.getStartValue()`, `createKeyframe(value)`, `createSetValueAction()`
All confirmed on `ComponentParam`:
- `getStartValue(): Promise<Keyframe>` — async, returns a `Keyframe` (the start/initial keyframe).
- `createKeyframe(inValue: number | string | boolean | PointF | Color): Keyframe` — **synchronous**, returns a `Keyframe` object (does NOT auto-apply). Value type depends on the param's type. (Note method name in spec `createKeyframe` matches exactly.)
- `createSetValueAction(inKeyFrame: Keyframe, inSafeForPlayback?: boolean): Action` — **note the argument is a `Keyframe` (e.g. from `createKeyframe`)**, not a raw value. Returns an `Action`.
- Related: `createAddKeyframeAction(inKeyFrame: Keyframe): Action` (add a keyframe), `createRemoveKeyframeAction(inTime: TickTime, updateUI?: boolean): Action`.

### 9. `project.executeTransaction(...)` and `CompoundAction` shape
- `project.executeTransaction(callback: (compoundAction: CompoundAction) => void, undoString?: string): boolean` — confirmed (line ~2546). It is **synchronous**, returns `boolean`. The callback receives the `CompoundAction` and pushes `Action`s into it; transaction commits when callback returns.
- `CompoundAction` shape (lines ~1254–1267):
  ```ts
  export declare type CompoundAction = {
    addAction(action: Action): boolean;
    readonly empty: boolean;
  };
  ```
  So actions are added via `compoundAction.addAction(action)`, NOT via array push or constructor. No explicit "shape" beyond `addAction` + `empty`.
- Companion: `project.lockedAccess(callback: () => void): void` for read/upgrade-locked access (can call `executeTransaction` within).

## Assumptions
- The spec targets Premiere 26.3, which is exactly the `@adobe/premierepro` v26.3.0 declaration we verified. If a different runtime version ships, some async/sync boundaries could differ, but the published 26.3 types are the contract.
- "Apply a native effect" maps to: `VideoFilterFactory.createComponent(matchName)` → `VideoComponentChain.createAppendComponentAction(component)` → add to `CompoundAction` → `executeTransaction`. This is the correct, current pattern.

## Contradictions / mismatches vs the spec
All claimed names exist. Minor signature nuances the spec/implementation must respect:
1. `createInsertComponentAction` takes an **extra required `componentInsertionIndex: number`** argument (not just the component).
2. `createSetValueAction` takes a **`Keyframe` object** (produced by `createKeyframe`), not a raw scalar value.
3. `getParamCount()` and `getParam()` are **synchronous**; `getActiveProject`, `getActiveSequence`, `getSelection`, `getComponentChain`, `createComponent`, `getMatchName`, `getStartValue` are **async (Promise)**. The spec should be explicit about which calls need `await`.
4. `TrackItemSelection.getTrackItems()` returns `Promise<Array<VideoClipTrackItem | AudioClipTrackItem>>` — must filter to video track items.
5. `executeTransaction` is **synchronous** and the `CompoundAction` is populated via `.addAction(...)` inside the callback, not constructed directly.

No renames, no deprecations, no removals of the claimed APIs were found. (One unrelated deprecation exists elsewhere: `Project.createSequence(name, presetPath?)` marks `presetPath` deprecated in favor of `createSequenceWithPresetPath` — not relevant to effect application.)

## Recommendation
- Adopt the verified API surface. Update the spec/implementation boundary (ticket `015-native-uxp-boundary`) to encode the five nuances above, particularly: the `componentInsertionIndex` arg, the `Keyframe` argument to `createSetValueAction`, the sync-vs-async split, and `CompoundAction.addAction()` population inside `executeTransaction`.
- Use the host module `require("premierepro")` at runtime; use `import type {…} from "@adobe/premierepro"` only for compile-time types (pin `@adobe/premierepro@26.3.0` as a devDependency).
- Use `VideoFilterFactory.getMatchNames()` at dev/runtime to validate effect match names rather than hardcoding.

## Impact on spec
- **Low/None on API-name correctness**: every named symbol exists in 26.3.0. The spec's API names are accurate.
- **Medium on implementation detail**: the parameter nuances (esp. #1, #2, #3) must be reflected in the native boundary design or the effect-apply/param-edit flow will not compile/run correctly.

## Follow-ups
- Pin `@adobe/premierepro@26.3.0` in the project and confirm it matches the actual installed Premiere build used for testing.
- Verify whether `getParam()` without an index is safe in practice; prefer explicit zero-based indices.
- Confirm `Keyframe` value types (`PointF`, `Color`) for non-scalar effect params (e.g. position/color effects) when implementing param editing beyond simple scalars.
- Check `minVersion` tags (the docs now annotate min-version per member) to see if any of these members were introduced after an older minimum Premiere version the plugin must support.
