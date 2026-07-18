// StateMotion point-default conversion (host-independent, no Adobe SDK).
//
// POINT parameter defaults are semantic in the contract ("frameCenter" /
// "sourceCenter") and resolve to the frame center, expressed as a percentage
// (0..100, origin top-left) in the native Adobe POINT type. The native type
// stores percentages as fixed-point 16.16 (PF_Fixed), so 50% -> 50.0 * 65536.
//
// This header is the single source of truth for that conversion so both the
// native registration code and the unit tests use the identical logic, and a
// regression to [0,0] is impossible to ship unnoticed.

#ifndef STATEMOTION_POINT_DEFAULT_HPP
#define STATEMOTION_POINT_DEFAULT_HPP

#include <cstddef>

namespace statemotion { namespace point {

// Fixed-point 16.16 scale used by the Adobe POINT type for percentages.
inline constexpr double kFixed16_16 = 65536.0;

// Canonical normalized center (0.5, 0.5) -> percentage (50, 50).
// A canonical value outside [0,1] maps linearly; callers pass 0.5 for center.
inline double canonicalToPercent(double canonical) {
    return canonical * 100.0;
}

// Percentage (0..100) -> Adobe fixed-point 16.16 long (e.g. 50 -> 3276800).
inline long percentToFixed16_16(double percent) {
    return static_cast<long>(percent * kFixed16_16);
}

// Frame/source center as percentages. frameCenter and sourceCenter both
// resolve to the center, i.e. 50%,50%.
struct PointPercent {
    double x;
    double y;
};

inline PointPercent resolvePointCenter() {
    return PointPercent{canonicalToPercent(0.5), canonicalToPercent(0.5)};
}

} // namespace point
} // namespace statemotion

#endif // STATEMOTION_POINT_DEFAULT_HPP
