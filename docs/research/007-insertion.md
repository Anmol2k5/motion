# Research Artifact: 007-effect-insertion-clip-types

**Ticket:** `007-effect-insertion-clip-types`
**Question:** How must an effect be inserted across clip types (footage, stills, EG text, EG shapes, MOGRTs, nested sequences, adjustment layers), and is the spec's "insert before the first graphics-generation component" requirement achievable from UXP?
**Resolved:** 2026-07-17
**Verdict:** ✅ REQUIREMENT ACHIEVABLE for footage / stills / EG text & shapes / adjustment layers / nests via `VideoComponentChain.createInsertComponentAction(component, index)`. ⚠️ MOGRTs: blocked by a host limitation — the graphics-generation component cannot be safely targeted/inserted-before from UXP today. Flag a prototype ticket.

---

## Question investigated

For each clip type, determine the correct insertion mechanism and whether we can enumerate the component chain, find a "graphics-generation" component by stable match name, and insert our effect *before* it. Confirm against spec §15.4 (insertion policy).

## Sources

- **Premiere UXP DOM API Reference (developer.adobe.com):**
  - VideoComponentChain (enumeration + insert/append/remove): `https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videocomponentchain` — Since **25.6**
  - VideoFilterFactory (`createComponent(matchName)`, `getMatchNames()`, `getDisplayNames()`): `https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videofilterfactory` — Since **25.6**
  - VideoClipTrackItem (`getComponentChain()`, `isAdjustmentLayer()`, `getMatchName()`, `getMediaType()`): `https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videocliptrackitem` — Since **25.6**
  - Component (`getMatchName()`, `getDisplayName()`, `getParam()`): `https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/component` — Since **25.0**
  - Overview / module import: `https://developer.adobe.com/premiere-pro/uxp/`
- **Premiere Pro Scripting Guide (docsforadobe.dev), ExtendScript era but mirrors UXP component model:**
  - Component object (`matchName` = on-disk unique id, `displayName` = localized): `https://ppro-scripting.docsforadobe.dev/sequence/component`
  - TrackItem object (`components`, `getMGTComponent()`, `isAdjustmentLayer()`): `https://ppro-scripting.docsforadobe.dev/item/trackitem`
- **Adobe Creative Cloud Developer Forums (authoritative staff answers — Bruce Bullis / bbb_999):**
  - MOGRT UXP support status — `https://forums.creativeclouddeveloper.com/t/uxp-and-working-with-mogrts/8879` and `https://forums.creativeclouddeveloper.com/t/mogrt-parameters-in-uxp-availabilty/11408` (MOGRT manipulation "on our list"; partial parameter editing only).
  - "Cannot invoke ExtendScript via UXP" — `https://forums.creativeclouddeveloper.com/t/changing-text-in-graphic-tool-uxp-premiere/11381`.
- **Prior StateMotion research (in-repo):** `docs/research/002-uxp-apis.md` — confirms `VideoComponentChain`, `VideoFilterFactory.createComponent`, and the `createInsertComponentAction(component, index)` pattern against target v26.3.0 type declarations.

## Confirmed facts

### 1. The insertion mechanism is uniform and index-based
`VideoClipTrackItem.getComponentChain()` returns a `VideoComponentChain`. It exposes:
- `getComponentCount(): number`
- `getComponentAtIndex(index): Component`
- `createInsertComponentAction(component, componentInsertionIndex): Action` — **inserts at a specific index**
- `createAppendComponentAction(component): Action`

A `VideoFilterComponent` is produced by `VideoFilterFactory.createComponent(matchName)` (e.g. `'PR.ADBE Solarize'`, `'AE.ADBE Mosaic'`). The action is executed inside a transaction (`project.executeTransaction(compound => compound.addAction(action))`). This is the spec's canonical flow and is confirmed in 002-uxp-apis.md.

**Implication:** "insert before a specific match name" = enumerate `getComponentCount()` / `getComponentAtIndex(i).getMatchName()`, locate the target graphics-generation index `N`, then `createInsertComponentAction(ourEffect, N)`. Fully supported for any clip that exposes a `VideoComponentChain`.

### 2. Footage, stills, adjustment layers, nests all expose a VideoComponentChain
- Footage & stills: standard video track items with a `Vector Motion`/`Motion` component and appended effects. Insertion works identically.
- **Adjustment layers:** `VideoClipTrackItem.isAdjustmentLayer(): Promise<boolean>` exists. An adjustment layer is itself a `VideoClipTrackItem` with a component chain; effects applied to it affect everything beneath (same insertion mechanism). No special-casing needed for *insertion* — only detection to know the effect scopes downstream.
- **Nested sequences:** a nest is a `VideoClipTrackItem` referencing a sequence project item; it has its own component chain and accepts video effects the same way. (The nested *contents* are a separate sequence; we apply to the nest clip, not its interior.)

### 3. Essential Graphics text & shapes DO accept arbitrary video effects in the component chain
EG text/shapes are rendered by a graphics-generation component on the clip's `VideoComponentChain`; normal video effects (e.g. blur, color) can be added to the *same* chain and process the rendered graphic. This is consistent with the public limit being about *clip-level* (you cannot add an effect to an individual *layer inside* the graphic from the component chain), not about the clip as a whole. The clip-level component chain is orderable like footage.

