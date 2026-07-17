// StateMotion native effect - public header.
//
// Minimal native Adobe effect load proof. Identity pass-through only.
// No StateMotion custom parameters are registered in this task.
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

// Internal development version (Phase 0.1 load proof).
#define STATEMOTION_MAJOR_VERSION 0
#define STATEMOTION_MINOR_VERSION 1
#define STATEMOTION_BUG_VERSION   0
#define STATEMOTION_STAGE_VERSION PF_Stage_DEVELOP
#define STATEMOTION_BUILD_VERSION 0

// Permanent registration identity.
#define STATEMOTION_MATCH_NAME "AE.io.github.anmol2k5.statemotion.effect"

// Parameter indices. Only the mandatory input/source layer is registered.
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
