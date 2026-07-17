// StateMotion — Phase 0.1 vertical slice: CPU/software transform renderer.
//
// This header defines the first independently testable subsystem: the host-agnostic
// transform renderer (handoff 2.5 / 3). It has NO Adobe SDK dependency so it can be
// built and unit-tested without Premiere. Native effect registration, UXP panel,
// Premiere timing, and host install are later tasks and are intentionally absent.
//
// Clean-room: original implementation. No commercial product binary/source inspected.

#ifndef STATEMOTION_TRANSFORM_RENDER_H
#define STATEMOTION_TRANSFORM_RENDER_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace statemotion {

// Premultiplied-alpha RGBA, 32-bit floats. Out-of-bounds / transparent = {0,0,0,0}.
struct Pixel {
    double r = 0.0;
    double g = 0.0;
    double b = 0.0;
    double a = 0.0;
};

// One endpoint of the A/B transform (handoff 2.2 transform family).
// Position/anchor are in source pixels (canonical, post native-to-adapter).
// scaleX/scaleY are fractions (1.0 == 100%). rotationDeg clockwise. opacity [0,1].
struct TransformState {
    double positionX = 0.0;
    double positionY = 0.0;
    double scaleX = 1.0;
    double scaleY = 1.0;
    double rotationDeg = 0.0;
    double anchorX = 0.0;
    double anchorY = 0.0;
    double opacity = 1.0;
};

// Approved first-slice easing (handoff 2.4). Smoothstep is the single supported
// curve for this slice; no curve-menu scaffolding. t is clamped to [0,1] by caller.
double evaluateCurve(double t);

// Clamp near-zero scale to +/-epsilon to avoid singular transforms, preserving
// overshoot. Negative scale stays valid for mirroring (handoff 3, 018).
double safeScale(double value);

// Linear interpolation of the full transform at progress p in [0,1].
TransformState interpolate(const TransformState& a, const TransformState& b, double p);

// Precomputed, allocation-free per-pixel-loop state (handoff 5).
struct CpuRenderPlan {
    double invScaleX = 1.0;
    double invScaleY = 1.0;
    double cosR = 1.0;
    double sinR = 0.0;
    double anchorX = 0.0;
    double anchorY = 0.0;
    double translateX = 0.0;
    double translateY = 0.0;
    double opacity = 1.0;
    int srcW = 0;
    int srcH = 0;
    bool identityTransform = true;
    bool fullyTransparent = false;
};

// Build the plan from an interpolated transform + source dimensions.
CpuRenderPlan plan(const TransformState& t, int srcW, int srcH);

// Source accessor: returns pixel at integer coords, or transparent black if outside.
using Sampler = Pixel(*)(void* user, int x, int y);

// Render one full frame. `out` must hold outW*outH pixels (row-major). Deterministic.
// Premultiplied-alpha output; opacity scales all four channels equally (handoff 3).
void render(const CpuRenderPlan& p, Sampler sampler, void* user,
            int outW, int outH, Pixel* out);

}  // namespace statemotion

#endif  // STATEMOTION_TRANSFORM_RENDER_H
