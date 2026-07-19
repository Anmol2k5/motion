// StateMotion — easing evaluator tests (SDK-free). Consumes the SAME fixture
// shared with TypeScript (shared/fixtures/easing-fixtures.json) for parity.
//
// Embedded minimal JSON reader (values/objects/arrays/strings/numbers/bools),
// dependency-free. Enough for our flat fixture only.

#include "easing.hpp"

using namespace statemotion;

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <string>
#include <vector>
#include <map>

namespace {

// --- tiny JSON (subset) ---
struct JVal {
    enum T { Null, Num, Str, Bool, Arr, Obj } t = Null;
    double num = 0;
    bool b = false;
    std::string str;
    std::vector<JVal> arr;
    std::map<std::string, JVal> obj;
};

struct Parser {
    const char* p;
    JVal parse() {
        skip();
        return parseValue();
    }
    void skip() { while (*p == ' ' || *p == '\n' || *p == '\r' || *p == '\t' || *p == ',') p++; }
    JVal parseValue() {
        skip();
        JVal v;
        if (*p == '{') { v.t = JVal::Obj; p++; parseObj(v); }
        else if (*p == '[') { v.t = JVal::Arr; p++; parseArr(v); }
        else if (*p == '"') { v.t = JVal::Str; v.str = parseStr(); }
        else if (*p == 't' || *p == 'f') { v.t = JVal::Bool; v.b = (*p == 't'); p += v.b ? 4 : 5; }
        else { v.t = JVal::Num; v.num = parseNum(); }
        return v;
    }
    void parseObj(JVal& v) {
        skip();
        while (*p && *p != '}') {
            skip();
            if (*p == '}') break;
            std::string key = parseStr();
            skip();
            if (*p == ':') p++;
            JVal val = parseValue();
            v.obj[key] = val;
            skip();
            if (*p == ',') p++;
        }
        if (*p == '}') p++;
    }
    void parseArr(JVal& v) {
        skip();
        while (*p && *p != ']') {
            skip();
            if (*p == ']') break;
            v.arr.push_back(parseValue());
            skip();
            if (*p == ',') p++;
        }
        if (*p == ']') p++;
    }
    std::string parseStr() {
        // assumes well-formed "..." (no escapes needed for our fixture keys/values)
        p++; // opening quote
        std::string s;
        while (*p && *p != '"') { s.push_back(*p); p++; }
        if (*p == '"') p++;
        return s;
    }
    double parseNum() {
        char* end = nullptr;
        double d = std::strtod(p, &end);
        p = end;
        return d;
    }
};

// --- fixture helpers ---
struct NamedCase { EasingMode mode; double progress; double eased; };
struct CustomCase { double x1, y1, x2, y2; double progress; double eased; };
struct InvalidCase { double x1, y1, x2, y2; double progress; double eased; };

EasingMode modeFromName(const std::string& s) {
    if (s == "LINEAR") return EasingMode::LINEAR;
    if (s == "EASE_IN") return EasingMode::EASE_IN;
    if (s == "EASE_OUT") return EasingMode::EASE_OUT;
    if (s == "EASE_IN_OUT") return EasingMode::EASE_IN_OUT;
    if (s == "CUSTOM") return EasingMode::CUSTOM;
    return EasingMode::LINEAR;
}

int loadFixture(const char* path, std::vector<NamedCase>& named, std::vector<CustomCase>& custom,
                std::vector<InvalidCase>& invalid, double& tol) {
    FILE* f = std::fopen(path, "rb");
    if (!f) { std::printf("fixture open failed: %s\n", path); return 1; }
    std::string buf; char c;
    while ((c = (char)std::fgetc(f)) != EOF) buf.push_back(c);
    std::fclose(f);
    Parser ps; ps.p = buf.c_str();
    JVal root = ps.parse();
    if (root.obj.count("tolerance")) tol = root.obj["tolerance"].num;
    for (const auto& e : root.obj["named"].arr) {
        named.push_back({ modeFromName(e.obj.at("mode").str), e.obj.at("progress").num, e.obj.at("eased").num });
    }
    for (const auto& e : root.obj["custom"].arr) {
        custom.push_back({ e.obj.at("x1").num, e.obj.at("y1").num, e.obj.at("x2").num, e.obj.at("y2").num,
                           e.obj.at("progress").num, e.obj.at("eased").num });
    }
    for (const auto& e : root.obj["invalid"].arr) {
        invalid.push_back({ e.obj.at("x1").num, e.obj.at("y1").num, e.obj.at("x2").num, e.obj.at("y2").num,
                            e.obj.at("progress").num, e.obj.at("eased").num });
    }
    return 0;
}

int failures = 0;
void check(bool ok, const char* name) {
    if (!ok) { std::printf("  FAIL: %s\n", name); failures++; }
}

}  // namespace

int main() {
    double tol = 1e-6;
    std::vector<NamedCase> named;
    std::vector<CustomCase> custom;
    std::vector<InvalidCase> invalid;
    if (loadFixture("shared/fixtures/easing-fixtures.json", named, custom, invalid, tol)) return 1;

    // Named modes vs fixture.
    for (const auto& c : named) {
        EasingCurve curve;  // unused for named modes
        double got = statemotion::evaluateEasing(c.mode, curve, c.progress);
        check(std::abs(got - c.eased) <= tol, ("named " + std::to_string((int)c.mode) +
               " p=" + std::to_string(c.progress)).c_str());
    }

    // Custom curves vs fixture.
    for (const auto& c : custom) {
        EasingCurve curve{ c.x1, c.y1, c.x2, c.y2 };
        double got = statemotion::evaluateEasing(EasingMode::CUSTOM, curve, c.progress);
        check(std::abs(got - c.eased) <= tol, "custom curve");
    }

    // Invalid control points -> linear fallback (feed NaN for x1).
    for (const auto& c : invalid) {
        EasingCurve curve{ std::nan(""), c.y1, c.x2, c.y2 };
        double got = statemotion::evaluateEasing(EasingMode::CUSTOM, curve, c.progress);
        check(std::abs(got - c.eased) <= tol, "invalid fallback");
    }

    // Endpoints exact for all named modes.
    for (int m = 0; m <= 4; m++) {
        EasingCurve curve;
        check(std::abs(statemotion::evaluateEasing((EasingMode)m, curve, 0.0)) < 1e-12, "endpoint0");
        check(std::abs(statemotion::evaluateEasing((EasingMode)m, curve, 1.0) - 1.0) < 1e-12, "endpoint1");
    }

    // Custom identity curve (0,0,1,1) == linear.
    {
        EasingCurve identity{ 0.0, 0.0, 1.0, 1.0 };
        check(std::abs(statemotion::evaluateEasing(EasingMode::CUSTOM, identity, 0.37) - 0.37) < 1e-9, "custom identity=linear");
    }

    // Non-finite input -> clamped identity (no NaN).
    {
        EasingCurve curve;
        double got = statemotion::evaluateEasing(EasingMode::EASE_IN_OUT, curve, NAN);
        check(std::isfinite(got), "nonfinite input finite");
    }

    if (failures) { std::printf("\nFAILED: %d failures\n", failures); return 1; }
    std::printf("\nALL PASSED: 0 failures\n");
    return 0;
}
