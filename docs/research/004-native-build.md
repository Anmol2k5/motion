# Research 004 — Native-Effect Build Requirements (Windows + macOS)

**Ticket:** `004-native-build-requirements`
**Status:** resolved (research only; ticket left open per instructions)
**Date:** 2026-07-17
**Scope:** Verify Windows/macOS native-effect build requirements for a Premiere
video effect built on the After Effects Effect SDK + Premiere GPU extension.

Clean-room note: all findings are from public documentation (docsforadobe /
Adobe developer docs / Adobe community). No commercial product was inspected and
no production code was written.

---

## Question

Verify:
1. Windows toolchain (spec: VS2022), C++ standard (spec: C++20), CMake usage,
   exact SDK sample to start from.
2. macOS toolchain (spec: Xcode), Apple Silicon arch, codesign/notarization for a
   loadable effect.
3. Where the built binary must be placed (MediaCore plugin path) per OS.
4. Whether the AE Effect SDK sample already builds on both OSes; minimum project
   files genuinely required vs. avoidable.

---

## Sources

- S1. Premiere Pro C++ SDK Guide — SDK Audience (toolchain requirements):
  https://ppro-plugins.docsforadobe.dev/intro/sdk-audience/
- S2. SDK Guide — Sample Projects (BuildAll projects, build paths, env vars):
  https://ppro-plugins.docsforadobe.dev/intro/sample-projects/
- S3. SDK Guide — GPU Effects & Transitions › Getting Started (sample deps:
  AE_SDK_BASE_PATH, Boost, Python, CUDA):
  https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/getting-started/
- S4. SDK Guide — Plug-In Installation (MediaCore paths, .prm/.bundle naming):
  https://ppro-plugins.docsforadobe.dev/intro/plugin-installation/
- S5. SDK Guide — Load Em Up (ad-hoc signing for macOS 15+, /MD linkage):
  https://ppro-plugins.docsforadobe.dev/intro/load-em-up/
- S6. SDK Guide — What's New (26.0 WinARM-native; 15.4 ARM-native headers;
  12.0 AE 15.0+ compat, runtime multi-effect registration, CUDA/Metal macros):
  https://ppro-plugins.docsforadobe.dev/intro/whats-new/
- S7. Adobe Community bug — Non-notarized plugins not loading (25.2 enforces
  notarization; 25.1 did not):
  https://community.adobe.com/t5/premiere-pro-bugs/non-notarized-plugins-not-loading/idi-p/15249538
- S8. Adobe Developer — Hybrid Plugins FAQ (macOS Developer ID signing +
  notarization; arm64/x64/universal build guidance). Context: UXP hybrid
  addons, not C++ .bundle, but corroborates the platform-level signing rule:
  https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/faq

---

## Confirmed facts

### 1. Windows toolchain / C++ standard / CMake / starting sample

- **Toolchain (CONFIRMED, more specific than spec):** the required Windows
  environment is **Microsoft Visual Studio 2022 LTSC 17.12** (S1). Spec's
  "VS2022" is correct but under-specified — Adobe pins the LTSC 17.12 servicing
  baseline.
- **"100% NOT supported" clause (CONFIRMED):** "Other compilers, build
  configurations, and programming languages are all 100% NOT supported." (S1).
  This directly affects the CMake question below.
- **C++ standard (NOT CONFIRMED by docs):** the SDK Guide never states a C++
  language-standard version. It only says APIs are C-compatible and samples are
  written in C++ (S1). The spec's "C++20" claim is **unverified** — it is a
  StateMotion project choice, not an Adobe requirement. The shipped `.sln`/
  `.vcxproj` files set whatever standard Adobe chose (must be read from the SDK
  once downloaded).
- **CMake (NOT USED by the SDK; effectively unsupported):** Adobe ships
  `BuildAll.sln` for Windows and `BuildAll.xcodeproj` for macOS (S2). There is
  **no CMake** in the official SDK, and the "other build configurations are 100%
  NOT supported" statement (S1) means a CMake-generated project is outside
  Adobe's support envelope. CMake *can* produce a loadable `.prm`/`.bundle` (the
  loader only cares about the binary + PiPL/entry points), but it is unsupported
  and you must replicate every setting Adobe's project files carry (linkage,
  output extension, custom build steps, PiPL compilation).
- **Starting sample (CONFIRMED):** for a GPU-accelerated effect using the AE API
  + Premiere GPU extensions, begin from one of the two GPU effect samples (S3):
  - **`SDK_ProcAmp`** — simple ProcAmp, **Metal** acceleration, AE API + PPro GPU
    extensions (S2). Best minimal starting point.
  - **`Vignette`** — vignette effect with **CUDA + software** render paths, plus
    8-bit/32-bit RGB/YUV software paths and AE smart-render paths (S2). Richer
    reference if CUDA/software fallback is needed.
  - (`SDK_CrossDissolve` is a transition, not an effect — not the target.)
  - Recommendation: **start from `SDK_ProcAmp`** and progressively replace its
    functionality (S3 explicitly advises this pattern).

