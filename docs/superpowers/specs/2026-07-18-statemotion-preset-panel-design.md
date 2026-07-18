# StateMotion Preset Panel — Design

- **Date:** 2026-07-18
- **Branch:** `feat/preset-panel` (branched from `main` @ `9eef551`, isolated from unfinished `feat/native-parameter-registration`)
- **Status:** Design locked. Implementation plan: `docs/superpowers/plans/2026-07-18-statemotion-preset-panel.md`
- **Clean room:** Original UI, original preset library. No commercial product copied. See `docs/clean-room-notes.md`.

## 1. Goal

A custom UXP panel for Premiere Pro that lets the editor browse, search, favorite,
organize, create, edit, import/export, and apply original StateMotion presets, and
inspect/manage the currently selected StateMotion effect instance. The panel is
**workflow only** — it never renders pixels. The native C++ effect remains the visual
truth.

## 2. Architectural boundary (fixed)

- **Native effect** owns persisted render parameters and project persistence.
- **Panel** owns user workflow: browse, select, read/write logical params via a host
  adapter, presets, favorites, collections, previews.
- **Shared** owns the generated logical contract (`shared/generated/parameter_bindings.hpp`,
  `io.github.anmol2k5.statemotion.preset` format ID) and schema validators.
- The panel **never** stores or transmits Premiere runtime parameter indexes. Index
  resolution is sealed behind `EffectParameterMap` inside `PremiereAdapter`.

## 3. Brainstorm — 3 candidate architectures

### A. Three-view (Library / Inspector / Manage)
Top-level tabs. Library = browse/search/filter. Inspector = current clip/effect
state + apply. Manage = user presets/collections/import-export.

### B. Two-view (Library / Current Clip)
Management actions inline in the Library context menus; Current Clip view handles
apply + creation. Fewer surfaces, more contextual menus.

### C. Command-first (grid + context drawer + command palette)
Keyboard-centric. Power-user ergonomics but heavier to build and less discoverable
for a motion editor.

### Evaluation

| Factor | A | B | C |
|---|---|---|---|
| Narrow docked width (240–320px) | OK (tabs) | OK | Weak (palette eats width) |
| Discoverability | High | Medium | Low |
| A/B workflow clarity | High (Inspector) | Medium | Medium |
| Impl complexity | Medium | Lower | Higher |
| Accessibility | Strong (tabs/buttons) | Medium | Weak (palette) |
| Maintainability | Strong (separation) | Medium | Medium |

### Decision: **A — Three-view**

Rationale: narrow Premiere panel width punishes command palettes; tabs give the
strongest accessibility and clearest A/B + apply story; separation keeps each view
testable as a pure component with a thin host adapter. B was a close second but buries
management behind context menus, hurting discoverability of import/export/collections.

## 4. Original design language

- **Palette:** neutral dark UI (Premiere-aligned), one accent (state-cyan `#36C5D6`),
  semantic colors only for warnings/errors (amber/red). Never color-only — icons +
  text labels for state.
- **Type:** system UI font, two sizes (13px body, 11px meta). No custom typography.
- **Layout:** fixed top tab bar (Library / Inspector / Manage); scrollable content;
  bottom action bar in Library (Apply to selection) and Manage.
- **Preset card:** SVG/CSS preview (deterministic from values) + name + category chip +
  favorite star (text + icon). Context menu: Apply / Edit / Duplicate / Delete /
  Add to collection / Export.
- **Empty/loading/error states:** explicit illustrations (inline SVG) + actionable text.
- **Accessibility:** full keyboard nav, visible focus rings, `role`/`aria-label` on
  icon-only buttons, tooltips, text alternatives for preview cards.

## 5. View specifications

### 5.1 Library
- Search box (name/tags/description/category, normalized substring).
- Category chip row (All + original categories).
- Filter toggle: All / Favorites / User presets / Recently used.
- Sort: A–Z / Newest / Recently used.
- Grid (default) and List toggle.
- Preset cards with favorite toggle + context menu.
- Bottom action bar: "Apply to selection" (enabled when ≥1 supported clip selected).
- States: loading, no-presets, no-selection, search-empty, unsupported-selection.

### 5.2 Inspector
- Selected clip/effect status: detected / not-selected / unsupported / no-StateMotion /
  incompatible (newer contract → read-only diagnostic).
- A/B parameter summary (read via adapter, logical IDs only).
- Currently applied preset (if matched).
- Actions: Apply selected preset / Replace / Swap A↔B / Reset to default / Refresh.
- Compatibility warnings for contract mismatch.

### 5.3 Manage
- User preset list (rename, duplicate, delete, export) with confirm on destructive.
- Collections list (create, rename, delete, add/remove preset). Deleting a collection
  never deletes presets.
- Import (.stmpreset) with validation + migration + error reporting.
- Compatibility diagnostics view.

## 6. Data model summary (see plan for full schema)

Preset JSON (`io.github.anmol2k5.statemotion.preset`, `schemaVersion` 1) carries
`presetId, name, description, author, createdAt, modifiedAt, tags[], category,
collectionIds[], compatibleContract, parameters{ logicalId: value }, preview{}`.
Parameters keyed by **logical ID** only. Unknown optional fields preserved on
round-trip. Explicit migrations keyed by `schemaVersion`.

## 7. Storage

File-backed under UXP `localFileSystem` (plugin data folder):
- `bundled/` — shipped starter presets (read-only; never mutated).
- `user/` — user presets (`<presetId>.stmpreset`).
- `library.json` — favorites (`favoritePresetIds[]`), collections, recently-used,
  metadata. Not a server, not a DB.

## 8. Host adapter (PremiereAdapter + EffectParameterMap)

Thin seam. Responsibilities: current selection, detect StateMotion effect by **match
name** `AE.io.github.anmol2k5.statemotion.effect`, apply effect (single undo),
enumerate params, resolve logical ID → runtime index via wireName/binding, read/write.
`EffectParameterMap` keeps raw indexes internal. Unknown/newer contracts → read-only
diagnostics, no blind writes. Host API usage verified by prototype before use; findings
documented in `docs/implementation/uxp-panel-development.md`. No CEP unless a later
decision proves UXP insufficient.

## 9. Preview system

Deterministic generated cards (SVG/CSS) from preset transform values: direction arrow
(position A→B delta), scale bars, rotation glyph, opacity fade. No video decoding.
Native renderer remains source of truth for actual pixels.

## 10. Apply / create flows

- **Apply:** selected clips → classify supported → locate/reuse StateMotion instance →
  validate contract → resolve param map → validate preset compatibility → build changes
  → one undoable transaction → structured report (applied/skipped/failed, reasons).
- **Create:** from selected instance → read logical params → build user preset →
  edit metadata → generate preview → persist to `user/`.

## 11. Out of scope (this feature)

CPU renderer, GPU, motion blur, crop, stroke, glow, shadow, native easing, native
timeline timing, production installer, licensing, telemetry, cloud. Panel depends only
on the committed logical contract and host-independent preset domain.

## 12. Self-review

- No TBD/TODO placeholders: none.
- Contradictions: none (storage split matches subsystem spec).
- Ambiguous interfaces: `EffectParameterMap` index-resolval is implementation-detail;
  public surface fixed (logical ID in/out).
- Scope creep: none beyond the 20 deliverables.
- Clean-room: original names/values/UI; no commercial asset referenced.
