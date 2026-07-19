// StateMotion — easing evaluator. Host-independent, single source of truth.
//
// Shared mathematical contract between C++ and TypeScript. Both implementations
// MUST be line-for-line identical and driven by the same JSON fixture
// (shared/fixtures/easing-fixtures.json). No dependencies.
//
// Named modes resolve to fixed StateMotion-owned curves. CUSTOM uses a cubic
// Bezier timing function P0=(0,0) P1=(x1,y1) P2=(x2,y2) P3=(1,1).

#ifndef STATEMOTION_EASING_H
#define STATEMOTION_EASING_H

#include <cmath>

namespace statemotion {

enum class EasingMode {
    LINEAR = 0,
    EASE_IN = 1,
    EASE_OUT = 2,
    EASE_IN_OUT = 3,
    CUSTOM = 4
};

struct EasingCurve {
    double x1 = 1.0 / 3.0;  // legacy smoothstep-equivalent (BezierX=t), see easing-system-design.md
    double y1 = 0.0;
    double x2 = 2.0 / 3.0;
    double y2 = 1.0;
};

// Evaluate easing. `linear` is clamped to [0,1]; result in [0,1].
// Invalid/non-finite control points or input fall back deterministically to
// `linear` (identity). No throw, no NaN.
double evaluateEasing(EasingMode mode, const EasingCurve& curve, double linear);

}  // namespace statemotion

#endif  // STATEMOTION_EASING_H
