# Research: 005-cuda-metal-cpu-fallback

## Question

Verify CUDA, Metal, and CPU-fallback requirements for a Premiere GPU effect,
and confirm the spec's GPU claims/exclusions:

1. How a Premiere GPU effect declares/selects CPU vs GPU rendering. (Confirm API
   names: `PF_GPUDeviceSuite` / `PrGPU` / `PrSDKGPU`.)
2. On Windows, is CUDA the supported GPU path, or is there a required abstraction
   that CUDA plugs into? Confirm "CUDA Driver API on Windows NVIDIA".
3. On macOS, is Metal the supported path? Confirm.
4. Are OpenCL and DirectX 12 actually excluded by Premiere's GPU effect API, or is
   that a project choice?
5. Minimum correct CPU (software) render entry point, and does it always exist as
   fallback?

---

## Sources

- https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/gpu-effects-transitions/
  (Overview / System Requirements / Compilation notes / DirectX)
- https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/getting-started/
  (Fallback to Software Rendering / Entry Point)
- https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/cuda-opencl-metal-opengl/
  (CUDA, OpenCL, Metal, OpenGL)
- https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/suites/ (GPU Device Suite)
- https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/PrGPUFilter-function-table/
- https://ppro-plugins.docsforadobe.dev/gpu-effects-transitions/function-descriptions/
  (CreateInstance opt-in semantics)

All sources are the official Adobe Premiere Pro C++ SDK Guide (docsforadobe.dev),
dated April 10, 2026 (current docs build). No commercial SDK headers were
inspected — findings are from published documentation only (clean-room compliant).

---

## Confirmed Facts

### 1. Declaring / selecting CPU vs GPU rendering

- A GPU effect is **not** a separate plugin. It is an *additional entry point*
  layered on top of a normal After Effects–SDK software effect/transition
  (plugins built on the AE SDK). The software path is the base; the GPU path is
  supplementary. (GPU Effects overview; Getting Started "Entry Point".)

- The GPU entry point is the function `xGPUFilterEntry`, which is only called
  when the project uses GPU acceleration (File > Project Settings > General >
  Video Rendering and Playback > Renderer = a GPU option). Otherwise the normal
  AE entry point is called. (`Getting Started > Entry Point`.)

- The current GPU API namespace is **`PrSDKGPU`** / **`PrGPUFilter`** — not
  `PF_GPUDeviceSuite` (legacy/AE) nor a bare `PrGPU`. Concrete confirmed names:
  - `PrGPUFilter`, `PrGPUFilterInfo`, `PrGPUFilterInstance`,
    `PrGPUFilterRenderParams`, `PrGPUFilterFrameDependency`
  - `PrSDKGPUFilterInterfaceVersion1 == 1`
  - `PrSDKGPUDeviceSuite` (the device suite used to allocate outFrame, etc.)
  - `PrGPUFilterModule.h` (`GetParam`, `GetProperty`),
    `PrSDKVideoSegmentProperties.h`
- The GPU **Device Suite** is the **GPU Device Suite** (sometimes historically
  called `PF_GPUDeviceSuite` in older AE-context docs). It provides
  `GetDeviceInfo()`, `AcquireExclusiveDeviceAccess()` /
  `ReleaseExclusiveDeviceAccess()`, `PurgeDeviceMemory()`. (`Suites` page.)

- **Opt-in / opt-out is per-instance, decided in `CreateInstance`.** "When a new
  GPU effect instance is created, the instance has the option of opting-in or
  out of providing GPU rendering." Returning an error from `CreateInstance`
  causes that node to be rendered in software for the current set of parameters.
  So CPU-vs-GPU selection is dynamic, parameter-driven, not a static flag.
  (`Getting Started > Fallback`; `Function Descriptions > CreateInstance`.)

- The host decides GPU vs software *per render*: "The GPU effect exists as a new
  entry point for rendering using the GPU if possible. The software render path
  will be used otherwise." There is **no API to fall back to software in the
  middle of a render** — opt-out must happen at instance creation. (`Getting
  Started > Fallback`.)

