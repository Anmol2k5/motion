// StateMotion — structured internal error -> user-facing message mapping.
//
// Internal code -> useful, non-technical text. Raw stack traces / Premiere
// exceptions are NEVER shown in normal UI; diagnostics may carry the code.

export enum ErrorCode {
  NoActiveSequence = 'NO_ACTIVE_SEQUENCE',
  NoSelection = 'NO_SELECTION',
  StateMotionNotFound = 'STATEMOTION_NOT_FOUND',
  ContractMismatch = 'CONTRACT_MISMATCH',
  NewerReadOnly = 'NEWER_READ_ONLY',
  ParameterNotFound = 'PARAMETER_NOT_FOUND',
  ParameterTypeMismatch = 'PARAMETER_TYPE_MISMATCH',
  WriteFailed = 'WRITE_FAILED',
  ReadFailed = 'READ_FAILED',
  HostUnsupported = 'HOST_UNSUPPORTED',
  InvalidPreset = 'INVALID_PRESET',
}

export interface UserMessage {
  code: ErrorCode;
  title: string;
  detail: string;
}

const MESSAGES: Record<ErrorCode, UserMessage> = {
  [ErrorCode.NoActiveSequence]: {
    code: ErrorCode.NoActiveSequence,
    title: 'No active sequence',
    detail: 'Open a sequence and select a clip to use StateMotion.',
  },
  [ErrorCode.NoSelection]: {
    code: ErrorCode.NoSelection,
    title: 'No selection',
    detail: 'Select a video clip to use StateMotion.',
  },
  [ErrorCode.StateMotionNotFound]: {
    code: ErrorCode.StateMotionNotFound,
    title: 'StateMotion not applied',
    detail: 'StateMotion is not applied to this clip.',
  },
  [ErrorCode.ContractMismatch]: {
    code: ErrorCode.ContractMismatch,
    title: 'Version incompatible',
    detail: 'This StateMotion effect version is not compatible with this panel version.',
  },
  [ErrorCode.NewerReadOnly]: {
    code: ErrorCode.NewerReadOnly,
    title: 'Newer project',
    detail: 'This project uses a newer StateMotion version. Editing is disabled to protect your animation.',
  },
  [ErrorCode.ParameterNotFound]: {
    code: ErrorCode.ParameterNotFound,
    title: 'Control missing',
    detail: 'StateMotion could not find one of the required effect controls.',
  },
  [ErrorCode.ParameterTypeMismatch]: {
    code: ErrorCode.ParameterTypeMismatch,
    title: 'Control type mismatch',
    detail: 'A StateMotion effect control has an unexpected type and was skipped.',
  },
  [ErrorCode.WriteFailed]: {
    code: ErrorCode.WriteFailed,
    title: 'Write failed',
    detail: 'StateMotion could not apply the change. No parameters were modified.',
  },
  [ErrorCode.ReadFailed]: {
    code: ErrorCode.ReadFailed,
    title: 'Read failed',
    detail: 'StateMotion could not read the current effect values.',
  },
  [ErrorCode.HostUnsupported]: {
    code: ErrorCode.HostUnsupported,
    title: 'Operation unavailable',
    detail: 'This action is not available in the current Premiere/UXP environment.',
  },
  [ErrorCode.InvalidPreset]: {
    code: ErrorCode.InvalidPreset,
    title: 'Invalid preset',
    detail: 'This preset could not be loaded because it is malformed or unsupported.',
  },
};

export function userMessage(code: ErrorCode): UserMessage {
  return MESSAGES[code];
}

// Map an arbitrary thrown error to a user message. Never leaks the raw message
// into the UI text; at most the structured code is preserved for diagnostics.
export function messageFromError(err: unknown): UserMessage {
  if (err instanceof Error && (err as any).code && (err as any).code in MESSAGES) {
    return MESSAGES[(err as any).code as ErrorCode];
  }
  return MESSAGES[ErrorCode.WriteFailed];
}
