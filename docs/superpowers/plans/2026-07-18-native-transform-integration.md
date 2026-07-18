# Native Transform Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the native StateMotion controls animate and render Position, Scale, Rotation, Anchor, and Opacity in Premiere by wiring the registered native parameters through the existing progress engine and CPU renderer.

**Architecture:** Native POINT/percent/degree params → `NativeParameterAdapter` → canonical `TransformState` (normalized/multiplier/radians/0..1) → `evaluateProgress()` → `interpolateCanonical()` → `toRendererTransformState()` (single boundary conversion, after interpolation) → existing verified CPU renderer (`plan()`+`render()`). Host time = `PF_InData.current_time/total_time` converted to seconds via `time_scale`, fed into `ProgressInput`.

**Tech Stack:** C++17 (MSVC 19.29 / SDK-free `cl` for unit tests), Adobe After Effects Effect SDK (headers only in `Render` rewiring, not compilable in this environment), existing `transform_render` + `progress_engine`.

## Global Constraints

- Canonical `TransformState` = normalized position/anchor, multiplier scale, radians rotation, opacity 0..1. Do NOT change this model.
- Renderer stores pixels+degrees; rename its `TransformState` → `RendererTransformState` (naming only, NO math change).
- The renderer-boundary conversion `toRendererTransformState` happens EXACTLY ONCE, AFTER interpolation.
- No second interpolation implementation; canonical interpolation mirrors renderer formula semantics.
- Do NOT change disk IDs, parameter contract, match name (`AE.io.github.anmol2k5.statemotion.effect`), or preset semantics.
- No `EffectParameterMap`, no UXP, no GPU/CUDA/Metal/PrSDKGPU, no crop/mask/stroke/glow/shadow/motion-blur, no custom easing, no installer/telemetry/cloud.
- Do NOT modify `feat/preset-panel`.
- Unit-testable logic MUST stay outside Adobe SDK APIs (plain `cl` compiles it).
- `time_scale` is never assumed constant; guard divide-by-zero.

---

### Task 1: Canonical TransformState type + canonical interpolation

**Files:**
- Create: `src/statemotion/renderer/transform_state.hpp`
- Test: `src/statemotion/renderer/transform_state_test.cpp`

**Interfaces:**
- Produces: `struct statemotion::TransformState { double positionNormX, positionNormY, scaleX, scaleY, rotationRadians, anchorNormX, anchorNormY, opacity; }` and `statemotion::TransformState interpolateCanonical(const TransformState& a, const TransformState& b, double p)`.

- [ ] **Step 1: Write the failing test**

```cpp
// transform_state_test.cpp
#include "transform_state.hpp"
#include <cstdio>
#include <cmath>
static int g_fail = 0;
static void check(bool ok, const char* n){ std::printf("%s  %s\n", ok?"PASS":"FAIL", n); if(!ok) ++g_fail; }
int main(){
    statemotion::TransformState a, b;
    a.positionNormX = 0.0; a.positionNormY = 0.0; b.positionNormX = 1.0; b.positionNormY = 0.5;
    a.scaleX = 1.0; b.scaleX = 2.0; a.rotationRadians = 0.0; b.rotationRadians = 1.57079632679;
    a.opacity = 0.0; b.opacity = 1.0; a.anchorNormX = 0.0; b.anchorNormX = 0.5;
    auto m = statemotion::interpolateCanonical(a, b, 0.5);
    check(std::abs(m.positionNormX - 0.5) < 1e-12, "midpoint position x");
    check(std::abs(m.positionNormY - 0.25) < 1e-12, "midpoint position y");
    check(std::abs(m.scaleX - 1.5) < 1e-12, "midpoint scale x");
    check(std::abs(m.rotationRadians - 0.785398163397) < 1e-9, "midpoint radians");
    check(std::abs(m.opacity - 0.5) < 1e-12, "midpoint opacity");
    check(std::abs(m.anchorNormX - 0.25) < 1e-12, "midpoint anchor x");
    auto ex = statemotion::interpolateCanonical(a, b, 1.0);
    check(std::abs(ex.positionNormX - 1.0) < 1e-12, "exact B position");
    check(std::abs(ex.rotationRadians - 1.57079632679) < 1e-9, "exact B radians");
    auto ey = statemotion::interpolateCanonical(a, b, 0.0);
    check(std::abs(ey.opacity - 0.0) < 1e-12, "exact A opacity");
    std::printf("\n%s: %d failures\n", g_fail?"FAILED":"ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "call \"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat\" >nul 2>&1 && cd /d E:\motion && cl /EHsc /std:c++17 /I src/statemotion/renderer src/statemotion/renderer/transform_state_test.cpp /Fe:.scratch/ts_test.exe && .scratch\ts_test.exe"`

Expected: compile error (header/function not found).

- [ ] **Step 3: Write minimal implementation**