### 2. macOS toolchain / Apple Silicon / signing + notarization

- **Toolchain (CONFIRMED, more specific than spec):** minimum is **Xcode 16.2 on
  macOS 15.7.1 or later** (S1). Spec's "Xcode" is correct but under-specified.
- **Apple Silicon (CONFIRMED supported):** ARM-native plugin builds are
  supported; the `PrSetEnv.h` header was updated in **15.4** to allow building
  ARM-native plugins (S6). Adobe's general guidance is to build/test **macOS
  arm64 (Apple Silicon), macOS x64, and Windows x64** and ship **universal**
  macOS binaries (S8). For StateMotion's macOS target: build **arm64** at
  minimum; a universal (arm64 + x86_64) `.bundle` is the shippable form.
- **Codesigning (CONFIRMED, hard requirement on modern macOS):**
  - macOS 15+ **prevents loading unsigned plugins**. Minimum viable dev workaround
    is **ad-hoc signing** as a custom build step (S5):
    `codesign --force --deep --sign - /path/to/plugin` (trailing `-` required).
  - For **distribution**, Premiere Pro **25.2+ no longer loads non-notarized
    plugins** — 25.1 tolerated them, 25.2 rejects them with
    `error code: 2685337601` and marks the plugin Ignore (S7). Notarization
    requires an **Apple Developer ID** certificate (S8).
- **Net:** dev-time = ad-hoc sign; ship-time = **Developer ID sign + notarize +
  staple**. This is stricter than the spec captured and is a real gate for
  ticket 010 (host test environment) if testing on PPro 25.2+.

### 3. Where the built binary must be placed (MediaCore plugin path)

Common plugin location loaded by Premiere, After Effects, Audition, and Media
Encoder (S2, S4):

