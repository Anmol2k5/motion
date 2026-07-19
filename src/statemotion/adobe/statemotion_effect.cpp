// StateMotion native effect - entry point and CPU transform render.
//
// Registers the "StateMotion" effect with the permanent match name and its 20
// transform + progress parameters. Render() reads native params via disk-ID
// adapters, builds canonical A/B states, evaluates progress from clip-local
// host time, interpolates, converts to renderer units, and rasterizes through
// the existing verified CPU transform renderer.

#include <cstdio>
#include <cstring>
#include <vector>

#include "statemotion_effect.h"
#include "statemotion_point_default.hpp"
#include "statemotion_world_pixels.hpp"

// ---------------------------------------------------------------------------
// TEMPORARY diagnostics (systematic-debugging). Compile-time gated; NO logging
// framework, no user/media data. Enable per build:
//   /D SM_DIAG=1            -> emit numeric stage trace via OutputDebugStringA
//   /D SM_FORCE_IDENTITY=1  -> Render() runs a depth-agnostic raw identity copy
//                             ONLY (no params/progress/interp/renderer)
// Both default OFF so the production TU is unchanged.
// ---------------------------------------------------------------------------
#ifndef SM_DIAG
#define SM_DIAG 0
#endif
#ifndef SM_FORCE_IDENTITY
#define SM_FORCE_IDENTITY 0
#endif

#if SM_DIAG
static void smTrace(const char *msg) { OutputDebugStringA(msg); }
static void smTraceNum(const char *tag, long v) {
    char buf[128];
    ::sprintf(buf, "StateMotion %s=%ld\n", tag, v);
    OutputDebugStringA(buf);
}
#define SM_TRACE(m)       smTrace("StateMotion " m "\n")
#define SM_TRACE_NUM(t,v) smTraceNum((t), static_cast<long>(v))
#else
#define SM_TRACE(m)       ((void)0)
#define SM_TRACE_NUM(t,v) ((void)0)
#endif

// Minimal error-propagation macro: run the call and return on the first error.
#define SM_ERR(x)                    \
    do {                             \
        err = (x);                   \
        if (err != PF_Err_NONE)      \
            return err;              \
    } while (0)

static PF_Err
About(
    PF_InData   *in_data,
    PF_OutData  *out_data,
    PF_ParamDef *params[],
    PF_LayerDef *output)
{
    (void)in_data;
    (void)params;
    (void)output;

    ::sprintf(
        out_data->return_msg,
        "%s v%d.%d\r%s",
        STR(StrID_Name),
        STATEMOTION_MAJOR_VERSION,
        STATEMOTION_MINOR_VERSION,
        STR(StrID_Description));

    return PF_Err_NONE;
}

static PF_Err
GlobalSetup(
    PF_InData   *in_data,
    PF_OutData  *out_data,
    PF_ParamDef *params[],
    PF_LayerDef *output)
{
    out_data->my_version = PF_VERSION(
        STATEMOTION_MAJOR_VERSION,
        STATEMOTION_MINOR_VERSION,
        STATEMOTION_BUG_VERSION,
        STATEMOTION_STAGE_VERSION,
        STATEMOTION_BUILD_VERSION);

    // No capabilities beyond the mandatory software render are declared.
    out_data->out_flags = 0;

    return PF_Err_NONE;
}