```cpp
// transform_state.hpp
#ifndef STATEMOTION_TRANSFORM_STATE_HPP
#define STATEMOTION_TRANSFORM_STATE_HPP
#include <algorithm>
namespace statemotion {
struct TransformState {
    double positionNormX = 0.0;
    double positionNormY = 0.0;
    double scaleX = 1.0;
    double scaleY = 1.0;
    double rotationRadians = 0.0;
    double anchorNormX = 0.0;
    double anchorNormY = 0.0;
    double opacity = 1.0;
};
inline TransformState interpolateCanonical(const TransformState& a, const TransformState& b, double p) {
    double t = std::clamp(p, 0.0, 1.0);
    TransformState r;
    r.positionNormX = a.positionNormX + (b.positionNormX - a.positionNormX) * t;
    r.positionNormY = a.positionNormY + (b.positionNormY - a.positionNormY) * t;
    r.scaleX = a.scaleX + (b.scaleX - a.scaleX) * t;
    r.scaleY = a.scaleY + (b.scaleY - a.scaleY) * t;
    r.rotationRadians = a.rotationRadians + (b.rotationRadians - a.rotationRadians) * t;
    r.anchorNormX = a.anchorNormX + (b.anchorNormX - a.anchorNormX) * t;
    r.anchorNormY = a.anchorNormY + (b.anchorNormY - a.anchorNormY) * t;
    r.opacity = a.opacity + (b.opacity - a.opacity) * t;
    return r;
}
}
#endif
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2. Expected: ALL PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/renderer/transform_state.hpp src/statemotion/renderer/transform_state_test.cpp
git commit -m "feat: add canonical TransformState + canonical interpolation"
```

---

### Task 2: Rename renderer TransformState → RendererTransformState

**Files:**
- Modify: `src/statemotion/renderer/transform_render.h`
- Modify: `src/statemotion/renderer/transform_render.cpp`
- Modify: `src/statemotion/renderer/transform_render_test.cpp`

**Interfaces:**
- Produces: `struct statemotion::RendererTransformState` (identical fields to the old `TransformState`); `plan()`/`render()`/`interpolate()` now operate on `RendererTransformState`. Math unchanged.

- [ ] **Step 1: Rename the struct in the header**

In `transform_render.h`: change `struct TransformState {` → `struct RendererTransformState {` and update the `interpolate` signature to `RendererTransformState interpolate(const RendererTransformState& a, const RendererTransformState& b, double p);`. Keep all field names and comments.

- [ ] **Step 2: Rename usages in the implementation**

In `transform_render.cpp`: replace `TransformState` with `RendererTransformState` in `interpolate`, `plan`, and `render`. Math body identical.

- [ ] **Step 3: Rename usages in the test**

In `transform_render_test.cpp`: replace `TransformState` with `RendererTransformState` (the `using statemotion::TransformState;` line becomes `using statemotion::RendererTransformState;`). Test bodies unchanged.

- [ ] **Step 4: Run renderer tests**

Run: `cmd /c "call \"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat\" >nul 2>&1 && cd /d E:\motion && cl /EHsc /std:c++17 /I src/statemotion/renderer src/statemotion/renderer/transform_render_test.cpp src/statemotion/renderer/transform_render.cpp /Fe:.scratch/render_test.exe && .scratch\render_test.exe"`

