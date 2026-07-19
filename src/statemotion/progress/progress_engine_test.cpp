// StateMotion — Phase 0.1 vertical slice: progress engine unit tests + fixture parity.
//
// Self-contained (no framework, no JSON dependency): a tiny fixture reader sufficient
// for shared/schema/progress-fixtures.json, plus the renderer integration check. Both
// C++ and TS read the SAME committed fixture; neither generates expected values for
// the other. Parity tolerance 1e-6 (ticket 015).

#include "progress_engine.h"
#include "transform_render.h"  // existing CPU renderer (integration)

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

using statemotion::ProgressInput;
using statemotion::ProgressOutput;
using statemotion::ids::ProgressMode;
using statemotion::ids::AlignmentMode;

int failures = 0;
void check(bool ok, const char* name) {
    std::printf("%s  %s\n", ok ? "PASS" : "FAIL", name);
    if (!ok) ++failures;
}

double maxErr(double a, double b) { return std::abs(a - b); }

// ---- minimal JSON reader (test-only) ---------------------------------------
// Supports exactly what progress-fixtures.json uses: objects, arrays, numbers,
// strings, booleans, nested. Enough and no more (Ponytail: no JSON dependency).

struct JsonValue {
    enum Type { Null, Bool, Num, Str, Arr, Obj } type = Null;
    bool b = false;
    double num = 0.0;
    std::string str;
    std::vector<JsonValue> arr;
    std::vector<std::pair<std::string, JsonValue>> obj;
};

// Strict fixture-number conversion (test-only). Accepts a real JSON number or one
// of the explicit sentinels "nan"/"inf"/"-inf". Any other string (e.g. "nonfinite")
// is rejected, never silently coerced to a finite value.
double parseFixtureNumber(const JsonValue& value) {
    if (value.type == JsonValue::Num) {
        return value.num;
    }
    if (value.type != JsonValue::Str) {
        throw std::runtime_error("Expected a numeric fixture value or supported sentinel");
    }
    if (value.str == "nan") {
        static_assert(std::numeric_limits<double>::has_quiet_NaN,
                      "Tests require quiet NaN support");
        return std::numeric_limits<double>::quiet_NaN();
    }
    if (value.str == "inf") {
        return std::numeric_limits<double>::infinity();
    }
    if (value.str == "-inf") {
        return -std::numeric_limits<double>::infinity();
    }
    throw std::runtime_error("Unknown numeric fixture sentinel: " + value.str);
}

struct Parser {
    const char* p;
    JsonValue parse() {
        while (*p == ' ' || *p == '\n' || *p == '\t' || *p == '\r' || *p == ',') ++p;
        if (*p == '{') return parseObj();
        if (*p == '[') return parseArr();
        if (*p == '"') return parseStr();
        if (*p == 't' || *p == 'f') return parseBool();
        return parseNumber();
    }
    JsonValue parseObj() {
        JsonValue v; v.type = JsonValue::Obj; ++p;
        while (true) {
            while (*p == ' ' || *p == '\n' || *p == '\t' || *p == '\r' || *p == ',') ++p;
            if (*p == '}') { ++p; break; }
            JsonValue key = parseStr();
            while (*p == ' ' || *p == ':' || *p == '\n' || *p == '\t' || *p == '\r') ++p;
            JsonValue val = parse();
            v.obj.push_back({ key.str, val });
        }
        return v;
    }
    JsonValue parseArr() {
        JsonValue v; v.type = JsonValue::Arr; ++p;
        while (true) {
            while (*p == ' ' || *p == '\n' || *p == '\t' || *p == '\r' || *p == ',') ++p;
            if (*p == ']') { ++p; break; }
            v.arr.push_back(parse());
        }
        return v;
    }
    JsonValue parseStr() {
        JsonValue v; v.type = JsonValue::Str; ++p;  // skip opening quote
        std::string s;
        while (*p && *p != '"') {
            if (*p == '\\' && *(p + 1) == '"') { s += '"'; p += 2; }
            else { s += *p; ++p; }
        }
        if (*p == '"') ++p;
        v.str = s;
        return v;
    }
    JsonValue parseBool() {
        JsonValue v; v.type = JsonValue::Bool;
        if (std::strncmp(p, "true", 4) == 0) { v.b = true; p += 4; }
        else { v.b = false; p += 5; }
        return v;
    }
    JsonValue parseNumber() {
        JsonValue v; v.type = JsonValue::Num;
        const char* start = p;
        while (*p && (std::strchr("0123456789+-.eE", *p))) ++p;
        v.str.assign(start, p);
        v.num = std::strtod(v.str.c_str(), nullptr);
        return v;
    }
};

const JsonValue* find(const JsonValue& obj, const std::string& key) {
    for (const auto& kv : obj.obj) if (kv.first == key) return &kv.second;
    return nullptr;
}

