// StateMotion - native parameter adapter unit tests (pure, SDK-free).
// Build + run: see plan Task 3.

#include "statemotion_native_adapter.hpp"

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
    using namespace statemotion::native;

    auto c = pointPercentToNorm(50.0, 50.0);
    check(std::abs(c.x - 0.5) < 1e-12 && std::abs(c.y - 0.5) < 1e-12, "center 50%->0.5");

    auto tl = pointPercentToNorm(0.0, 0.0);
    check(std::abs(tl.x) < 1e-12 && std::abs(tl.y) < 1e-12, "top-left 0%->0");

    auto br = pointPercentToNorm(100.0, 100.0);
    check(std::abs(br.x - 1.0) < 1e-12 && std::abs(br.y - 1.0) < 1e-12, "bottom-right 100%->1");

    auto hostCenter = pointPixelsToPercent(368.0, 245.5, 736, 491);
    check(std::abs(hostCenter.x - 50.0) < 1e-12 && std::abs(hostCenter.y - 50.0) < 1e-12,
          "Premiere runtime POINT pixels -> contract percent");

    // off-frame / negative percent still linear
    auto of = pointPercentToNorm(150.0, -25.0);
    check(std::abs(of.x - 1.5) < 1e-12 && std::abs(of.y + 0.25) < 1e-12, "off-frame linear");

    check(std::abs(percentToMultiplier(100.0) - 1.0) < 1e-12, "scale 100%->1");
    check(std::abs(percentToMultiplier(50.0) - 0.5) < 1e-12, "scale 50%->0.5");
    check(std::abs(percentToMultiplier(115.0) - 1.15) < 1e-12, "scale 115%->1.15");
    check(std::abs(percentToMultiplier(75.0) - 0.75) < 1e-12, "scale 75% (non-uniform) ->0.75");

    check(std::abs(percentToOpacity(0.0)) < 1e-12, "opacity 0%->0");
    check(std::abs(percentToOpacity(50.0) - 0.5) < 1e-12, "opacity 50%->0.5");
    check(std::abs(percentToOpacity(100.0) - 1.0) < 1e-12, "opacity 100%->1");
    check(percentToOpacity(150.0) == 1.0, "opacity >100 clamps to 1");
    check(percentToOpacity(-10.0) == 0.0, "opacity <0 clamps to 0");

    check(std::abs(percentToFraction(0.0)) < 1e-12, "crop 0%->0");
    check(std::abs(percentToFraction(50.0) - 0.5) < 1e-12, "crop 50%->0.5");
    check(std::abs(percentToFraction(100.0) - 1.0) < 1e-12, "crop 100%->1");
    check(std::abs(percentToFraction(25.0) - 0.25) < 1e-12, "crop 25%->0.25");
    // percentToFraction does NOT clamp (renderer clamps in plan()), so out-of-range passes through.
    check(std::abs(percentToFraction(150.0) - 1.5) < 1e-12, "crop 150%->1.5 (no clamp)");

    check(std::abs(degreesToRadians(0.0)) < 1e-12, "0deg->0rad");
    check(std::abs(degreesToRadians(90.0) - 1.5707963267948966) < 1e-9, "90deg->pi/2");
    check(std::abs(degreesToRadians(180.0) - 3.141592653589793) < 1e-9, "180deg->pi");
    check(std::abs(degreesToRadians(-45.0) + 0.7853981633974483) < 1e-9, "-45deg->-pi/4");

    auto s = buildCanonicalState(50, 50, 100, 100, 0, 50, 50, 100);
    check(s.positionNormX == 0.5 && s.scaleX == 1.0 && s.rotationRadians == 0.0 &&
              s.opacity == 1.0 && s.anchorNormX == 0.5,
          "buildCanonicalState default");

    auto s2 = buildCanonicalState(25, 75, 130, 130, 30, 25, 75, 50);
    check(std::abs(s2.opacity - 0.5) < 1e-12 && std::abs(s2.rotationRadians - 0.5235987755982988) < 1e-9 &&
              std::abs(s2.scaleX - 1.3) < 1e-12 && std::abs(s2.positionNormX - 0.25) < 1e-12,
          "buildCanonicalState B values");

    check(modeFromPopup(6) == statemotion::ids::ProgressMode::Manual, "mode popup 6=Manual");
    check(modeFromPopup(0) == statemotion::ids::ProgressMode::AToB, "mode popup 0=AToB");
    check(alignmentFromPopup(2) == statemotion::ids::AlignmentMode::EntireClip, "align popup 2=EntireClip");
    check(alignmentFromPopup(1) == statemotion::ids::AlignmentMode::ClipEnd, "align popup 1=ClipEnd");

    std::printf("\n%s: %d failures\n", g_fail ? "FAILED" : "ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
