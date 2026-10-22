// StateMotion - canonical TransformState + interpolation unit tests.
// Self-contained (no framework). Build + run: see plan Task 1.

#include "transform_state.hpp"

#include <cmath>
#include <cstdio>

namespace {
using statemotion::TransformState;
int g_fail = 0;
void check(bool ok, const char* n) {
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", n);
    if (!ok) ++g_fail;
}
}  // namespace

int main() {
    TransformState a, b;
    a.positionNormX = 0.0; a.positionNormY = 0.0;
    b.positionNormX = 1.0; b.positionNormY = 0.5;
    a.scaleX = 1.0; b.scaleX = 2.0;
    a.rotationRadians = 0.0; b.rotationRadians = 1.5707963267948966;
    a.opacity = 0.0; b.opacity = 1.0;
    a.anchorNormX = 0.0; b.anchorNormX = 0.5;

    auto m = statemotion::interpolateCanonical(a, b, 0.5);
    check(std::abs(m.positionNormX - 0.5) < 1e-12, "midpoint position x");
    check(std::abs(m.positionNormY - 0.25) < 1e-12, "midpoint position y");
    check(std::abs(m.scaleX - 1.5) < 1e-12, "midpoint scale x");
    check(std::abs(m.rotationRadians - 0.7853981633974483) < 1e-9, "midpoint radians");
    check(std::abs(m.opacity - 0.5) < 1e-12, "midpoint opacity");
    check(std::abs(m.anchorNormX - 0.25) < 1e-12, "midpoint anchor x");

    auto ex = statemotion::interpolateCanonical(a, b, 1.0);
    check(std::abs(ex.positionNormX - 1.0) < 1e-12, "exact B position");
    check(std::abs(ex.rotationRadians - 1.5707963267948966) < 1e-9, "exact B radians");

    auto ey = statemotion::interpolateCanonical(a, b, 0.0);
    check(std::abs(ey.opacity - 0.0) < 1e-12, "exact A opacity");

    // Easing may overshoot; physical opacity remains bounded.
    auto lo = statemotion::interpolateCanonical(a, b, -0.3);
    check(std::abs(lo.positionNormX + 0.3) < 1e-12, "anticipation position");
    check(lo.opacity == 0.0, "opacity lower bound");
    auto hi = statemotion::interpolateCanonical(a, b, 1.7);
    check(std::abs(hi.positionNormX - 1.7) < 1e-12, "overshoot position");
    check(std::abs(hi.scaleX - 2.7) < 1e-12, "overshoot scale");
    check(hi.opacity == 1.0, "opacity upper bound");
    check(std::abs(hi.rotationRadians - 1.7*b.rotationRadians) < 1e-12, "overshoot rotation");
    auto invalid = statemotion::interpolateCanonical(a,b,NAN);
    check(std::isfinite(invalid.positionNormX), "nonfinite progress deterministic");
    b.scaleX = -1.0;
    check(statemotion::interpolateCanonical(a,b,1.0).scaleX == -1.0, "negative scale retained");

    std::printf("\n%s: %d failures\n", g_fail ? "FAILED" : "ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
