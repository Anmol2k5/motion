// StateMotion — easing evaluator implementation. See easing.hpp.

#include "easing.hpp"

#include <algorithm>
#include <cmath>

namespace statemotion {

namespace {
    inline double clamp01(double x) { return std::clamp(x, 0.0, 1.0); }

    // Cubic Bezier basis.
    inline double bezier1(double t, double p0, double p1, double p2, double p3) {
        double u = 1.0 - t;
        return u * u * u * p0 + 3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t * p3;
    }

    // Cubic Bezier X(t) with P0=0, P3=1: x1, x2 are control x.
    inline double bezierX(double t, double x1, double x2) {
        return bezier1(t, 0.0, x1, x2, 1.0);
    }
    inline double bezierY(double t, double y1, double y2) {
        return bezier1(t, 0.0, y1, y2, 1.0);
    }
    inline double bezierXDeriv(double t, double x1, double x2) {
        // d/dt of X(t) = 3(1-t)^2 (x1 - 0) + 6(1-t)t (x2 - x1) + 3t^2 (1 - x2)
        double u = 1.0 - t;
        return 3.0 * u * u * x1 + 6.0 * u * t * (x2 - x1) + 3.0 * t * t * (1.0 - x2);
    }

    inline bool finite2(double x, double y) {
        return std::isfinite(x) && std::isfinite(y);
    }

    // Solve X(t) = targetX for t in [0,1] via Newton-Raphson with bisection
    // fallback. Returns clamped t.
    double solveBezierT(double targetX, double x1, double x2) {
        double tx = clamp01(targetX);
        if (tx <= 0.0) return 0.0;
        if (tx >= 1.0) return 1.0;
        double t = tx;  // good initial guess for monotonic-ish X
        for (int i = 0; i < 8; ++i) {
            double x = bezierX(t, x1, x2);
            double d = bezierXDeriv(t, x1, x2);
            if (std::abs(d) < 1e-6) break;          // flat derivative: bail to bisection
            double step = (x - tx) / d;
            double nt = t - step;
            if (nt < 0.0 || nt > 1.0) break;          // diverged: bail to bisection
            if (std::abs(step) < 1e-9) return nt;     // converged
            t = nt;
        }
        // Bounded binary subdivision fallback on t in [0,1].
        double lo = 0.0, hi = 1.0;
        t = tx;
        for (int i = 0; i < 40; ++i) {
            double x = bezierX(t, x1, x2);
            if (std::abs(x - tx) < 1e-9) return t;
            if (x < tx) lo = t; else hi = t;
            t = 0.5 * (lo + hi);
        }
        return t;
    }
}  // namespace

double evaluateEasing(EasingMode mode, const EasingCurve& curve, double linear) {
    if (!std::isfinite(linear)) return 0.0;  // non-finite input -> deterministic 0
    double x = clamp01(linear);

    switch (mode) {
        case EasingMode::LINEAR:
            return x;
        case EasingMode::EASE_IN:
            return x * x;
        case EasingMode::EASE_OUT: {
            double u = 1.0 - x;
            return 1.0 - u * u;
        }
        case EasingMode::EASE_IN_OUT:
            return x * x * (3.0 - 2.0 * x);
        case EasingMode::CUSTOM: {
            if (!finite2(curve.x1, curve.x2) || !finite2(curve.y1, curve.y2)) {
                return x;  // invalid control points -> deterministic linear fallback
            }
            double t = solveBezierT(x, curve.x1, curve.x2);
            return clamp01(bezierY(t, curve.y1, curve.y2));
        }
    }
    return x;  // unreachable; safe fallback
}

}  // namespace statemotion
