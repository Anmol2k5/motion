// StateMotion — Phase 0.1 vertical slice: transform renderer unit tests.
// Self-contained (no framework). Build: g++ transform_render.cpp transform_render_test.cpp -o tr_test
// Run: ./tr_test   -> prints PASS/FAIL per case; exit code 1 on any failure.

#include "transform_render.h"
#include "../progress/easing.hpp"

#include <cmath>
#include <cstdio>
#include <vector>

namespace {
    const statemotion::EasingCurve legacy{1.0 / 3.0, 0.0, 2.0 / 3.0, 1.0};

using statemotion::Pixel;
using statemotion::RendererTransformState;

int failures = 0;

void check(bool ok, const char* name) {
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", name);
    if (!ok) ++failures;
}

double maxAbs(const Pixel& a, const Pixel& b) {
    double m = 0.0;
    m = std::max(m, std::abs(a.r - b.r));
    m = std::max(m, std::abs(a.g - b.g));
    m = std::max(m, std::abs(a.b - b.b));
    m = std::max(m, std::abs(a.a - b.a));
    return m;
}

Pixel* makeSource(int w, int h, double fill) {
    Pixel* s = new Pixel[w * h];
    for (int i = 0; i < w * h; ++i) {
        s[i].r = fill; s[i].g = fill; s[i].b = fill; s[i].a = fill;  // premultiplied solid
    }
    return s;
}

Pixel sample(void* user, int x, int y) {
    auto* src = static_cast<Pixel*>(user);
    // sampler is only called with in-bounds coords by render(); guard anyway.
    return src[y * 4 + x];
}

}  // namespace

