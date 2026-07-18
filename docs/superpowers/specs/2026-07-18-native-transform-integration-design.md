# Native Transform Integration — Design

**Branch:** `feat/native-transform-integration`
**Date:** 2026-07-18
**Depends on:** `main` containing the merged native parameter-registration PR (`e97f17b`).
**Prohibited scope:** see §10 (no preset panel, UXP, GPU, crop/mask/stroke/glow/shadow/motion-blur, custom easing, installers, telemetry, cloud). Must not modify `feat/preset-panel`.

## 1. Goal

Connect the already-existing, independently-tested subsystems so the native
StateMotion controls actually animate and render **Position, Scale, Rotation,
Anchor, Opacity** inside Premiere Pro:

```
Premiere native POINT / percent / degrees
        ↓  NativeParameterAdapter
Canonical TransformState (normalized / multiplier / radians / 0..1)
        ↓  ProgressEngine . evaluateProgress()
        ↓  interpolate(canonicalA, canonicalB, easedProgress)
RenderInputAdapter . toRendererTransformState(canonical, dims)
        ↓
RendererTransformState (pixels / multiplier / degrees / 0..1)
        ↓  existing verified CPU renderer (plan + render)
Premiere output frame
```

CPU remains the only renderer. Save/reopen persistence already works and must
keep working.

## 2. Two coordinate models (resolved conflict)

The milestone brief describes the canonical model as **normalized position/anchor,
multiplier scale, radians, opacity 0..1**. The already-tested renderer
(`src/statemotion/renderer/transform_render.*`) stores its `TransformState` as
**source-pixel position/anchor, multiplier scale, degrees, opacity 0..1** and
its `plan()` inverse map expects pixels.

Decision (approved by user): **keep the canonical model as normalized+radians**
and **do not rewrite the renderer**. The renderer's public `TransformState` type
is **renamed to `RendererTransformState`** (naming cleanup only — no math
change). A single, minimal, pure conversion function
`toRendererTransformState(canonical, dims)` maps the final interpolated canonical
state to renderer units **once, after interpolation**.

This satisfies: resolution-independent canonical model; preset/panel contract;
normalized persistence; radians as internal rotation unit; existing tested
renderer reused; Ponytail no-rewrite/no-duplicate rule.

## 3. NativeParameterAdapter

New header `src/statemotion/adobe/statemotion_native_adapter.hpp` (host-independent
C++, no Adobe SDK — unit-testable). Reads the registered parameter **values**
supplied by the effect and produces a canonical `TransformState`.

Canonical conversion rules:

| Native (Adobe) | Contract source | Canonical |
|---|---|---|
| POINT position | percent of output frame (fixed 16.16), origin top-left | `x = pct.x/100`, `y = pct.y/100` (normalized top-left) |
| POINT anchor | percent of source/layer frame | `x = pct.x/100`, `y = pct.y/100` (normalized top-left) |
| FLOAT_SLIDER scale % | `scaleX.a/b`, `scaleY.a/b` valid 0.01–10000 | `multiplier = percent/100` |
| ANGLE rotation | degrees native | `radians = degrees * pi / 180` |
| FLOAT_SLIDER opacity % | `opacity.a/b` valid 0–100 | `opacity = clamp(percent/100, 0, 1)` |

POINT values are stored by the SDK as **percentages of the frame** (research:
`statemotion_point_default.hpp` documents `PF_PointDef` percent convention,
0–100, top-left, fixed-point 16.16). The adapter works in **percent space**, so
it never hardcodes resolution.

Functions (pure, each unit-tested):

```cpp
namespace statemotion { namespace native {

// POINT percent (0..100, top-left) -> normalized [0,1].
Vec2 pointPercentToNorm(double px, double py);

// percent slider -> multiplier / clamped fraction.
double percentToMultiplier(double percent);
double percentToOpacity(double percent);      // clamps to [0,1]

// degrees -> radians.
double degreesToRadians(double degrees);

// Build ONE canonical endpoint from already-read native values.
TransformState buildCanonicalState(
    double posPx, double posPy,
    double scaleX, double scaleY,
    double rotDeg,
    double ancPx, double ancPy,
    double opacityPercent);

// Popup index -> enum (reuse ids::ProgressMode / ids::AlignmentMode).
ids::ProgressMode modeFromPopup(int idx);
ids::AlignmentMode alignmentFromPopup(int idx);

}}
```

