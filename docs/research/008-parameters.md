# 008 — Native Parameter Limitations (AE Effect SDK)

Research ticket for the StateMotion parameter-contract design (spec §8).
No production code. Clean-room / documentation-only research.

Sources:
- AE Effect SDK Guide — PF_ParamDef: https://ae-plugins.docsforadobe.dev/effect-basics/PF_ParamDef/
- AE Effect SDK Guide — Parameters: https://ae-plugins.docsforadobe.dev/effect-basics/parameters
- AE Effect SDK Guide — Changing Parameter Orders, the Nice Way: https://ae-plugins.docsforadobe.dev/effect-details/changing-parameter-orders/
- AE Effect SDK Guide — AEGP Suites (effect/stream access): https://ae-plugins.docsforadobe.dev/aegps/aegp-suites/
- PiPL resource (Premiere/Video Filters): https://ppro-plugins.docsforadobe.dev/resources/pipl-resource/ and https://ppro-plugins.docsforadobe.dev/video-filters/getting-started
- UXP-for-AE status note (pushREC AE SDK KB): https://github.com/pushREC/after-effects-sdk-kb/blob/main/scripting/UXP-STATUS-NOTE.md
- AE SDK community Q&A (invisible-param access by index, ARB sharing): https://emlcpfx.github.io/ae-sdk-docs/qa/aegp/

---

## 1. How parameters are declared & identified

### Declaration
- Effect parameters are declared in two places:
  1. **PiPL** (`'PiPL'` resource, `.r` file) — for Premiere/Video Filter plugins, parameters are described in `ANIM_ParamAtom` blocks (see ppro-plugins docsforadobe `video-filters/getting-started`). For pure AE effects, parameters are registered at runtime during `PF_Cmd_PARAM_SETUP` via `PF_ADD_PARAM` (params page).
  2. **Runtime `PF_ParamDef`** during `PF_Cmd_PARAM_SETUP`. Each `PF_ParamDef` is added to the params array; `params[0]` is always the input layer (`PF_EffectWorld`/`PF_LayerDef`), not a user param (PF_ParamDef page, "Param Zero").

### Identifiers per parameter (confirmed)
A `PF_ParamDef` carries three distinct identifiers (PF_ParamDef members):
- **`id`** (`A_long`, member `uu.id`): the *disk ID*. Stable across versions *if the developer maintains it*. The doc explicitly states: "You can re-order parameters in future versions of your plug-in and not cause users to re-apply your effect, if you maintain the parameter's ID across versions." Range 1–9999 (0 reserved — see §2). This is the persistence/identity key AE writes to the project file.
- **`name`** (`A_char[32]`, `PF_DEF_NAME`): the display name (max 31 chars + NUL). Can be localized/changed at runtime; NOT a stable identity.
- **Match name**: defined at the *plugin* level via `AE_Effect_Match_Name` in the PiPL (ppro-plugins PiPL resource). This identifies the *effect*, not individual parameters. There is **no per-parameter match name field in `PF_ParamDef`** — individual params are identified by index or disk `id`, not by a match name the way layers/properties are in the scripting DOM.

**Confirmed facts:**
- Each param has: a stable-ish numeric **disk `id`** (only stable if preserved by dev), a 31-char **name**, and a **position/index** in the params array.
- The *plugin* (effect) has a `matchName` (PiPL `AE_Effect_Match_Name`), queryable from AEGP via `AEGP_GetEffectMatchName`. Individual params do not.

---

## 2. Is parameter *index* stable across versions? — YES, it can drift

This **confirms the spec's "parameter-index drift" concern.**

- The **array index** is determined by registration order during `PF_Cmd_PARAM_SETUP`. The "Changing Parameter Orders, the Nice Way" page states the order of registration "determines the order in which they appear in the Effect Control and Timeline panels."
- Index is **not** guaranteed stable: inserting/removing/reordering a param changes every subsequent index. AE advises maintaining a *separate* "parameter array index" enumeration from a "disk ID" enumeration.
- The **disk `id`** (1–9999) is the stable persistence key. AE tags saved param info with this ID so "although your 'Foobarocity' slider is now the fourth parameter passed, it's the same parameter as when it was second."
- Therefore **index is the volatile coordinate; disk `id` is the stable coordinate.**

**Mitigation confirmation (matches spec §8):**
- Generate a **binding map** (`paramName`/`logicalKey` → disk `id`) at build time from the same source that registers params. The native side reads/writes by disk `id` internally; external consumers (panel) must resolve logical key → current index via the generated schema, not hardcode indices.
- Version the schema. Because adding params must append to the disk-ID enum (never reuse/renumber), a schema-version + disk-id pair uniquely identifies a param even across effect upgrades. `PF_ParamFlag_USE_VALUE_FOR_OLD_PROJECTS` handles new params added after an older project was saved.