double getNum(const JsonValue& obj, const std::string& key, double def = 0.0) {
    const JsonValue* v = find(obj, key);
    if (!v) return def;
    return parseFixtureNumber(*v);
}

// fixture "input" may store a non-finite field as an explicit sentinel string.
double getNumOrStr(const JsonValue& obj, const std::string& key) {
    const JsonValue* v = find(obj, key);
    if (!v) return 0.0;
    return parseFixtureNumber(*v);
}

// ---- fixture-driven parity ------------------------------------------------

ProgressInput inputFromFixture(const JsonValue& in) {
    ProgressInput pi;
    pi.visibleElapsedSeconds = getNumOrStr(in, "visibleElapsedSeconds");
    pi.visibleDurationSeconds = getNumOrStr(in, "visibleDurationSeconds");
    pi.transitionDurationSeconds = getNumOrStr(in, "transitionDurationSeconds");
    pi.delaySeconds = getNumOrStr(in, "delaySeconds");
    pi.alignment = static_cast<AlignmentMode>(static_cast<int>(getNum(in, "alignment")));
    pi.mode = static_cast<ProgressMode>(static_cast<int>(getNum(in, "mode")));
    pi.manualProgress = getNumOrStr(in, "manualProgress");
    return pi;
}

void runFixture(const JsonValue& fixture) {
    const JsonValue* cases = find(fixture, "cases");
    if (!cases) { check(false, "fixture has cases"); return; }
    int n = 0;
    for (const auto& c : cases->arr) {
        const JsonValue* input = find(c, "input");
        const JsonValue* expected = find(c, "expected");
        if (!input || !expected) continue;
        const JsonValue* okv = find(*expected, "ok");
        ProgressInput pi = inputFromFixture(*input);
        ProgressOutput out = statemotion::evaluateProgress(pi);
        std::string name = c.obj.empty() ? "case" : find(c, "name")->str;
        if (okv && okv->type == JsonValue::Bool && !okv->b) {
            // expected invalid
            const JsonValue* errv = find(*expected, "error");
            bool ok = (!out.ok) && (errv && errv->str == "NonFiniteInput");
            check(ok, ("invalid: " + name).c_str());
        } else {
            double lin = getNum(*expected, "linearProgress");
            double eas = getNum(*expected, "easedProgress");
            bool ok = out.ok &&
                      maxErr(out.result.linearProgress, lin) < 1e-6 &&
                      maxErr(out.result.easedProgress, eas) < 1e-6;
            check(ok, ("fixture: " + name).c_str());
        }
        ++n;
    }
    std::printf("    (%d fixture cases)\n", n);
}

// ---- dense sampling --------------------------------------------------------

void runDense(const JsonValue& fixture) {
    const JsonValue* dense = find(fixture, "dense");
    if (!dense) { check(false, "fixture has dense config"); return; }
    int samples = static_cast<int>(getNum(*dense, "samples", 10001));
    double tol = getNum(*dense, "tolerance", 1e-9);
    ProgressInput pi;
    pi.alignment = static_cast<AlignmentMode>(static_cast<int>(getNum(*dense, "alignment")));
    pi.mode = static_cast<ProgressMode>(static_cast<int>(getNum(*dense, "mode")));
    pi.visibleDurationSeconds = getNum(*dense, "visibleDurationSeconds");
    pi.transitionDurationSeconds = getNum(*dense, "transitionDurationSeconds");
    pi.delaySeconds = getNum(*dense, "delaySeconds");
    bool allFinite = true;
    double worst = 0.0;
    for (int i = 0; i < samples; ++i) {
        double q = static_cast<double>(i) / (samples - 1);  // 0..1
        pi.visibleElapsedSeconds = q;  // ENTIRE_CLIP-like: elapsed/dur == q
        ProgressOutput out = statemotion::evaluateProgress(pi);
        if (!out.ok || !std::isfinite(out.result.easedProgress)) { allFinite = false; break; }
        // reference: easing for AToB + ENTIRE_CLIP (elapsed==q*dur); default is EASE_IN_OUT
        double ref = statemotion::evaluateEasing(pi.easing, pi.curve, q);
        worst = std::max(worst, maxErr(out.result.easedProgress, ref));
    }
    check(allFinite && worst < tol, "dense 10001-sample finite + smoothstep within tolerance");
    std::printf("    (worst abs err %.2e)\n", worst);
}

// ---- integration with existing CPU renderer -------------------------------