No `EffectParameterMap`, no UXP, no SDK dependency in this header. Disk IDs,
parameter types, and the contract are unchanged.

## 4. HostTimeAdapter

New header `src/statemotion/adobe/statemotion_host_time.hpp` (host-independent;
the effect passes in the three integers). Converts Premiere clip-local timing
into `ProgressInput` units.

Research 006 (`docs/research/006-effect-timing.md`) verifies: in Premiere,
`PF_InData.current_time` and `PF_InData.total_time` are **clip-local layer time**
in `time_scale` units. `current_time/total_time` is the robust baseline (guards
`time_step==0` and reversed clips). Therefore:

```cpp
ProgressInput buildProgressInput(
    long current_time, long total_time, long time_scale,
    ids::ProgressMode mode, ids::AlignmentMode alignment,
    double durationSeconds, double delaySeconds,
    double manualProgressNative);   // 0..100 from native manualProgress
```

- `visibleElapsedSeconds = current_time / time_scale`
- `visibleDurationSeconds = total_time / time_scale`
- `manualProgress = clamp(manualProgressNative/100, 0, 1)` (native units 0–100)

`time_scale` is never assumed constant (research 006 confirms Premiere uses
large scales such as 60000). Division guards against `time_scale <= 0` (treat as
1 to avoid divide-by-zero; documented safe behavior).

**No** `GetClipSpeed` / `GetClipStart` / sequence-time reconstruction in this
milestone. If a real Premiere host test later proves clip-local timing fails a
required semantic, STOP and open a separate timing decision ticket.

## 5. RenderInputAdapter (the single renderer-boundary conversion)

After interpolation, convert the canonical `TransformState` to
`RendererTransformState` exactly once:

```cpp
struct RenderDimensions { int outputW, outputH, sourceW, sourceH; };

RendererTransformState toRendererTransformState(
    const TransformState& canonical, const RenderDimensions& dims);
```

Mapping (each line verified by a unit test):

- `positionX = canonical.positionNorm.x * dims.outputW`
- `positionY = canonical.positionNorm.y * dims.outputH`
- `anchorX   = canonical.anchorNorm.x   * dims.sourceW`
- `anchorY   = canonical.anchorNorm.y   * dims.sourceH`
- `scaleX/scaleY = canonical.scale` (unchanged multiplier)
- `rotationDeg = canonical.rotationRadians * 180 / pi`
- `opacity = canonical.opacity` (unchanged 0..1)

For the Premiere software path, source and layer share dimensions, so
`sourceW = outputW`, `sourceH = outputH`. This is the minimal correct set.

## 6. Renderer type rename

Rename `struct TransformState` in `transform_render.h` → `struct
RendererTransformState`. Update `transform_render.cpp`, `transform_render_test.cpp`,
and any reference. **No math change.** The canonical `TransformState` (new, in a
shared header `statemotion_transform_state.hpp` under
`src/statemotion/renderer/` or `shared/`) is the normalized/radians model used by
the adapter, progress, and interpolation.

Interpolation: a new `interpolateCanonical(a, b, p)` returns canonical
`TransformState` (linear per property, exactly mirroring the renderer's existing
`interpolate` but in canonical units). This is a **separate, minimal** function —
it is not a second pixel sampler and reuses the same linear formula semantics.

## 7. Pixel format boundary

The current identity render does a format-agnostic `memcpy`. The host-independent
renderer uses `Pixel` (premultiplied RGBA, `double`). For Phase 0.1 the native
`Render` path:

- Reads source pixels from the Adobe `PF_EffectWorld` for the software path
  (Premiere passes 32-bit float RGBA / BGRA depending on format — **operator
  verifies the exact format on the test machine**; the unit-testable logic uses
  a `Sampler` over an in-memory `Pixel` buffer).
