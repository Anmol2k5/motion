// StateMotion native effect - display strings.

#include "statemotion_effect.h"

typedef struct {
    A_u_long index;
    A_char   str[512];
} TableString;

static TableString g_strs[StrID_NUMTYPES] = {
    StrID_NONE,       "",
    StrID_Name,        "StateMotion",
    StrID_Description, "StateMotion identity pass-through effect (Phase 0.1 load proof).\r"
                       "StateMotion is independently developed and is not affiliated with or endorsed by Adobe."
};

char *GetStringPtr(int strNum)
{
    return g_strs[strNum].str;
}
