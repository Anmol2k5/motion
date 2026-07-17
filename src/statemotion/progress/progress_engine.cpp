// StateMotion — Phase 0.1 vertical slice: progress engine implementation.
// See progress_engine.h for scope, clean-room note, and invalid-input rule.

#include "progress_engine.h"

#include <cmath>

namespace statemotion {

namespace {

bool finite(double v) { return std::isfinite(v); }

// Documented input rule (ticket 013 + handoff):
//  - Non-finite (NaN / +-Inf) on any timing/manual field -> rejected (typed error).
//  - Negative elapsed/delay/transitionDuration are normalized by clamping to 0.
//    Negative visibleDuration is handled per-alignment (rest state, see below).
double clampLower0(double v) { return v < 0.0 ? 0.0 : v; }

}  // namespace

double computeLinearProgress(ids::AlignmentMode alignment, double elapsed, double visibleDuration,
                             double transitionDuration, double delay) {
    elapsed = clampLower0(elapsed);
    delay = clampLower0(delay);
    transitionDuration = clampLower0(transitionDuration);

    if (alignment == ids::AlignmentMode::EntireClip) {
        // Ignores transitionDuration and delay. Zero/invalid visible duration is
        // deterministic destination (ticket 013: "ENTIRE_CLIP zero/invalid duration
        // -> deterministic destination").
        if (visibleDuration <= 0.0) return 1.0;
        return std::clamp(elapsed / visibleDuration, 0.0, 1.0);
    }

    // CLIP_START: window starts at `delay`. CLIP_END: window ends at visibleDuration-delay.
    if (alignment == ids::AlignmentMode::ClipStart) {
        if (visibleDuration <= 0.0) return 0.0;  // no timeline -> rest at start (A)
        const double ws = std::clamp(delay, 0.0, visibleDuration);
        const double we = std::clamp(delay + transitionDuration, 0.0, visibleDuration);
        if (we <= ws) return (elapsed >= ws) ? 1.0 : 0.0;  // instantaneous step
        return std::clamp((elapsed - ws) / (we - ws), 0.0, 1.0);
    }

    // ClipEnd
    if (visibleDuration <= 0.0) return 1.0;  // no timeline -> rest at destination (B)
    const double we = std::clamp(visibleDuration - delay, 0.0, visibleDuration);
    const double ws = std::clamp(visibleDuration - delay - transitionDuration, 0.0, visibleDuration);
    if (we <= ws) return (elapsed >= ws) ? 1.0 : 0.0;  // instantaneous step
    return std::clamp((elapsed - ws) / (we - ws), 0.0, 1.0);
}

ProgressOutput evaluateProgress(const ProgressInput& input) {
    ProgressOutput out;
    if (!finite(input.visibleElapsedSeconds) || !finite(input.visibleDurationSeconds) ||
        !finite(input.transitionDurationSeconds) || !finite(input.delaySeconds) ||
        !finite(input.manualProgress)) {
        out.ok = false;
        out.error = ProgressErrorCode::NonFiniteInput;
        return out;
    }

    double linear;
    if (input.mode == ids::ProgressMode::Manual) {
        linear = std::clamp(input.manualProgress, 0.0, 1.0);  // ignores alignment timing
    } else {
        linear = computeLinearProgress(input.alignment, input.visibleElapsedSeconds,
                                       input.visibleDurationSeconds, input.transitionDurationSeconds,
                                       input.delaySeconds);
    }
    out.result.linearProgress = linear;

    double eased = 0.0;
    switch (input.mode) {
        case ids::ProgressMode::HoldA:
            eased = 0.0;
            break;
        case ids::ProgressMode::HoldB:
            eased = 1.0;
            break;
        case ids::ProgressMode::Manual:
            eased = smoothstep(linear);
            break;
        case ids::ProgressMode::AToB:
            eased = smoothstep(linear);
            break;
        case ids::ProgressMode::BToA:
            eased = 1.0 - smoothstep(linear);
            break;
        case ids::ProgressMode::AToBToA:  // two independently-eased halves, never one triangle
            eased = (linear <= 0.5) ? smoothstep(2.0 * linear)
                                    : 1.0 - smoothstep(2.0 * linear - 1.0);
            break;
        case ids::ProgressMode::BToAToB:
            eased = (linear <= 0.5) ? 1.0 - smoothstep(2.0 * linear)
                                    : smoothstep(2.0 * linear - 1.0);
            break;
    }
    out.result.easedProgress = eased;
    return out;
}

}  // namespace statemotion