**Note on 0:** disk IDs should range 1–9999; 0 is special-cased by AE (auto-ID assumption). Use 1-based disk IDs.

---

## 3. Supported parameter value types & limits relevant to State A/B pairs

From the Parameters page "Parameter Types" table:

| Type | Union member | Value type | Notes relevant to State pairs |
|---|---|---|---|
| `PF_Param_LAYER` | `ld` | `A_long` (layer ref) | param[0] is input; extra layers are pull-downs |
| `PF_Param_FLOAT_SLIDER` | `fs_d` | `PF_FPLong` (float) | recommended numeric; has min/max, slider range |
| `PF_Param_FIX_SLIDER` | `fd` | `PF_Fixed` | deprecated; float slider preferred |
| `PF_Param_SLIDER` | `sd` | `long` | "No longer used" |
| `PF_Param_ANGLE` | `ad` | `PF_Fixed` | degrees, multi-rev allowed |
| `PF_Param_CHECKBOX` | `bd` | `PF_Boolean` | `CANNOT_INTERP` forced |
| `PF_Param_COLOR` | `cd` | `PF_Pixel` | **RGB only; alpha NOT used** (`PF_Pixel` is 8-bit RGB). For float accuracy use `PF_ColorParamSuite1` |
| `PF_Param_POINT` | `td` | `PF_Fixed` x2 | 2D point, destination-layer space, upper-left origin; float via `PF_PointParamSuite1` (CS5.5+) |
| `PF_Param_POINT_3D` | `point3d_d` | `PF_FpLong` x3 | 3D point (CS5.5+); **unsupported in Premiere Pro** |
| `PF_Param_POPUP` | `pd` | `A_long` | list of choices; 1-based on the wire |
| `PF_Param_ARBITRARY_DATA` | `arb_d` | custom handle | opaque blob; has its own ID; keyframable |
| `PF_Param_PATH` | `path_d` | `PF_PathID` | mask reference; not directly readable |
| `PF_Param_GROUP_START/END` | — | — | twirly groups / topics |
| `PF_Param_BUTTON` | `button_d` | none | push button (CS5.5+) |
| `PF_Param_NO_DATA` | — | — | no stream |

**Limits relevant to State A/B pairs:**
- **Two-point params:** use `PF_Param_POINT` (or `POINT_3D`). Native point is 2D; no built-in "two-point" param type — a State A/B pair modeled as two points = two `POINT` params (or one `POINT_3D` + separate). Confirmed point origin is upper-left, x right, y down, and AE applies upstream origin offsets automatically.
- **Color-with-alpha:** native `PF_Param_COLOR` is **RGB only, no alpha** (`PF_Pixel`, 8-bit). To carry alpha you must either (a) add a separate float/checkbox/fixed-slider alpha param, or (b) use `PF_Param_ARBITRARY_DATA` to pack RGBA, or (c) use `PF_ColorParamSuite1` for float RGB (still no alpha). **Implication for spec §8:** a "color+alpha" State channel cannot be a single native COLOR param; design the contract to map it to COLOR + an alpha scalar, or to ARB data.
- **Max count:** docs state "You may have up to (approximately) 38 kajillion parameters" — i.e. **no hard documented limit**; practical constraint is the Effect Controls UI. Recommend a bounded schema (e.g. dozens, not thousands) for StateMotion.
- Float sliders support 32-bit float; COLOR is 8-bit unless the float color suite is used.

---

## 4. How a panel (UXP / ExtendScript) reads & writes these params

### Critical finding: UXP panels are NOT available for After Effects (as of 2026-04-19)
The UXP-for-AE status note (pushREC AE SDK KB) states verbatim: "**UXP panels for After Effects are not yet available as of April 2026.** Use CEP + ExtendScript until Adobe ships AE UXP." Premiere Pro shipped UXP v25.6 (Dec 2025); AE has only *scripting-only* UXP APIs in the version matrix, no panel framework. AE panels today use **CEP (HTML) or ScriptUI/ExtendScript**.

### Effect parameter access from scripting (ExtendScript) — by name or index, NOT by disk id
- ExtendScript exposes effects as `PropertyGroup`s whose children are `Property` objects (one per param). Each `Property` has `.name` (display) and `.matchName`.
- Access is by **1-based index** (`layer.property("ADBE Effect Parade").property(index)`) or by **name/match name** (`property("My Param")`). The **effect** has a match name (`ADBE Bulge`, etc.); individual params are addressed by display name or index within the effect's property group.
- There is **no scripting-side per-param disk `id`** accessor. The stable scripting identifier is the **param name / match name**, which the developer controls (and can localize/change → also mutable).

