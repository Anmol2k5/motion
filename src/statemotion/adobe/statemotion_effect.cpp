// StateMotion native effect - entry point and pass-through render.
//
// This is the minimal native load proof: it registers a single effect
// ("StateMotion") with the permanent match name, declares only the SDK-required
// input/source layer, and performs an identity pass-through render.
//
// It does NOT implement any StateMotion transform parameter, progress control,
// animation, or the CPU transform renderer. Those are separate later tasks.

#include <cstdio>
#include <cstring>
#include <vector>

#include "statemotion_effect.h"
#include "statemotion_point_default.hpp"

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

// Build a premultiplied-alpha RGBA float Pixel buffer from a Premiere software
// PF_EffectWorld. Phase 0.1 supports the 32-bit float, 4-channel (RGBA) world the
// host hands the CPU path; the exact channel order is confirmed by the operator on
// the test machine. No generic pixel-format conversion framework is added.
static void
smWorldToPixels(const PF_EffectWorld *world, std::vector<statemotion::Pixel> &out)
{
    const int w = world->width;
    const int h = world->height;
    out.resize(static_cast<size_t>(w) * h);
    const A_long rowbytes = world->rowbytes;
    for (int y = 0; y < h; ++y) {
        const PF_PixelFloat *row =
            reinterpret_cast<const PF_PixelFloat *>(reinterpret_cast<const char *>(world->data) + y * rowbytes);
        for (int x = 0; x < w; ++x) {
            const PF_PixelFloat &px = row[x];
            statemotion::Pixel &p = out[static_cast<size_t>(y) * w + x];
            p.r = px.red;
            p.g = px.green;
            p.b = px.blue;
            p.a = px.alpha;
        }
    }
}

static void
smPixelsToWorld(const std::vector<statemotion::Pixel> &in, PF_EffectWorld *world)
{
    const int w = world->width;
    const int h = world->height;
    const A_long rowbytes = world->rowbytes;
    for (int y = 0; y < h; ++y) {
        PF_PixelFloat *row =
            reinterpret_cast<PF_PixelFloat *>(reinterpret_cast<char *>(world->data) + y * rowbytes);
        for (int x = 0; x < w; ++x) {
            const statemotion::Pixel &p = in[static_cast<size_t>(y) * w + x];
            row[x].red = static_cast<float>(p.r);
            row[x].green = static_cast<float>(p.g);
            row[x].blue = static_cast<float>(p.b);
            row[x].alpha = static_cast<float>(p.a);
        }
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

    if (!in_data || !output || !params) return PF_Err_BAD_CALLBACK_PARAM;
    PF_EffectWorld *src = &params[STATEMOTION_INPUT]->u.ld;
    PF_EffectWorld *dst = &output->u.ld;
    if (!src->data || !dst->data) return PF_Err_BAD_CALLBACK_PARAM;

    const int W = output->width;
    const int H = output->height;
    const int SW = src->width;
    const int SH = src->height;

    // 1. Read registered params by disk ID (runtime index resolved via smParamIndex).
    #define SM_RD(did) params[smParamIndex(statemotion::ids::did)]
    const int modeIdx = static_cast<int>(SM_RD(kTransformMode)->u.pd.value);
    const int alignIdx = static_cast<int>(SM_RD(kTransformAlignment)->u.pd.value);
    const double dur = SM_RD(kTransitionDurationSeconds)->u.fs_d.value;
    const double delay = SM_RD(kTransitionDelaySeconds)->u.fs_d.value;
    const double manual = SM_RD(kTransitionManualProgress)->u.fs_d.value;
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
        dur, delay, manual);

    // 4. Progress -> canonical interpolation.
    auto pe = statemotion::evaluateProgress(pin);
    if (!pe.ok) {
        // Non-finite input: fail safe to identity copy.
        const A_long bytes = output->rowbytes * H;
        if (bytes > 0) ::memcpy(dst->data, src->data, static_cast<size_t>(bytes));
        return err;
    }
    auto canon = statemotion::interpolateCanonical(A, B, pe.result.easedProgress);

    // 5. Canonical -> renderer-native units (single boundary conversion, after interp).
    statemotion::raster::RenderDimensions dims{W, H, SW, SH};
    auto rt = statemotion::raster::toRendererTransformState(canon, dims);

    // 6. Identity fast path (true no-op only).
    auto plan = statemotion::plan(rt, SW, SH);
    if (plan.identityTransform) {
        const A_long bytes = output->rowbytes * H;
        if (bytes > 0) ::memcpy(dst->data, src->data, static_cast<size_t>(bytes));
        return err;
    }

    // 7. Render via the existing verified CPU renderer.
    std::vector<statemotion::Pixel> srcPix, dstPix;
    smWorldToPixels(src, srcPix);
    struct Ctx { const std::vector<statemotion::Pixel> *buf; int w; };
    Ctx ctx{&srcPix, SW};
    auto sample = [](void *user, int x, int y) -> statemotion::Pixel {
        const auto *c = static_cast<const Ctx *>(user);
        return (*c->buf)[static_cast<size_t>(y) * c->w + x];
    };
    dstPix.resize(static_cast<size_t>(W) * H);
    statemotion::render(plan, sample, &ctx, W, H, dstPix.data());
    smPixelsToWorld(dstPix, dst);

    (void)out_data;

    return err;
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
