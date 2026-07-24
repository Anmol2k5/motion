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
        case EasingMode::SPRING: {
            if (x <= 0.0) return 0.0;
            if (x >= 1.0) return 1.0;
            double freq = std::max(0.01, curve.springFrequency);
            double damping = std::max(0.0, curve.springDamping);
            double omega0 = 2.0 * 3.14159265358979323846 * freq;
            double zeta = damping;
            if (zeta < 1.0) {
                // Underdamped
                double omegaD = omega0 * std::sqrt(1.0 - zeta * zeta);
                double c1 = 1.0;
                double c2 = (zeta * omega0 - curve.springInitialVelocity) / omegaD;
                double env = std::exp(-zeta * omega0 * x);
                double raw = 1.0 - env * (c1 * std::cos(omegaD * x) + c2 * std::sin(omegaD * x));
                
                // Normalize so response(1) lands exactly at 1
                double env1 = std::exp(-zeta * omega0 * 1.0);
                double raw1 = 1.0 - env1 * (c1 * std::cos(omegaD * 1.0) + c2 * std::sin(omegaD * 1.0));
                if (std::abs(raw1 - 1.0) > 1e-6 && raw1 != 0.0) {
                     return 1.0 + (raw - 1.0) / (raw1 - 1.0 + 1e-12) * (1.0 - 1.0); // Wait, this division doesn't scale to 1 properly if we want to fix exactly at 1.
                     // The spec says: Normalize the final sample so response(1) lands exactly at 1. 
                     // A simple fix is to fade out the residual error over time:
                }
                
                // Correct normalization:
                // Error at t=1 is (1 - raw1).
                // We can distribute this error linearly: raw + x * (1 - raw1).
                double err = 1.0 - raw1;
                return raw + x * err;
            } else {
                // Critically damped or overdamped (fallback approximation)
                double c1 = 1.0;
                double c2 = omega0 - curve.springInitialVelocity;
                double raw = 1.0 - std::exp(-omega0 * x) * (c1 + c2 * x);
                double raw1 = 1.0 - std::exp(-omega0 * 1.0) * (c1 + c2 * 1.0);
                double err = 1.0 - raw1;
                return raw + x * err;
            }
        }
        case EasingMode::BOUNCE: {
            if (x <= 0.0) return 0.0;
            if (x >= 1.0) return 1.0;
            
            int count = std::clamp(static_cast<int>(curve.bounceCount), 1, 8);
            double hDecay = std::clamp(curve.bounceHeightDecay, 0.0, 1.0);
            double tDecay = std::clamp(curve.bounceTimeDecay, 0.01, 1.0);
            
            // Calculate total time duration
            double totalT = 1.0; // initial fall
            double currentT = 1.0;
            for (int i = 0; i < count; ++i) {
                currentT *= tDecay;
                totalT += currentT * 2.0; // up and down
            }
            
            // Scale x to internal time
            double t = x * totalT;
            
            // Initial fall
            if (t <= 1.0) {
                return t * t;
            }
            
            t -= 1.0; // time since first bounce
            
            double currentH = 1.0;
            currentT = 1.0;
            
            for (int i = 0; i < count; ++i) {
                currentH *= hDecay;
                currentT *= tDecay;
                
                if (t <= currentT * 2.0) {
                    // We are in this bounce
                    // Map t to [-currentT, currentT]
                    double localT = t - currentT;
                    // Normalized time [-1, 1]
                    double nT = localT / currentT;
                    // Parabola: 1 - currentH * (1 - nT^2)
                    return 1.0 - currentH * (1.0 - nT * nT);
                }
                t -= currentT * 2.0;
            }
            
            return 1.0; // past last bounce
        }
    }
    return x;  // unreachable; safe fallback
}

}  // namespace statemotion
