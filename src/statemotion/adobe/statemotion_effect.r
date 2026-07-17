#include "AEConfig.h"
#include "AE_EffectVers.h"

#ifndef AE_OS_WIN
    #include <AE_General.r>
#endif

resource 'PiPL' (16000) {
    {   /* array properties */
        Kind {
            AEEffect
        },
        Name {
            "StateMotion"
        },
        Category {
            "StateMotion"
        },
#ifdef AE_OS_WIN
    #ifdef AE_PROC_INTELx64
        CodeWin64X86 {"EntryPointFunc"},
    #else
        CodeWin32X86 {"EntryPointFunc"},
    #endif
#else
    #ifdef AE_OS_MAC
        CodeMachOPowerPC {"EntryPointFunc"},
        CodeMacIntel32 {"EntryPointFunc"},
        CodeMacIntel64 {"EntryPointFunc"},
    #endif
#endif
        AE_PiPL_Version {
            2,
            0
        },
        AE_Effect_Spec_Version {
            PF_PLUG_IN_VERSION,
            PF_PLUG_IN_SUBVERS
        },
        AE_Effect_Version {
            65536   /* 0.1.0 */
        },
        AE_Effect_Info_Flags {
            0
        },
        AE_Effect_Global_OutFlags {
            0x00000000
        },
        AE_Effect_Global_OutFlags_2 {
            0x00000000
        },
        AE_Effect_Match_Name {
            "AE.io.github.anmol2k5.statemotion.effect"
        },
        AE_Reserved_Info {
            0
        }
    }
};
