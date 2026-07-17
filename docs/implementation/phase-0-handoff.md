# Phase 0 / 0.1 Vertical Slice — Implementation Handoff

**Status:** Authorized for implementation (2026-07-17).
**Wayfinder:** Complete — all 19 tickets resolved (`docs/agents/issue-tracker.md`, `.scratch/statemotion-wayfinder/map.md`).
**Ponytail:** Enforced — minimum-safe implementation only. No over-building, no speculative scaffolding, no "future-proofing" beyond the contract this slice requires.

---

## 1. Authorization scope

This document authorizes **only** the **First Vertical Slice** (internal name:
**0.1 Architecture Validation**). It does **not** authorize v1.0, and it does not
authorize treating the v1.0 destination as one task. Implementation proceeds through
independently testable milestones; this handoff covers the first one only.

The slice exists to prove the architecture end-to-end: a coding agent can build,
install, apply, animate, and re-open a transform-only motion effect on footage/stills
with a correct CPU renderer — without guessing Adobe architecture, the native/UXP split,
timing, parameter contracts, or the clean-room boundary.

Derived from resolved tickets: `011` `012` `013` `014` `015` `016` `017` `018` `019`.

---

## 2. What the slice MUST include

### 2.1 Native C++ Premiere effect (AE Effect SDK)

- Native effect is the **visual truth**: it renders a visible result without the UXP
  panel present (`015`). Panel is editing workflow only.
- Registered with permanent IDs (clean-room, `016`):
  - effect: `AE.io.github.anmol2k5.statemotion.effect`
  - preset: `io.github.anmol2k5.statemotion.preset`
  - panel: `io.github.anmol2k5.statemotion.panel`
  - display name: **StateMotion**
- Build via the Adobe SDK `BuildAll.sln` (NOT CMake per `004`). VS2022 LTSC 17.12 on
  Windows (first practical target, `003`).
- MediaCore install path: `...\Plugins\7.0\MediaCore\` (Windows, `009`).

### 2.2 Generated parameter contract (`014`)

- Logical dotted IDs are canonical; mapped to generated `{diskId, wireName, nativeType}`
  bindings. Raw native indexes never leak past `EffectParameterMap` (`015`).
- Disk-ID family ranges: **1–49** active A/B transform, **50–99** alignment/mode,
  **100–149** active controls; **150–399 reserved** (reserved IDs must NOT appear as
  actual params in this slice — no placeholder params).
- Transform family (all five pairs wired end-to-end, `012`):
  - Position — `POINT`, pixels
  - Scale X / Scale Y — `FLOAT_SLIDER`, percent
  - Rotation — `ANGLE`, degrees
  - Anchor — `POINT`, pixels
  - Opacity — percent
- `manualProgress` is the only keyframeable progress parameter.
- Contract handshake: `schemaVersion` / `parameterCount` / `bindingRevision`.
- Per-instance wireName→index discovery (index drift is real, `008`); stable key is
  disk `id`.
- Normalized position/anchor handled through the native-to-canonical adapter.

### 2.3 UXP panel (`015`)

- Selects supported clips (footage + stills only, `017`) and applies the effect in a
  single undo.
- Minimal local panel preview (does not need per-frame UXP rendering; UXP cannot render
  the frame, `001`).
- Shares with native only: the generated contract + curve fixtures. No RPC, no WASM, no
  Hybrid render path.
- Insert effect after the last verified intrinsic component by **match name** (`017`):
  never index 0, never by display name. Ambiguous/unclear component chain → skip with a
  `COMPONENT_ORDER_UNSUPPORTED` diagnostic; never best-effort append.

### 2.4 Timing & progress (`013`)

- Sequence / track-item time is authoritative; derive visible elapsed from host timing
  (`006`), not a blind `PF_InData.current_time`.
- All **7 progress modes** and **3 alignments** (clip-start, clip-end, entire-clip) in
  the first slice.
- Approved first-slice easing curves only.
- A mandatory Premiere timing prototype gates final validation (timing observable via
  `PF_UtilitySuite`, `006`).

### 2.5 CPU / software renderer (`018`)

Single correct CPU renderer. No GPU. Render order:

```
host timing
→ alignment progress
→ progress-mode mapping
→ curve evaluation
→ interpolate TransformState A/B
→ construct inverse transform
→ map output pixel to source pixel
→ bilinear sample
→ apply opacity
→ write premultiplied output
```

Rendering fundamentals required for correctness:

- Inverse-transform mapping (rotation around the animated anchor point).
- Bilinear source sampling (4-tap lerp; Section 3 reference).
- Transparent output `RGBA = 0,0,0,0` for samples outside source bounds — no edge
  smear, no coordinate clamping to nearest edge.
- Premultiplied-alpha-safe compositing (opacity scales all premultiplied channels).
- Opacity clamping to `[0, 1]`.
- Safe nonzero scale (`safeScale`, ±1e-4 floor) to avoid singular transforms, preserving
  overshoot; negative scale stays valid for mirroring if the native limits permit.
- Normalized position/anchor via the adapter.
- Deterministic output across repeated renders.

### 2.6 Tests

- Unit tests (transform math, curve eval, bilinear, safeScale, premultiplied compositing).
- Native/UXP CurveEngine parity within `1e-6` (`015`) — separate C++ and TS engines.
- Premiere host tests (apply → animate → re-open deterministic rerender).
- CPU reference benchmarks per scenario in `docs/performance/cpu-reference-benchmarks.md`
  (`018` Q2): StateMotion version, commit SHA, Premiere version, OS, CPU, memory,
  sequence res/fps, source res, pixel format, scenario, avg/median/p95 frame time.
  Fixtures: identity, scale, position, rotation, combined, opacity at 1920×1080,
  1080×1920, 3840×2160, transparent source, still-with-source≠sequence.

### 2.7 Clean-room boundary (`016`)

- Independent implementation inspired by the general state-based animation workflow only.
- Permitted: general workflow knowledge. Forbidden: inspect/copy/exact-reproduce any
  commercial Motion State binary, source, preset, asset, or branding.
- Include the required non-affiliation disclaimer (Adobe + commercial product) in
  distribution metadata and docs.
- Clean-room needs no Adobe review (`009`).

---

## 3. Bilinear sampling reference (verbatim from `018`)

```cpp
const int x0 = static_cast<int>(std::floor(x));
const int y0 = static_cast<int>(std::floor(y));
const int x1 = x0 + 1;
const int y1 = y0 + 1;

