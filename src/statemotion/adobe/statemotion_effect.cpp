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

static PF_Err
Render(
    PF_InData   *in_data,
    PF_OutData  *out_data,
    PF_ParamDef *params[],
    PF_LayerDef *output)
{
    PF_Err              err = PF_Err_NONE;
    PF_EffectWorld      *src = &params[STATEMOTION_INPUT]->u.ld;

    if (!in_data || !output || !src || !src->data || !output->data) {
        return PF_Err_BAD_CALLBACK_PARAM;
    }

    if (!src->world_flags && !output->world_flags) {
        // Not a valid world pair; let the host handle it.
        return PF_Err_BAD_CALLBACK_PARAM;
    }

    // Identity pass-through: copy the source world buffer verbatim into the
    // output world. This is format-agnostic (8/16/32 bpc, any channel layout)
    // and performs no per-pixel transformation. Both worlds share the same
    // dimensions and rowbytes for this effect.
    const A_long bytes = output->rowbytes * output->height;
    if (bytes > 0) {
        ::memcpy(output->data, src->data, static_cast<size_t>(bytes));
    }

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