static PF_Err
registerStateMotionParameters(
    PF_InData *in_data)
{
    PF_Err err = PF_Err_NONE;

    const auto &bindings = statemotion::contract::kBindings;
    const int count = static_cast<int>(
        sizeof(bindings) / sizeof(bindings[0]));

    for (int i = 0; i < count; ++i) {
        const auto &b = bindings[i];

        // Persistent identity is disk ID + native type + match name. Runtime
        // index (i+1, after the input layer at 0) is local only.
        const int diskId = b.diskId;

        PF_ParamDef def;
        AEFX_CLR_STRUCT(def);

        PF_STRCPY(def.name, b.wireName);
        def.uu.id = diskId;

        // Static params cannot vary over time in Phase 0.1; only manualProgress
        // is keyframeable. Old projects receive oldProjectDefault via the
        // USE_VALUE_FOR_OLD_PROJECTS mechanism (value field), while new projects
        // receive the contract default (dephault field).
        const bool keyframeable = (b.timeVariance[0] == 'k'); // "keyframeable"
        const PF_ParamFlags timeFlag =
            keyframeable ? static_cast<PF_ParamFlags>(0)
                         : PF_ParamFlag_CANNOT_TIME_VARY;
        const PF_ParamFlags oldFlag = PF_ParamFlag_USE_VALUE_FOR_OLD_PROJECTS;
        const bool hidden = (b.stateOwnership[0] == 'm'); // "metadata"
        if (hidden) {
            def.ui_flags = PF_PUI_INVISIBLE;
        }

        const char *nativeType = b.nativeType;

        if (::strcmp(nativeType, "FLOAT_SLIDER") == 0) {
            def.param_type = PF_Param_FLOAT_SLIDER;
            def.flags = static_cast<PF_ParamFlags>(timeFlag | oldFlag);
            def.u.fs_d.valid_min = static_cast<PF_FpShort>(b.validMin);
            def.u.fs_d.valid_max = static_cast<PF_FpShort>(b.validMax);
            def.u.fs_d.slider_min = static_cast<PF_FpShort>(b.uiMin);
            def.u.fs_d.slider_max = static_cast<PF_FpShort>(b.uiMax);
            // OLD-project value, NEW-project default.
            def.u.fs_d.value = static_cast<PF_FpLong>(b.oldDefaultNum);
            def.u.fs_d.dephault = static_cast<PF_FpShort>(b.defaultNum);
            def.u.fs_d.precision = static_cast<A_short>(b.precision);
            const bool percent = (::strstr(b.logicalId, "scale") != nullptr) ||
                                 (::strstr(b.logicalId, "opacity") != nullptr);
            def.u.fs_d.display_flags = percent
                ? PF_ValueDisplayFlag_PERCENT
                : PF_ValueDisplayFlag_NONE;
        } else if (::strcmp(nativeType, "POPUP") == 0) {
            def.param_type = PF_Param_POPUP;
            def.flags = static_cast<PF_ParamFlags>(timeFlag | oldFlag);
            // Choice labels follow the permanent enum numeric order.
            const char *items = "";
            if (::strcmp(b.enumRef, "ProgressMode") == 0) {
                items = "AToB|BToA|AToBToA|BToAToB|HoldA|HoldB|Manual";
            } else if (::strcmp(b.enumRef, "AlignmentMode") == 0) {
                items = "ClipStart|ClipEnd|EntireClip";
            } else if (::strcmp(b.enumRef, "EasingMode") == 0) {
                items = "Linear|EaseIn|EaseOut|EaseInOut|Custom";
            }
            def.u.pd.num_choices = static_cast<A_short>(b.enumCount);
            def.u.pd.dephault = static_cast<A_short>(b.defaultNum);
            def.u.pd.value = static_cast<PF_ParamValue>(b.oldDefaultNum);
            def.u.pd.u.namesptr = items;
        } else if (::strcmp(nativeType, "ANGLE") == 0) {
            def.param_type = PF_Param_ANGLE;
            def.flags = static_cast<PF_ParamFlags>(timeFlag | oldFlag);
            const double deg = b.defaultNum;
            def.u.ad.dephault = static_cast<PF_Fixed>(deg * 65536.0);
            def.u.ad.value = static_cast<PF_Fixed>(b.oldDefaultNum * 65536.0);
        } else if (::strcmp(nativeType, "POINT") == 0) {
            def.param_type = PF_Param_POINT;
            def.flags = static_cast<PF_ParamFlags>(timeFlag | oldFlag);
            // Per the official Adobe SDK (PF_PointDef): point dephaults are
            // percentages (0-100, origin top-left), fixed-point 16.16.
            // "frameCenter" / "sourceCenter" both resolve to 50%,50% via the
            // shared, test-guarded conversion in statemotion_point_default.hpp.
            const auto center = statemotion::point::resolvePointCenter();
            const PF_Fixed fx = static_cast<PF_Fixed>(
                statemotion::point::percentToFixed16_16(center.x));
            const PF_Fixed fy = static_cast<PF_Fixed>(
                statemotion::point::percentToFixed16_16(center.y));
            def.u.td.x_value = def.u.td.x_dephault = fx;
            def.u.td.y_value = def.u.td.y_dephault = fy;
            def.u.td.restrict_bounds = TRUE;
        } else {
            // Unknown native type from the contract: fail loudly rather than
            // register a malformed parameter.
            return PF_Err_BAD_CALLBACK_PARAM;
        }

        SM_ERR(PF_ADD_PARAM(in_data, -1, &def));
        if (err != PF_Err_NONE) {
            break;
        }
    }

    return err;
}