### 2. Windows GPU path — CUDA, with Driver API recommendation

- Windows GPU effects are built with the **CUDA SDK** (recommend CUDA SDK 11.8;
  min compute capability sm_50; Kepler dropped). The CUDA SDK is required for
  CUDA rendering development. (`GPU Effects > System Requirements / Compilation notes`.)
- Adobe **recommends the CUDA Driver API** (not Runtime) for best forward
  compatibility, because "the driver API is directly backwards compatible with
  future drivers." So the spec's "CUDA Driver API on Windows NVIDIA" claim is
  **accurate and Adobe-endorsed**. (`CUDA Runtime API vs. Driver API`.)
- CUDA is the abstraction's backing on Windows: the GPU extensions expose
  CUDA/Metal via a Premiere GPU framework (`PrSDKGPUDeviceSuite`, `PrGPUFilter`),
  and CUDA is the underlying Windows implementation behind that abstraction. The
  plugin does not call the OS display API directly; it goes through the PrSDKGPU
  layer, which on Windows is CUDA-backed.
- Note: NVIDIA-only on Windows is implied by CUDA (CUDA is NVIDIA). The docs do
  not separately state "NVIDIA" but CUDA == NVIDIA by definition. Confirmed:
  Windows path = CUDA (Driver API preferred).

### 3. macOS GPU path — Metal

- "As of Summer 2021, Premiere Pro no longer supports OpenCL. The GPU
  architecture of Premiere Pro is entirely CUDA/Metal, and this is what is
  exposed through the GPU extensions." On macOS there is no CUDA (NVIDIA), so the
  macOS path is **Metal**. Confirmed. (`CUDA, OpenCL, Metal, or OpenGL?`.)
- On the Mac, CUDA↔OpenGL interop "will go through system memory" — further
  evidence CUDA is not the Mac path. (`Getting Started > OpenGL Interoperability`.)

### 4. OpenCL and DirectX 12 — excluded by API or project choice?

- **OpenCL is excluded by Premiere's GPU architecture, not a project choice.**
  As of Summer 2021 Premiere "no longer supports OpenCL"; the architecture is
  "entirely CUDA/Metal." The GPU effect API exposes only CUDA/Metal. So excluding
  OpenCL in the spec is consistent with the platform, not an arbitrary project
  decision. Confirmed exclusion (by Adobe, not by us).
- **DirectX 12 is NOT a current GPU-effect API path.** The docs state Adobe is
  *"working on introducing support for DirectX 12 in our rendering pipeline"*
  and that it is *"still under development"* (as of April 2026 doc build). DX12
  is a planned host-rendering engine, not an effect-facing API surface today. So
  excluding DX12 from the effect's own GPU code is correct *now* — but this is a
  moving target: Adobe is adding it at the host/pipeline level, which could
  later change the abstraction the PrSDKGPU layer sits on. Treat DX12 exclusion
  as "currently not available to effects," not "permanently forbidden."
- The plugin never directly uses OpenCL/CUDA/Metal/DX12 primitives as a
  cross-platform choice; it uses the PrSDKGPU abstraction, and the *host* maps
  that to CUDA (Windows) or Metal (macOS). So "excluding OpenCL/DX12" is really
  "we do not implement those backends ourselves" — correct, because we can't; the
  host owns the backend.

### 5. Minimum correct CPU (software) render entry point — always exists

