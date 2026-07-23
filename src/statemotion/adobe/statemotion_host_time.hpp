#ifndef STATEMOTION_HOST_TIME_HPP
#define STATEMOTION_HOST_TIME_HPP

#include "progress_engine.h"  // ProgressInput, ids::*

namespace statemotion { namespace host {

// Convert Premiere clip-local layer timing (PF_InData: current_time, total_time,
// time_scale; all in the same time_scale units) into the host-independent
// ProgressInput seconds model. Research 006 verifies current_time/total_time are
// clip-local layer time in Premiere, so this is the visible clip timeline for the
// supported footage/still workflow. The progress engine owns all alignment/mode
// semantics; this adapter only converts units. Native Manual Progress is 0..100.
inline ProgressInput buildProgressInput(long current_time, long total_time, long time_scale,
                                        ids::ProgressMode mode, ids::AlignmentMode alignment,
                                        double durationSeconds, double delaySeconds,
                                        double manualProgressNative,
                                        ids::EasingMode easing = ids::EasingMode::EaseInOut,
                                        EasingCurve curve = {}) {
    ProgressInput in;
    const double scale = (time_scale > 0) ? static_cast<double>(time_scale) : 1.0;
    in.visibleElapsedSeconds = static_cast<double>(current_time) / scale;
    in.visibleDurationSeconds = static_cast<double>(total_time) / scale;
    in.transitionDurationSeconds = durationSeconds;
    in.delaySeconds = delaySeconds;
    in.alignment = alignment;
    in.mode = mode;
    in.manualProgress = (manualProgressNative < 0.0)   ? 0.0
                        : (manualProgressNative > 100.0) ? 1.0
                                                        : manualProgressNative / 100.0;
    // Ignored by the progress engine unless mode == Manual.
    in.easing = static_cast<EasingMode>(static_cast<int>(easing));
    in.curve = curve;
    return in;
}

}  // namespace host
}  // namespace statemotion

#endif  // STATEMOTION_HOST_TIME_HPP