static PF_Err
ParamsSetup(
    PF_InData   *in_data,
    PF_OutData  *out_data,
    PF_ParamDef *params[],
    PF_LayerDef *output)
{
    PF_Err err = PF_Err_NONE;

    // Custom StateMotion parameters are registered after the SDK-mandated input
    // layer (index 0). Runtime order is local; persistent identity is the disk
    // ID + native type + match name.
    SM_ERR(registerStateMotionParameters(in_data));

    out_data->num_params = STATEMOTION_NUM_PARAMS +
        static_cast<A_short>(sizeof(statemotion::contract::kBindings) /
                             sizeof(statemotion::contract::kBindings[0]));

    return err;
}

// Map a permanent disk ID to the runtime parameter index used in params[].
// Runtime index = SDK input layer (0) + 1 + binding array position.
static int
smParamIndex(int diskId)
{
    const auto &b = statemotion::contract::kBindings;
    const int n = static_cast<int>(sizeof(b) / sizeof(b[0]));
    for (int i = 0; i < n; ++i) {
        if (b[i].diskId == diskId) return STATEMOTION_INPUT + 1 + i;
    }
    return -1;
}

// Query the ACTUAL host pixel format via PF_WorldSuite2 rather than guessing
// from world flags. Premiere's basic AE-effect path is ARGB32 (8u); ARGB64 is
// 16u; ARGB128 is 32-bit float. Returns true and sets depth on success. On any
// failure (suite/callback unavailable) falls back to PF_WORLD_IS_DEEP, and the
// caller can still choose a safe path.
static bool
smQueryWorldDepth(PF_InData *in_data, const PF_EffectWorld *world,
                  statemotion::world::WorldDepth &depthOut, long *rawFormatOut)
{
    if (rawFormatOut) *rawFormatOut = -1;
    if (!in_data || !in_data->pica_basicP) return false;

    const void *wsRaw = nullptr;
    SPErr sp = in_data->pica_basicP->AcquireSuite(
        kPFWorldSuite, kPFWorldSuiteVersion2, &wsRaw);
    const PF_WorldSuite2 *ws = static_cast<const PF_WorldSuite2 *>(wsRaw);
    if (sp != 0 || !ws || !ws->PF_GetPixelFormat) return false;

    PF_PixelFormat fmt = PF_PixelFormat_INVALID;
    PF_Err ferr = ws->PF_GetPixelFormat(world, &fmt);
    in_data->pica_basicP->ReleaseSuite(kPFWorldSuite, kPFWorldSuiteVersion2);
    if (ferr != PF_Err_NONE) return false;

    if (rawFormatOut) *rawFormatOut = static_cast<long>(fmt);
    switch (fmt) {
        case PF_PixelFormat_ARGB32:  depthOut = statemotion::world::WorldDepth::Eight;   return true;
        case PF_PixelFormat_ARGB64:  depthOut = statemotion::world::WorldDepth::Sixteen; return true;
        case PF_PixelFormat_ARGB128: depthOut = statemotion::world::WorldDepth::Float;   return true;
        default: return false;  // unknown/Premiere-native format: caller falls back
    }
}

// Legacy fallback only. Prefer smQueryWorldDepth.
static statemotion::world::WorldDepth
smWorldDepth(const PF_EffectWorld *world)
{
    return PF_WORLD_IS_DEEP(world)
        ? statemotion::world::WorldDepth::Sixteen
        : statemotion::world::WorldDepth::Eight;
}

// Depth-agnostic, format-agnostic identity: copy the raw overlapping bytes of
// each scanline respecting BOTH rowbytes. Never assumes bytes-per-pixel, never
// writes past either row. This is the known-good baseline pass-through.
static void
smRawIdentityCopy(const PF_EffectWorld *src, PF_EffectWorld *dst)
{
    const int h = src->height < dst->height ? src->height : dst->height;
    const A_long srb = src->rowbytes < 0 ? -src->rowbytes : src->rowbytes;
    const A_long drb = dst->rowbytes < 0 ? -dst->rowbytes : dst->rowbytes;
    const size_t rowCopy = static_cast<size_t>(srb < drb ? srb : drb);
    for (int y = 0; y < h; ++y) {
        const char *s = reinterpret_cast<const char *>(src->data) + static_cast<ptrdiff_t>(y) * src->rowbytes;
        char *d = reinterpret_cast<char *>(dst->data) + static_cast<ptrdiff_t>(y) * dst->rowbytes;
        ::memcpy(d, s, rowCopy);
    }
}

