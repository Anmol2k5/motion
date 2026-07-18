# StateMotion Preset Panel — Implementation Plan

- **Date:** 2026-07-18
- **Branch:** `feat/preset-panel` (from `main` @ `9eef551`)
- **Design:** `docs/superpowers/specs/2026-07-18-statemotion-preset-panel-design.md`
- **Process:** TDD vertical slices. Host-independent domain logic is pure/testable;
  host adapter is a thin seam with minimal boundary tests. No CEP. No native renderer.

## Tech stack (ponytail — minimal)

- UXP panel: vanilla TypeScript + HTML/CSS (no framework; UXP supports DOM + TS).
- Tests: Node `node --experimental-transform-types file.test.ts` with `node:assert`
  (matches existing `progressEngine.test.ts` convention). No test framework dep.
- Storage: UXP `localFileSystem` (plugin folder) for runtime; presets authored as
  JSON in repo under `src/statemotion/panel/presets/bundled/` and copied at build.
- The authoritative logical contract is consumed from `shared/generated/parameter_bindings.hpp`
  — but TS cannot read C++ headers. Therefore the panel imports a **generated TS
  contract mirror** (`shared/generated/parameter_contract.ts`) produced by
  `tools/generate-contract.js` (extend generator). Single source of truth stays the
  JSON; both C++ and TS bindings are generated. No manual duplication.

## File layout

```
shared/generated/parameter_contract.ts        # NEW (generator-emitted TS mirror)
tools/generate-contract.js                    # EXTEND: also emit TS mirror
tools/generate-contract.test.js               # EXTEND: TS mirror digest test
src/statemotion/panel/
  src/
    domain/
      presetSchema.ts          # formatId, types, validators, migrations
      presetSchema.test.ts
      presetStorage.ts         # local repo: list/get/create/update/duplicate/delete/import/export
      presetStorage.test.ts
      favorites.ts             # toggle/query/filter
      favorites.test.ts
      collections.ts           # create/rename/delete/add/remove/list
      collections.test.ts
      search.ts                # pure search/filter/sort
      search.test.ts
      compatibility.ts         # contract compatibility check
      compatibility.test.ts
      parameterMap.ts          # EffectParameterMap seam (pure resolution logic, host injects indices)
      parameterMap.test.ts
      applyPlan.ts             # build apply plan from selection + preset (pure)
      applyPlan.test.ts
    preview/
      previewCard.ts           # deterministic SVG/CSS preview from preset values
      previewCard.test.ts
    host/
      premiereAdapter.ts       # PremiereAdapter (thin; uses UXP APIs; guarded)
      premiereAdapter.test.ts  # boundary tests with fake host
    ui/
      main.tsx?  -> main.ts (no framework: plain DOM modules)
      library.ts
      inspector.ts
      manage.ts
      components.ts            # card, chip, dialog, states
      styles.css
    starter/
      bundledPresets.ts        # imports JSON array of ~16 original presets
  presets/bundled/*.stmpreset  # authored starter library (also source for bundledPresets.ts)
  index.html
  manifest.json                # UXP manifest (panel ID io.github.anmol2k5.statemotion.panel)
  tsconfig.json
docs/implementation/uxp-panel-development.md
```

## Subsystem tasks (each = red test → green → commit)

### T1 — Generator emits TS contract mirror
- Extend `tools/generate-contract.js` to emit `shared/generated/parameter_contract.ts`
  (const `kContract` with logicalId→{diskId,wireName,nativeType,default,range,...} and
  enums). Deterministic. Add digest check to `generate-contract.test.js`.
- Commit: `feat(panel): generate TS contract mirror from parameter-contract.json`

### T2 — Preset domain model + schema validation
- `presetSchema.ts`: types, `validatePreset`, `migratePreset`, `serializePreset`
  (deterministic — sorted keys, stable float formatting).
- Tests: valid; bad formatId; unsupported schemaVersion; duplicate presetId (in lib);
  missing required field; unknown optional preserved; incompatible contract; invalid
  logicalId (not in contract); import/export round-trip; deterministic serialization.
- Commit: `feat(panel): add preset domain model and schema validation`

### T3 — Local preset repository (storage)
- `presetStorage.ts`: in-memory + file-backed (injectable IO interface so tests use
  temp dir; runtime uses UXP localFileSystem). list/get/create/update/duplicate/delete/
  import/export. Bundled read-only.
- Tests: CRUD round-trip in temp dir; bundled immutable; import writes user file;
  export emits `.stmpreset`; duplicate gets new id.
- Commit: `feat(panel): add local preset repository`

### T4 — Favorites
- `favorites.ts`: toggle/query/filter over `library.json` model. Pure given state.
- Tests: toggle, idempotent, filter, persistence shape.
- Commit: `feat(panel): add favorites`

### T5 — Collections
- `collections.ts`: create/rename/delete/add/remove/list. Delete preserves presets.
- Tests: CRUD, add/remove membership, delete-does-not-delete-presets.
- Commit: `feat(panel): add collections`