- Builds a `Pixel` buffer via a `Sampler` callback that reads the Adobe world.
- Calls `plan()` + `render()` into a `Pixel` output buffer.
- Writes the buffer back to the Adobe output world.

Only the format actually tested in Premiere is claimed. The unit tests use the
renderer's own `Pixel` abstraction (already the contract), so the
adapter/logic is fully testable without Adobe types.

## 8. Identity fast path

If the canonical interpolated state is identity (`positionNorm == 0`,
`scale == 1`, `rotationRadians == 0`, `anchorNorm == 0`, `opacity == 1`), the
`RenderInputAdapter` yields a `RendererTransformState` with
`identityTransform == true` (same check as `plan()`), and `Render` keeps the
verified direct-copy path. Correctness before optimization; manual mode at
default values must remain byte-identical to source.

## 9. Testing (TDD)

Pure logic lives outside Adobe APIs so it is unit-testable with plain `cl`
(g++ equivalent). New SDK-free tests:

- `statemotion_native_adapter_test.cpp`: POINT→norm (center, TL, BR, off-frame,
  negative); percent scale (100/50/non-uniform); degrees→radians
  (0/90/180/-45); opacity (0/50/100); different source/output dims; mode/alignment
  popup mapping.
- `statemotion_host_time_test.cpp`: elapsed/duration from ticks+scale; 0-scale
  guard; manual 0–100 → 0–1; zero-duration; duration > clip.
- `statemotion_render_input_test.cpp`: norm 0.5,0.5 → output center; anchor
  0.5,0.5 → source center; vertical/UHD dims; radians 0 / pi/2 / -pi/4 → degrees;
  scale/opacity unchanged; no hardcoded dimensions.

Regression suites re-run: contract generator/check, contract tests,
renderer tests, C++ progress tests, TS progress tests, native registration test,
point-default test, identity/load-proof test.

Premiere host tests (§12–§17 of the task) are **operator-run** and recorded with
PASS/FAIL values. They cannot be executed in this SDK-absent environment; the
native `Render` rewiring is written against the SDK headers and reviewed, with
the logic covered by the SDK-free unit tests above.

## 10. Prohibited scope (enforced)

Do NOT implement: UXP panel, preset panel/integration/application,
EffectParameterMap for panel, GPU/CUDA/Metal/PrSDKGPU, crop, masks, stroke, glow,
shadow, motion blur, custom easing, graph editor, installer, licensing,
telemetry, cloud. Do NOT modify `feat/preset-panel`, the permanent match name,
disk IDs, or the parameter contract.

## 11. Clean-room review

All code is original, derived from public Adobe SDK documentation and the
repository's own research notes. No commercial product binary/source inspected.
The `toRendererTransformState` conversion and interpolation formula are original
mathematical mappings, not copied from any vendor implementation.

## 12. Files changed (planned)

- `src/statemotion/renderer/transform_render.h` — rename `TransformState` →
  `RendererTransformState`; add `interpolate` stays for `RendererTransformState`.
- `src/statemotion/renderer/transform_render.cpp` — rename usages (math unchanged).
- `src/statemotion/renderer/transform_render_test.cpp` — rename usages.
- `src/statemotion/renderer/transform_state.hpp` — **new** canonical
  `TransformState` (normalized/multiplier/radians/0..1) + `interpolateCanonical`.
- `src/statemotion/adobe/statemotion_native_adapter.hpp` — **new** (pure).
- `src/statemotion/adobe/statemotion_host_time.hpp` — **new** (pure).
- `src/statemotion/adobe/statemotion_render_input.hpp` — **new** (pure).
- `src/statemotion/adobe/statemotion_*.cpp` tests — **new** (3 SDK-free suites).
- `src/statemotion/adobe/statemotion_effect.cpp` — `Render` reads params, adapts,
  evaluates progress, interpolates, converts, renders (SDK-dependent; reviewed,
  not compiled here).
- `src/statemotion/adobe/statemotion_effect.vcxproj` — add new `.cpp` compile
  inputs if any host-side glue file is introduced (adapter headers are
  header-only, so no new compile item needed).
- design + plan docs under `docs/superpowers/`.
