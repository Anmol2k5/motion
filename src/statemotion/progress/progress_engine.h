// StateMotion — Phase 0.1 vertical slice: progress / alignment / curve engine.
//
// Host-independent. Pure functions over already-converted visible timeline values.
// Knows nothing about PF_InData, Adobe suites, ticks, frame rates, sequence objects,
// track items, clip speed, or any Premiere API (handoff + ticket 013/015). The later
// host adapter converts Premiere time -> ProgressInput; this file stays clean.
//
// Reuses the generated enum values from the parameter contract (no duplicated numbers).
// Clean-room: original implementation.

#ifndef STATEMOTION_PROGRESS_ENGINE_H
#define STATEMOTION_PROGRESS_ENGINE_H

#include "parameter_ids.hpp"  // generated: ids::ProgressMode, ids::AlignmentMode

#include <algorithm>
#include <cmath>

namespace statemotion {

// Fixed first-slice curve only (ticket 013/015). One small function, no
// curve-family abstraction, no cubic-bezier/spring/bounce/anticipation/overshoot.
inline double smoothstep(double t) {
    double x = std::clamp(t, 0.0, 1.0);
    return x * x * (3.0 - 2.0 * x);
}

enum class ProgressErrorCode { None, NonFiniteInput };

struct ProgressInput {
    double visibleElapsedSeconds = 0.0;
    double visibleDurationSeconds = 0.0;
    double transitionDurationSeconds = 0.0;
    double delaySeconds = 0.0;
    ids::AlignmentMode alignment = ids::AlignmentMode::ClipStart;
    ids::ProgressMode mode = ids::ProgressMode::AToB;
    double manualProgress = 0.0;
};

struct ProgressResult {
    double linearProgress = 0.0;   // alignment-derived 0..1 (or manualProgress)
    double easedProgress = 0.0;    // smoothstep-applied value driving A/B interpolation
};

struct ProgressOutput {
    bool ok = true;
    ProgressErrorCode error = ProgressErrorCode::None;
    ProgressResult result;
};

// Linear alignment progress q in [0,1] for non-manual modes.
double computeLinearProgress(ids::AlignmentMode alignment, double elapsed, double visibleDuration,
                             double transitionDuration, double delay);

// Pure progress evaluation. Returns finite {linearProgress, easedProgress} or
// ok=false with a typed error for non-finite inputs.
ProgressOutput evaluateProgress(const ProgressInput& input);

}  // namespace statemotion

#endif  // STATEMOTION_PROGRESS_ENGINE_H
