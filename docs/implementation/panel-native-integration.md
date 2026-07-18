# Panel ↔ Native Effect Integration — Host Verification Ledger

**Branch:** `feat/panel-native-integration` (worktree `E:\motion-panel-integration`)
**Base:** `feat/native-transform-integration` @ `05330b9` + merged `feat/preset-panel`
**Plan:** `docs/superpowers/plans/2026-07-18-panel-native-integration.md`
**Spec:** `docs/superpowers/specs/2026-07-18-panel-native-integration-design.md`

## Status summary

| Layer | Code | Automated tests | Premiere host (real) |
|---|---|---|---|
| Native effect (`.aex`) | built (`05330b9`) | 10 SDK-free C++ suites PASS | **UNVERIFIED** |
| Panel domain + conversion | complete (Tasks 1–5) | 13 panel suites PASS | n/a (pure) |
| Panel ↔ native seam (`UxpHostBridge`) | complete (Task 2) | conversion unit tests PASS | **UNVERIFIED** |
| Create-from-instance (`readState`) | complete (Task 3) | unit tests PASS (fake bridge) | **UNVERIFIED** |

**All real Premiere interactions are NOT YET OPERATOR VERIFIED.** This branch is
code-complete and automated-test-green only. It must NOT be merged to main until
the operator runs host verification.

## Build state (verified 2026-07-19, operator handoff point)

| Artifact | Result |
|---|---|
| Native AEX build (`msbuild Release\|x64`) | exit 0, `StateMotion.aex` 27648 B |
| Native AEX SHA-256 | `187BA976B42439F051FA1FEBE6989DDD9199610C9568FB1009373ABE42FE5700` |
| AEX integration markers | match name `AE.io.github.anmol2k5.statemotion.effect` ✔, `Manual`/`manualProgress` ✔ |
| Panel `npm test` | 13/13 suites PASS |
| Panel `npm run build` | OK → `src/statemotion/panel/dist/main.js` (56963 B) |
| Contract `generate-contract.js --check` | CHECK OK (no diskID/bindingRevision drift) |
| 10 SDK-free C++ suites | 0 failures (built from worktree `src/`) |

Host gates A–R remain **NOT YET OPERATOR VERIFIED** (see ledger below).
The two `.aex`/`.dll`/`.pdb` artifacts are gitignored and were NOT committed.

## Host-dependent gates (operator-run later)

| # | Gate | Status |
|---|---|---|
| A | Panel loads in Premiere | NOT YET OPERATOR VERIFIED |
| B | Panel reload works | NOT YET OPERATOR VERIFIED |
| C | Selection detection | NOT YET OPERATOR VERIFIED |
| D | Existing StateMotion detected (by permanent match name) | NOT YET OPERATOR VERIFIED |
| E | Effect application (if supported) | NOT YET OPERATOR VERIFIED |
| F | No duplicate effect added | NOT YET OPERATOR VERIFIED |
| G | Parameter read (native → canonical) | NOT YET OPERATOR VERIFIED |
| H | Parameter write (canonical → native) | NOT YET OPERATOR VERIFIED |
| I | Apply preset | NOT YET OPERATOR VERIFIED |
| J | Undo (single undo boundary) | NOT YET OPERATOR VERIFIED |
| K | Save / reopen | NOT YET OPERATOR VERIFIED |
| L | Create preset from instance | NOT YET OPERATOR VERIFIED |
| M | Favorites persistence | NOT YET OPERATOR VERIFIED |
| N | Collections persistence | NOT YET OPERATOR VERIFIED |
| O | Import / export | NOT YET OPERATOR VERIFIED |
| P | Multi-selection (supported/unsupported split) | NOT YET OPERATOR VERIFIED |
| Q | Unsupported-item errors (skipped with reason) | NOT YET OPERATOR VERIFIED |
| R | Newer contract read-only behavior | NOT YET OPERATOR VERIFIED |

## UXP capability matrix (carried from `uxp-panel-development.md`)

All host APIs below are PROPOSED / guarded / UNVERIFIED. The pure code converts
canonical↔native correctly; the only question is whether the installed Premiere
UXP build exposes these shapes.

| Capability | API used (proposed) | Status |
|---|---|---|
| Active sequence + tracks | `app.project.activeSequence.videoTracks[].clips` | PROTOTYPE — verify shape |
| Per-clip components | `clip.components[]` (matchName) | PROTOTYPE — verify match-name |
| Read contract metadata | effect `properties` by persistentID (disk 1/2/3) | PROTOTYPE — verify persistentID |
| Enumerate param index | effect `properties` by `displayName` (wireName) | PROTOTYPE — verify displayName==wireName |
| Write logical param | `property.setValue(nativeValue)` | **UNVERIFIED** |
| POINT host shape | marshal/unmarshal (identity passthrough) | **UNVERIFIED** — operator must confirm |
| Single undo boundary | `app.beginUndo` / `app.endUndo` | PROTOTYPE — verify availability |
| Apply effect by match name | `clip.addEffect(MATCH_NAME)` | PROTOTYPE — verify signature |

`MATCH_NAME = AE.io.github.anmol2k5.statemotion.effect` (permanent; never display name).

## Native transform verification debt (carried from source branch)

- `.aex` Release x64 build: **PASS** (commit `05330b9`).
- 10 SDK-free C++ suites: **PASS** (0 failures).
- Actual Premiere transform render (Manual 0/50/100 → A/mid/B): **UNVERIFIED**.
- Pixel-format / alpha behavior (`PF_PixelFloat` channel order, premultiplication): **UNVERIFIED**.
- Host-time edge cases (trim / reverse / freeze / speed change): **UNVERIFIED**.

Panel integration does NOT depend on unverified visual behavior beyond the
existence of the native parameter contract.

## What was completed this milestone (verified by automated tests)

1. Pure canonical↔native conversion layer (`valueConversion.ts`) — mirrors C++
   `statemotion_native_adapter.hpp` math; selector by generated logical ID,
   `nativeType` is a validation guard only.
2. `UxpHostBridge.readLogical`/`writeLogical` convert canonical↔native at the
   single Premiere seam (marshal/unmarshal kept host-only, identity passthrough).
3. `PremiereAdapter.readState(clip)` returns `CanonicalStateMotionConfig`
   (metadata excluded); wired to `PresetRepository.create` from the Inspector.
4. Starter presets corrected to true canonical units (rotation radians, opacity
   0..1); regenerated `.stmpreset` artifacts.
5. `EffectParameterMap` shuffle test locks wireName-based resolution.
6. No parameter-contract changes; no renderer/progress changes; no new deps.
