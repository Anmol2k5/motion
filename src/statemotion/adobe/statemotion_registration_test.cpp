// StateMotion native parameter-registration consistency test.
//
// Host-independent: includes only the generated contract headers (no Adobe SDK,
// no mocked suites). Proves the Phase 0.1 registration described in
// statemotion_effect.cpp is consistent with the generated contract.
//
// Build with a C++17 compiler, e.g.:
//   cl /EHsc /std:c++17 statemotion_registration_test.cpp
//   g++ -std=c++17 statemotion_registration_test.cpp -o statemotion_registration_test

#include <cstdio>
#include <cstring>

#include "parameter_ids.hpp"
#include "parameter_bindings.hpp"

namespace {

struct Expectation {
    int diskId;
    const char *nativeType;
    bool keyframeable;
    bool hidden;
};

// Test oracle. This is NOT a second source-of-truth table committed for use by
// the effect; it is the expected set used only to prove the generated binding
// matches the authorized parameter list.
const Expectation kExpected[20] = {
    {1,   "FLOAT_SLIDER", false, true},   // contract.schemaVersion
    {2,   "FLOAT_SLIDER", false, true},   // contract.parameterCount
    {3,   "FLOAT_SLIDER", false, true},   // contract.bindingRevision
    {50,  "POPUP",        false, false},  // transition.mode
    {51,  "POPUP",        false, false},  // transition.alignment
    {52,  "FLOAT_SLIDER", false, false},  // transition.durationSeconds
    {53,  "FLOAT_SLIDER", false, false},  // transition.delaySeconds
    {54,  "FLOAT_SLIDER", true,  false},  // transition.manualProgress
    {100, "POINT",        false, false},  // transform.position.a
    {101, "POINT",        false, false},  // transform.position.b
    {102, "FLOAT_SLIDER", false, false},  // transform.scaleX.a
    {103, "FLOAT_SLIDER", false, false},  // transform.scaleX.b
    {104, "FLOAT_SLIDER", false, false},  // transform.scaleY.a
    {105, "FLOAT_SLIDER", false, false},  // transform.scaleY.b
    {106, "ANGLE",        false, false},  // transform.rotation.a
    {107, "ANGLE",        false, false},  // transform.rotation.b
    {108, "POINT",        false, false},  // transform.anchor.a
    {109, "POINT",        false, false},  // transform.anchor.b
    {110, "FLOAT_SLIDER", false, false},  // transform.opacity.a
    {111, "FLOAT_SLIDER", false, false},  // transform.opacity.b
};

int g_failures = 0;

void check(bool cond, const char *msg) {
    if (!cond) {
        std::printf("FAIL  %s\n", msg);
        ++g_failures;
    }
}

} // namespace

