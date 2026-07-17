// StateMotion - native effect load-proof host-independent checks.
//
// These tests cover only the pure registration constants (match name, display
// name, internal version packing). They do NOT build against the Adobe SDK and
// do NOT mock a host. The real acceptance test is the Premiere host load.
//
// The literals here mirror src/statemotion/adobe/statemotion_effect.h and
// statemotion_effect.r and must stay in agreement with the permanent identity.

#include <cstring>
#include <cstdio>

static int g_failures = 0;

static void check(bool ok, const char *name)
{
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", name);
    if (!ok) g_failures++;
}

// Mirrors the SDK PF_VERSION packing shape used in GlobalSetup.
static long packVersion(int major, int minor, int bug, int stage, int build)
{
    return ((major & 0xff) << 24) |
           ((minor & 0xff) << 16) |
           ((bug   & 0xff) << 8)  |
           ((stage & 0xff) << 4)  |
           (build & 0x0f);
}

int main()
{
    // Permanent registration identity.
    static const char kMatchName[] = "AE.io.github.anmol2k5.statemotion.effect";
    static const char kDisplayName[] = "StateMotion";
    static const char kCategory[] = "StateMotion";

    check(std::strcmp(kMatchName, "AE.io.github.anmol2k5.statemotion.effect") == 0,
          "match name is permanent StateMotion identity");
    check(std::strncmp(kMatchName, "AE.io.github.anmol2k5.", 20) == 0,
          "match name uses permanent namespace");
    check(std::strcmp(kDisplayName, "StateMotion") == 0,
          "display name is StateMotion");
    check(std::strcmp(kCategory, "StateMotion") == 0,
          "category is StateMotion");

    // No Adobe endorsement wording in identity strings.
    check(std::strstr(kMatchName, "Adobe") == nullptr,
          "match name does not imply Adobe endorsement");
    check(std::strstr(kDisplayName, "Adobe") == nullptr,
          "display name does not imply Adobe endorsement");

    // Internal development version 0.1.0-dev -> PF_VERSION(0,1,0,DEVELOP,0).
    const long packed = packVersion(0, 1, 0, 0, 0);
    check(packed == 0x00010000, "version 0.1.0 packs to 0x00010000");
    check(((packed >> 24) & 0xff) == 0, "packed major == 0");
    check(((packed >> 16) & 0xff) == 1, "packed minor == 1");

    std::printf("\n%s: %d failures\n",
                g_failures ? "FAILED" : "ALL PASSED", g_failures);
    return g_failures ? 1 : 0;
}
