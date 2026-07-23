// StateMotion - end-to-end integration test (pure, SDK-free). See plan Task 6.
// Exercises: native adapter -> host-time -> progress -> canonical interpolation
// -> render-input boundary -> existing CPU renderer. No Adobe SDK types.

#include "statemotion_native_adapter.hpp"
#include "statemotion_host_time.hpp"
#include "statemotion_render_input.hpp"
#include "transform_state.hpp"
#include "transform_render.h"
#include "progress_engine.h"

#include <cmath>
#include <cstdio>
#include <vector>

namespace {
int g_fail = 0;
void check(bool ok, const char* n) {
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", n);
    if (!ok) ++g_fail;
}
statemotion::Pixel solid(void*, int, int) { return statemotion::Pixel{0.5, 0.5, 0.5, 0.5}; }
}  // namespace

int main() {
    using namespace statemotion;

    // Build canonical A and B from native values (manual mode, progress 0 / 0.5 / 1).
    auto A = native::buildCanonicalState(50, 50, 100, 100, 0, 50, 50, 100);
    auto B = native::buildCanonicalState(75, 50, 130, 130, 30, 50, 50, 50);

    // Manual progress 0 -> exact A.
    ProgressInput in0 = host::buildProgressInput(0, 100, 100,
        ids::ProgressMode::Manual, ids::AlignmentMode::ClipStart, 0, 0, 0);
    auto e0 = evaluateProgress(in0);
    check(e0.ok, "eval0 ok");
    auto c0 = interpolateCanonical(A, B, e0.result.easedProgress);
    check(std::abs(c0.positionNormX - 0.5) < 1e-9, "manual0 position=A");
    check(std::abs(c0.opacity - 1.0) < 1e-9, "manual0 opacity=A");

    // Manual progress 100 -> exact B.
    ProgressInput in1 = host::buildProgressInput(0, 100, 100,
        ids::ProgressMode::Manual, ids::AlignmentMode::ClipStart, 0, 0, 100);
    auto e1 = evaluateProgress(in1);
    auto c1 = interpolateCanonical(A, B, e1.result.easedProgress);
    check(std::abs(c1.positionNormX - 0.75) < 1e-9, "manual100 position=B");
    check(std::abs(c1.opacity - 0.5) < 1e-9, "manual100 opacity=B");

    // Manual progress 50 -> exact midpoint (Manual bypasses easing; eased=0.5).
    ProgressInput in5 = host::buildProgressInput(0, 100, 100,
        ids::ProgressMode::Manual, ids::AlignmentMode::ClipStart, 0, 0, 50);
    auto e5 = evaluateProgress(in5);
    auto c5 = interpolateCanonical(A, B, e5.result.easedProgress);
    check(std::abs(c5.positionNormX - 0.625) < 1e-9, "manual50 midpoint position");
    check(std::abs(c5.opacity - 0.75) < 1e-9, "manual50 midpoint opacity");

    // Automatic AToB over entire clip: elapsed 0.5 of 1.0 -> q=0.5 -> EASE_IN_OUT -> 0.5.
    ProgressInput inA = host::buildProgressInput(30000, 60000, 60000,
        ids::ProgressMode::AToB, ids::AlignmentMode::EntireClip, 1.0, 0.0, 0.0);
    auto eA = evaluateProgress(inA);
    check(std::abs(eA.result.easedProgress - 0.5) < 1e-9, "AToB mid eased=0.5");
    auto cA = interpolateCanonical(A, B, eA.result.easedProgress);
    check(std::abs(cA.positionNormX - 0.625) < 1e-9, "AToB mid position");

    // HoldA -> 0, HoldB -> 1.
    ProgressInput inHA = host::buildProgressInput(30000, 60000, 60000,
        ids::ProgressMode::HoldA, ids::AlignmentMode::EntireClip, 1.0, 0.0, 0.0);
    check(std::abs(evaluateProgress(inHA).result.easedProgress) < 1e-9, "HoldA eased=0");
    ProgressInput inHB = host::buildProgressInput(30000, 60000, 60000,
        ids::ProgressMode::HoldB, ids::AlignmentMode::EntireClip, 1.0, 0.0, 0.0);
    check(std::abs(evaluateProgress(inHB).result.easedProgress - 1.0) < 1e-9, "HoldB eased=1");

    // StateMotion Position is an absolute frame coordinate. Matching center
    // position/anchor with unit scale and zero rotation is the native default
    // and must be identity.
    raster::RenderDimensions d{1920, 1080, 1920, 1080};
    auto rA = raster::toRendererTransformState(A, d);
    auto planA = plan(rA, d.sourceW, d.sourceH);
    check(planA.identityTransform, "native centered defaults -> identity plan");

    // Render B through the existing CPU renderer (no crash, finite).
    std::vector<statemotion::Pixel> out(static_cast<size_t>(d.outputW) * d.outputH);
    auto rB = raster::toRendererTransformState(B, d);
    auto planB = plan(rB, d.sourceW, d.sourceH);
    render(planB, solid, nullptr, d.outputW, d.outputH, out.data());
    bool finite = true;
    for (const auto& p : out) finite &= std::isfinite(p.a) && std::isfinite(p.r);
    check(finite, "render B finite");

    std::printf("\n%s: %d failures\n", g_fail ? "FAILED" : "ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
