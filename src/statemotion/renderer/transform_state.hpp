#ifndef STATEMOTION_TRANSFORM_STATE_HPP
#define STATEMOTION_TRANSFORM_STATE_HPP

#include <algorithm>

namespace statemotion {

// Canonical StateMotion transform (resolution-independent, internal math model).
// Position/anchor are normalized top-left [0,1] (0,0 = top-left, 1,1 = bottom-right).
// scale is a multiplier (1.0 == 100%). rotationRadians is the internal rotation unit.
// opacity is [0,1]. This is the model the native adapter produces, the progress
// engine interpolates, and the renderer boundary converts to pixels+degrees.
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

// Linear interpolation of the full canonical transform at progress p in [0,1].
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

}  // namespace statemotion

#endif  // STATEMOTION_TRANSFORM_STATE_HPP