const double fx = x - x0;
const double fy = y - y0;

const Pixel top =
    lerp(sample(x0, y0), sample(x1, y0), fx);

const Pixel bottom =
    lerp(sample(x0, y1), sample(x1, y1), fx);

const Pixel result =
    lerp(top, bottom, fy);
```

Out-of-bounds samples return transparent black `RGBA = 0,0,0,0` (do not clamp to edge).

**Alpha behavior (premultiplied):**

```cpp
output.r = sampled.r * opacity;
output.g = sampled.g * opacity;
output.b = sampled.b * opacity;
output.a = sampled.a * opacity;
```

**Scale safety:**

```cpp
double safeScale(double value) {
    constexpr double epsilon = 1e-4;
    if (std::abs(value) >= epsilon) return value;
    return value < 0.0 ? -epsilon : epsilon;
}
```

---

## 4. Explicit prohibitions (Ponytail: do NOT build or scaffold)

Per `018`, `019`, and Ponytail's minimum-safe rule, the following are **excluded from
this slice and must not appear as code, parameters, empty passes, disabled controls,
placeholder presets, reserved-but-wired groups, directory stubs, or speculative
abstractions**:

- **GPU:** no CUDA, Metal, `PrSDKGPU*`, GPU kernels, shaders, capability-detection
  dummies, or GPU build deps. CPU is the permanent reference; GPU opens only in the
  later "GPU parity" milestone, and only after CPU golden-frame + host tests pass and
  profiling justifies it (`018`).
- **Crop and rounded masks:** no crop params, rounded-corner params, feathering, or
  mask geometry.
- **Styling effects:** no stroke, gradient stroke, glow, shadow.
- **Motion blur:** no `enabled`, `sampleCount`, `shutterAngle`, Draft/Preview/High/Ultra
  tiers, temporal sampling, or frame accumulation. The values Draft=2/Preview=4/High=8/
  Ultra=16 are design guidance for a later ticket only — not constants or code here.
- **Bicubic sampling:** bilinear only.
- **Expanded clip types:** footage + stills only. No Essential Graphics, adjustment
  layers, nests, MOGRT, multicam (`017`).
- **Full preset systems:** no preset browser, original/commercial presets, animated
  preset previews, user presets, favorites, collections, import/export browser. (The
  preset *disk ID* `io.github.anmol2k5.statemotion.preset` is reserved for clean-room
  naming only; no preset functionality is built.)
- **Batch / matching-instance tools:** no copy/selective paste of A/B, no matching-
  instance select/update/remove, no side-by-side batch utilities.
- **Production installers / commercial polish:** no signed packages, no marketing pages.
- **Speculative scaffolding:** no empty `// TODO GPU` files, no "future hook" interfaces
  that this slice does not call, no parameter slots reserved-then-unused beyond the
  explicitly reserved disk-ID range (150–399 stays absent from the actual param set).

