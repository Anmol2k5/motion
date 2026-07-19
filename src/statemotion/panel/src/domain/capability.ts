// StateMotion — capability / status model (local UI/domain model, NOT telemetry).
//
// Represents the panel's understanding of the current environment so the UI can
// explain state to the user. Structured + typed; raw host exceptions are NEVER
// surfaced directly to users (see errorMessages.ts).

// Verification confidence for a given capability. Distinct from whether the
// capability is present: we may KNOW it is unavailable, or simply have NOT YET
// tested it on a real host.
export enum VerifyState {
  Verified = 'verified', // operator confirmed on real Premiere
  Available = 'available', // host reported present this session
  Unavailable = 'unavailable', // host reported absent / call failed
  Unknown = 'unknown', // not yet tested / not observable in this build
}

export enum Capability {
  PanelLoaded = 'PanelLoaded',
  NoActiveSequence = 'NoActiveSequence',
  NoSelection = 'NoSelection',
  UnsupportedSelection = 'UnsupportedSelection',
  NativeEffectMissing = 'NativeEffectMissing',
  StateMotionNotApplied = 'StateMotionNotApplied',
  Compatible = 'Compatible',
  OlderSupported = 'OlderSupported',
  NewerReadOnly = 'NewerReadOnly',
  InvalidContract = 'InvalidContract',
  ParameterMissing = 'ParameterMissing',
  ParameterTypeMismatch = 'ParameterTypeMismatch',
  HostOperationUnsupported = 'HostOperationUnsupported',
  WriteFailed = 'WriteFailed',
  ReadFailed = 'ReadFailed',
}

export interface CapabilityStatus {
  capability: Capability;
  verify: VerifyState;
  detail?: string;
}

export type CapabilityMatrix = Partial<Record<Capability, CapabilityStatus>>;

export function capabilityStatus(
  capability: Capability,
  verify: VerifyState,
  detail?: string,
): CapabilityStatus {
  return { capability, verify, detail };
}

// Human label for a capability, original StateMotion wording. Never includes
// raw exception text.
export function capabilityLabel(capability: Capability): string {
  switch (capability) {
    case Capability.PanelLoaded: return 'Panel loaded';
    case Capability.NoActiveSequence: return 'No active sequence';
    case Capability.NoSelection: return 'No selection';
    case Capability.UnsupportedSelection: return 'Unsupported selection';
    case Capability.NativeEffectMissing: return 'Native effect missing';
    case Capability.StateMotionNotApplied: return 'StateMotion not applied';
    case Capability.Compatible: return 'Contract compatible';
    case Capability.OlderSupported: return 'Older contract (supported, read-only)';
    case Capability.NewerReadOnly: return 'Newer contract (read-only)';
    case Capability.InvalidContract: return 'Invalid contract';
    case Capability.ParameterMissing: return 'Parameter missing';
    case Capability.ParameterTypeMismatch: return 'Parameter type mismatch';
    case Capability.HostOperationUnsupported: return 'Host operation unsupported';
    case Capability.WriteFailed: return 'Write failed';
    case Capability.ReadFailed: return 'Read failed';
  }
}