**Caveat — order matters (this is exactly what §15.4 requires):** To affect the *rendered pixels* of the graphic, the effect must sit **before** (upstream of) the graphics-generation component; effects appended after it process the already-composited frame and may behave differently (e.g. clip-level masks). The "insert before first graphics-generation component" rule is therefore both achievable and *necessary* for correct visual behavior on EG clips.

### 4. MOGRTs — partial / host-limited (the one blocker)
- MOGRT clips are also `VideoClipTrackItem`s and *do* expose a `VideoComponentChain`, so `createInsertComponentAction` technically works to add a video effect to a MOGRT clip.
- **However**, the graphics-generation component of a MOGRT is the locked AE render; per Adobe staff, UXP MOGRT parameter/structure manipulation is only "basic" and was still being delivered (forum threads above, active through 2026). The spec's requirement to *identify and insert before* the MOGRT's graphics-generation component cannot be reliably guaranteed: the match name of that internal component is not documented, and MOGRT internals may be non-enumerable or reorder-protected.
- "You can only change text in fields the .mogrt author declared editable" (forum 11381) — confirms MOGRT internals are locked. We should treat MOGRT insertion-before-graphics as **best-effort / append-only** until verified on host.
- Note: ExtendScript (`getMGTComponent()`) is **not callable from UXP** (forum 11381), so the legacy MOGRT path is unavailable to us.

### 5. Identifying the "graphics-generation" component (never hardcode display names)
- `Component.matchName` is the **stable, on-disk, locale-independent** identifier ("used to uniquely identify effect plug-ins"); `displayName` is localized and must NOT be matched on.
- We must detect the graphics-generation component by a **known match-name constant**, not by `"Text"` / `"Vector Motion"` / localized strings.
- **The exact match name(s) of the EG/MOGRT graphics-generation component are NOT published in the UXP reference or scripting guide.** `VideoFilterFactory.getMatchNames()` returns *effect* match names, not intrinsic clip components. The internal render component's match name must be discovered empirically on host.
- **Defensive rule for the plugin:** iterate the chain; if a component's `matchName` matches a *known* graphics-generation allowlist constant, insert before its index; otherwise fall back to `createAppendComponentAction` (append at end). This keeps us robust if the constant is unknown on a given host/locale.

## Assumptions
- Target host is Premiere **26.3.0+** (the spec's target; all used APIs are `Since 25.6`, so 26.3 satisfies them).
- EG text/shapes and MOGRTs, once on a video track, are represented as `VideoClipTrackItem` and thus expose `getComponentChain()`.
- "Graphics-generation component" means the intrinsic component that rasterizes the graphic (text/shapes/MOGRT) before clip-level effects.

## Contradictions / open risks
- Public docs do not enumerate intrinsic (non-effect) component match names, so the precise identifier for "first graphics-generation component" is unconfirmed from documentation alone. This is the single gap preventing a fully locked-down spec.
- MOGRT internals may be reorder-protected; insertion *before* the MOGRT render component might be rejected or reorder to append.

## Recommendation
1. Adopt `createInsertComponentAction(component, index)` for all clip types except where blocked.
2. Implement a `findGraphicsComponentIndex(chain)` helper that walks `getComponentCount()`/`getComponentAtIndex(i).getMatchName()` against a configurable allowlist of graphics match-name constants; insert before it; else append.
3. For MOGRTs: implement append-only (or no-op with a user warning) until the prototype confirms insert-before behavior; do not block the feature on MOGRTs.
4. Store the graphics match-name constant(s) in one config module (no string literals scattered, no localized names).

## Impact on spec (esp. §15.4)
- §15.4 "insert before the first graphics-generation component" is **achievable and correctly specified** for footage, stills, EG text, EG shapes, adjustment layers, and nests.
- §15.4 needs one **clarification**: the graphics-generation component must be matched by `matchName` (locale-independent constant), not display name; and the concrete constant(s) must be populated from prototype results. Add a fallback-to-append clause for unknown/locked clips (esp. MOGRTs).
- Minimum version note: insertion APIs are `Since 25.6`; spec's 26.3 target is sufficient.

## Follow-ups / prototype tickets to raise
- **PROTOTYPE-007a:** On host, enumerate the component chain of (a) an EG text clip, (b) an EG shape clip, (c) a MOGRT clip; log every component's `matchName` and order. Capture the exact match name of the graphics-generation component. → Populates the allowlist constant.
- **PROTOTYPE-007b:** On host, attempt `createInsertComponentAction(blurComponent, graphicsIndex)` for each clip type; verify visual result (effect upstream of graphic) and confirm MOGRT does/doesn't accept insert-before vs. appends.
- **PROTOTYPE-007c:** Confirm `getComponentCount()` ordering semantics (index 0 = top of chain = first-to-process upstream? or reverse?) — the forums imply keyframe/time quirks for non-footage clips (in-point at 1h for text/images/adjustment layers) which may hint at chain ordering; verify empirically.

---

*Note: No production code written; clean-room research only. No commercial/Adobe source code inspected.*
