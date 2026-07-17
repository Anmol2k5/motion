# Research Artifact: 001 — Verify Adobe Plugin Architecture

**Ticket:** `001-verify-adobe-architecture`
**Date:** 2026-07-17
**Verdict:** SPEC CONFIRMED — the two-part architecture (native C++ AE-SDK effect + UXP panel) is correct and is the Adobe-recommended path.

---

## 1. Question Investigated

Verify the correct Adobe plugin architecture for a render-time, per-frame
state-animation video effect in Premiere Pro, against a spec that asserts:

- A native C++ effect built on the **After Effects Effect SDK** performs per-frame rendering.
- A **UXP panel** handles management/UI.

Four sub-questions were verified:

1. Can a UXP-only extension render a per-frame video filter inside Premiere? (Spec: no.)
2. Is the AE Effect SDK the right SDK, or is there a Premiere-native effect SDK? Which sample is canonical?
3. Does Premiere's GPU effect extension require the AE Effect SDK as the base?
4. What is the role of a UXP Hybrid addon — core renderer, or helper computation only? (Spec: helper-only.)

---

## 2. Sources Examined

Primary Adobe sources (official, in priority order):

- **Premiere Pro Plug-In Types** — https://ppro-plugins.docsforadobe.dev/intro/premiere-pro-plugin-types/
- **Video Filters (overview + Getting Started)** — https://ppro-plugins.docsforadobe.dev/video-filters/video-filters/ and https://ppro-plugins.docsforadobe.dev/video-filters/getting-started/
- **GPU Effects & Transitions (overview + Getting Started)** — https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/gpu-effects-transitions/ and https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/getting-started/
- **Sample Projects** — https://ppro-plugins.docsforadobe.dev/intro/sample-projects/
- **Where Do I Start** — https://ppro-plugins.docsforadobe.dev/intro/where-do-i-start/
- **Premiere UXP API (overview)** — https://developer.adobe.com/premiere-pro/uxp/
- **UXP Hybrid Plugins** — https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/
- **Premiere Plugin Guide GitHub repo (readme/structure)** — https://github.com/docsforadobe/premiere-plugin-guide

No commercial product was inspected. All findings derive from Adobe documentation.

---

## 3. Confirmed Facts

### Q1 — UXP-only cannot render a per-frame video filter (CONFIRMED)
- The Premiere **C++ SDK** defines the only plugin types that touch pixels:
  Importers, Exporters, Export Controllers, Transmitters, **Video Filters**,
  **GPU Effects & Transitions**, AE Transition Extensions, Control Surfaces.
  ("Premiere Pro Plug-In Types" page.)
- **Video Filters** are explicitly described as processing "a series of video
  frames with parameters that can be animated over time" — exactly the
  render-time, per-frame requirement. (Plug-In Types page.)