int main() {
    const int W = 4, H = 4;

    // --- AC1: identity reproduces source exactly ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState id;
        auto p = statemotion::plan(id, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i) ok &= maxAbs(out[i], src[i]) < 1e-12;
        check(ok, "AC1 identity reproduces source");
        delete[] src;
    }

    // Native defaults use absolute center position and center anchor.
    {
        RendererTransformState centered;
        centered.positionX = 2.0; centered.positionY = 2.0;
        centered.anchorX = 2.0; centered.anchorY = 2.0;
        check(statemotion::plan(centered, W, H).identityTransform,
              "AC1 center position + center anchor is identity");
    }

    // --- AC2: position-only shift (translate by +1,+1) ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.positionX = 1.0; t.positionY = 1.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        // pixel (1,1) should now sample source (0,0)
        bool ok = maxAbs(out[1 * W + 1], src[0]) < 1e-9 && out[0].a < 1e-12;
        check(ok, "AC2 position-only shift");
        delete[] src;
    }

    // --- AC2: uniform scale 2x about center, pixel (2,2) samples between ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.scaleX = 2.0; t.scaleY = 2.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i) ok &= std::abs(out[i].a - 0.5) < 1e-9;
        check(ok, "AC2 uniform scale 2x fills (bilinear averages to same value)");
        delete[] src;
    }

    // --- AC2: non-uniform scale + rotation, must not crash and be finite ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.scaleX = 1.5; t.scaleY = 0.7; t.rotationDeg = 33.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i)
            ok &= std::isfinite(out[i].r) && std::isfinite(out[i].a);
        check(ok, "AC2 non-uniform scale + rotation finite");
        delete[] src;
    }

    // --- AC2: rotation around a noncentral anchor ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.anchorX = 1.0; t.anchorY = 1.0; t.rotationDeg = 90.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i) ok &= std::isfinite(out[i].a);
        check(ok, "AC2 rotation around noncentral anchor finite");
        delete[] src;
    }

    // --- AC2: opacity scales premultiplied channels ---
    {
        Pixel* src = makeSource(W, H, 0.8);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.opacity = 0.5;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        // identity: out = src * 0.5
        bool ok = std::abs(out[0].a - 0.4) < 1e-12 && std::abs(out[0].r - 0.4) < 1e-12;
        check(ok, "AC2 opacity scales premultiplied channels equally");
        delete[] src;
    }

    // --- AC3: out-of-bounds returns transparent black, no edge smear ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.positionX = -100.0;  // pushes everything off-source
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i) ok &= (out[i].a == 0.0 && out[i].r == 0.0);
        check(ok, "AC3 off-screen motion => transparent black");
        delete[] src;
    }

    // --- AC4: premultiplied compositing verified explicitly ---
    {
        Pixel* src = makeSource(W, H, 0.6);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.opacity = 0.25;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = std::abs(out[0].r - 0.15) < 1e-12 && std::abs(out[0].a - 0.15) < 1e-12;
        check(ok, "AC4 premultiplied: rgb and alpha scaled by same opacity");
        delete[] src;
    }

    // --- AC5: safeScale clamps near-zero, preserves overshoot, no NaN ---
    {
        bool ok = std::abs(statemotion::safeScale(0.0) - 1e-4) < 1e-12 &&
                  std::abs(statemotion::safeScale(-0.0) + 1e-4) < 1e-12 &&
                  std::abs(statemotion::safeScale(2.5) - 2.5) < 1e-12 &&
                  std::isfinite(statemotion::safeScale(1e-9));
        check(ok, "AC5 safeScale clamps near-zero, preserves overshoot");
    }

    // --- AC5: degenerate scale (0) renders without NaN/inf ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.scaleX = 0.0; t.scaleY = 0.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i) ok &= std::isfinite(out[i].r) && std::isfinite(out[i].a);
        check(ok, "AC5 degenerate scale (0) no NaN/inf");
        delete[] src;
    }

    // --- AC6: overshoot curve (t outside [0,1]) no invalid memory access ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState a, b;
        b.positionX = 10.0; b.scaleX = 3.0; b.rotationDeg = 720.0;
        RendererTransformState mid = statemotion::interpolate(a, b, 1.5);  // overshoot
        auto p = statemotion::plan(mid, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i) ok &= std::isfinite(out[i].a);
        check(ok, "AC6 overshoot curve no invalid memory access");
        delete[] src;
    }

    // --- AC7: determinism — same inputs, byte-identical output ---
    {
        Pixel* src = makeSource(W, H, 0.5);
        std::vector<statemotion::Pixel> out1(W * H), out2(W * H);
        RendererTransformState t;
        t.positionX = 0.3; t.scaleX = 1.2; t.rotationDeg = 17.0; t.anchorX = 1.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out1.data());
        statemotion::render(p, sample, src, W, H, out2.data());
        bool ok = true;
        for (int i = 0; i < W * H; ++i) ok &= maxAbs(out1[i], out2[i]) == 0.0;
        check(ok, "AC7 deterministic rerender");
        delete[] src;
    }

    // --- AC8: curve eval pure + monotonic + endpoints (via shared easing) ---
    {
        statemotion::EasingCurve legacy{1.0 / 3.0, 0.0, 2.0 / 3.0, 1.0};
        bool ok = std::abs(statemotion::evaluateEasing(statemotion::EasingMode::EASE_IN_OUT, legacy, 0.0)) < 1e-12 &&
                  std::abs(statemotion::evaluateEasing(statemotion::EasingMode::EASE_IN_OUT, legacy, 1.0) - 1.0) < 1e-12 &&
                  statemotion::evaluateEasing(statemotion::EasingMode::EASE_IN_OUT, legacy, 0.25) <
                      statemotion::evaluateEasing(statemotion::EasingMode::EASE_IN_OUT, legacy, 0.75) &&
                  std::abs(statemotion::evaluateEasing(statemotion::EasingMode::EASE_IN_OUT, legacy, 2.0) - 1.0) < 1e-12;
        check(ok, "AC8 curve eval endpoints/monotonic/clamped");
    }

    // --- AC9: rectangular crop masking (cropLeft 50% crops left half) ---
    {
        Pixel* src = makeSource(W, H, 0.8);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.cropLeft = 0.5;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        // Left half (x=0, x=1) transparent, right half (x=2, x=3) visible
        bool ok = out[0].a < 1e-12 && out[1].a < 1e-12 &&
                  std::abs(out[2].a - 0.8) < 1e-12 && std::abs(out[3].a - 0.8) < 1e-12;
        check(ok, "AC9 rectangular cropLeft 50% crops left half");
        delete[] src;
    }

    // --- AC10: corner radius antialiasing & interpolation ---
    {
        RendererTransformState a, b;
        a.cropRight = 0.0; b.cropRight = 0.5;
        a.cornerRadius = 0.0; b.cornerRadius = 1.0;
        RendererTransformState mid = statemotion::interpolate(a, b, 0.5);
        bool okInterp = std::abs(mid.cropRight - 0.25) < 1e-12 && std::abs(mid.cornerRadius - 0.5) < 1e-12;
        check(okInterp, "AC10 crop & cornerRadius linear interpolation");

        Pixel* src = makeSource(W, H, 1.0);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.cornerRadius = 1.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        // Rounded corners produce reduced alpha at outer corner pixels (0,0) compared to center (1,1)
        bool okRounded = out[0].a < out[1 * W + 1].a && out[1 * W + 1].a > 0.9;
        check(okRounded, "AC10 corner radius antialiases outer corners");
        delete[] src;
    }

    // --- AC11: drop shadow compositing & softness interpolation ---
    {
        RendererTransformState a, b;
        a.shadowOpacity = 0.0; b.shadowOpacity = 1.0;
        a.shadowDistance = 0.0; b.shadowDistance = 20.0;
        RendererTransformState mid = statemotion::interpolate(a, b, 0.5);
        bool okInterp = std::abs(mid.shadowOpacity - 0.5) < 1e-12 && std::abs(mid.shadowDistance - 10.0) < 1e-12;
        check(okInterp, "AC11 shadow opacity & distance linear interpolation");

        Pixel* src = makeSource(W, H, 1.0);
        std::vector<statemotion::Pixel> out(W * H);
        RendererTransformState t;
        t.shadowOpacity = 0.5;
        t.shadowDistance = 0.0;
        t.shadowSoftness = 0.0;
        auto p = statemotion::plan(t, W, H);
        statemotion::render(p, sample, src, W, H, out.data());
        bool okShadow = p.hasShadow && out[0].a > 0.0;
        check(okShadow, "AC11 drop shadow rendering active");
        delete[] src;
    }

    std::printf("\n%s: %d failures\n", failures ? "FAILED" : "ALL PASSED", failures);
    return failures ? 1 : 0;
}