- **Windows (PPro 22.0+):** `[Program Files]\Adobe\Common\Plugins\7.0\MediaCore\`
  - Registry hint (per-version): `HKLM\Software\Adobe\Premiere Pro\<ver>\` value
    `CommonPluginInstallPath` (S4).
  - Folder renamed `\Plug-ins` → `\Plugins` in 22.0; `\Plug-Ins` still honored
    for the foreseeable future (S4).
- **macOS (PPro 22.0+):**
  `/Library/Application Support/Adobe/Common/Plugins/7.0/MediaCore/` (S2, S4).
  - Mac installer hints: `com.Adobe.Premiere Pro.paths.plist` in
    `/Library/Preferences` (S4).
- **Version is locked at `7.0`** for all CC versions (S2).
- **File extensions (CONFIRMED):** Windows = **`.prm`**, macOS = **`.bundle`**;
  AE-style plugins use **`.aex`** (S4). A GPU effect built on the AE API + PPro
  GPU extensions ships as `.prm` on Windows and `.bundle` on macOS.
- **Debug tip:** build directly into the MediaCore folder rather than copying
  after build, so the plugin can be debugged while the host runs (S2). On
  Windows this may require launching Visual Studio as Administrator (S2).

### 4. Does the AE Effect SDK sample already build on both OSes? Minimum files.

- **Builds on both OSes out of the box (CONFIRMED):** yes. Adobe ships a combined
  master project in the SDK `Examples` folder — **`BuildAll.xcodeproj`** (macOS)
  and **`BuildAll.sln`** (Windows) (S2). Since **12.0** the GPU effect samples
  load in **both Premiere Pro and After Effects** (S6).
- **External dependencies the GPU samples require (CONFIRMED) (S3):**
  - **AE plugin SDK** — headers referenced via env var **`AE_SDK_BASE_PATH`**
    (Windows env var; macOS: Xcode › Settings › Locations › Custom Paths).
  - **Boost** — `BOOST_BASE_PATH` (download from boost.org).
  - **Python 3.6+** — used by custom build steps.
  - **CUDA SDK** — only if the effect uses CUDA — `CUDA_SDK_BASE_PATH` (Windows).
  - **`PREMSDKBUILDPATH`** (Windows) — output base path so the built `.prm`
    lands in MediaCore (S2).
- **Minimum project files genuinely required (per plugin):**
  - The compiled effect source (`.cpp`/`.h`) + GPU kernels (Metal/CUDA/OpenCL as
    needed).
  - A **project/build file** carrying Adobe's exact settings: `.vcxproj` (Win) /
    `.xcodeproj` target (mac). This is where output extension, `/MD` runtime
    linkage (S5), and custom build steps live.
  - **Entry-point registration.** Two paths (S6, 12.0):
    - **PiPL resource** (`.r`/`.rc`) — still required for **After Effects**
      compatibility and for backward compat in PPro.
    - **Runtime multi-effect registration** — replaces PiPL, **PPro-only**.
  - So a **PPro-only** effect could in principle drop the PiPL and register at
    runtime, but if AE compatibility is wanted (samples support both), keep PiPL.
- **Genuinely avoidable scaffolding:**
  - `BuildAll` umbrella — convenience only; a single-plugin project suffices.
  - CUDA toolchain / `CUDA_SDK_BASE_PATH` — avoidable if targeting **Metal**
    (macOS) + software fallback only.
  - The non-effect samples (importers, exporters, transmitter, control surface)
    — irrelevant to an effect.
- **Not avoidable:** AE SDK headers, Boost, Python (custom build steps),
  correct output extension + MediaCore output path, `/MD` linkage on Windows
  (static `/MT` can exhaust fiber-local storage slots and break loading — S5),
  entry-point registration (PiPL or runtime), and macOS signing.

---

## Assumptions

- A1. StateMotion targets a **PPro-loadable GPU effect** (`.prm`/`.bundle`), not
  an AE-only `.aex`. If AE loadability is also required, PiPL must be retained.
- A2. Target macOS host is PPro **25.2 or newer**, so notarization is a hard ship
  gate. If pinned to ≤25.1, ad-hoc signing alone loads (dev only).
- A3. "C++20" is a StateMotion internal choice; Adobe's `.vcxproj`/`.xcodeproj`
  standard version must be confirmed by reading the downloaded SDK.

## Contradictions / spec deltas

- C1. **Spec "VS2022"** vs docs **"VS2022 LTSC 17.12"** — tighten spec to the
  LTSC servicing baseline (S1).
- C2. **Spec "Xcode"** vs docs **"Xcode 16.2 / macOS 15.7.1+"** — tighten (S1).
- C3. **Spec "CMake usage"** vs docs — the official SDK uses **`.sln` /
  `.xcodeproj`, not CMake**, and non-Adobe build configs are "100% NOT
  supported" (S1, S2). Using CMake is possible but unsupported and risky.
- C4. **Spec "C++20"** — **unverified** against Adobe docs; no standard version
  is documented (S1).
- C5. Spec likely does not capture **notarization** (25.2+ hard gate) or the
  **ad-hoc-signing dev workaround** — both are load-blocking on modern macOS
  (S5, S7).

---

## Recommendation

1. **Windows:** VS2022 **LTSC 17.12**, `/MD(d)` dynamic runtime linkage. Start
   from **`SDK_ProcAmp`**. Keep Adobe's `.vcxproj` as the source of truth for
   build settings; **do not adopt CMake** unless the project accepts unsupported
   status and fully replicates Adobe's settings (output `.prm`, PiPL step,
   custom build steps).
2. **macOS:** Xcode **16.2** on macOS **15.7.1+**. Build **arm64** (ship
   **universal**). Add **ad-hoc `codesign`** as a build step for dev; require
   **Developer ID sign + notarize + staple** for any host on PPro 25.2+.
3. **Output paths:** Win `...\Adobe\Common\Plugins\7.0\MediaCore\` (`.prm`);
   mac `/Library/Application Support/Adobe/Common/Plugins/7.0/MediaCore/`
   (`.bundle`). Build directly into these for debugging.
4. **Dependencies:** wire `AE_SDK_BASE_PATH`, `BOOST_BASE_PATH`, Python 3.6+,
   and `PREMSDKBUILDPATH` (Win). Skip CUDA if Metal-only.
5. **Entry point:** keep **PiPL** if AE compat matters; otherwise runtime
   multi-effect registration (PPro-only) is permitted.

## Impact on spec

- Update toolchain lines: VS2022 → **VS2022 LTSC 17.12**; Xcode → **Xcode 16.2 /
  macOS 15.7.1+**.
- Reclassify **CMake** from a stated requirement to an **explicitly unsupported
  option**; default to Adobe's `.sln`/`.xcodeproj`.
- Mark **C++20** as a StateMotion-internal decision, pending confirmation of the
  SDK's own standard setting.
- Add **macOS notarization (Developer ID) as a distribution requirement** and
  **ad-hoc signing as a dev requirement** — both load-blocking on macOS 15+ /
  PPro 25.2+.
- Add explicit **build dependency list** (AE SDK, Boost, Python, optional CUDA)
  and **MediaCore output paths + extensions** to the spec.

## Follow-ups

- F1. Download the actual Premiere Pro / AE SDK and read the shipped
  `SDK_ProcAmp` `.vcxproj`/`.xcodeproj` to confirm the **C++ standard version**
  and exact compiler/linker flags (resolves C4/A3).
- F2. Confirm target host **Premiere Pro version** for ticket 010 to decide
  whether notarization is required at test time (A2).
- F3. Decide **PPro-only vs AE-compatible** to settle whether PiPL is required.
- F4. If WinARM support is desired, verify against **What's New 26.0** WinARM-
  native plugin support (S6) and add an arm64 Windows config.
- F5. Locate the official SDK **download page / EULA** to confirm clean-room /
  licensing constraints before distribution.