- The Premiere **UXP API** is documented as "a modern extensibility platform for
  building Custom Tools and Features that streamline workflows" — panels,
  commands, modal dialogs, and programmatic access to the Premiere DOM
  (sequences, tracks, clips, markers, project items, application settings).
  It exposes **project/UI orchestration**, not frame buffers.
  (https://developer.adobe.com/premiere-pro/uxp/)
- There is **no UXP API surface for receiving, processing, or returning video
  frame data** in the Premiere UXP docs. UXP plugins are DLL/bundle-hosted JS/HTML/CSS
  panels; they cannot register as a Video Filter or GPU Effect entry point.
- **Conclusion:** A UXP-only extension cannot render a per-frame video filter.
  The spec's assertion (no) is correct.

### Q2 — AE Effect SDK is correct; there is no separate "Premiere-native effect SDK" (CONFIRMED)
- The docs state verbatim: **"We strongly recommend using the After Effects SDK
  to develop effects plugins. Most of the effects included in Premiere Pro are
  After Effects plugins."** ("Video Filters" overview.)
- Repeated: **"We strongly recommend using the After Effects SDK to develop
  effects plugins. Almost all of the effects included in Premiere Pro are After
  Effects plugins, and future development will be based on the After Effects
  API."** (Video Filters page.)
- "Premiere Pro supports a portion of the AE API. The After Effects SDK is not
  included in the Premiere Pro SDK." (Plug-In Types → Other Supported plugin Standards.)
  ⇒ The AE SDK is a **separate download** the developer must obtain; Premiere consumes
  AE-compatible plugins.
- The Video Filter entry point mirrors the AE model: `short xFilter(short selector, VideoHandle theData)`,
  with a PiPL resource declaring `Kind {PrEffect}`, `AE_Effect_Match_Name`, and
  `ANIM_ParamAtom` sections for time-animated parameters. (Video Filters → Getting Started.)
- **Canonical starting samples:**
  - **Software/CPU filter:** the two "video filter sample projects" referenced in
    Video Filters → Getting Started ("Begin with one of the two video filter
    sample projects…"). In the SDK these are the `SDK_ProcAmp`-style / `Vignette`
    effect samples.
  - **Named canonical GPU effect samples** (Sample Projects page):
    - **`SDK_ProcAmp`** — "a simple ProcAmp effect using the After Effects API with
      the Premiere Pro GPU extensions. The effect is found in the SDK folder of the
      Video Effects… Supports Metal acceleration."
    - **`Vignette`** — "creates a vignette on video using the After Effects API with
      the Premiere Pro GPU extensions. Has CUDA and software render paths."
  - For a render-time state-animation effect, **`Vignette` is the recommended
    canonical base** because it demonstrates BOTH a GPU (CUDA) path AND a software
    render path in one plugin (see Q3 fallback). `SDK_ProcAmp` is the simpler
    GPU-only starting point.
- **Conclusion:** The After Effects Effect SDK is the correct and only
  Adobe-recommended SDK for custom Premiere video effects. There is no separate
  "Premiere-native" effect SDK; the Premiere C++ SDK supplies the GPU extensions
  and PiPL/host glue on top of the AE API.

### Q3 — GPU effect extension requires the AE Effect SDK as the base (CONFIRMED)
- Verbatim: **"The GPU extensions work on top of effects and transitions built
  using the After Effects SDK. The extensions are designed to supplement a regular
  software effect or transition, which defines the software rendering path,
  parameters, custom UI drawing, and other standard interaction. The GPU effect
  exists as a new entry point for rendering using the GPU if possible. The software
  render path will be used otherwise."** (GPU Effects & Transitions overview.)
- The GPU sample setup explicitly requires the AE SDK: "the sample project is also
  dependent on the After Effects plugin SDK… create an environment variable
  pointing to it named `AE_SDK_BASE_PATH`, so that the compiler will find the AE
  headers." (GPU Effects → Getting Started.)
- Fallback semantics: "The GPU entry point function will only be called if the
  current project is using GPU acceleration. Otherwise, the normal entry point
  function will be called as described in the After Effects SDK…" ⇒ The AE software
  path is the guaranteed fallback; GPU is an optional accelerator.
  (GPU Effects → Getting Started, Entry Point.)
- **Conclusion:** Yes — the AE Effect SDK software effect is the mandatory base;
  the Premiere GPU extension is layered on top as an optional, accelerated render
  entry point with software fallback.

### Q4 — UXP Hybrid addon role: helper computation, NOT core renderer (CONFIRMED)
- A **UXP Hybrid plugin** is "a standard UXP plugin that can load
  dynamically-linked shared objects written in C++" via `require("sample.uxpaddon")`,
  mirroring Node.js C++ addons / Node-API. (UXP Hybrid Plugins page.)
- Documented **Use Cases** are explicitly helper/computation oriented:
  "Performance-intensive audio/video processing: offload computationally expensive
  operations (custom waveform analysis, **frame-level pixel manipulation**, audio DSP
  algorithms) to native code while keeping the **UI and orchestration logic in
  JavaScript**." Also: integration with C++ libraries (OpenCV, TFLite), metadata
  batch processing, bridging external native pipelines.
- Critically, the Hybrid addon runs **inside the UXP plugin runtime** — it is loaded
  by a UXP panel/command, not by the Premiere render pipeline. It has no Video
  Filter / GPU Effect entry point and cannot be invoked per-frame by the Mercury
  Playback Engine. Its "frame-level pixel manipulation" is ad-hoc computation the
  JS side calls on demand, not a registered render hook.
- Minimum requirements show Hybrid is a Premiere **26.2+ / UXP** feature — a much
  newer, app-extension layer distinct from the C++ plugin pipeline.
- **Conclusion:** A UXP Hybrid addon can perform heavy helper computation
  (e.g., precomputing animation state, parsing state files, running inference,
  generating parameter keyframes) but **cannot be the core per-frame renderer**.
  The spec's "helper-only" assertion is correct.

---

## 4. Unverified Assumptions / Gaps

- **Exact SDK sample folder names.** The docs say "two video filter sample
  projects" and name `SDK_ProcAmp` and `Vignette` under GPU samples; the precise
  folder/name of the pure-software filter sample in the current SDK build was not
  enumerated in the docs pages fetched (the repo's `Examples/` tree was not
  recursively listed). The recommendation (`Vignette` as base) holds because it
  contains both paths; the plain-software sample is a fallback if GPU is unwanted.
- **Whether UXP can drive the AE effect's parameters at render time.** We confirmed
  UXP can manipulate the Premiere DOM (clip effects/parameters) but did not find an
  explicit doc statement that a UXP panel can write animated keyframes into a
  third-party AE effect during a render. This is a reasonable inference, not a
  quoted fact. (See follow-ups.)
- **Hybrid addon frame access specifics.** Docs mention "frame-level pixel
  manipulation" as a use case but do not specify how a Hybrid addon obtains frame
  bytes (presumably via JS passing buffers, not host push). Mechanism unconfirmed.

---

## 5. Contradictions Found

- **None material.** The UXP overview and the C++ SDK guide are consistent: UXP =
  workflow/UI/orchestration; C++/AE SDK = pixel rendering. The only nuance is that
  Hybrid addons blur the line by allowing C++ inside UXP — but that C++ still runs
  under UXP orchestration, not the render pipeline, so it does not contradict the
  two-part architecture.
- Minor: the GPU Getting Started says "begin with one of the two GPU effect sample
  projects" while Sample Projects lists only `SDK_ProcAmp` and `Vignette` as GPU
  effects (plus `SDK_CrossDissolve` as a transition). The "two" refers to the two
  effect samples, consistent with the listing.

---

## 6. Recommendation

Adopt the two-part architecture exactly as specified:

1. **Core renderer = native C++ effect on the After Effects Effect SDK**, using the
   **`Vignette` sample** as the canonical base (it ships both CUDA GPU and software
   render paths, satisfying the GPU-extension-as-optional-accelerator model). Use
   PiPL `ANIM_ParamAtom` entries for time-animated state parameters.
2. **Management/UI = UXP panel** for project setup, state-file loading, and
   parameter orchestration via the Premiere DOM.
3. **Optional helper = UXP Hybrid addon** for heavy off-thread computation
   (state interpolation, asset parsing, ML inference) — explicitly NOT the renderer.
4. Treat the **software (AE) render path as mandatory** and the GPU path as an
   opt-in accelerator with no mid-render fallback (per GPU Getting Started).

No spec change required; the architecture is validated against current Adobe docs.

---

## 7. Impact on Spec

- **No contradiction with the spec.** The spec's four assertions are all confirmed:
  (1) UXP-only cannot render frames; (2) AE Effect SDK is correct, no Premiere-native
  effect SDK; (3) GPU extension requires AE SDK base; (4) Hybrid addon is helper-only.
- Confidence: **High** for Q1–Q4 conclusions; **Medium** only on the precise
  software-sample folder name (mitigated by choosing `Vignette`, which covers both
  paths).
- Suggested spec refinement (non-blocking): explicitly state that the C++ effect
  must carry BOTH a software and an optional GPU entry point, and that the UXP
  panel is the only sanctioned UI surface.

---

## 8. Follow-up Decisions Surfaced

- **015-native-uxp-boundary (blocked by this ticket):** Now unblocked — the
  boundary is: UXP ⇄ C++ effect communicate via (a) Premiere DOM parameter writes
  from the UXP panel and (b) optional Hybrid addon calls for helper computation.
  Define the exact parameter-passing contract between UXP panel and the AE effect
  (PiPL param IDs, keyframe injection method).
- Decide whether **GPU acceleration is required or optional** for StateMotion v1.
  If optional, `Vignette`'s dual-path design is ideal; if GPU-only, `SDK_ProcAmp`
  is a leaner base (but loses the software fallback safety net).
- Confirm the **state-description format** (file/structure) the UXP panel loads and
  whether its parsing lives in the UXP JS, a Hybrid addon, or is passed pre-parsed
  into AE effect parameters.
- Verify (separate research) whether UXP can write **animated keyframes** into a
  third-party AE effect's parameters programmatically — needed if the panel drives
  per-frame state changes rather than the effect computing them internally.

---

*Artifact authored by research subagent. No production code written. No commercial
product inspected. All claims cite Adobe primary sources listed in §2.*
