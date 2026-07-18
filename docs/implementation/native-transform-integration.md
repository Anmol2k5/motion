# Native Transform Integration — Premiere Host Verification

**Branch:** `feat/native-transform-integration`
**Feature commit:** `596a841`
**Head at handoff:** `a7ab92d`
**Prepared by:** opencode (headless env — SDK + Premiere absent)
**Status:** Build + GUI gates are **operator-run**. This document is the runbook and results ledger.

> The automated SDK-free suites (10 C++ + TS progress + contract) all pass
> (`ALL PASSED: 0 failures`). They do NOT exercise the real Adobe `Render`
> path. Everything below the build step requires the operator's Windows +
> Adobe SDK + Premiere Pro 2026 environment.

## Build environment (record at build time)

| Field | Value |
|---|---|
| Adobe After Effects SDK version | _<operator fills>_ |
| Visual Studio version | _<operator fills>_ |
| MSVC toolset | v142 (per vcxproj) |
| Windows SDK version | 10.0 (per vcxproj) |
| Build command | `set STATEMOTION_SDK=<sdk>; msbuild statemotion_effect.vcxproj /p:Configuration=Release /p:Platform=x64` |
| Build exit code | _<operator fills>_ |
| Warnings | _<operator fills>_ |
| Errors | _<operator fills>_ |
| Output binary | `src\statemotion\adobe\x64\Release\StateMotion.aex` |
| Binary size | _<operator fills>_ |
| SHA-256 (new) | _<operator fills>_ |
| SHA-256 (previous build) | _<operator fills>_ |

The previous `StateMotion.aex` in `x64\Release\` dated **17-07-2026** is the
identity-only registration binary. A successful new build MUST overwrite it and
the SHA-256 MUST differ. If the hash is unchanged, the build did not pick up
commit `596a841` — do not proceed.

## Install (exactly one dev binary)

Close Premiere. Remove any other `StateMotion.aex` from
`C:\Program Files\Adobe\Common\Plug-ins\7.0\MediaCore` (and any other Premiere
plugin search path). Copy the newly built `StateMotion.aex` there. Confirm
installed SHA-256 == built SHA-256.

| Field | Value |
|---|---|
| Built SHA-256 | _<operator fills>_ |
| Installed SHA-256 | _<operator fills>_ |
| Match | _<operator fills>_ |

## Result ledger

Fill PASS/FAIL as you run each gate. Do not prefill untested gates.

| Gate | Result |
|---|---|
| Native Release x64 build | _PENDING_ |
| Premiere discovery | _PENDING_ |
| Manual 0 → State A | _PENDING_ |
| Manual 50 → midpoint | _PENDING_ |
| Manual 100 → State B | _PENDING_ |
| Position | _PENDING_ |
| Scale | _PENDING_ |
| Non-uniform scale | _PENDING_ |
| Rotation | _PENDING_ |
| Anchor | _PENDING_ |
| Opacity | _PENDING_ |
| Combined transform | _PENDING_ |
| Alpha/channel behavior | _PENDING_ |
| Footage | _PENDING_ |
| Still image | _PENDING_ |
| 1920x1080 | _PENDING_ |
| 1080x1920 | _PENDING_ |
| UHD | _PENDING_ |
| AToB | _PENDING_ |
| BToA | _PENDING_ |
| AToBToA | _PENDING_ |
| BToAToB | _PENDING_ |
| HoldA | _PENDING_ |
| HoldB | _PENDING_ |
| Manual | _PENDING_ |
| ClipStart | _PENDING_ |
| ClipEnd | _PENDING_ |
| EntireClip | _PENDING_ |
| Head trim | _PENDING_ |
| Tail trim | _PENDING_ |
| Clip moved | _PENDING_ |
| Reverse | _PENDING_ |
| Freeze | _PENDING_ |
| Speed change | _PENDING_ |
| Save/reopen | _PENDING_ |

## Observed host pixel format

| Field | Value |
|---|---|
| Actual PF_ format invoked by Premiere | _<operator fills>_ |
| Channel order correct (no R/B swap) | _<operator fills>_ |
| Alpha premultiplication correct | _<operator fills>_ |

## Known risk to watch (anchor vs position dimensions)

`toRendererTransformState` maps **position** using **output** dimensions and
**anchor** using **source** dimensions. In the Premiere software path
source==output, so these agree. For still images whose source dimensions differ
from the sequence (gate "Still image"), confirm the anchor pivot lands where the
native POINT% implies. If anchor is visibly wrong, record it precisely — do not
hide it. The fix is to resolve anchor against output dims too, but only apply
after confirming the failure on the host.

## Host-time edge cases (current_time/total_time)

Clip-local timing per research 006. If `current_time/total_time` fails any of:
clip moved, head/tail trim, reverse, freeze, speed change — STOP. Do NOT add
`GetClipSpeed`/`GetClipStart` speculatively. Open a Wayfinder timing ticket
with the exact failing case + observed `current_time`/`total_time` behavior.

## Stop condition

After building and recording, the automated side is done. GUI gates require a
human at Premiere. Report results back; the ledger above is updated per run.