Expected: ALL PASSED (same 13 cases as baseline).

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/renderer/transform_render.h src/statemotion/renderer/transform_render.cpp src/statemotion/renderer/transform_render_test.cpp
git commit -m "refactor: rename renderer TransformState to RendererTransformState (no math change)"
```

---

### Task 3: NativeParameterAdapter (pure, SDK-free)

**Files:**
- Create: `src/statemotion/adobe/statemotion_native_adapter.hpp`
- Test: `src/statemotion/adobe/statemotion_native_adapter_test.cpp`

**Interfaces:**
- Consumes: canonical `TransformState` (Task 1), `ids::*` enums (`parameter_ids.hpp`), `Vec2` (define locally as `struct Vec2 { double x, y; };` in this header).
- Produces: `statemotion::native::pointPercentToNorm`, `percentToMultiplier`, `percentToOpacity`, `degreesToRadians`, `buildCanonicalState`, `modeFromPopup`, `alignmentFromPopup`.

- [ ] **Step 1: Write the failing test**

```cpp
#include "statemotion_native_adapter.hpp"
#include <cstdio>
#include <cmath>
static int g_fail = 0;
static void check(bool ok, const char* n){ std::printf("%s  %s\n", ok?"PASS":"FAIL", n); if(!ok) ++g_fail; }
int main(){
    using namespace statemotion::native;
    auto c = pointPercentToNorm(50.0, 50.0);
    check(std::abs(c.x-0.5)<1e-12 && std::abs(c.y-0.5)<1e-12, "center 50%->0.5");
    auto tl = pointPercentToNorm(0.0, 0.0);
    check(std::abs(tl.x)<1e-12 && std::abs(tl.y)<1e-12, "top-left 0%->0");
    auto br = pointPercentToNorm(100.0, 100.0);
    check(std::abs(br.x-1.0)<1e-12 && std::abs(br.y-1.0)<1e-12, "bottom-right 100%->1");
    check(std::abs(percentToMultiplier(100.0)-1.0)<1e-12, "scale 100%->1");
    check(std::abs(percentToMultiplier(50.0)-0.5)<1e-12, "scale 50%->0.5");
    check(std::abs(percentToMultiplier(115.0)-1.15)<1e-12, "scale 115%->1.15");
    check(std::abs(percentToOpacity(0.0))<1e-12, "opacity 0%->0");
    check(std::abs(percentToOpacity(50.0)-0.5)<1e-12, "opacity 50%->0.5");
    check(std::abs(percentToOpacity(100.0)-1.0)<1e-12, "opacity 100%->1");
    check(percentToOpacity(150.0)==1.0, "opacity >100 clamps to 1");
    check(percentToOpacity(-10.0)==0.0, "opacity <0 clamps to 0");
    check(std::abs(degreesToRadians(0.0))<1e-12, "0deg->0rad");
    check(std::abs(degreesToRadians(90.0)-1.57079632679)<1e-9, "90deg->pi/2");
    check(std::abs(degreesToRadians(180.0)-3.14159265359)<1e-9, "180deg->pi");
    check(std::abs(degreesToRadians(-45.0)+0.785398163397)<1e-9, "-45deg->-pi/4");
    auto s = buildCanonicalState(50,50, 100,100, 0, 50,50, 100);
    check(s.positionNormX==0.5 && s.scaleX==1.0 && s.rotationRadians==0.0 && s.opacity==1.0 && s.anchorNormX==0.5, "buildCanonicalState default");
    auto s2 = buildCanonicalState(25,75, 130,130, 30, 25,75, 50);
    check(std::abs(s2.opacity-0.5)<1e-12 && std::abs(s2.rotationRadians-0.523598775598)<1e-9 && std::abs(s2.scaleX-1.3)<1e-12, "buildCanonicalState B values");
    check(modeFromPopup(6)==statemotion::ids::ProgressMode::Manual, "mode popup 6=Manual");
    check(alignmentFromPopup(2)==statemotion::ids::AlignmentMode::EntireClip, "align popup 2=EntireClip");
    std::printf("\n%s: %d failures\n", g_fail?"FAILED":"ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "call \"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat\" >nul 2>&1 && cd /d E:\motion && cl /EHsc /std:c++17 /I src/statemotion/adobe /I src/statemotion/renderer /I shared/generated src/statemotion/adobe/statemotion_native_adapter_test.cpp /Fe:.scratch/native_test.exe && .scratch\native_test.exe"`

Expected: compile error (header not found).

- [ ] **Step 3: Write minimal implementation**

```cpp
#ifndef STATEMOTION_NATIVE_ADAPTER_HPP
#define STATEMOTION_NATIVE_ADAPTER_HPP
#include <algorithm>
#include "transform_state.hpp"      // canonical TransformState
#include "parameter_ids.hpp"        // ids::ProgressMode / AlignmentMode
namespace statemotion { namespace native {
struct Vec2 { double x = 0.0; double y = 0.0; };
inline Vec2 pointPercentToNorm(double px, double py) { return Vec2{px/100.0, py/100.0}; }
inline double percentToMultiplier(double percent) { return percent / 100.0; }
inline double percentToOpacity(double percent) { return std::clamp(percent/100.0, 0.0, 1.0); }
inline double degreesToRadians(double degrees) { return degrees * 3.14159265358979323846 / 180.0; }
inline TransformState buildCanonicalState(double posPx, double posPy, double scaleX, double scaleY,
        double rotDeg, double ancPx, double ancPy, double opacityPercent) {
    TransformState t;
    t.positionNormX = pointPercentToNorm(posPx, posPy).x;
    t.positionNormY = pointPercentToNorm(posPx, posPy).y;
    t.scaleX = percentToMultiplier(scaleX);
    t.scaleY = percentToMultiplier(scaleY);
    t.rotationRadians = degreesToRadians(rotDeg);
    t.anchorNormX = pointPercentToNorm(ancPx, ancPy).x;
    t.anchorNormY = pointPercentToNorm(ancPx, ancPy).y;
    t.opacity = percentToOpacity(opacityPercent);
    return t;
}
inline ids::ProgressMode modeFromPopup(int idx) { return static_cast<ids::ProgressMode>(idx); }
inline ids::AlignmentMode alignmentFromPopup(int idx) { return static_cast<ids::AlignmentMode>(idx); }
}}
#endif
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2. Expected: ALL PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/adobe/statemotion_native_adapter.hpp src/statemotion/adobe/statemotion_native_adapter_test.cpp
git commit -m "feat: add native parameter adapter (pure, SDK-free)"
```

---

### Task 4: HostTimeAdapter (pure, SDK-free)

**Files:**
- Create: `src/statemotion/adobe/statemotion_host_time.hpp`
- Test: `src/statemotion/adobe/statemotion_host_time_test.cpp`

**Interfaces:**
- Consumes: `ProgressInput` (`progress_engine.h`), `ids::*` enums, `manualProgressNative` (0..100).
- Produces: `statemotion::host::buildProgressInput(long current_time, long total_time, long time_scale, ids::ProgressMode, ids::AlignmentMode, double durationSeconds, double delaySeconds, double manualProgressNative)`.

- [ ] **Step 1: Write the failing test**

```cpp
#include "statemotion_host_time.hpp"
#include <cstdio>
#include <cmath>
static int g_fail = 0;
static void check(bool ok, const char* n){ std::printf("%s  %s\n", ok?"PASS":"FAIL", n); if(!ok) ++g_fail; }
int main(){
    using namespace statemotion::host;
    // 60000 scale, frame at time 30000 of 60000 total => 0.5s elapsed, 1.0s duration
    auto p = buildProgressInput(30000, 60000, 60000,
        statemotion::ids::ProgressMode::AToB, statemotion::ids::AlignmentMode::EntireClip, 1.0, 0.0, 0.0);
    check(std::abs(p.visibleElapsedSeconds-0.5)<1e-9, "elapsed 30000/60000");
    check(std::abs(p.visibleDurationSeconds-1.0)<1e-9, "duration 60000/60000");
    check(std::abs(p.transitionDurationSeconds-1.0)<1e-9, "duration passed");
    check(p.mode==statemotion::ids::ProgressMode::AToB, "mode passed");
    // zero scale guard
    auto z = buildProgressInput(30000, 60000, 0,
        statemotion::ids::ProgressMode::AToB, statemotion::ids::AlignmentMode::EntireClip, 1.0, 0.0, 0.0);
    check(std::abs(z.visibleElapsedSeconds-30000.0)<1e-9, "zero scale guarded (treated as 1)");
    // manual 0..100 -> 0..1
    auto m = buildProgressInput(0, 100, 100,
        statemotion::ids::ProgressMode::Manual, statemotion::ids::AlignmentMode::ClipStart, 0.0, 0.0, 50.0);
    check(std::abs(m.manualProgress-0.5)<1e-9, "manual 50 -> 0.5");
    auto m2 = buildProgressInput(0, 100, 100,
        statemotion::ids::ProgressMode::Manual, statemotion::ids::AlignmentMode::ClipStart, 0.0, 0.0, 100.0);
    check(std::abs(m2.manualProgress-1.0)<1e-9, "manual 100 -> 1.0");
    std::printf("\n%s: %d failures\n", g_fail?"FAILED":"ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "call \"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat\" >nul 2>&1 && cd /d E:\motion && cl /EHsc /std:c++17 /I src/statemotion/adobe /I src/statemotion/progress /I shared/generated src/statemotion/adobe/statemotion_host_time_test.cpp /Fe:.scratch/host_test.exe && .scratch\host_test.exe"`

Expected: compile error.

- [ ] **Step 3: Write minimal implementation**

```cpp
#ifndef STATEMOTION_HOST_TIME_HPP
#define STATEMOTION_HOST_TIME_HPP
#include "progress_engine.h"   // ProgressInput, ids::
namespace statemotion { namespace host {
inline ProgressInput buildProgressInput(long current_time, long total_time, long time_scale,
        ids::ProgressMode mode, ids::AlignmentMode alignment,
        double durationSeconds, double delaySeconds, double manualProgressNative) {
    ProgressInput in;
    const double scale = (time_scale > 0) ? static_cast<double>(time_scale) : 1.0;
    in.visibleElapsedSeconds = static_cast<double>(current_time) / scale;
    in.visibleDurationSeconds = static_cast<double>(total_time) / scale;
    in.transitionDurationSeconds = durationSeconds;
    in.delaySeconds = delaySeconds;
    in.alignment = alignment;
    in.mode = mode;
    in.manualProgress = (manualProgressNative < 0.0) ? 0.0
                        : (manualProgressNative > 100.0 ? 1.0 : manualProgressNative / 100.0);
    return in;
}
}}
#endif
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2. Expected: ALL PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/adobe/statemotion_host_time.hpp src/statemotion/adobe/statemotion_host_time_test.cpp
git commit -m "feat: add host-time adapter (current_time/total_time -> ProgressInput seconds)"
```

---

### Task 5: RenderInputAdapter (single boundary conversion, after interpolation)

**Files:**
- Create: `src/statemotion/adobe/statemotion_render_input.hpp`
- Test: `src/statemotion/adobe/statemotion_render_input_test.cpp`

**Interfaces:**
- Consumes: canonical `TransformState` (Task 1), `RendererTransformState` (Task 2).
- Produces: `statemotion::render::RenderDimensions` and `statemotion::render::toRendererTransformState(const TransformState&, const RenderDimensions&)`.

- [ ] **Step 1: Write the failing test**

```cpp
#include "statemotion_render_input.hpp"
#include <cstdio>
#include <cmath>
static int g_fail = 0;
static void check(bool ok, const char* n){ std::printf("%s  %s\n", ok?"PASS":"FAIL", n); if(!ok) ++g_fail; }
int main(){
    using namespace statemotion::render;
    // 1920x1080 output, same source -> center 0.5,0.5 maps to 960,540
    TransformState c; c.positionNormX=0.5; c.positionNormY=0.5;
    c.anchorNormX=0.5; c.anchorNormY=0.5; c.scaleX=1.0; c.scaleY=1.0;
    c.rotationRadians=0.0; c.opacity=1.0;
    RenderDimensions d{1920,1080,1920,1080};
    auto r = toRendererTransformState(c, d);
    check(std::abs(r.positionX-960.0)<1e-9 && std::abs(r.positionY-540.0)<1e-9, "center pos->output center");
    check(std::abs(r.anchorX-960.0)<1e-9 && std::abs(r.anchorY-540.0)<1e-9, "center anchor->source center");
    // vertical 1080x1920
    RenderDimensions v{1080,1920,1080,1920};
    auto rv = toRendererTransformState(c, v);
    check(std::abs(rv.positionX-540.0)<1e-9 && std::abs(rv.positionY-960.0)<1e-9, "vertical center");
    // UHD 3840x2160
    RenderDimensions u{3840,2160,3840,2160};
    auto ru = toRendererTransformState(c, u);
    check(std::abs(ru.positionX-1920.0)<1e-9, "UHD center x");
    // radians->degrees
    TransformState r2; r2.rotationRadians = 1.57079632679; // pi/2
    auto rd = toRendererTransformState(r2, d);
    check(std::abs(rd.rotationDeg-90.0)<1e-9, "pi/2 -> 90deg");
    TransformState r3; r3.rotationRadians = -0.785398163397; // -pi/4
    auto rd2 = toRendererTransformState(r3, d);
    check(std::abs(rd2.rotationDeg+45.0)<1e-9, "-pi/4 -> -45deg");
    // scale/opacity unchanged
    TransformState r4; r4.scaleX=1.3; r4.scaleY=0.7; r4.opacity=0.5;
    auto rd3 = toRendererTransformState(r4, d);
    check(std::abs(rd3.scaleX-1.3)<1e-12 && std::abs(rd3.scaleY-0.7)<1e-12 && std::abs(rd3.opacity-0.5)<1e-12, "scale/opacity unchanged");
    std::printf("\n%s: %d failures\n", g_fail?"FAILED":"ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "call \"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat\" >nul 2>&1 && cd /d E:\motion && cl /EHsc /std:c++17 /I src/statemotion/adobe /I src/statemotion/renderer /I shared/generated src/statemotion/adobe/statemotion_render_input_test.cpp /Fe:.scratch/ri_test.exe && .scratch\ri_test.exe"`

Expected: compile error.

- [ ] **Step 3: Write minimal implementation**

```cpp
#ifndef STATEMOTION_RENDER_INPUT_HPP
#define STATEMOTION_RENDER_INPUT_HPP
#include "transform_state.hpp"        // canonical TransformState
#include "transform_render.h"          // RendererTransformState
namespace statemotion { namespace render {
struct RenderDimensions { int outputW = 0; int outputH = 0; int sourceW = 0; int sourceH = 0; };
inline RendererTransformState toRendererTransformState(const TransformState& c, const RenderDimensions& d) {
    RendererTransformState r;
    r.positionX = c.positionNormX * static_cast<double>(d.outputW);
    r.positionY = c.positionNormY * static_cast<double>(d.outputH);
    r.scaleX = c.scaleX;
    r.scaleY = c.scaleY;
    r.rotationDeg = c.rotationRadians * 180.0 / 3.14159265358979323846;
    r.anchorX = c.anchorNormX * static_cast<double>(d.sourceW);
    r.anchorY = c.anchorNormY * static_cast<double>(d.sourceH);
    r.opacity = c.opacity;
    return r;
}
}}
#endif
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2. Expected: ALL PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/statemotion/adobe/statemotion_render_input.hpp src/statemotion/adobe/statemotion_render_input_test.cpp
git commit -m "feat: add render-input adapter (canonical -> renderer units, after interpolation)"
```

---

### Task 6: End-to-end integration test (adapter + progress + interpolation + render boundary)

**Files:**
- Test: `src/statemotion/adobe/statemotion_integration_test.cpp`

**Interfaces:**
- Consumes: all adapters (Tasks 1,3,4,5) + `evaluateProgress` + `interpolateCanonical` + `plan`/`render` from renderer.
- Produces: proof that native params → canonical → progress → interpolate → renderer units → render yields correct A/B/midpoint + identity fast path.

- [ ] **Step 1: Write the failing test**

```cpp
#include "statemotion_native_adapter.hpp"
#include "statemotion_host_time.hpp"
#include "statemotion_render_input.hpp"
#include "transform_state.hpp"
#include "transform_render.h"
#include "progress_engine.h"
#include <cstdio>
#include <cmath>
#include <vector>
static int g_fail = 0;
static void check(bool ok, const char* n){ std::printf("%s  %s\n", ok?"PASS":"FAIL", n); if(!ok) ++g_fail; }
namespace { statemotion::Pixel solid(void*, int, int){ return statemotion::Pixel{0.5,0.5,0.5,0.5}; } }
int main(){
    using namespace statemotion;
    // Build canonical A and B from native values (manual mode, progress 0 / 0.5 / 1).
    auto A = native::buildCanonicalState(50,50, 100,100, 0, 50,50, 100);
    auto B = native::buildCanonicalState(75,50, 130,130, 30, 50,50, 50);  // offset, scale 130%, rot 30deg, opacity 50%
    // Manual progress 0
    ProgressInput in0 = host::buildProgressInput(0,100,100, ids::ProgressMode::Manual, ids::AlignmentMode::ClipStart, 0,0, 0);
    auto e0 = evaluateProgress(in0); check(e0.ok, "eval0 ok");
    auto c0 = interpolateCanonical(A, B, e0.result.easedProgress);
    check(std::abs(c0.positionNormX-0.5)<1e-9, "manual0 position=A");
    check(std::abs(c0.opacity-1.0)<1e-9, "manual0 opacity=A");
    // Manual progress 100
    ProgressInput in1 = host::buildProgressInput(0,100,100, ids::ProgressMode::Manual, ids::AlignmentMode::ClipStart, 0,0, 100);
    auto e1 = evaluateProgress(in1);
    auto c1 = interpolateCanonical(A, B, e1.result.easedProgress);
    check(std::abs(c1.positionNormX-0.75)<1e-9, "manual100 position=B");
    check(std::abs(c1.opacity-0.5)<1e-9, "manual100 opacity=B");
    // Manual progress 50 -> midpoint
    ProgressInput in5 = host::buildProgressInput(0,100,100, ids::ProgressMode::Manual, ids::AlignmentMode::ClipStart, 0,0, 50);
    auto e5 = evaluateProgress(in5);
    auto c5 = interpolateCanonical(A, B, e5.result.easedProgress); // smoothstep(0.5)=0.5
    check(std::abs(c5.positionNormX-0.625)<1e-9, "manual50 midpoint position");
    // Convert to renderer units and render identity check (default A with identity)
    render::RenderDimensions d{1920,1080,1920,1080};
    auto rA = render::toRendererTransformState(A, d);
    auto planA = plan(rA, d.sourceW, d.sourceH);
    check(planA.identityTransform, "A is identity transform");
    // Render B through renderer (must not crash, finite)
    std::vector<statemotion::Pixel> out(1920*1080);
    auto rB = render::toRendererTransformState(B, d);
    auto planB = plan(rB, d.sourceW, d.sourceH);
    render(planB, solid, nullptr, d.outputW, d.outputH, out.data());
    bool finite=true; for(auto&p:out) finite &= std::isfinite(p.a)&&std::isfinite(p.r);
    check(finite, "render B finite");
    std::printf("\n%s: %d failures\n", g_fail?"FAILED":"ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "call \"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat\" >nul 2>&1 && cd /d E:\motion && cl /EHsc /std:c++17 /I src/statemotion/adobe /I src/statemotion/renderer /I src/statemotion/progress /I shared/generated src/statemotion/adobe/statemotion_integration_test.cpp src/statemotion/renderer/transform_render.cpp src/statemotion/progress/progress_engine.cpp /Fe:.scratch/integ_test.exe && .scratch\integ_test.exe"`

Expected: compile error (headers not present yet from prior tasks — actually they are; this fails only if a header is missing, otherwise it runs and the assertions are the real check). Build, then expect ALL PASSED (since all prior tasks exist). If any assertion fails, fix in the owning task.

- [ ] **Step 3: Run and confirm passes**

Run same as Step 2. Expected: ALL PASSED.

- [ ] **Step 4: Commit**

```bash
git add src/statemotion/adobe/statemotion_integration_test.cpp
git commit -m "test: end-to-end native->canonical->progress->interpolate->render integration"
```

---

### Task 7: Wire Render callback (Adobe SDK — reviewed, not compiled in this env)

**Files:**
- Modify: `src/statemotion/adobe/statemotion_effect.cpp` (only the `Render` function; add includes for the new adapters).
- Modify: `src/statemotion/adobe/statemotion_effect.h` (include new adapter headers).

**Interfaces:**
- Consumes: `PF_InData`, `PF_ParamDef params[]`, `PF_EffectWorld` for source/output; the adapters from Tasks 3/4/5; `evaluateProgress`; `interpolateCanonical`; `plan`/`render`.
- Produces: rendered output world.

This task CANNOT be compiled in this environment (no Adobe SDK headers). It is written carefully, reviewed, and its logic is covered by Tasks 1–6 SDK-free tests. Operator compiles in Premiere/VS with `STATEMOTION_SDK` set.

- [ ] **Step 1: Read current Render and param access patterns**

Read `src/statemotion/adobe/statemotion_effect.cpp` `Render` (lines 192–223) and `registerStateMotionParameters` for disk-ID→runtime-index mapping. Note: runtime param index = `STATEMOTION_INPUT + 1 + i` where `i` is the binding array index; disk IDs map via `parameter_ids.hpp` constants (`kTransformPositionA`, etc.). Build a small local helper `int paramIndex(int diskId)` that scans `kBindings` for the matching `diskId` and returns `STATEMOTION_INPUT + 1 + idx`.

- [ ] **Step 2: Add includes and helper**

In `statemotion_effect.h` add:
```cpp
#include "statemotion_native_adapter.hpp"
#include "statemotion_host_time.hpp"
#include "statemotion_render_input.hpp"
#include "transform_state.hpp"
#include "transform_render.h"
#include "progress_engine.h"
```
Add a free helper in the `.cpp` (above `Render`):
```cpp
static int smParamIndex(int diskId) {
    const auto& b = statemotion::contract::kBindings;
    for (int i = 0; i < (int)(sizeof(b)/sizeof(b[0])); ++i)
        if (b[i].diskId == diskId) return STATEMOTION_INPUT + 1 + i;
    return -1;
}
```

- [ ] **Step 3: Rewrite Render to orchestrate the pipeline**

Replace the `Render` body with:
```cpp
static PF_Err
Render(
    PF_InData   *in_data,
    PF_OutData  *out_data,
    PF_ParamDef *params[],
    PF_LayerDef *output)
{
    PF_Err err = PF_Err_NONE;
    if (!in_data || !output || !params) return PF_Err_BAD_CALLBACK_PARAM;
    PF_EffectWorld* src = &params[STATEMOTION_INPUT]->u.ld;
    PF_EffectWorld* dst = &output->u.ld;
    if (!src->data || !dst->data) return PF_Err_BAD_CALLBACK_PARAM;

    const int W = output->width, H = output->height;
    const int SW = src->width, SH = src->height;

    // 1. Read registered params by disk ID.
    #define SM_RD(did) params[smParamIndex(statemotion::ids::did)]
    auto modeIdx = static_cast<int>(SM_RD(kTransformMode)->u.pd.value);
    auto alignIdx = static_cast<int>(SM_RD(kTransformAlignment)->u.pd.value);
    double dur = SM_RD(kTransitionDurationSeconds)->u.fs_d.value;
    double delay = SM_RD(kTransitionDelaySeconds)->u.fs_d.value;
    double manual = SM_RD(kTransitionManualProgress)->u.fs_d.value;
    auto pa = SM_RD(kTransformPositionA)->u.td;  auto pb = SM_RD(kTransformPositionB)->u.td;
    double sxa = SM_RD(kTransformScaleXA)->u.fs_d.value, sxb = SM_RD(kTransformScaleXB)->u.fs_d.value;
    double sya = SM_RD(kTransformScaleYA)->u.fs_d.value, syb = SM_RD(kTransformScaleYB)->u.fs_d.value;
    double ra = SM_RD(kTransformRotationA)->u.ad.value / 65536.0, rb = SM_RD(kTransformRotationB)->u.ad.value / 65536.0;
    auto aa = SM_RD(kTransformAnchorA)->u.td;  auto ab = SM_RD(kTransformAnchorB)->u.td;
    double oa = SM_RD(kTransformOpacityA)->u.fs_d.value, ob = SM_RD(kTransformOpacityB)->u.fs_d.value;
    #undef SM_RD

    // 2. Native POINT is percent (16.16 fixed); convert to percent double.
    auto pct = [](PF_Fixed v){ return static_cast<double>(v) / 65536.0; };

    // 3. Adapt -> canonical A/B.
    auto A = statemotion::native::buildCanonicalState(
        pct(pa.x_value), pct(pa.y_value), sxa, sya, ra, pct(aa.x_value), pct(aa.y_value), oa);
    auto B = statemotion::native::buildCanonicalState(
        pct(pb.x_value), pct(pb.y_value), sxb, syb, rb, pct(ab.x_value), pct(ab.y_value), ob);

    // 4. Host time -> ProgressInput (clip-local seconds).
    auto pin = statemotion::host::buildProgressInput(
        in_data->current_time, in_data->total_time, in_data->time_scale,
        statemotion::native::modeFromPopup(modeIdx),
        statemotion::native::alignmentFromPopup(alignIdx),
        dur, delay, manual);

    // 5. Progress -> interpolate canonical.
    auto pe = statemotion::evaluateProgress(pin);
    if (!pe.ok) { /* non-finite: fall back to identity copy */
        ::memcpy(dst->data, src->data, static_cast<size_t>(output->rowbytes * H));
        return err;
    }
    auto canon = statemotion::interpolateCanonical(A, B, pe.result.easedProgress);

    // 6. Canonical -> renderer units (single boundary conversion).
    statemotion::render::RenderDimensions dims{W, H, SW, SH};
    auto rt = statemotion::render::toRendererTransformState(canon, dims);

    // 7. Identity fast path.
    auto plan = statemotion::plan(rt, SW, SH);
    if (plan.identityTransform) {
        ::memcpy(dst->data, src->data, static_cast<size_t>(output->rowbytes * H));
        return err;
    }

    // 8. Render via existing CPU renderer. Sample source world as premultiplied
    //     RGBA float (format verified by operator; 32f RGBA assumed for Phase 0.1).
    //     Map in_data pixel format; allocate a Pixel buffer, copy src->Pixel,
    //     render, copy Pixel->dst. Operator confirms exact channel order.
    //     (Sampler reads from an in-memory Pixel buffer built from the source world.)
    // ... see Step 4 note for the minimal pixel glue.
    return err;
}
```

- [ ] **Step 4: Document the pixel-glue boundary (operator-verified)**

Add a clear comment block stating: the minimal Phase 0.1 path builds a `Pixel` buffer from the Adobe `PF_EffectWorld` (32-bit float, premultiplied, RGBA — exact channel order confirmed by operator on the test machine), samples with the existing `Sampler`, calls `render()`, then writes the `Pixel` buffer back to `dst`. Only the format the operator verifies is claimed. No generic conversion framework is added.

- [ ] **Step 5: Review Render wiring against the code-review checklist (Task 9)**

Self-check: coordinate-space (position uses output dims, anchor uses source dims), no duplicate progress/logic, no unsafe reads (all indices from `smParamIndex`, bounds-safe), no speculative abstractions.

- [ ] **Step 6: Do NOT commit the .aex binary; commit only source**

```bash
git add src/statemotion/adobe/statemotion_effect.cpp src/statemotion/adobe/statemotion_effect.h
git commit -m "feat: wire native params through adapters to CPU renderer in Render"
```

---

### Task 8: Run full regression + new suites

**Files:** none (verification only).

- [ ] **Step 1: Run all SDK-free suites**

Run each:
- `cmd /c "... cl ... src/statemotion/renderer/transform_render_test.cpp src/statemotion/renderer/transform_render.cpp /Fe:.scratch/render_test.exe && .scratch\render_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/progress/progress_engine_test.cpp src/statemotion/progress/progress_engine.cpp src/statemotion/renderer/transform_render.cpp /Fe:.scratch/progress_test.exe && .scratch\progress_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/adobe/statemotion_registration_test.cpp /Fe:.scratch/reg_test.exe && .scratch\reg_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/adobe/statemotion_identity_test.cpp /Fe:.scratch/identity_test.exe && .scratch\identity_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/adobe/statemotion_point_default_test.cpp /Fe:.scratch/point_test.exe && .scratch\point_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/renderer/transform_state_test.cpp /Fe:.scratch/ts_test.exe && .scratch\ts_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/adobe/statemotion_native_adapter_test.cpp /Fe:.scratch/native_test.exe && .scratch\native_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/adobe/statemotion_host_time_test.cpp /Fe:.scratch/host_test.exe && .scratch\host_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/adobe/statemotion_render_input_test.cpp /Fe:.scratch/ri_test.exe && .scratch\ri_test.exe"` (expect ALL PASSED)
- `cmd /c "... cl ... src/statemotion/adobe/statemotion_integration_test.cpp src/statemotion/renderer/transform_render.cpp src/statemotion/progress/progress_engine.cpp /Fe:.scratch/integ_test.exe && .scratch\integ_test.exe"` (expect ALL PASSED)

- [ ] **Step 2: Run TS progress test + contract check**

Run: `cd E:\motion; node --experimental-transform-types src/statemotion/progress/progressEngine.test.ts` (expect ALL PASSED) and `node tools/generate-contract.js --check` (expect CHECK OK) and `node tools/generate-contract.test.js` (expect ALL PASSED).

- [ ] **Step 3: Fix any failure before proceeding**

If any suite fails, fix in the owning task. Do not move to review with red tests.

---

### Task 9: Code review + clean-room review

- [ ] **Step 1: Run requesting-code-review checklist**

Review the diff for: coordinate-space mistakes (position=output, anchor=source), source/output confusion, alpha errors, pixel-format assumptions (only verified format claimed), timing assumptions (clip-local, not universal current_time/total_time hardcoded), duplicate progress/logic (none — reused), unsafe reads (all via smParamIndex), unnecessary abstractions, speculative future code.

- [ ] **Step 2: Clean-room review (docs/clean-room-notes.md)**

Confirm all code derived from public SDK docs + repo research; no commercial binary/source inspected; conversion math original.

- [ ] **Step 3: Address findings, re-run Task 8 suites, commit fixes**

```bash
git add -p  # stage review fixes
git commit -m "fix: address native-transform-integration code-review findings"
```

---

### Task 10: Final verification, commit, push

- [ ] **Step 1: Final source commit (if not already)**

Ensure the feature commit message: `feat: connect native parameters to CPU transform rendering`.

- [ ] **Step 2: Push branch only**

```bash
git push -u origin feat/native-transform-integration
```

Do NOT push to main, do NOT force-push, do NOT auto-merge.

- [ ] **Step 3: Record operator host-test results in the completion report**

The Premiere host tests (manual mode, 5 properties, media matrix, trim/reverse/freeze, save/reopen) are operator-run. Record PASS/FAIL values in the milestone completion report. They cannot be executed in this SDK-absent environment.

---

## Self-Review (plan vs spec)

- **Spec coverage:** §4 adapter → Tasks 3; §5 host time → Task 4; §6 progress → reused (no change); §7 interpolation → Task 1; §8 renderer → Task 2 + 5; §9 pixel format → Task 7 step 4 (operator-verified); §10 identity → Task 7 step 7; §11 tests → Tasks 1–6 + 8; §12–17 host tests → operator-run, recorded in Task 10. All covered.
- **Placeholder scan:** Task 7 step 4 explicitly avoids a fake pixel framework and defers exact format to operator; this is by design (SDK absent), not a TBD. All other steps have code.
- **Type consistency:** `TransformState` (canonical, Task 1) vs `RendererTransformState` (Task 2) vs `ProgressInput` (existing) used consistently across Tasks 3–7. `toRendererTransformState(const TransformState&, RenderDimensions&)` signature matches Task 5 test and Task 7 call. `buildProgressInput` signature matches Task 4/6/7. `modeFromPopup`/`alignmentFromPopup` match Task 3/7.
