// StateMotion native effect - entry point and pass-through render.
//
// This is the minimal native load proof: it registers a single effect
// ("StateMotion") with the permanent match name, declares only the SDK-required
// input/source layer, and performs an identity pass-through render.
//
// It does NOT implement any StateMotion transform parameter, progress control,
// animation, or the CPU transform renderer. Those are separate later tasks.

#include <cstdio>

#include "statemotion_effect.h"

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
ParamsSetup(
    PF_InData   *in_data,
    PF_OutData  *out_data,
    PF_ParamDef *params[],
    PF_LayerDef *output)
{
    PF_Err err = PF_Err_NONE;

    // The input/source layer is provided automatically by the host as the first
    // parameter (index STATEMOTION_INPUT). No custom StateMotion parameter is
    // registered in this task.
    out_data->num_params = STATEMOTION_NUM_PARAMS;

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
