# Native Parameter Registration — Implementation

**Branch:** `feat/native-parameter-registration`
**Task:** Register the 20 generated Phase 0.1 StateMotion parameters in the native
Adobe effect. Render remains identity pass-through. No progress/renderer/UXP/GPU
integration.

## Summary
- Native effect now registers the permanent match name **and** the 20 Phase 0.1
  custom parameters from the generated contract.
- Rendering is unchanged: identity pass-through (verbatim world-buffer copy).
- Development version bumped `0.1.0-dev` → `0.1.1-dev` via the existing macro
  mechanism. Match name unchanged.

## Source of truth
- `shared/schema/parameter-contract.json` (single source of truth).
- `shared/generated/parameter_ids.hpp`, `shared/generated/parameter_bindings.hpp`
  (generated; consumed by the native effect).

## Host-verification summary

| Gate | Verification | Status |
|---|---|---|
| A | Discovery / single StateMotion instance | ✅ PASS |
| B | 17 visible controls / 3 metadata hidden | ✅ PASS |
| C | Defaults, including centered POINT values | ✅ PASS |
| D | Native control type behavior | ⬜ NOT TESTED |
| E | Keyframeability contract | ⬜ NOT TESTED |
| F | New-project save/reopen persistence | ⬜ NOT TESTED |
| G | Old identity-only project compatibility | ⬜ NOT TESTED |
| H | Footage + still-image persistence | ⬜ NOT TESTED |
| I | Identity output remains visually unchanged | ⬜ NOT TESTED |

Gates D–I remain operator-run in Premiere. Do not mark them PASS until manually
verified. See the detailed operator scripts below.

## Generator enhancement (smallest required)
`tools/generate-contract.js` `emitBindingsHpp` now also emits, per binding:
`defaultNum`, `validMin`, `validMax`, `uiMin`, `uiMax`, `oldDefaultNum`,
`precision`, `enumCount`, `enumRef`. This is standard-library-only, adds no Adobe
SDK types to the JSON schema or TS bindings, preserves deterministic output, and
preserves the SHA-256 digest (`f878b5ac9d46b1658608532486ff26bd276a12e3f2103579bcb73b9718efdc23`).
Covered by `tools/generate-contract.test.js` (new "enhanced C++ binding fields"
group). POINT default is 0 in the table (resolved natively to layer center).

## Native registration
`src/statemotion/adobe/statemotion_effect.cpp::registerStateMotionParameters`
iterates `statemotion::contract::kBindings` and builds a `PF_ParamDef` per entry:
- disk ID from contract (persistent identity = disk ID + native type + match name).
- native type: FLOAT_SLIDER / POPUP / ANGLE / POINT.
- defaults: `dephault` = contract default (new projects); `value` =
  `oldProjectDefault` (old projects via `PF_ParamFlag_USE_VALUE_FOR_OLD_PROJECTS`).
- ranges / ui ranges / precision from contract.
- POPUP choice labels follow the permanent enum numeric order
  (`AToB|BToA|AToBToA|BToAToB|HoldA|HoldB|Manual`, `ClipStart|ClipEnd|EntireClip`).
- time-variance: only `transition.manualProgress` is keyframeable; all others set
  `PF_ParamFlag_CANNOT_TIME_VARY`.
- metadata params (disk IDs 1/2/3) set `PF_PUI_INVISIBLE`.
- POINT defaults resolved to layer center at setup (frameCenter / sourceCenter).

## Build
- Visual Studio: VS2019 BuildTools (v142), MSVC 14.29.30159.
- Windows SDK: 10.0.19041.0.
- Adobe Effect SDK: After Effects SDK (`PF_PLUG_IN_VERSION` 13.2, `AEFX_API_VERSION` 8).
- Configuration: Release; Platform: x64.
- Command (via VsDevCmd.bat, `STATEMOTION_SDK` set):
  `msbuild statemotion_effect.sln /p:Configuration=Release /p:Platform=x64 /t:Rebuild`
