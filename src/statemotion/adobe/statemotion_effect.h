// StateMotion native effect - public header.
//
// Native Adobe effect: registers the permanent match name, the mandatory
// input/source layer, and the Phase 0.1 generated parameter contract. Renders
// an identity pass-through. No transform/progress/UXP integration is performed
// in this milestone.
//
// Builds against the official Adobe After Effects Effect SDK (AE_Effect.h et al.).
// The permanent match name is AE.io.github.anmol2k5.statemotion.effect.

#pragma once

#ifndef STATEMOTION_EFFECT_H
#define STATEMOTION_EFFECT_H

#include "AEConfig.h"

#ifdef AE_OS_WIN
#include <Windows.h>
typedef unsigned short PixelType;
#endif

#include "entry.h"
#include "AE_Effect.h"
#include "AE_EffectCB.h"
#include "AE_Macros.h"
#include "Param_Utils.h"
#include "AE_EffectCBSuites.h"
#include "String_Utils.h"
#include "AE_GeneralPlug.h"

#include "statemotion_effect_strings.h"

// Generated parameter contract (do not edit). Source of truth:
// shared/schema/parameter-contract.json -> shared/generated/parameter_bindings.hpp
#include "parameter_ids.hpp"
#include "parameter_bindings.hpp"

// Native transform integration (pure, no Adobe SDK dependency):
//   native adapter, host-time adapter, render-input boundary, canonical model.
#include "statemotion_native_adapter.hpp"
#include "statemotion_host_time.hpp"
#include "statemotion_render_input.hpp"
#include "transform_state.hpp"
#include "transform_render.h"
#include "progress_engine.h"

// Internal development version (Phase 0.1 parameter registration).
#define STATEMOTION_MAJOR_VERSION 0
#define STATEMOTION_MINOR_VERSION 1
#define STATEMOTION_BUG_VERSION   1
#define STATEMOTION_STAGE_VERSION PF_Stage_DEVELOP
#define STATEMOTION_BUILD_VERSION 0

// Permanent registration identity.
#define STATEMOTION_MATCH_NAME "AE.io.github.anmol2k5.statemotion.effect"

// Runtime parameter indices. Index 0 is the SDK-mandated input/source layer
// (not a StateMotion custom parameter). Custom parameters follow in the order
// declared by statemotion::contract::kBindings. Runtime order is local to the
// current callback and is NOT a persistent identity (disk ID + type + match
// name is).
enum {
    STATEMOTION_INPUT = 0,
    STATEMOTION_NUM_PARAMS
};

#ifdef __cplusplus
extern "C" {
#endif

DllExport PF_Err
EntryPointFunc(
    PF_Cmd       cmd,
    PF_InData    *in_data,
    PF_OutData   *out_data,
    PF_ParamDef  *params[],
    PF_LayerDef  *output,
    void         *extra);

#ifdef __cplusplus
}
#endif

#endif // STATEMOTION_EFFECT_H
