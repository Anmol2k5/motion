// StateMotion native parameter-registration consistency test.
//
// Host-independent: includes only the generated contract headers (no Adobe SDK,
// no mocked suites). Proves the Phase 0.1 registration described in
// statemotion_effect.cpp is consistent with the generated contract.

#include <cstdio>
#include <cstring>

#include "parameter_ids.hpp"
#include "parameter_bindings.hpp"

namespace {

int g_failures = 0;

void check(bool cond, const char *msg) {
    if (!cond) {
        std::printf("FAIL  %s\n", msg);
        ++g_failures;
    }
}

const statemotion::contract::ParameterBinding* findBindingByDiskId(int diskId) {
    using namespace statemotion::contract;
    const int n = static_cast<int>(sizeof(kBindings) / sizeof(kBindings[0]));
    for (int i = 0; i < n; ++i) {
        if (kBindings[i].diskId == diskId) return &kBindings[i];
    }
    return nullptr;
}

} // namespace

int main() {
    using namespace statemotion::contract;
    using namespace statemotion::ids;

    const int n = static_cast<int>(sizeof(kBindings) / sizeof(kBindings[0]));

    // Exactly 70 active custom contract entries.
    check(n == 70, "exactly 70 active custom contract entries");
    check(n == kParameterCount, "generated kParameterCount equals 70");

    // No active disk ID is 0; all unique.
    bool seen[10000] = {false};
    for (int i = 0; i < n; ++i) {
        const int id = kBindings[i].diskId;
        check(id > 0 && id < 10000, "valid disk ID range");
        check(!seen[id], "all disk IDs are unique");
        seen[id] = true;
    }

    // Popup item count matches generated enum count; ordering matches permanent numeric values.
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
            else if (std::strcmp(b.enumRef, "EasingMode") == 0) expectedCount = 7;
            char buf[128];
            std::snprintf(buf, sizeof(buf),
                          "popup %s enum count %d matches %d",
                          b.logicalId, b.enumCount, expectedCount);
            check(b.enumCount == expectedCount, buf);
        }
    }

    // Parameter-count metadata is 70; schema/binding revision match generated.
    check(kParameterCount == 70, "parameter count metadata is 70");
    check(kSchemaVersion == 1, "schema version matches generated contract (1)");
    check(kBindingRevision == 4, "binding revision matches generated contract (4)");

    // Metadata entries are hidden.
    for (int i = 0; i < 3; ++i) {
        check(kBindings[i].stateOwnership[0] == 'm',
              "first three bindings are metadata (hidden)");
    }

    // Position and anchor remain POINT; rotation remains ANGLE; scale/opacity remain percentage float sliders.
    auto checkType = [](int diskId, const char* expectedType, const char* name) {
        const auto* b = findBindingByDiskId(diskId);
        char buf[128];
        std::snprintf(buf, sizeof(buf), "%s matches nativeType %s", name, expectedType);
        check(b && std::strcmp(b->nativeType, expectedType) == 0, buf);
    };

    checkType(kTransformPositionA, "POINT", "position.a");
    checkType(kTransformPositionB, "POINT", "position.b");
    checkType(kTransformAnchorA, "POINT", "anchor.a");
    checkType(kTransformAnchorB, "POINT", "anchor.b");
    checkType(kTransformRotationA, "ANGLE", "rotation.a");
    checkType(kTransformRotationB, "ANGLE", "rotation.b");
    checkType(kTransformScaleXA, "FLOAT_SLIDER", "scaleX.a");
    checkType(kTransformScaleXB, "FLOAT_SLIDER", "scaleX.b");
    checkType(kTransformScaleYA, "FLOAT_SLIDER", "scaleY.a");
    checkType(kTransformScaleYB, "FLOAT_SLIDER", "scaleY.b");
    checkType(kTransformOpacityA, "FLOAT_SLIDER", "opacity.a");
    checkType(kTransformOpacityB, "FLOAT_SLIDER", "opacity.b");

    // Only manual progress is time-varying.
    int keyframeableCount = 0;
    for (int i = 0; i < n; ++i) {
        if (kBindings[i].timeVariance[0] == 'k') ++keyframeableCount;
    }
    check(keyframeableCount == 1, "exactly one parameter is keyframeable");
    const auto* manualB = findBindingByDiskId(kTransitionManualProgress);
    check(manualB && std::strcmp(manualB->logicalId, "transition.manualProgress") == 0,
          "the keyframeable parameter is transition.manualProgress");

    if (g_failures == 0) {
        std::printf("ALL PASSED: 0 failures\n");
        return 0;
    }
    std::printf("\nFAILURES: %d\n", g_failures);
    return 1;
}