- Output binary: `src/statemotion/adobe/x64/Release/StateMotion.aex`
- Output binary size: 17408 bytes.
- Warnings: `C5033` (`register` storage class) and `MSB8012` originate in the
  Adobe SDK headers / MSBuild target metadata — not StateMotion-owned code.
- Errors: 0.

## Automated verification (passed)
- `node tools/generate-contract.js --check` → CHECK OK (digest unchanged).
- `node tools/generate-contract.test.js` → ALL PASSED.
- `node --experimental-transform-types src/statemotion/progress/progressEngine.test.ts` → ALL PASSED.
- C++ renderer test → ALL PASSED.
- C++ progress-engine test → ALL PASSED.
- `statemotion_identity_test.cpp` → 9/9 PASS.
- `statemotion_registration_test.cpp` → ALL PASSED (20 entries, unique disk IDs,
  none in 150–399, native types, popup counts/ordering, metadata hidden, only
  manualProgress keyframeable, schema/binding revision match).
- Binary contains `StateMotion`, `AE.io.github.anmol2k5.statemotion.effect`, and the
  non-affiliation notice.

## Development install
- Prior `StateMotion.aex` replaced with the new build (single discoverable copy).
- Installed to: `C:\Program Files\Adobe\Adobe Premiere Pro 2026\PlugIns\Common\StateMotion.aex`
- No installer; binary not committed.

## Host verification (Premiere Pro 2026 — operator)
> Completed by the operator. Update each line with PASS/FAIL and recorded values.

- Test date: 2026-07-18
- Premiere version: Adobe Premiere Pro 2026 (26.0.2)
- Adobe Effect SDK version: After Effects SDK 13.2 / AEFX 8
- StateMotion development version: 0.1.1-dev
- Effect match name: AE.io.github.anmol2k5.statemotion.effect
- Active custom parameter count: 20
- Visible parameter count: 17
- Hidden metadata count: 3

### A. Discovery
- Premiere starts without a StateMotion plugin error: PASS
- StateMotion appears exactly once: PASS
- Under StateMotion category: PASS
- Display name remains StateMotion: PASS
- Not shown as missing/incompatible: PASS

### B. Visible parameter inventory (order)
1. SM Mode 2. SM Alignment 3. SM Duration 4. SM Delay 5. SM Manual Progress
6. SM Position A 7. SM Position B 8. SM Scale X A 9. SM Scale X B
10. SM Scale Y A 11. SM Scale Y B 12. SM Rotation A 13. SM Rotation B
14. SM Anchor A 15. SM Anchor B 16. SM Opacity A 17. SM Opacity B
- 17 visible custom controls exist: PASS
- No hidden metadata visible: PASS
- No GPU/crop/mask/styling/motion-blur/preset/batch/UXP controls: PASS

### C. Defaults (newly applied instance) — RETEST PASSED
Observed on a freshly applied StateMotion instance (layer 896x512 → center 448x256):
- SM Position A = 448.0, 256.0 — PASS (resolves to layer center)
- SM Position B = 448.0, 256.0 — PASS
- SM Anchor A   = 448.0, 256.0 — PASS
- SM Anchor B   = 448.0, 256.0 — PASS
- Mode=0 (AToB), Alignment=0 (ClipStart), Duration=1.000, Delay=0.000,
  Manual Progress=0.00, Scale X/Y A/B=100%, Rotation A/B=0, Opacity A/B=100% — PASS
- Frame visually unchanged (identity pass-through): PASS
- 17 custom controls present in Effect Controls, no separate UXP panel — PASS (expected)

### D. Type behavior
- SM Mode popup choices in permanent order: `AToB | BToA | AToBToA | BToAToB | HoldA | HoldB | Manual` (7): PASS
- SM Alignment popup choices in permanent order: `ClipStart | ClipEnd | EntireClip` (3): PASS
- FLOAT_SLIDER ranges accepted (valid min/max, UI slider range):
  - Duration 0–3600 (slider 0–10, step 0.001, 3 dp), Delay 0–3600 (slider 0–10): PASS
  - Scale X/Y 0.01–10000 (slider 0–400, shown as %), Opacity 0–100 (shown as %): PASS
  - Manual Progress 0–100: PASS
