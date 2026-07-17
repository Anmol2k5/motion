# Native Effect Load Proof — Implementation

**Branch:** `feat/native-effect-load-proof`
**Task:** Phase 0.1 minimal native Adobe effect load proof.
**Status:** Built, installed, export-verified. Manual host GUI test pending (operator).

## Goal
Prove a native effect built with the official Adobe After Effects Effect SDK is discovered by
Premiere Pro 2026, appears in the Effects panel, applies as an identity pass-through to footage
and stills, and survives save/reopen — using a permanent match name.

## Registration identity (permanent)
- Display name: `StateMotion`
- Match name: `AE.io.github.anmol2k5.statemotion.effect`
- Category: `StateMotion`
- Version (SDK `PF_VERSION`): `0.1.0` `PF_Stage_DEVELOP` build `0` → packed `0x00010000`.

## Source layout (`src/statemotion/adobe/`)
- `statemotion_effect.h` — entry point, version + match-name macros, param enum
  (`STATEMOTION_INPUT=0`, `STATEMOTION_NUM_PARAMS=1`).
- `statemotion_effect.cpp` — `ABOUT` / `GLOBAL_SETUP` / `PARAMS_SETUP` / `RENDER`.
  Only the SDK-mandatory input/source layer is registered. Render is a format-agnostic
  identity pass-through (verbatim world-buffer copy; no per-pixel transform, no heap alloc).
- `statemotion_effect.r` — PiPL resource (Kind `AEEffect`, Name/Category `StateMotion`,
  `Match_Name AE.io.github.anmol2k5.statemotion.effect`, `EntryPointFunc`).
- `statemotion_effect_strings.{h,cpp}` — display strings; About text carries the
  non-affiliation notice: "StateMotion is independently developed and is not affiliated with
  or endorsed by Adobe."
- `statemotion_effect.vcxproj` / `.sln` — VS2019 (v142), x64 Debug/Release. SDK referenced via
  the `STATEMOTION_SDK` environment variable (never committed). PiPL pipeline runs as a
  PreBuildEvent: `cl /EP .r → PiPLTool → cl /D MSWindows /EP .rrc → .rc`.
- `statemotion_identity_test.cpp` — host-independent checks (match name, version packing,
  non-affiliation). 9/9 PASS.

## Build
```
set STATEMOTION_SDK=D:\path\to\AfterEffectsSDK
# via VsDevCmd.bat (MSVC 14.29.30133, WinSDK 10.0.19041.0)
msbuild statemotion_effect.sln /p:Configuration=Release /p:Platform=x64
```
Output: `x64\Release\StateMotion.aex`.

## Verification
### Automated (passed)
- `StateMotion.aex` is produced (Release|x64, BUILD EXIT=0).
- Binary contains the permanent match name, `StateMotion`, and the non-affiliation notice.
- Export table contains `EntryPointFunc` (matches PiPL entry point).
- `statemotion_identity_test.cpp`: 9/9 PASS.

### Manual host test (operator, not automatable headlessly)
1. Launch Premiere Pro 2026 (26.0.2).
2. Confirm `StateMotion` appears under the `StateMotion` bin in the Effects panel.
3. Apply it to a footage clip and to a still image; confirm visually identical output
   (identity pass-through).
4. Save the project, close Premiere, reopen; confirm the effect reloads (permanent match name).
5. Report pass/fail here.

## Notes / deviations
- The AE Effect SDK exposes no `PF_WORLD_IS_FLOAT`; `PF_LayerDef` has no `bitdepth` member.
  Rather than claim per-format handling, Render copies the source world buffer verbatim
  (`memcpy` of `rowbytes * height`). This is format-agnostic identity and avoids any untested
  format handling. Premiere default render paths (8/16 bpc) are covered; 32-bit float is not
  claimed as explicitly tested.
- `MSB8012` build warning is benign: the DynamicLibrary target forces a logical `.dll`
  extension while `Linker/OutputFile` correctly emits `StateMotion.aex`.
- Clean-room: no Adobe SDK/headers/binaries committed; SDK stays outside the repo. The official
  SDK `Examples\template\Skeleton` was used only as a reference (not copied); SDK-confidential
  headers are included at build time only.

## Next
- Complete the manual host test above.
- On pass, this branch is ready to merge to `main`.
