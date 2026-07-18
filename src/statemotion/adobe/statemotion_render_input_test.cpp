// StateMotion - render-input adapter unit tests (pure, SDK-free). See plan Task 5.

#include "statemotion_render_input.hpp"

#include <cmath>
#include <cstdio>

namespace {
int g_fail = 0;
void check(bool ok, const char* n) {
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", n);
    if (!ok) ++g_fail;
}
}  // namespace

int main() {
    using namespace statemotion::raster;
using statemotion::TransformState;

    // 1920x1080 output, same source -> center 0.5,0.5 maps to 960,540.
    TransformState c;
    c.positionNormX = 0.5; c.positionNormY = 0.5;
    c.anchorNormX = 0.5; c.anchorNormY = 0.5;
    c.scaleX = 1.0; c.scaleY = 1.0; c.rotationRadians = 0.0; c.opacity = 1.0;

    RenderDimensions d{1920, 1080, 1920, 1080};
    auto r = toRendererTransformState(c, d);
    check(std::abs(r.positionX - 960.0) < 1e-9 && std::abs(r.positionY - 540.0) < 1e-9,
          "center pos->output center");
    check(std::abs(r.anchorX - 960.0) < 1e-9 && std::abs(r.anchorY - 540.0) < 1e-9,
          "center anchor->source center");

    // vertical 1080x1920.
    RenderDimensions v{1080, 1920, 1080, 1920};
    auto rv = toRendererTransformState(c, v);
    check(std::abs(rv.positionX - 540.0) < 1e-9 && std::abs(rv.positionY - 960.0) < 1e-9,
          "vertical center");

    // UHD 3840x2160.
    RenderDimensions u{3840, 2160, 3840, 2160};
    auto ru = toRendererTransformState(c, u);
    check(std::abs(ru.positionX - 1920.0) < 1e-9 && std::abs(ru.positionY - 1080.0) < 1e-9,
          "UHD center");

    // Different source vs output dims: position uses output, anchor uses source.
    RenderDimensions diff{1920, 1080, 960, 540};
    TransformState c2;
    c2.positionNormX = 0.5; c2.positionNormY = 0.5;
    c2.anchorNormX = 0.5; c2.anchorNormY = 0.5;
    auto rd = toRendererTransformState(c2, diff);
    check(std::abs(rd.positionX - 960.0) < 1e-9 && std::abs(rd.anchorX - 480.0) < 1e-9,
          "position=output dims, anchor=source dims");

    // radians -> degrees.
    TransformState r2; r2.rotationRadians = 1.5707963267948966;  // pi/2
    auto rd2 = toRendererTransformState(r2, d);
    check(std::abs(rd2.rotationDeg - 90.0) < 1e-9, "pi/2 -> 90deg");
    TransformState r3; r3.rotationRadians = -0.7853981633974483;  // -pi/4
    auto rd3 = toRendererTransformState(r3, d);
    check(std::abs(rd3.rotationDeg + 45.0) < 1e-9, "-pi/4 -> -45deg");
    TransformState r4; r4.rotationRadians = 3.141592653589793;  // pi
    auto rd4 = toRendererTransformState(r4, d);
    check(std::abs(rd4.rotationDeg - 180.0) < 1e-9, "pi -> 180deg");

    // scale/opacity unchanged.
    TransformState r5; r5.scaleX = 1.3; r5.scaleY = 0.7; r5.opacity = 0.5;
    auto rd5 = toRendererTransformState(r5, d);
    check(std::abs(rd5.scaleX - 1.3) < 1e-12 && std::abs(rd5.scaleY - 0.7) < 1e-12 &&
              std::abs(rd5.opacity - 0.5) < 1e-12,
          "scale/opacity unchanged");

    std::printf("\n%s: %d failures\n", g_fail ? "FAILED" : "ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