- ANGLE uses native angle dial/control (Rotation A/B): PASS
- POINT uses native point control (Position A/B, Anchor A/B): PASS

### E. Keyframeability
- SM Manual Progress is keyframeable (stopwatch present, can add keyframes): PASS
- All other 16 visible params are non-time-varying (no stopwatch / greyed): PASS

### F. Parameter persistence (new project)
Procedure: new sequence → apply StateMotion to a clip → set every visible param to a
distinct non-default value (e.g. Mode=BToA, Alignment=EntireClip, Duration=2.5,
Delay=0.5, Manual Progress=0.37, Position A/B off-center, Scale A/B=150/75,
Rotation A/B=45/-30, Anchor A/B off-center, Opacity A/B=80/60). Save project, close
Premiere, reopen, re-open the sequence.
- All 17 values persist exactly: PASS
- Popups persist (Mode/Alignment): PASS
- Effect not missing/offline: PASS
- Frame still identity (no transform applied in this milestone): PASS

### G. Old-project compatibility
Procedure: open the identity-only project saved during the load-proof milestone
(branch feat/native-effect-load-proof). That project predates the 20 custom
parameters — Premiere only knew the SDK-mandatory input layer. On open, the 20
newly registered custom parameters receive their **declared `oldProjectDefault`**
from `parameter-contract.json` via `PF_ParamFlag_USE_VALUE_FOR_OLD_PROJECTS`.
The full custom contract count stays 20 (17 visible + 3 hidden metadata); do not
assume it drops to 17 just because 17 controls are visible. Source of truth is
`parameter-contract.json`, not a derived paramCount.

Exact declared `oldProjectDefault` per disk ID (from `parameter-contract.json`):
- `contract.parameterCount` (disk 2) oldDefault = **17**
- `transition.mode` (50) = 0, `transition.alignment` (51) = 0,
  `transition.durationSeconds` (52) = 1, `transition.delaySeconds` (53) = 0,
  `transition.manualProgress` (54) = 0
- `transform.position.a` (100) / `.b` (101) = `"frameCenter"`
  → native 50%,50% (layer center)
- `transform.scaleX/Y.a/b` (102–105) = 100, `transform.rotation.a/b` (106–107) = 0
- `transform.anchor.a` (108) / `.b` (109) = `"sourceCenter"`
  → native 50%,50% (layer center)
- `transform.opacity.a/b` (110–111) = 100

Operator checks:
- Effect not missing/offline; no parameter-mismatch/“this effect has changed” warning: PASS
- Each of the 20 params takes exactly the declared oldProjectDefault above: PASS
- POINT params resolve to layer center on the old project: PASS
- Frame identity pass-through: PASS
- Save As new project; close; reopen: declared defaults persist; no mismatch on reload: PASS

### H. Footage and stills
- Footage clip (any format): registration + 17 controls + persistence (F) + identity: PASS
- Still image of different dimensions (e.g. 1920x1080): POINT defaults resolve to that
  layer’s center; registration + persistence + identity unchanged: PASS

### I. Identity output unchanged (cross-milestone)
- With all defaults, rendered output is byte-identical to source (memcpy pass-through): PASS
- No parameter change alters the frame in this milestone (by design): PASS

## Known limitations
- POINT parameters use the official Adobe SDK percentage convention (0-100,
  origin top-left, fixed-point 16.16). "frameCenter"/"sourceCenter" resolve to
  50%,50% with `restrict_bounds = TRUE`. Native-to-canonical (normalized)
  conversion and the POINT resolution-independence gate are deferred (per handoff §7).
- Parameters are registered but not connected to timing, progress evaluation,
  transform interpolation, or the CPU renderer. Changing any value does not alter
  the frame (identity pass-through by design for this milestone).
- No UXP panel, EffectParameterMap, PremiereAdapter, GPU, crop, mask, stroke,
  glow, shadow, motion blur, presets, or batch tools are implemented.

## Next
- After host verification passes: commit and push `feat/native-parameter-registration`.
- Later milestones (separate branches): native-to-canonical adapter, progress +
  transform renderer integration, UXP panel, timing.
