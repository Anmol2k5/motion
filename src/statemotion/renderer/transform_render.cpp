// StateMotion — Phase 0.1 vertical slice: CPU/software transform renderer.
// See transform_render.h for scope and clean-room note.

#include "transform_render.h"

#include <algorithm>
#include <cmath>

namespace statemotion {

double evaluateCurve(double t) {
    double x = std::clamp(t, 0.0, 1.0);
    return x * x * (3.0 - 2.0 * x);  // smoothstep
}

double safeScale(double value) {
    constexpr double epsilon = 1e-4;
    if (std::abs(value) >= epsilon) return value;
    // Honor sign including negative zero so -0 maps to -epsilon (mirroring-safe).
    return std::signbit(value) ? -epsilon : epsilon;
}

TransformState interpolate(const TransformState& a, const TransformState& b, double p) {
    double t = std::clamp(p, 0.0, 1.0);
    TransformState r;
    r.positionX = a.positionX + (b.positionX - a.positionX) * t;
    r.positionY = a.positionY + (b.positionY - a.positionY) * t;
    r.scaleX = a.scaleX + (b.scaleX - a.scaleX) * t;
    r.scaleY = a.scaleY + (b.scaleY - a.scaleY) * t;
    r.rotationDeg = a.rotationDeg + (b.rotationDeg - a.rotationDeg) * t;
    r.anchorX = a.anchorX + (b.anchorX - a.anchorX) * t;
    r.anchorY = a.anchorY + (b.anchorY - a.anchorY) * t;
    r.opacity = a.opacity + (b.opacity - a.opacity) * t;
    return r;
}

CpuRenderPlan plan(const TransformState& t, int srcW, int srcH) {
    CpuRenderPlan p;
    p.srcW = srcW;
    p.srcH = srcH;
    p.opacity = std::clamp(t.opacity, 0.0, 1.0);
    p.fullyTransparent = p.opacity <= 0.0;
    p.invScaleX = 1.0 / safeScale(t.scaleX);
    p.invScaleY = 1.0 / safeScale(t.scaleY);
    double rad = t.rotationDeg * 3.14159265358979323846 / 180.0;
    p.cosR = std::cos(rad);
    p.sinR = std::sin(rad);
    p.anchorX = t.anchorX;
    p.anchorY = t.anchorY;
    p.translateX = t.positionX;
    p.translateY = t.positionY;
    p.identityTransform =
        (std::abs(t.positionX) < 1e-9 && std::abs(t.positionY) < 1e-9 &&
         std::abs(t.scaleX - 1.0) < 1e-9 && std::abs(t.scaleY - 1.0) < 1e-9 &&
         std::abs(t.rotationDeg) < 1e-9 && std::abs(t.anchorX) < 1e-9 &&
         std::abs(t.anchorY) < 1e-9);
    return p;
}

namespace {

Pixel lerp(Pixel a, Pixel b, double f) {
    Pixel r;
    r.r = a.r + (b.r - a.r) * f;
    r.g = a.g + (b.g - a.g) * f;
    r.b = a.b + (b.b - a.b) * f;
    r.a = a.a + (b.a - a.a) * f;
    return r;
}

Pixel transparent() { return Pixel{}; }

}  // namespace

void render(const CpuRenderPlan& p, Sampler sampler, void* user,
            int outW, int outH, Pixel* out) {
    if (p.fullyTransparent) {
        for (int i = 0; i < outW * outH; ++i) out[i] = Pixel{};
        return;
    }
    for (int y = 0; y < outH; ++y) {
        for (int x = 0; x < outW; ++x) {
            Pixel result = transparent();
            if (!p.identityTransform) {
                // Inverse of forward map  out = R(theta)*( (s-anchor)*scale ) + anchor + position.
                // Solve for source s. R(-theta) = [cos, sin; -sin, cos]. Deterministic;
                // out-of-bounds => transparent (no edge smear).
                double dx = x - p.anchorX - p.translateX;
                double dy = y - p.anchorY - p.translateY;
                double rx = p.cosR * dx + p.sinR * dy;
                double ry = -p.sinR * dx + p.cosR * dy;
                double sx = rx * p.invScaleX + p.anchorX;
                double sy = ry * p.invScaleY + p.anchorY;

                const int x0 = static_cast<int>(std::floor(sx));
                const int y0 = static_cast<int>(std::floor(sy));
                const int x1 = x0 + 1;
                const int y1 = y0 + 1;
                if (x0 >= 0 && y0 >= 0 && x1 < p.srcW && y1 < p.srcH) {
                    const double fx = sx - x0;
                    const double fy = sy - y0;
                    Pixel top = lerp(sampler(user, x0, y0), sampler(user, x1, y0), fx);
                    Pixel bot = lerp(sampler(user, x0, y1), sampler(user, x1, y1), fx);
                    result = lerp(top, bot, fy);
                }
            } else if (x >= 0 && x < p.srcW && y >= 0 && y < p.srcH) {
                result = sampler(user, x, y);
            }
            // Premultiplied-alpha opacity (handoff 3).
            result.r *= p.opacity;
            result.g *= p.opacity;
            result.b *= p.opacity;
            result.a *= p.opacity;
            out[y * outW + x] = result;
        }
    }
}

}  // namespace statemotion