- The **software (CPU) render entry point is the standard After Effects plugin
  entry point** (the AE effect `EntryPoint` dispatching `PF_Cmd_RENDER` etc.),
  exactly as described in the AE SDK and the SDK Guide's Video Filters chapter.
  This is mandatory and always present — the GPU path is *supplementary* and only
  invoked when GPU acceleration is active. (`Getting Started > Entry Point`:
  "Otherwise, the normal entry point function will be called as described in the
  After Effects SDK.") 
- Therefore the CPU/software path is the **baseline and guaranteed fallback**:
  - It is required to exist (defines params, UI, software rendering).
  - If GPU is off, or the project renderer is software, or `CreateInstance`
    opts out / errors, the host uses the software entry point.
  - There is no scenario where only the GPU path exists. Confirmed: CPU fallback
    always exists by design.

---

## Assumptions

- The spec referenced ("CUDA Driver API on Windows NVIDIA", "Metal on macOS",
  exclusions of OpenCL/DX12, "CPU before GPU" rule) is the StateMotion design
  spec; this research validates it against Adobe docs, not against the spec text
  directly (spec not in scope of this ticket's provided materials).
- "PF_GPUDeviceSuite" in the ticket is the legacy/AE-era name for what is now the
  GPU Device Suite exposed via `PrSDKGPUDeviceSuite`. The ticket's naming is
  slightly stale; current SDK uses the `PrSDKGPU*` names.
- Docs build date (2026-04-10) is treated as current. DX12 status may change with
  future Adobe releases — flagged as follow-up.

## Contradictions / Caveats

- The GPU Device Suite doc text still mentions "see if the device supports
  OpenCL or CUDA," which is stale relative to the "OpenCL no longer supported"
  statement. The authoritative exclusion is the Summer-2021 CUDA/Metal-only
  statement. Treat the OpenCL mention as legacy doc residue.
- "CUDA/Metal" on the host does not mean the plugin chooses; the plugin codes
  against `PrSDKGPU` and the host translates. A naive reading of "CUDA Driver API
  on Windows" could imply the plugin calls CUDA directly — it does, but only
  through the PrSDKGPU abstraction's CUDA backend, and should prefer the Driver
  API per Adobe guidance.

## Recommendation

1. **"CPU before GPU" rule is correct and mandatory.** Always ship a working
   software (AE `PF_Cmd_RENDER`) path; the GPU `xGPUFilterEntry`/`PrGPUFilter`
   path is optional and supplementary. Never rely on GPU being available.
2. **API names:** use `PrSDKGPU*` / `PrGPUFilter*` (and `PrSDKGPUDeviceSuite`).
   Do not reference `PF_GPUDeviceSuite` as the current name in new code/spec.
3. **Windows:** implement the CUDA backend of the PrSDKGPU layer; prefer the
   **CUDA Driver API** (forward-compatible). CUDA == NVIDIA on Windows.
4. **macOS:** implement the **Metal** backend. No CUDA on Mac.
5. **Exclusions:** OpenCL exclusion is mandated by Adobe (Summer 2021) — keep it.
   DX12 exclusion is currently correct (not yet an effect-facing API) but is
   *host-side and evolving* — revisit when Adobe ships DX12 pipeline support;
   do not hard-code a permanent "forbidden" stance in architecture that would
   block adopting the host's future DX12 backend transparently via PrSDKGPU.
6. **Opt-in granularity:** decide GPU vs CPU in `CreateInstance` per-parameter;
   return error there to force software for a given param set. No mid-render
   fallback.

## Impact on Spec

- The spec's GPU claims (CUDA Driver API/Windows/NVIDIA, Metal/macOS) are
  **confirmed accurate** against Adobe docs.
- The spec's OpenCL exclusion is **confirmed** (Adobe-enforced, not optional).
- The spec's DX12 exclusion should be **softened/qualified**: currently true, but
  DX12 is an Adobe in-progress host pipeline; the project should rely on the
  PrSDKGPU abstraction so a future DX12 host backend is adopted without effect
  code changes. Avoid claiming DX12 is architecturally forbidden.
- "CPU before GPU" is **validated as the correct, required architecture**.
- Update spec terminology: replace `PF_GPUDeviceSuite` with
  `PrSDKGPUDeviceSuite` / `PrGPUFilter` family.

## Follow-ups

- Monitor Adobe DX12 pipeline release; re-verify effect-facing API impact.
- Confirm exact `PrSDKGPUDeviceSuite` function set from SDK headers when
  available (clean-room: only via Adobe-published SDK, not decompilation).
- Verify `PF_Cmd_RENDER` software path pixel-format parity requirements vs GPU
  path (same input/output format rule) — minor, for implementation ticket.
