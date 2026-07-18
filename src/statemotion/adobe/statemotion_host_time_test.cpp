// StateMotion - host-time adapter unit tests (pure, SDK-free). See plan Task 4.

#include "statemotion_host_time.hpp"

#include <cmath>
#include <cstdio>

namespace {
int g_fail = 0;
void check(bool ok, const char* n) {
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", n);
    if (!ok) ++g_fail;
}
}  // namespace

int main() {
    using namespace statemotion::host;

    // 60000 scale: frame at 30000 of 60000 total => 0.5s elapsed, 1.0s duration.
    auto p = buildProgressInput(30000, 60000, 60000,
        statemotion::ids::ProgressMode::AToB, statemotion::ids::AlignmentMode::EntireClip,
        1.0, 0.0, 0.0);
    check(std::abs(p.visibleElapsedSeconds - 0.5) < 1e-9, "elapsed 30000/60000");
    check(std::abs(p.visibleDurationSeconds - 1.0) < 1e-9, "duration 60000/60000");
    check(std::abs(p.transitionDurationSeconds - 1.0) < 1e-9, "duration passed through");
    check(p.mode == statemotion::ids::ProgressMode::AToB, "mode passed through");
    check(p.alignment == statemotion::ids::AlignmentMode::EntireClip, "alignment passed through");

    // Different scale (30000): 15000/30000 = 0.5s still.
    auto p2 = buildProgressInput(15000, 30000, 30000,
        statemotion::ids::ProgressMode::AToB, statemotion::ids::AlignmentMode::EntireClip,
        1.0, 0.0, 0.0);
    check(std::abs(p2.visibleElapsedSeconds - 0.5) < 1e-9, "elapsed scale-independent");

    // zero scale guard (treated as 1 to avoid divide-by-zero).
    auto z = buildProgressInput(30000, 60000, 0,
        statemotion::ids::ProgressMode::AToB, statemotion::ids::AlignmentMode::EntireClip,
        1.0, 0.0, 0.0);
    check(std::abs(z.visibleElapsedSeconds - 30000.0) < 1e-9, "zero scale guarded (scale=1)");

    // manual 0..100 -> 0..1 (native units).
    auto m = buildProgressInput(0, 100, 100,
        statemotion::ids::ProgressMode::Manual, statemotion::ids::AlignmentMode::ClipStart,
        0.0, 0.0, 50.0);
    check(std::abs(m.manualProgress - 0.5) < 1e-9, "manual 50 -> 0.5");
    auto m2 = buildProgressInput(0, 100, 100,
        statemotion::ids::ProgressMode::Manual, statemotion::ids::AlignmentMode::ClipStart,
        0.0, 0.0, 100.0);
    check(std::abs(m2.manualProgress - 1.0) < 1e-9, "manual 100 -> 1.0");
    auto m3 = buildProgressInput(0, 100, 100,
        statemotion::ids::ProgressMode::Manual, statemotion::ids::AlignmentMode::ClipStart,
        0.0, 0.0, 0.0);
    check(std::abs(m3.manualProgress) < 1e-12, "manual 0 -> 0.0");
    auto mo = buildProgressInput(0, 100, 100,
        statemotion::ids::ProgressMode::Manual, statemotion::ids::AlignmentMode::ClipStart,
        0.0, 0.0, 250.0);
    check(std::abs(mo.manualProgress - 1.0) < 1e-12, "manual >100 clamps to 1");

    std::printf("\n%s: %d failures\n", g_fail ? "FAILED" : "ALL PASSED", g_fail);
    return g_fail ? 1 : 0;
}