static PF_Err
Render(
    PF_InData   *in_data,
    PF_OutData  *out_data,
    PF_ParamDef *params[],
    PF_LayerDef *output)
{
    PF_Err err = PF_Err_NONE;

    SM_TRACE("SM_RENDER_00_ENTER");
    if (!in_data || !output || !params) return PF_Err_BAD_CALLBACK_PARAM;
    PF_EffectWorld *src = &params[STATEMOTION_INPUT]->u.ld;
    PF_EffectWorld *dst = output;
    if (!src->data || !dst->data) return PF_Err_BAD_CALLBACK_PARAM;
    SM_TRACE("SM_RENDER_01_WORLDS_VALID");

    const int W = output->width;
    const int H = output->height;
    const int SW = src->width;
    const int SH = src->height;

    // Query and log the ACTUAL host pixel format + geometry (numeric only).
    {
        long inFmt = -1, outFmt = -1;
        statemotion::world::WorldDepth d;
        smQueryWorldDepth(in_data, src, d, &inFmt);
        smQueryWorldDepth(in_data, dst, d, &outFmt);
        SM_TRACE_NUM("in_fmt", inFmt);
        SM_TRACE_NUM("out_fmt", outFmt);
        SM_TRACE_NUM("in_w", SW);
        SM_TRACE_NUM("in_h", SH);
        SM_TRACE_NUM("in_rowbytes", src->rowbytes);
        SM_TRACE_NUM("out_w", W);
        SM_TRACE_NUM("out_h", H);
        SM_TRACE_NUM("out_rowbytes", dst->rowbytes);
        (void)d;
    }
    SM_TRACE("SM_RENDER_02_PIXEL_FORMAT");

#if SM_FORCE_IDENTITY
    // Diagnostic: known-good, format-agnostic raw identity pass-through ONLY.
    smRawIdentityCopy(src, dst);
    SM_TRACE("SM_RENDER_FORCED_IDENTITY_DONE");
    (void)out_data;
    return err;
#else

    // 1. Read registered params by disk ID (runtime index resolved via smParamIndex).
    #define SM_RD(did) params[smParamIndex(statemotion::ids::did)]
    const int modeIdx = static_cast<int>(SM_RD(kTransitionMode)->u.pd.value);
    const int alignIdx = static_cast<int>(SM_RD(kTransitionAlignment)->u.pd.value);
    const double dur = SM_RD(kTransitionDurationSeconds)->u.fs_d.value;
    const double delay = SM_RD(kTransitionDelaySeconds)->u.fs_d.value;
    const double manual = SM_RD(kTransitionManualProgress)->u.fs_d.value;
    const int easingIdx = static_cast<int>(SM_RD(kTransitionEasing)->u.pd.value);
    const double cx1 = SM_RD(kTransitionCurveX1)->u.fs_d.value;
    const double cy1 = SM_RD(kTransitionCurveY1)->u.fs_d.value;
    const double cx2 = SM_RD(kTransitionCurveX2)->u.fs_d.value;
    const double cy2 = SM_RD(kTransitionCurveY2)->u.fs_d.value;
    const PF_PointDef &pa = SM_RD(kTransformPositionA)->u.td;
    const PF_PointDef &pb = SM_RD(kTransformPositionB)->u.td;
    const double sxa = SM_RD(kTransformScaleXA)->u.fs_d.value;
    const double sxb = SM_RD(kTransformScaleXB)->u.fs_d.value;
    const double sya = SM_RD(kTransformScaleYA)->u.fs_d.value;
    const double syb = SM_RD(kTransformScaleYB)->u.fs_d.value;
    const double ra = SM_RD(kTransformRotationA)->u.ad.value / 65536.0;
    const double rb = SM_RD(kTransformRotationB)->u.ad.value / 65536.0;
    const PF_PointDef &aa = SM_RD(kTransformAnchorA)->u.td;
    const PF_PointDef &ab = SM_RD(kTransformAnchorB)->u.td;
    const double oa = SM_RD(kTransformOpacityA)->u.fs_d.value;
    const double ob = SM_RD(kTransformOpacityB)->u.fs_d.value;
    #undef SM_RD
    SM_TRACE("SM_RENDER_03_PARAMS");

    // Native POINT is percent (fixed 16.16); convert to a percent double.
    auto pct = [](PF_Fixed v) { return static_cast<double>(v) / 65536.0; };

    // 2. Native -> canonical A/B.
    auto A = statemotion::native::buildCanonicalState(
        pct(pa.x_value), pct(pa.y_value), sxa, sya, ra,
        pct(aa.x_value), pct(aa.y_value), oa);
    auto B = statemotion::native::buildCanonicalState(
        pct(pb.x_value), pct(pb.y_value), sxb, syb, rb,
        pct(ab.x_value), pct(ab.y_value), ob);

    // 3. Host clip-local time -> ProgressInput seconds.
    auto pin = statemotion::host::buildProgressInput(
        in_data->current_time, in_data->total_time, in_data->time_scale,
        statemotion::native::modeFromPopup(modeIdx),
        statemotion::native::alignmentFromPopup(alignIdx),
        dur, delay, manual,
        static_cast<statemotion::EasingMode>(easingIdx),
        {cx1, cy1, cx2, cy2});
    SM_TRACE("SM_RENDER_04_HOST_TIME");

    // 4. Progress -> canonical interpolation.
    auto pe = statemotion::evaluateProgress(pin);
    if (!pe.ok) {
        // Non-finite input: fail safe to identity copy.
        smRawIdentityCopy(src, dst);
        return err;
    }
    SM_TRACE("SM_RENDER_05_PROGRESS");
    auto canon = statemotion::interpolateCanonical(A, B, pe.result.easedProgress);
    SM_TRACE("SM_RENDER_07_INTERPOLATE");

    // 5. Canonical -> renderer-native units (single boundary conversion, after interp).
    statemotion::raster::RenderDimensions dims{W, H, SW, SH};
    auto rt = statemotion::raster::toRendererTransformState(canon, dims);

    // 6. Identity fast path (true no-op only).
    auto plan = statemotion::plan(rt, SW, SH);
    SM_TRACE("SM_RENDER_08_RENDER_PLAN");
    if (plan.identityTransform) {
        smRawIdentityCopy(src, dst);
        SM_TRACE("SM_RENDER_IDENTITY_FASTPATH_DONE");
        return err;
    }

    // 7. Render via the existing verified CPU renderer, using the ACTUAL host
    //    pixel format queried from the world (fallback: flag heuristic).
    statemotion::world::WorldDepth srcDepth, dstDepth;
    if (!smQueryWorldDepth(in_data, src, srcDepth, nullptr)) srcDepth = smWorldDepth(src);
    if (!smQueryWorldDepth(in_data, dst, dstDepth, nullptr)) dstDepth = smWorldDepth(dst);

    std::vector<statemotion::Pixel> srcPix, dstPix;
    statemotion::world::worldToPixels(
        src->data, SW, SH, static_cast<std::ptrdiff_t>(src->rowbytes), srcDepth, srcPix);
    SM_TRACE("SM_RENDER_09_CPU_RENDER_BEGIN");
    struct Ctx { const std::vector<statemotion::Pixel> *buf; int w; };
    Ctx ctx{&srcPix, SW};
    auto sample = [](void *user, int x, int y) -> statemotion::Pixel {
        const auto *c = static_cast<const Ctx *>(user);
        return (*c->buf)[static_cast<size_t>(y) * c->w + x];
    };
    dstPix.resize(static_cast<size_t>(W) * H);
    statemotion::render(plan, sample, &ctx, W, H, dstPix.data());
    SM_TRACE("SM_RENDER_10_CPU_RENDER_END");
    statemotion::world::pixelsToWorld(
        dstPix, dst->data, W, H, static_cast<std::ptrdiff_t>(dst->rowbytes), dstDepth);

    (void)out_data;
    SM_TRACE("SM_RENDER_11_EXIT");

    return err;
#endif  // SM_FORCE_IDENTITY
}

DllExport PF_Err
EntryPointFunc(
    PF_Cmd       cmd,
    PF_InData    *in_data,
    PF_OutData   *out_data,
    PF_ParamDef  *params[],
    PF_LayerDef  *output,
    void         *extra)
{
    PF_Err err = PF_Err_NONE;

    switch (cmd) {
    case PF_Cmd_ABOUT:
        err = About(in_data, out_data, params, output);
        break;
    case PF_Cmd_GLOBAL_SETUP:
        err = GlobalSetup(in_data, out_data, params, output);
        break;
    case PF_Cmd_PARAMS_SETUP:
        err = ParamsSetup(in_data, out_data, params, output);
        break;
    case PF_Cmd_RENDER:
        err = Render(in_data, out_data, params, output);
        break;
    default:
        // Unknown/unhandled commands return the SDK's normal success result.
        break;
    }

    return err;
}
