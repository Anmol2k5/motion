// StateMotion — Phase 0.1 vertical slice: CPU/software transform renderer.
// See transform_render.h for scope and clean-room note.

#include "transform_render.h"

#include <algorithm>
#include <cmath>

namespace statemotion {

double safeScale(double value) {
    constexpr double epsilon = 1e-4;
    if (std::abs(value) >= epsilon) return value;
    // Honor sign including negative zero so -0 maps to -epsilon (mirroring-safe).
    return std::signbit(value) ? -epsilon : epsilon;
}

RendererTransformState interpolate(const RendererTransformState& a, const RendererTransformState& b, double p) {
    double t = std::clamp(p, 0.0, 1.0);
    RendererTransformState r;
    r.positionX = a.positionX + (b.positionX - a.positionX) * t;
    r.positionY = a.positionY + (b.positionY - a.positionY) * t;
    r.scaleX = a.scaleX + (b.scaleX - a.scaleX) * t;
    r.scaleY = a.scaleY + (b.scaleY - a.scaleY) * t;
    r.rotationDeg = a.rotationDeg + (b.rotationDeg - a.rotationDeg) * t;
    r.anchorX = a.anchorX + (b.anchorX - a.anchorX) * t;
    r.anchorY = a.anchorY + (b.anchorY - a.anchorY) * t;
    r.opacity = a.opacity + (b.opacity - a.opacity) * t;
    r.cropLeft = a.cropLeft + (b.cropLeft - a.cropLeft) * t;
    r.cropRight = a.cropRight + (b.cropRight - a.cropRight) * t;
    r.cropTop = a.cropTop + (b.cropTop - a.cropTop) * t;
    r.cropBottom = a.cropBottom + (b.cropBottom - a.cropBottom) * t;
    r.cornerRadius = a.cornerRadius + (b.cornerRadius - a.cornerRadius) * t;
    r.shadowOpacity = a.shadowOpacity + (b.shadowOpacity - a.shadowOpacity) * t;
    r.shadowAngleDeg = a.shadowAngleDeg + (b.shadowAngleDeg - a.shadowAngleDeg) * t;
    r.shadowDistance = a.shadowDistance + (b.shadowDistance - a.shadowDistance) * t;
    r.shadowSoftness = a.shadowSoftness + (b.shadowSoftness - a.shadowSoftness) * t;
    return r;
}

CpuRenderPlan plan(const RendererTransformState& t, int srcW, int srcH) {
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

    // Crop calculation
    const double cl = std::clamp(t.cropLeft, 0.0, 1.0);
    const double cr = std::clamp(t.cropRight, 0.0, 1.0);
    const double ct = std::clamp(t.cropTop, 0.0, 1.0);
    const double cb = std::clamp(t.cropBottom, 0.0, 1.0);
    const double crad = std::clamp(t.cornerRadius, 0.0, 1.0);

    p.hasCropMask = (cl > 0.0 || cr > 0.0 || ct > 0.0 || cb > 0.0 || crad > 0.0);
    p.cropMinX = cl * srcW;
    p.cropMaxX = (1.0 - cr) * srcW;
    p.cropMinY = ct * srcH;
    p.cropMaxY = (1.0 - cb) * srcH;

    const double cropW = p.cropMaxX - p.cropMinX;
    const double cropH = p.cropMaxY - p.cropMinY;

    if (cropW <= 0.0 || cropH <= 0.0) {
        p.fullyTransparent = true;
    } else if (p.hasCropMask) {
        p.cropCenterX = 0.5 * (p.cropMinX + p.cropMaxX);
        p.cropCenterY = 0.5 * (p.cropMinY + p.cropMaxY);
        const double maxRadius = 0.5 * std::min(cropW, cropH);
        p.cornerRadiusPx = crad * maxRadius;
        p.cropHalfInnerW = std::max(0.0, 0.5 * cropW - p.cornerRadiusPx);
        p.cropHalfInnerH = std::max(0.0, 0.5 * cropH - p.cornerRadiusPx);
    }

    // Shadow calculation
    p.shadowOpacity = std::clamp(t.shadowOpacity, 0.0, 1.0);
    p.shadowSoftnessPx = std::max(0.0, t.shadowSoftness);
    p.hasShadow = (p.shadowOpacity > 0.0 && p.opacity > 0.0);
    if (p.hasShadow) {
        double radShadow = t.shadowAngleDeg * 3.14159265358979323846 / 180.0;
        p.shadowOffsetX = std::cos(radShadow) * t.shadowDistance;
        p.shadowOffsetY = std::sin(radShadow) * t.shadowDistance;
    }

    p.identityTransform =
        (!p.hasCropMask && !p.hasShadow &&
         std::abs(t.positionX - t.anchorX) < 1e-9 &&
         std::abs(t.positionY - t.anchorY) < 1e-9 &&
         std::abs(t.scaleX - 1.0) < 1e-9 && std::abs(t.scaleY - 1.0) < 1e-9 &&
         std::abs(t.rotationDeg) < 1e-9);
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

double evalCropMaskAlpha(const CpuRenderPlan& p, double sx, double sy) {
    if (!p.hasCropMask) return 1.0;
    const double px = std::abs(sx - p.cropCenterX) - p.cropHalfInnerW;
    const double py = std::abs(sy - p.cropCenterY) - p.cropHalfInnerH;
    const double dx = std::max(px, 0.0);
    const double dy = std::max(py, 0.0);
    const double distOut = std::sqrt(dx * dx + dy * dy);
    const double distIn = std::min(std::max(px, py), 0.0);
    const double sdf = distOut + distIn - p.cornerRadiusPx;
    return std::clamp(0.5 - sdf, 0.0, 1.0);
}

double sampleTransformedAlphaAt(const CpuRenderPlan& p, Sampler sampler, void* user, double px, double py) {
    double sx = px;
    double sy = py;
    if (!p.identityTransform) {
        double dx = px - p.translateX;
        double dy = py - p.translateY;
        double rx = p.cosR * dx + p.sinR * dy;
        double ry = -p.sinR * dx + p.cosR * dy;
        sx = rx * p.invScaleX + p.anchorX;
        sy = ry * p.invScaleY + p.anchorY;
    }
    const int x0 = static_cast<int>(std::floor(sx));
    const int y0 = static_cast<int>(std::floor(sy));
    const int x1 = x0 + 1;
    const int y1 = y0 + 1;
    double a = 0.0;
    if (x0 >= 0 && y0 >= 0 && x1 < p.srcW && y1 < p.srcH) {
        const double fx = sx - x0;
        const double fy = sy - y0;
        double topA = sampler(user, x0, y0).a + (sampler(user, x1, y0).a - sampler(user, x0, y0).a) * fx;
        double botA = sampler(user, x0, y1).a + (sampler(user, x1, y1).a - sampler(user, x0, y1).a) * fx;
        a = topA + (botA - topA) * fy;
    } else if (p.identityTransform && px >= 0 && px < p.srcW && py >= 0 && py < p.srcH) {
        a = sampler(user, static_cast<int>(px), static_cast<int>(py)).a;
    }
    return a * evalCropMaskAlpha(p, sx, sy) * p.opacity;
}

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
            double sx = static_cast<double>(x);
            double sy = static_cast<double>(y);
            if (!p.identityTransform) {
                // Inverse of forward map out = R(theta)*((s-anchor)*scale) + position.
                // Solve for source s. R(-theta) = [cos, sin; -sin, cos]. Deterministic;
                // out-of-bounds => transparent (no edge smear).
                double dx = x - p.translateX;
                double dy = y - p.translateY;
                double rx = p.cosR * dx + p.sinR * dy;
                double ry = -p.sinR * dx + p.cosR * dy;
                sx = rx * p.invScaleX + p.anchorX;
                sy = ry * p.invScaleY + p.anchorY;

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

            // Apply crop and rounded rectangle mask alpha.
            const double maskAlpha = evalCropMaskAlpha(p, sx, sy);
            const double effectiveOpacity = p.opacity * maskAlpha;

            // Premultiplied-alpha opacity (handoff 3).
            result.r *= effectiveOpacity;
            result.g *= effectiveOpacity;
            result.b *= effectiveOpacity;
            result.a *= effectiveOpacity;

            // Composite drop shadow behind content
            if (p.hasShadow) {
                double shadowAlphaSum = 0.0;
                const double shadowPx = static_cast<double>(x) - p.shadowOffsetX;
                const double shadowPy = static_cast<double>(y) - p.shadowOffsetY;
                if (p.shadowSoftnessPx <= 0.0) {
                    shadowAlphaSum = sampleTransformedAlphaAt(p, sampler, user, shadowPx, shadowPy);
                } else {
                    const int radius = std::min(5, static_cast<int>(std::ceil(p.shadowSoftnessPx)));
                    int sampleCount = 0;
                    for (int dy = -radius; dy <= radius; ++dy) {
                        for (int dx = -radius; dx <= radius; ++dx) {
                            shadowAlphaSum += sampleTransformedAlphaAt(p, sampler, user, shadowPx + dx, shadowPy + dy);
                            sampleCount++;
                        }
                    }
                    if (sampleCount > 0) shadowAlphaSum /= sampleCount;
                }
                const double shadowAlpha = std::clamp(shadowAlphaSum * p.shadowOpacity, 0.0, 1.0);
                // Porter-Duff Over: result (content) over shadow (black with shadowAlpha)
                const double invContentA = 1.0 - result.a;
                result.r += 0.0 * invContentA;
                result.g += 0.0 * invContentA;
                result.b += 0.0 * invContentA;
                result.a += shadowAlpha * invContentA;
            }

            out[y * outW + x] = result;
        }
    }
}

}  // namespace statemotion
