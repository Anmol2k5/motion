#ifndef STATEMOTION_NATIVE_ADAPTER_HPP
#define STATEMOTION_NATIVE_ADAPTER_HPP

#include <algorithm>

#include "transform_state.hpp"  // canonical TransformState
#include "parameter_ids.hpp"    // ids::ProgressMode / AlignmentMode

namespace statemotion { namespace native {

// Adobe POINT parameters store values as percentages (0..100, origin top-left,
// fixed-point 16.16). We work in percent space so no resolution is hardcoded.
struct Vec2 {
    double x = 0.0;
    double y = 0.0;
};

// POINT percent (0..100) -> normalized [0,1] (top-left origin).
inline Vec2 pointPercentToNorm(double px, double py) {
    return Vec2{px / 100.0, py / 100.0};
}

// PF_PointDef defaults are declared as percentages, but Premiere supplies
// runtime POINT values in pixels.
inline Vec2 pointPixelsToPercent(double x, double y, int width, int height) {
    return Vec2{
        width > 0 ? x * 100.0 / static_cast<double>(width) : 0.0,
        height > 0 ? y * 100.0 / static_cast<double>(height) : 0.0
    };
}

// FLOAT_SLIDER scale percent -> multiplier (100% -> 1.0).
inline double percentToMultiplier(double percent) {
    return percent / 100.0;
}

// FLOAT_SLIDER opacity percent -> clamped [0,1] (0% -> 0, 100% -> 1).
inline double percentToOpacity(double percent) {
    return std::clamp(percent / 100.0, 0.0, 1.0);
}

// FLOAT_SLIDER crop percent -> fraction [0,1] (0% -> 0, 100% -> 1).
// Crop values are stored as percent in the native host but the renderer expects
// fractions of the source dimension.
inline double percentToFraction(double percent) {
    return percent / 100.0;
}

// ANGLE degrees -> radians.
inline double degreesToRadians(double degrees) {
    return degrees * 3.14159265358979323846 / 180.0;
}

// Build ONE canonical endpoint from already-read native values.
inline TransformState buildCanonicalState(double posPx, double posPy, double scaleX, double scaleY,
                                          double rotDeg, double ancPx, double ancPy,
                                          double opacityPercent) {
    TransformState t;
    Vec2 p = pointPercentToNorm(posPx, posPy);
    t.positionNormX = p.x;
    t.positionNormY = p.y;
    t.scaleX = percentToMultiplier(scaleX);
    t.scaleY = percentToMultiplier(scaleY);
    t.rotationRadians = degreesToRadians(rotDeg);
    Vec2 a = pointPercentToNorm(ancPx, ancPy);
    t.anchorNormX = a.x;
    t.anchorNormY = a.y;
    t.opacity = percentToOpacity(opacityPercent);
    return t;
}

// POPUP index -> permanent enum (ProgressMode / AlignmentMode).
inline ids::ProgressMode modeFromPopup(int idx) {
    return static_cast<ids::ProgressMode>(idx);
}
inline ids::AlignmentMode alignmentFromPopup(int idx) {
    return static_cast<ids::AlignmentMode>(idx);
}

}  // namespace native
}  // namespace statemotion

#endif  // STATEMOTION_NATIVE_ADAPTER_HPP