### T6 — Search & filtering & sorting
- `search.ts`: pure functions over preset list. Substring (normalized lower) on
  name/tags/description/category; filters All/Favorites/User/Collection/Category;
  sort A-Z/Newest/RecentlyUsed.
- Tests: match name; match tag; filter favorites; filter collection; sort orders.
- Commit: `feat(panel): add search, filtering, and sorting`

### T7 — Compatibility + parameter map + apply plan
- `compatibility.ts`: compare preset.compatibleContract vs current contract
  (schemaVersion/bindingRevision/param set). Returns level: ok / readonly / incompatible.
- `parameterMap.ts`: pure resolver — given contract binding + a host-provided
  `enumerate(wireName)->index` callback, map logicalId→runtime index; validates
  match name + wire name + native type + binding revision. Unknown contract → no write.
- `applyPlan.ts`: pure planner — selection items → classify supported/unsupported →
  for each supported, locate/reuse instance + resolve map + validate preset → produce
  ordered change set + report (applied/skipped/failed + reasons). No host calls.
- Tests: compatibility ok/readonly/incompatible; param map resolves + rejects drift;
  apply plan classifies mixed selection; unknown contract blocks writes.
- Commit: `feat(panel): add compatibility, parameter map, and apply planner`

### T8 — Starter preset library
- Author ~16 original presets as `.stmpreset` JSON + import into `bundledPresets.ts`.
  Original categories: Entrances, Exits, Slides, Zooms, Focus, Layout, Screen, Titles,
  Custom. Original names/values only (Soft Arrival, Quick Drift, Center Bloom, Side
  Glide, Gentle Push, Focus Pull-In, etc.). Validate each against schema in a test.
- Commit: `feat(panel): add original starter preset library`

### T9 — Deterministic preview cards
- `previewCard.ts`: pure function preset → SVG string (direction arrow from position
  A→B delta, scale bars, rotation glyph, opacity fade). No host/decode.
- Test: deterministic output for given preset; reflects scale/rotation/opacity.
- Commit: `feat(panel): add deterministic preset preview cards`

### T10 — PremiereAdapter (host seam)
- `premiereAdapter.ts`: implements host interface used by applyPlan executor. Methods:
  getSelection, findStateMotionEffect (by match name), applyEffect (single undo via
  `app.beginUndo`/`endUndo` or `executeCommand`), readLogical/ writeLogical (via
  parameterMap). Prototype UXP APIs first; document verified + unavailable APIs in
  `uxp-panel-development.md`. Guard: unknown/newer contract → read-only diagnostic.
- Boundary tests with a fake host implementing the same interface.
- Commit: `feat(panel): add PremiereAdapter host seam`

### T11 — UI: Library view
- `library.ts` + `components.ts` + `styles.css` + `index.html` + `manifest.json`.
  Search, chips, filter/sort, grid/list, cards w/ favorite + context menu, empty/loading/
  error states, apply-to-selection bar. Keyboard + aria.
- Commit: `feat(panel): add Library view`

### T12 — UI: Inspector view
- `inspector.ts`: selection status, A/B summary (via adapter), applied preset, Apply/
  Replace/Swap A↔B/Reset/Refresh, compatibility warnings, unsupported/incompatible
  states.
- Commit: `feat(panel): add Inspector view`

### T13 — UI: Manage view
- `manage.ts`: user preset list (rename/duplicate/delete w/ confirm), collections
  (create/rename/delete/add-remove), import (.stmpreset) w/ validation+error UI,
  export, compatibility diagnostics.
- Commit: `feat(panel): add Manage view`

### T14 — Wire apply + create flows end-to-end
- `main.ts`: tab routing; connect Library apply → adapter.applyPlan executor;
  Inspector create-from-instance → build user preset → storage.create.
- Commit: `feat(panel): wire apply and create flows`

### T15 — Panel dev docs + build
- `docs/implementation/uxp-panel-development.md`: Premiere version, UXP tooling, build,
  load/reload, logs, verified/unavailable host APIs, known limitations.
- `tsconfig.json` + minimal build (tsc → bundle, or UXP direct TS). Verify panel builds.
- Commit: `feat(panel): add panel dev docs and build`

## Host verification (operator, Premiere) — do not self-mark

After build: open panel, reload, narrow layout, presets display, search, favorites
persist, collections persist, create/delete user preset, import/export, detect
StateMotion instance, read values, apply preset, undo, save/reopen retains values,
unsupported selection clear error, no duplicate effect, multi-select per verified API.

## Definition of done (subset relevant to panel)
Design + plan committed; panel builds; loads; original library visible; search/sort/
favorites/collections/user-preset CRUD/import-export/preview/compatibility all work;
host adapter detects StateMotion; apply works against verified native params; empty/
error/loading states; narrow layout usable; automated tests pass; operator gates pass;
clean-room review passes; no proprietary/SDK/binary committed.

## Prohibitions (this feature)
No GPU/CUDA/Metal, motion blur, crop, stroke, glow, shadow, native easing, native
timeline, production installer, licensing, telemetry, cloud. Panel depends only on
committed logical contract + host-independent domain.