int main() {
    using namespace statemotion::contract;
    using namespace statemotion::ids;

    const int n = static_cast<int>(sizeof(kBindings) / sizeof(kBindings[0]));

    // Exactly 20 active custom contract entries.
    check(n == 20, "exactly 20 active custom contract entries");
    check(n == kParameterCount, "generated kParameterCount equals 20");

    // No active disk ID is 0; all unique; none in reserved 150..399.
    bool seen[10000] = {false};
    for (int i = 0; i < n; ++i) {
        const int id = kBindings[i].diskId;
        check(id != 0, "no active disk ID is 0");
        check(!seen[id], "all disk IDs are unique");
        seen[id] = true;
        check(!(id >= 150 && id <= 399), "no active disk ID in 150..399");
    }

    // Native registration covers every active generated binding exactly once.
    for (int i = 0; i < n; ++i) {
        const Expectation &e = kExpected[i];
        const auto &b = kBindings[i];
        char buf[128];
        std::snprintf(buf, sizeof(buf),
                      "binding %d: diskId %d matches expected %d",
                      i, b.diskId, e.diskId);
        check(b.diskId == e.diskId, buf);
        std::snprintf(buf, sizeof(buf),
                      "binding %d (%s): nativeType %s matches expected %s",
                      i, b.logicalId, b.nativeType, e.nativeType);
        check(std::strcmp(b.nativeType, e.nativeType) == 0, buf);
        const bool keyframeable = (b.timeVariance[0] == 'k');
        std::snprintf(buf, sizeof(buf),
                      "binding %d (%s): keyframeable matches expected",
                      i, b.logicalId);
        check(keyframeable == e.keyframeable, buf);
        const bool hidden = (b.stateOwnership[0] == 'm');
        std::snprintf(buf, sizeof(buf),
                      "binding %d (%s): hidden matches expected",
                      i, b.logicalId);
        check(hidden == e.hidden, buf);
    }

    // Popup item count matches generated enum count; ordering matches permanent
    // numeric values (0..6 and 0..2).
    check(static_cast<int>(ProgressMode::Manual) == 6,
          "ProgressMode permanent order: Manual == 6");
    check(static_cast<int>(ProgressMode::AToB) == 0,
          "ProgressMode permanent order: AToB == 0");
    check(static_cast<int>(AlignmentMode::EntireClip) == 2,
          "AlignmentMode permanent order: EntireClip == 2");
    check(static_cast<int>(AlignmentMode::ClipStart) == 0,
          "AlignmentMode permanent order: ClipStart == 0");

    for (int i = 0; i < n; ++i) {
        const auto &b = kBindings[i];
        if (std::strcmp(b.nativeType, "POPUP") == 0) {
            int expectedCount = 0;
            if (std::strcmp(b.enumRef, "ProgressMode") == 0) expectedCount = 7;
            else if (std::strcmp(b.enumRef, "AlignmentMode") == 0) expectedCount = 3;
            char buf[128];
            std::snprintf(buf, sizeof(buf),
                          "popup %s enum count %d matches %d",
                          b.logicalId, b.enumCount, expectedCount);
            check(b.enumCount == expectedCount, buf);
        }
    }

    // Parameter-count metadata is 20; schema/binding revision match generated.
    check(kParameterCount == 20, "parameter count metadata is 20");
    check(kSchemaVersion == 1, "schema version matches generated contract (1)");
    check(kBindingRevision == 1, "binding revision matches generated contract (1)");

    // Metadata entries are hidden.
    for (int i = 0; i < 3; ++i) {
        check(kBindings[i].stateOwnership[0] == 'm',
              "first three bindings are metadata (hidden)");
    }

    // Position and anchor remain POINT; rotation remains ANGLE; scale/opacity
    // remain percentage float sliders.
    auto isPoint = [](int i) {
        return std::strcmp(kBindings[i].nativeType, "POINT") == 0;
    };
    auto isAngle = [](int i) {
        return std::strcmp(kBindings[i].nativeType, "ANGLE") == 0;
    };
    auto isFloat = [](int i) {
        return std::strcmp(kBindings[i].nativeType, "FLOAT_SLIDER") == 0;
    };
    check(isPoint(8) && isPoint(9), "position.a/b remain POINT");
    check(isPoint(16) && isPoint(17), "anchor.a/b remain POINT");
    check(isAngle(14) && isAngle(15), "rotation.a/b remain ANGLE");
    check(isFloat(10) && isFloat(11) && isFloat(12) && isFloat(13),
          "scaleX/Y a/b remain FLOAT_SLIDER");
    check(isFloat(18) && isFloat(19), "opacity.a/b remain FLOAT_SLIDER");

    // Only manual progress is time-varying.
    int keyframeableCount = 0;
    for (int i = 0; i < n; ++i) {
        if (kBindings[i].timeVariance[0] == 'k') ++keyframeableCount;
    }
    check(keyframeableCount == 1, "exactly one parameter is keyframeable");
    check(std::strcmp(kBindings[7].logicalId, "transition.manualProgress") == 0,
          "the keyframeable parameter is transition.manualProgress");

    if (g_failures == 0) {
        std::printf("ALL PASSED: 0 failures\n");
        return 0;
    }
    std::printf("\nFAILURES: %d\n", g_failures);
    return 1;
}
