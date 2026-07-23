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

// One endpoint of the A/B transform in renderer-native units.
// Position/anchor are in source pixels. scaleX/scaleY are fractions (1.0 == 100%).
// rotationDeg clockwise. opacity [0,1]. The canonical (normalized/radians) model
// is defined separately in transform_state.hpp; toRendererTransformState() maps
// between them exactly once, after interpolation.
struct RendererTransformState {
    double positionX = 0.0;
    double positionY = 0.0;
    double scaleX = 1.0;
    double scaleY = 1.0;
    double rotationDeg = 0.0;
    double anchorX = 0.0;
    double anchorY = 0.0;
    double opacity = 1.0;
    double cropLeft = 0.0;
    double cropRight = 0.0;
    double cropTop = 0.0;
    double cropBottom = 0.0;
    double cornerRadius = 0.0;
    double shadowOpacity = 0.0;
    double shadowAngleDeg = 135.0;
    double shadowDistance = 10.0;
    double shadowSoftness = 20.0;
};

// Clamp near-zero scale to +/-epsilon to avoid singular transforms, preserving
// overshoot. Negative scale stays valid for mirroring (handoff 3, 018).
double safeScale(double value);

// Linear interpolation of the full renderer-native transform at progress p in [0,1].
RendererTransformState interpolate(const RendererTransformState& a, const RendererTransformState& b, double p);

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
    double cropMinX = 0.0;
    double cropMaxX = 0.0;
    double cropMinY = 0.0;
    double cropMaxY = 0.0;
    double cropCenterX = 0.0;
    double cropCenterY = 0.0;
    double cropHalfInnerW = 0.0;
    double cropHalfInnerH = 0.0;
    double cornerRadiusPx = 0.0;
    double shadowOffsetX = 0.0;
    double shadowOffsetY = 0.0;
    double shadowOpacity = 0.0;
    double shadowSoftnessPx = 0.0;
    int srcW = 0;
    int srcH = 0;
    bool hasCropMask = false;
    bool hasShadow = false;
    bool identityTransform = true;
    bool fullyTransparent = false;
};

// Build the plan from an interpolated renderer-native transform + source dimensions.
CpuRenderPlan plan(const RendererTransformState& t, int srcW, int srcH);

// Source accessor: returns pixel at integer coords, or transparent black if outside.
using Sampler = Pixel(*)(void* user, int x, int y);

// Render one full frame. `out` must hold outW*outH pixels (row-major). Deterministic.
// Premultiplied-alpha output; opacity scales all four channels equally (handoff 3).
void render(const CpuRenderPlan& p, Sampler sampler, void* user,
            int outW, int outH, Pixel* out);

}  // namespace statemotion

#endif  // STATEMOTION_TRANSFORM_RENDER_H