### AEGP (C++) access — by index OR by stream
- AEGP `EffectSuite` / `StreamSuite`: `AEGP_GetNewEffectStreamByIndex(effectH, index, ...)` retrieves a param stream **by index** (1-based, skipping the input layer). `AEGP_GetEffectParamUnionByIndex` reads the `PF_ParamDef` union by index. Stream values read via `AEGP_StreamSuite4::AEGP_GetNewStreamValue`.
- The **invisible-param caveat** (AE SDK community Q&A): params marked `PF_PUI_INVISIBLE` "cannot be accessed by name or match name in expressions, but they can be accessed by their index number." So index remains a viable fallback even when name is hidden.

### Does UXP/scripting expose a stable param identifier matching the native side?
- **No single shared stable ID.** Native side persistence key = disk `id` (opaque to scripting). Scripting side stable key = param **name/match name** (developer-controlled, mutable, localizable). AEGP side = **index** (volatile) or stream refs (opaque).
- The only *developer-controlled, cross-surface constant* is the **logical param key you assign in your own code** (and encode as both the disk `id` on the native side and the display/match name on the scripting side). Hence the need for a **generated, versioned binding map** rather than hardcoded indices or names on either side.

---

## 5. Maximum parameter count & practical limits
- **No hard maximum** documented ("approximately 38 kajillion"). Practical UI limit is user tolerance in Effect Controls / Timeline.
- **Name length:** 31 chars (`A_char[32]`), a long-standing limitation.
- **Disk ID range:** 1–9999.
- **Index:** 1-based array; param[0] reserved for input layer. External (scripting) param access is also 1-based within the effect's property group (with the input layer conceptually index 0).
- Point/color precision limits noted in §3.

---

## Assumptions
- StateMotion will ship as a native AE effect plug-in (C++ Effect SDK) plus a panel. Panel surface today is ExtendScript/CEP, not UXP; UXP may arrive later (monitor Premiere UXP rollout as the analog).
- "State A/B pairs" are user-facing parameter sets captured/restored by the panel; native storage is the effect's param stream set.
- We assume the developer (us) controls both the disk `id` assignment and the param display/match names, enabling a single generated source of truth.

## Contradictions / surprises
- Spec §8's "match name per parameter" mental model does **not** map 1:1 to the native SDK: native params have disk `id` + name, but **no per-param match name** (match name is plugin-level). The scripting DOM *does* expose a per-property match name, but it is not the native disk id and is not guaranteed unique/stable if names change.
- COLOR has **no alpha** — a direct hit to any "color-with-alpha" State channel if modeled as one COLOR param.
- UXP is unavailable for AE; spec language referencing "UXP panel" must be treated as forward-looking.

## Recommendation (parameter-contract shape)
- **Generated binding map, not hardcoded.** Single source of truth (e.g. a code-generated `ParamSchema`): `logicalKey → { diskId, displayName, matchName, type, version }`.
- Native side registers params using the generated disk `id`s and names; panel side resolves `logicalKey` → current scripting name/index via the same generated schema (or via a small AEGP bridge that exposes disk-id-based lookup).
- **Version the schema.** Bump on any param add/remove/reorder. Use disk `id` append-only rule (never reuse/renumber). Map new params with `PF_ParamFlag_USE_VALUE_FOR_OLD_PROJECTS` for backward project compat.
- For State A/B pairs needing color+alpha or two points: model as explicit multi-param tuples in the schema (COLOR + alpha scalar; or two POINT params), since no native single param covers them.
- Keep param count bounded (tens) for UI sanity.

## Impact on spec §8
- Spec's "parameter-index drift" concern is **valid and confirmed**; mitigation (generated bindings + schema version) is the correct approach.
- Revise spec wording: replace "per-parameter match name" with "disk `id` (native) + display/match name (scripting), unified by a generated logical key." 
- Add explicit handling for color-without-alpha and 2D-only points.
- Note UXP panel is future-facing; current panel target is ExtendScript/CEP.

## Follow-ups
- Confirm AE UXP availability timeline (monitor Adobe dev blog + UXP version matrix).
- Decide AEGP bridge vs pure ExtendScript for panel↔effect param sync (AEGP gives index/stream access; ExtendScript gives name/index only).
- Prototype the generated `ParamSchema` build step and disk-id assignment tooling.
- Verify `PF_ColorParamSuite1` float-RGB path and whether alpha can ride alongside (likely needs separate param).