void runIntegration() {
    // Prove easedProgress drives State A/B interpolation rendered by the CPU renderer.
    using statemotion::RendererTransformState;
    RendererTransformState a, b;
    // A: no transform; B: translate +1,+1, scale 1.5, opacity 0.5.
    b.positionX = 1.0; b.positionY = 1.0; b.scaleX = 1.5; b.scaleY = 1.5; b.opacity = 0.5;

    ProgressInput pi;
    pi.mode = ProgressMode::AToB;
    pi.alignment = AlignmentMode::EntireClip;
    pi.visibleDurationSeconds = 1.0;
    pi.visibleElapsedSeconds = 0.5;  // q = 0.5 -> eased = smoothstep(0.5) = 0.5

    ProgressOutput out = statemotion::evaluateProgress(pi);
    check(out.ok, "integration: evaluateProgress ok at q=0.5");

    RendererTransformState interp = statemotion::interpolate(a, b, out.result.easedProgress);
    // at eased=0.5: position 0.5,0.5; scale 1.25; opacity 0.75.
    bool midOk = maxErr(interp.positionX, 0.5) < 1e-9 &&
                 maxErr(interp.scaleX, 1.25) < 1e-9 &&
                 maxErr(interp.opacity, 0.75) < 1e-9;
    check(midOk, "integration: easedProgress=0.5 -> interpolated midpoint transform");

    // Render A and interpolated-B; assert the animation actually changes pixels.
    const int W = 4, H = 4;
    auto sampler = [](void* u, int x, int y) -> statemotion::Pixel {
        auto* s = static_cast<statemotion::Pixel*>(u);
        return s[y * 4 + x];
    };
    statemotion::Pixel* src = new statemotion::Pixel[W * H];
    for (int i = 0; i < W * H; ++i) { src[i].r = 0.5; src[i].g = 0.5; src[i].b = 0.5; src[i].a = 0.5; }
    std::vector<statemotion::Pixel> outA(W * H), outMid(W * H);
    auto planA = statemotion::plan(a, W, H);
    auto planMid = statemotion::plan(interp, W, H);
    statemotion::render(planA, sampler, src, W, H, outA.data());
    statemotion::render(planMid, sampler, src, W, H, outMid.data());
    bool changed = false;
    for (int i = 0; i < W * H; ++i) changed |= maxErr(outA[i].a, outMid[i].a) > 1e-9;
    check(changed, "integration: easedProgress-driven render differs from identity-A render");
    delete[] src;
}

// ---- focused fixture-number reader tests --------------------------------

void runFixtureReaderTests() {
    std::printf("== fixture-number reader (C++) ==\n");
    // ordinary number -> same finite number
    {
        JsonValue v; v.type = JsonValue::Num; v.num = 1.25;
        double r = parseFixtureNumber(v);
        check(!std::isnan(r) && std::isfinite(r) && maxErr(r, 1.25) < 1e-12,
              "reader: number -> same finite value");
    }
    // "nan"
    {
        JsonValue v; v.type = JsonValue::Str; v.str = "nan";
        double r = parseFixtureNumber(v);
        check(std::isnan(r) && !std::isfinite(r), "reader: \"nan\" -> isNaN && !isFinite");
    }
    // "inf"
    {
        JsonValue v; v.type = JsonValue::Str; v.str = "inf";
        double r = parseFixtureNumber(v);
        check(!std::isfinite(r) && r > 0 && std::isinf(r), "reader: \"inf\" -> +infinity");
    }
    // "-inf"
    {
        JsonValue v; v.type = JsonValue::Str; v.str = "-inf";
        double r = parseFixtureNumber(v);
        check(!std::isfinite(r) && r < 0 && std::isinf(r), "reader: \"-inf\" -> -infinity");
    }
    // unknown string -> throws
    {
        JsonValue v; v.type = JsonValue::Str; v.str = "nonfinite";
        bool threw = false;
        try { parseFixtureNumber(v); } catch (const std::exception& e) { threw = true; }
        check(threw, "reader: unknown string -> throws");
    }
    // non-number/non-string JSON value -> throws
    {
        JsonValue v; v.type = JsonValue::Bool; v.b = true;
        bool threw = false;
        try { parseFixtureNumber(v); } catch (const std::exception& e) { threw = true; }
        check(threw, "reader: bool value -> throws");
        JsonValue o; o.type = JsonValue::Obj;
        threw = false;
        try { parseFixtureNumber(o); } catch (const std::exception& e) { threw = true; }
        check(threw, "reader: object value -> throws");
    }
}

}  // namespace

int main() {
    // load fixture
    FILE* f = std::fopen("shared/schema/progress-fixtures.json", "rb");
    if (!f) { check(false, "open progress-fixtures.json"); return 1; }
    std::string buf; char ch;
    while (std::fread(&ch, 1, 1, f) == 1) buf += ch;
    std::fclose(f);

    Parser parser; parser.p = buf.c_str();
    JsonValue fixture = parser.parse();

    std::printf("== progress engine fixture parity (C++) ==\n");
    runFixtureReaderTests();
    runFixture(fixture);
    runDense(fixture);
    runIntegration();

    std::printf("\n%s: %d failures\n", failures ? "FAILED" : "ALL PASSED", failures);
    return failures ? 1 : 0;
}
