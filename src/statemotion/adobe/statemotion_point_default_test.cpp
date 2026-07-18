// Focused test: canonical point center [0.5,0.5] must resolve to the native
// POINT percentage [50,50] (fixed-point 3276800) and MUST NOT collapse to [0,0].
//
// Host-independent: includes only statemotion_point_default.hpp (no Adobe SDK).
// Proves the registration-time POINT default conversion is correct.
//
// Build with a C++17 compiler, e.g.:
//   cl /EHsc /std:c++17 statemotion_point_default_test.cpp
//   g++ -std=c++17 statemotion_point_default_test.cpp -o statemotion_point_default_test

#include <cstdio>
#include "statemotion_point_default.hpp"

namespace {

int g_failures = 0;

void check(bool cond, const char *msg) {
    if (!cond) {
        std::printf("FAIL  %s\n", msg);
        ++g_failures;
    }
}

} // namespace

int main() {
    using namespace statemotion::point;

    // Canonical normalized center maps to percentage 50,50 (NOT 0,0).
    const PointPercent c = resolvePointCenter();
    check(c.x == 50.0, "point center x resolves to 50% (not 0)");
    check(c.y == 50.0, "point center y resolves to 50% (not 0)");
    check(!(c.x == 0.0 && c.y == 0.0), "point center is never [0,0]");

    // Canonical 0.5 must not be truncated to integer 0 before scaling.
    check(canonicalToPercent(0.5) == 50.0, "canonicalToPercent(0.5) == 50.0");

    // Native fixed-point 16.16 representation of 50% must be 3276800, not 0.
    const long fx = percentToFixed16_16(c.x);
    const long fy = percentToFixed16_16(c.y);
    check(fx == 3276800, "percentToFixed16_16(50) == 3276800");
    check(fy == 3276800, "percentToFixed16_16(50) == 3276800");
    check(!(fx == 0 || fy == 0), "fixed-point point default is never 0");

    if (g_failures == 0) {
        std::printf("ALL PASSED: 0 failures\n");
        return 0;
    }
    std::printf("\nFAILURES: %d\n", g_failures);
    return 1;
}