If a `// later` note is genuinely needed to explain an *excluded* decision, it must cite
the resolving ticket (`018`/`019`) and must not introduce a code path, parameter, or
directory.

---

## 5. Ponytail enforcement checklist (apply during build)

- Implement the smallest thing that satisfies Sections 2.1–2.7. Nothing broader.
- Reject per-pixel heap allocation, param lookup, matrix rebuild, invariant recompute,
  suite-resolve, or per-pixel logging inside the pixel loop (`018` Q2). Precompute a
  `CpuRenderPlan { inverseTransform, opacity, dims, identityTransform,
  fullyTransparent }` before the loop.
- Permitted correctness-first fast paths: opacity ≤ 0 → transparent frame;
  identity + opacity == 1 → safe copy; out-of-bounds sample → transparent without
  sampling. No SIMD/threading/tiling/custom alloc until profiling proves need.
- Do not create abstractions for features in Section 4.
- Each subsystem that exists must have a test (Section 2.6) or be removed.
- Regression guard: investigate (do not auto-fail) if median frame time > 25% slower
  than baseline on the same machine/fixture. Golden-frame correctness failures are hard
  fails.

---

## 6. Acceptance criteria (slice is "done" when)

1. Native effect installs into Premiere (MediaCore path) and renders a transform
   animation on footage **and** stills with no panel present.
2. UXP panel selects a supported clip, applies the effect in one undo, and reads/writes
   the generated contract.
3. All five transform pairs (pos/scale/rot/anchor/opacity) interpolate A→B across all 7
   progress modes and 3 alignments.
4. CPU renderer correctly handles: identity; position-only; uniform + non-uniform scale;
   rotation; rotation around a noncentral anchor; opacity; combined transform; off-screen
   motion; transparent source pixels; source≠sequence dimensions; landscape + vertical
   sequences; overshooting curves without invalid memory access.
5. Bilinear sampling + premultiplied-alpha compositing match the Section 3 reference;
   out-of-bounds → transparent black.
6. Save → close → reopen yields a deterministic rerender (byte-stable golden frames).
7. Native/UXP curve parity within `1e-6`.
8. CPU reference benchmarks recorded per Section 2.6 fixtures.
9. No prohibited feature (Section 4) exists in the tree in any form.
10. Clean-room disclaimer present; no commercial-asset/branding leakage.

---

## 7. Not in this slice (remaining fog — prototype/Phase-1 tickets later)

- Graphics-generation component **match name** for EG text/shapes (undocumented; needs a
  host prototype, `007`).
- **POINT resolution-independence gate:** before freezing disk IDs 100/101/108/109, the
  Phase 0 prototype must verify native POINT works across 1920×1080, 3840×2160,
  1080×1920, post-apply resolution change, scaled source, still-with-source≠sequence.
  If Premiere fails, replace each POINT with two normalized FLOAT_SLIDERs (disk IDs
  unchanged) — this is a Phase-0 prototype finding, not a v1.0 defer.
- Exact Phase-0 repository layout (grow per phase; do not pre-create the full spec
  monorepo).
- Panel→effect version-mismatch handling (no signed installer yet).

---

## 8. Transition note

This handoff closes Wayfinder's planning role. Implementation begins at Phase 0 / 0.1
only. The v1.0 destination (full spec §26) remains the long-term target but is **not
authorized** as a unit of work here. Future milestones (crop/masks → GPU parity →
presets → styling → motion blur → batch → expanded clips → packaging → v1.0) each get
their own acceptance criteria and may be deferred by a later ticket when evidence shows
they are unsafe, unreliable, or disproportionately expensive (`019` scope-control rule).
