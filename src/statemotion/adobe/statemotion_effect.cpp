// StateMotion native effect - entry point and CPU transform render.
//
// Registers the "StateMotion" effect with the permanent match name and its 43
// parameters (progress, transform, crop, shadow). Render() reads native params
// via disk-ID adapters, builds canonical A/B states, evaluates progress from
// clip-local host time, interpolates, converts to renderer units, and
// rasterizes through the existing verified CPU transform renderer.

#include <cstdio>
#include <cstring>
#include <vector>

#include "statemotion_effect.h"
#include "statemotion_point_default.hpp"
#include "statemotion_world_pixels.hpp"

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
                items = "Linear|EaseIn|EaseOut|EaseInOut|Custom|Spring|Bounce";
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
        } else if (::strcmp(nativeType, "CHECKBOX") == 0) {
            def.param_type = PF_Param_CHECKBOX;
            def.flags = static_cast<PF_ParamFlags>(timeFlag | oldFlag);
            def.u.bd.dephault = b.defaultNum > 0.5 ? TRUE : FALSE;
            def.u.bd.value = b.oldDefaultNum > 0.5 ? TRUE : FALSE;
            def.u.bd.u.nameptr = b.wireName;
        } else if (::strcmp(nativeType, "COLOR") == 0) {
            def.param_type = PF_Param_COLOR;
            def.flags = static_cast<PF_ParamFlags>(timeFlag | oldFlag);
            // Default is string, handled gracefully via white color fallback
            def.u.cd.dephault = {255, 255, 255, 255};
            def.u.cd.value = {255, 255, 255, 255};
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


// The legacy PF_Cmd_RENDER path hands an 8-bit world when no depth capability is
// declared (out_flags = 0), or a 16-bit world under DEEP_COLOR_AWARE. Float
// worlds only arrive on the SmartFX path, which this effect does not implement.
// Reading the world at the wrong depth (the prior float-only cast) over-reads
// past every row and the buffer end -> host low-level exception (AEVideoFilter).
static statemotion::world::WorldDepth
smWorldDepth(const PF_EffectWorld *world)
{
    return PF_WORLD_IS_DEEP(world)
        ? statemotion::world::WorldDepth::Sixteen
        : statemotion::world::WorldDepth::Eight;
}

static void
smWorldToPixels(const PF_EffectWorld *world, std::vector<statemotion::Pixel> &out)
{
    statemotion::world::worldToPixels(
        world->data, world->width, world->height,
        static_cast<std::ptrdiff_t>(world->rowbytes), smWorldDepth(world), out);
}

static void
smPixelsToWorld(const std::vector<statemotion::Pixel> &in, PF_EffectWorld *world)
{
    statemotion::world::pixelsToWorld(
        in, world->data, world->width, world->height,
        static_cast<std::ptrdiff_t>(world->rowbytes), smWorldDepth(world));
}

// Safe identity copy respecting per-world rowbytes. Copies only the overlapping
// region so a src/dst dimension or stride mismatch can never over-read/write.
static void
smIdentityCopy(const PF_EffectWorld *src, PF_EffectWorld *dst)
{
    const int w = src->width < dst->width ? src->width : dst->width;
    const int h = src->height < dst->height ? src->height : dst->height;
    const A_long srb = src->rowbytes;
    const A_long drb = dst->rowbytes;
    const size_t bpp = statemotion::world::bytesPerPixel(smWorldDepth(dst));
    const size_t bytesPerRow = static_cast<size_t>(w) * bpp;
    for (int y = 0; y < h; ++y) {

        const char *s = reinterpret_cast<const char *>(src->data) + static_cast<ptrdiff_t>(y) * srb;
        char *d = reinterpret_cast<char *>(dst->data) + static_cast<ptrdiff_t>(y) * drb;
        ::memcpy(d, s, bytesPerRow);
    }
}

struct FrameParams {
    statemotion::native::CanonicalState A, B;
    
    int modeIdx, alignIdx, easingIdx;
    double dur, delay, manual;
    statemotion::EasingCurve curve;
    
    double cropLA, cropLB, cropRA, cropRB, cropTA, cropTB, cropBA, cropBB, cropCRA, cropCRB;
    double shadOpA, shadOpB, shadAngA, shadAngB, shadDistA, shadDistB, shadSoftA, shadSoftB;
    
    bool strokeEnA, strokeEnB;
    double strokeWidthA, strokeWidthB;
    statemotion::Pixel strokeC1A, strokeC1B, strokeC2A, strokeC2B;
    double strokeAngA, strokeAngB, strokeSpeed;
    
    bool glowEnA, glowEnB;
    double glowAmountA, glowAmountB, glowRadiusA, glowRadiusB;
    
    bool mblurEnabled;
    int mblurSamples;
    double mblurAngle;
};

static void
ApplyCropAndShadow(const FrameParams& fp, double t, statemotion::raster::RendererTransformState& rt)
{
    rt.cropLeft      = statemotion::native::percentToFraction(fp.cropLA  + (fp.cropLB  - fp.cropLA)  * t);
    rt.cropRight     = statemotion::native::percentToFraction(fp.cropRA  + (fp.cropRB  - fp.cropRA)  * t);
    rt.cropTop       = statemotion::native::percentToFraction(fp.cropTA  + (fp.cropTB  - fp.cropTA)  * t);
    rt.cropBottom    = statemotion::native::percentToFraction(fp.cropBA  + (fp.cropBB  - fp.cropBA)  * t);
    rt.cornerRadius  = statemotion::native::percentToFraction(fp.cropCRA + (fp.cropCRB - fp.cropCRA) * t);
    rt.shadowOpacity = statemotion::native::percentToOpacity( fp.shadOpA + (fp.shadOpB - fp.shadOpA) * t);
    rt.shadowAngleDeg  = fp.shadAngA + (fp.shadAngB - fp.shadAngA) * t;
    rt.shadowDistance  = fp.shadDistA + (fp.shadDistB - fp.shadDistA) * t;
    rt.shadowSoftness  = fp.shadSoftA + (fp.shadSoftB - fp.shadSoftA) * t;
}

static void
ApplyStrokeAndGlow(const FrameParams& fp, double t, double timeSeconds, statemotion::raster::RendererTransformState& rt)
{
    rt.strokeEnabled = (t < 0.5) ? fp.strokeEnA : fp.strokeEnB;
    rt.strokeWidth = fp.strokeWidthA + (fp.strokeWidthB - fp.strokeWidthA) * t;
    rt.strokeColor1.r = fp.strokeC1A.r + (fp.strokeC1B.r - fp.strokeC1A.r) * t;
    rt.strokeColor1.g = fp.strokeC1A.g + (fp.strokeC1B.g - fp.strokeC1A.g) * t;
    rt.strokeColor1.b = fp.strokeC1A.b + (fp.strokeC1B.b - fp.strokeC1A.b) * t;
    rt.strokeColor1.a = fp.strokeC1A.a + (fp.strokeC1B.a - fp.strokeC1A.a) * t;
    rt.strokeColor2.r = fp.strokeC2A.r + (fp.strokeC2B.r - fp.strokeC2A.r) * t;
    rt.strokeColor2.g = fp.strokeC2A.g + (fp.strokeC2B.g - fp.strokeC2A.g) * t;
    rt.strokeColor2.b = fp.strokeC2A.b + (fp.strokeC2B.b - fp.strokeC2A.b) * t;
    rt.strokeColor2.a = fp.strokeC2A.a + (fp.strokeC2B.a - fp.strokeC2A.a) * t;
    rt.strokeGradientAngleDeg = fp.strokeAngA + (fp.strokeAngB - fp.strokeAngA) * t;
    rt.strokeGradientPhaseOffset = timeSeconds * fp.strokeSpeed;
    
    rt.glowEnabled = (t < 0.5) ? fp.glowEnA : fp.glowEnB;
    rt.glowAmount = (fp.glowAmountA + (fp.glowAmountB - fp.glowAmountA) * t) / 100.0;
    rt.glowRadius = fp.glowRadiusA + (fp.glowRadiusB - fp.glowRadiusA) * t;
}

static PF_Err
RenderSingleSample(
    PF_InData* in_data, const PF_EffectWorld* src, PF_EffectWorld* dst,
    const std::vector<statemotion::Pixel>& srcPix, std::vector<statemotion::Pixel>& dstPix,
    const FrameParams& fp)
{
    auto pin = statemotion::host::buildProgressInput(
        in_data->current_time, in_data->total_time, in_data->time_scale,
        statemotion::native::modeFromPopup(fp.modeIdx),
        statemotion::native::alignmentFromPopup(fp.alignIdx),
        fp.dur, fp.delay, fp.manual,
        static_cast<statemotion::EasingMode>(fp.easingIdx), fp.curve);

    auto pe = statemotion::evaluateProgress(pin);
    if (!pe.ok) {
        smIdentityCopy(src, dst);
        return PF_Err_NONE;
    }

    auto canon = statemotion::interpolateCanonical(fp.A, fp.B, pe.result.easedProgress);
    statemotion::raster::RenderDimensions dims{dst->width, dst->height, src->width, src->height};
    auto rt = statemotion::raster::toRendererTransformState(canon, dims);

    const double t = std::clamp(pe.result.easedProgress, 0.0, 1.0);
    ApplyCropAndShadow(fp, t, rt);
    double timeSeconds = in_data->current_time / static_cast<double>(in_data->time_scale);
    ApplyStrokeAndGlow(fp, t, timeSeconds, rt);

    auto plan = statemotion::plan(rt, src->width, src->height);
    if (plan.identityTransform) {
        smIdentityCopy(src, dst);
        return PF_Err_NONE;
    }

    struct Ctx { const std::vector<statemotion::Pixel> *buf; int w; };
    Ctx ctx{&srcPix, src->width};
    auto sample = [](void *user, int x, int y) -> statemotion::Pixel {
        const auto *c = static_cast<const Ctx *>(user);
        return (*c->buf)[static_cast<size_t>(y) * c->w + x];
    };

    statemotion::render(plan, sample, &ctx, dst->width, dst->height, dstPix.data());
    return PF_Err_NONE;
}

static PF_Err
RenderMultiSample(
    PF_InData* in_data, const PF_EffectWorld* src, PF_EffectWorld* dst,
    const std::vector<statemotion::Pixel>& srcPix, std::vector<statemotion::Pixel>& dstPix,
    const FrameParams& fp)
{
    const int W = dst->width;
    const int H = dst->height;
    const int SW = src->width;
    const int SH = src->height;

    std::vector<statemotion::Pixel> accum(W * H, statemotion::Pixel{0,0,0,0});
    std::vector<statemotion::Pixel> tempPix(W * H);
    
    struct Ctx { const std::vector<statemotion::Pixel> *buf; int w; };
    Ctx ctx{&srcPix, SW};
    auto sample = [](void *user, int x, int y) -> statemotion::Pixel {
        const auto *c = static_cast<const Ctx *>(user);
        return (*c->buf)[static_cast<size_t>(y) * c->w + x];
    };
    
    int validSamples = 0;
    double shutterDuration = static_cast<double>(in_data->time_step) * (fp.mblurAngle / 360.0);
    
    for (int i = 0; i < fp.mblurSamples; ++i) {
        double st = static_cast<double>(i) / (fp.mblurSamples - 1);
        double offset = (st - 0.5) * shutterDuration;
        A_long sampleTime = in_data->current_time + static_cast<A_long>(std::round(offset));
        
        auto pin = statemotion::host::buildProgressInput(
            sampleTime, in_data->total_time, in_data->time_scale,
            statemotion::native::modeFromPopup(fp.modeIdx),
            statemotion::native::alignmentFromPopup(fp.alignIdx),
            fp.dur, fp.delay, fp.manual,
            static_cast<statemotion::EasingMode>(fp.easingIdx), fp.curve);

        auto pe = statemotion::evaluateProgress(pin);
        if (!pe.ok) continue;

        auto canon = statemotion::interpolateCanonical(fp.A, fp.B, pe.result.easedProgress);
        statemotion::raster::RenderDimensions dims{W, H, SW, SH};
        auto rt = statemotion::raster::toRendererTransformState(canon, dims);

        const double t = std::clamp(pe.result.easedProgress, 0.0, 1.0);
        ApplyCropAndShadow(fp, t, rt);
        ApplyStrokeAndGlow(fp, t, sampleTime / static_cast<double>(in_data->time_scale), rt);

        auto plan = statemotion::plan(rt, SW, SH);
        statemotion::render(plan, sample, &ctx, W, H, tempPix.data());
        
        for (size_t p = 0; p < accum.size(); ++p) {
            accum[p].r += tempPix[p].r;
            accum[p].g += tempPix[p].g;
            accum[p].b += tempPix[p].b;
            accum[p].a += tempPix[p].a;
        }
        validSamples++;
    }
    
    if (validSamples > 0) {
        double inv = 1.0 / validSamples;
        for (size_t p = 0; p < dstPix.size(); ++p) {
            dstPix[p].r = accum[p].r * inv;
            dstPix[p].g = accum[p].g * inv;
            dstPix[p].b = accum[p].b * inv;
            dstPix[p].a = accum[p].a * inv;
        }
    } else {
        smIdentityCopy(src, dst);
    }
    return PF_Err_NONE;
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
    PF_EffectWorld *dst = output;
    if (!src->data || !dst->data) return PF_Err_BAD_CALLBACK_PARAM;

    const int W = output->width;
    const int H = output->height;
    const int SW = src->width;
    const int SH = src->height;

    FrameParams fp;

    // 1. Read registered params by disk ID (runtime index resolved via smParamIndex).
    #define SM_RD(did) params[smParamIndex(statemotion::ids::did)]
    fp.modeIdx = static_cast<int>(SM_RD(kTransitionMode)->u.pd.value);
    fp.alignIdx = static_cast<int>(SM_RD(kTransitionAlignment)->u.pd.value);
    fp.dur = SM_RD(kTransitionDurationSeconds)->u.fs_d.value;
    fp.delay = SM_RD(kTransitionDelaySeconds)->u.fs_d.value;
    fp.manual = SM_RD(kTransitionManualProgress)->u.fs_d.value;
    fp.easingIdx = static_cast<int>(SM_RD(kTransitionEasing)->u.pd.value);
    
    fp.curve.x1 = SM_RD(kTransitionCurveX1)->u.fs_d.value;
    fp.curve.y1 = SM_RD(kTransitionCurveY1)->u.fs_d.value;
    fp.curve.x2 = SM_RD(kTransitionCurveX2)->u.fs_d.value;
    fp.curve.y2 = SM_RD(kTransitionCurveY2)->u.fs_d.value;
    fp.curve.springFrequency = SM_RD(kTransitionSpringFrequency)->u.fs_d.value;
    fp.curve.springDamping = SM_RD(kTransitionSpringDamping)->u.fs_d.value;
    fp.curve.springInitialVelocity = SM_RD(kTransitionSpringInitialVelocity)->u.fs_d.value;
    fp.curve.bounceCount = SM_RD(kTransitionBounceCount)->u.fs_d.value;
    fp.curve.bounceHeightDecay = SM_RD(kTransitionBounceHeightDecay)->u.fs_d.value;
    fp.curve.bounceTimeDecay = SM_RD(kTransitionBounceTimeDecay)->u.fs_d.value;
    fp.curve.bounceHangTime = SM_RD(kTransitionBounceHangTime)->u.fs_d.value;

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

    // 1b. Read crop parameters (disk IDs 150-159, percent 0-100).
    fp.cropLA = SM_RD(kCropLeftA)->u.fs_d.value;
    fp.cropLB = SM_RD(kCropLeftB)->u.fs_d.value;
    fp.cropRA = SM_RD(kCropRightA)->u.fs_d.value;
    fp.cropRB = SM_RD(kCropRightB)->u.fs_d.value;
    fp.cropTA = SM_RD(kCropTopA)->u.fs_d.value;
    fp.cropTB = SM_RD(kCropTopB)->u.fs_d.value;
    fp.cropBA = SM_RD(kCropBottomA)->u.fs_d.value;
    fp.cropBB = SM_RD(kCropBottomB)->u.fs_d.value;
    fp.cropCRA = SM_RD(kCropCornerRadiusA)->u.fs_d.value;
    fp.cropCRB = SM_RD(kCropCornerRadiusB)->u.fs_d.value;

    // 1c. Read shadow parameters (disk IDs 250-257).
    fp.shadOpA = SM_RD(kShadowOpacityA)->u.fs_d.value;
    fp.shadOpB = SM_RD(kShadowOpacityB)->u.fs_d.value;
    fp.shadAngA = SM_RD(kShadowAngleA)->u.ad.value / 65536.0;
    fp.shadAngB = SM_RD(kShadowAngleB)->u.ad.value / 65536.0;
    fp.shadDistA = SM_RD(kShadowDistanceA)->u.fs_d.value;
    fp.shadDistB = SM_RD(kShadowDistanceB)->u.fs_d.value;
    fp.shadSoftA = SM_RD(kShadowSoftnessA)->u.fs_d.value;
    fp.shadSoftB = SM_RD(kShadowSoftnessB)->u.fs_d.value;

    // 1d. Read stroke and glow parameters (disk IDs 200-216).
    fp.strokeEnA = SM_RD(kStrokeEnabledA)->u.bd.value;
    fp.strokeEnB = SM_RD(kStrokeEnabledB)->u.bd.value;
    fp.strokeWidthA = SM_RD(kStrokeWidthA)->u.fs_d.value;
    fp.strokeWidthB = SM_RD(kStrokeWidthB)->u.fs_d.value;
    auto readColor = [](const PF_Pixel& c) { return statemotion::Pixel{c.red/255.0, c.green/255.0, c.blue/255.0, c.alpha/255.0}; };
    fp.strokeC1A = readColor(SM_RD(kStrokeColor1A)->u.cd.value);
    fp.strokeC1B = readColor(SM_RD(kStrokeColor1B)->u.cd.value);
    fp.strokeC2A = readColor(SM_RD(kStrokeColor2A)->u.cd.value);
    fp.strokeC2B = readColor(SM_RD(kStrokeColor2B)->u.cd.value);
    fp.strokeAngA = SM_RD(kStrokeGradientAngleA)->u.ad.value / 65536.0;
    fp.strokeAngB = SM_RD(kStrokeGradientAngleB)->u.ad.value / 65536.0;
    fp.strokeSpeed = SM_RD(kStrokeGradientCycleSpeed)->u.fs_d.value;
    fp.glowEnA = SM_RD(kGlowEnabledA)->u.bd.value;
    fp.glowEnB = SM_RD(kGlowEnabledB)->u.bd.value;
    fp.glowAmountA = SM_RD(kGlowAmountA)->u.fs_d.value;
    fp.glowAmountB = SM_RD(kGlowAmountB)->u.fs_d.value;
    fp.glowRadiusA = SM_RD(kGlowRadiusA)->u.fs_d.value;
    fp.glowRadiusB = SM_RD(kGlowRadiusB)->u.fs_d.value;

    // 1e. Read motion blur parameters.
    fp.mblurEnabled = SM_RD(kMotionBlurEnabled)->u.bd.value;
    fp.mblurAngle = SM_RD(kMotionBlurShutterAngle)->u.fs_d.value;
    const int mblurSamplesRaw = static_cast<int>(SM_RD(kMotionBlurSamples)->u.fs_d.value);
    // Enforce 2..64 range for samples if enabled
    fp.mblurSamples = (fp.mblurEnabled && mblurSamplesRaw >= 2) ? (mblurSamplesRaw < 64 ? mblurSamplesRaw : 64) : 1;

    #undef SM_RD

    // Premiere exposes runtime POINT values as pixels in fixed 16.16.
    auto fixedToDouble = [](PF_Fixed v) { return static_cast<double>(v) / 65536.0; };
    const auto posA = statemotion::native::pointPixelsToPercent(
        fixedToDouble(pa.x_value), fixedToDouble(pa.y_value), W, H);
    const auto posB = statemotion::native::pointPixelsToPercent(
        fixedToDouble(pb.x_value), fixedToDouble(pb.y_value), W, H);
    const auto anchorA = statemotion::native::pointPixelsToPercent(
        fixedToDouble(aa.x_value), fixedToDouble(aa.y_value), SW, SH);
    const auto anchorB = statemotion::native::pointPixelsToPercent(
        fixedToDouble(ab.x_value), fixedToDouble(ab.y_value), SW, SH);

    // 2. Native -> canonical A/B.
    fp.A = statemotion::native::buildCanonicalState(
        posA.x, posA.y, sxa, sya, ra, anchorA.x, anchorA.y, oa);
    fp.B = statemotion::native::buildCanonicalState(
        posB.x, posB.y, sxb, syb, rb, anchorB.x, anchorB.y, ob);

    std::vector<statemotion::Pixel> srcPix, dstPix;
    smWorldToPixels(src, srcPix);
    dstPix.resize(static_cast<size_t>(W) * H);

    if (!fp.mblurEnabled || fp.mblurSamples <= 1 || fp.mblurAngle <= 0.0) {
        err = RenderSingleSample(in_data, src, dst, srcPix, dstPix, fp);
    } else {
        err = RenderMultiSample(in_data, src, dst, srcPix, dstPix, fp);
    }

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
