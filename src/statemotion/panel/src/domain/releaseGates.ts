// StateMotion — release blocker model (pure classification, no UI).
//
// Three severity levels for launch gates. Private Alpha cannot launch with any
// BLOCKER. MAJOR requires explicit documented acceptance. MINOR may ship.

export enum GateSeverity {
  Blocker = 'blocker',
  Major = 'major',
  Minor = 'minor',
}

export interface ReleaseGate {
  id: string;
  title: string;
  severity: GateSeverity;
  status: 'open' | 'accepted' | 'resolved';
  note?: string;
}

export function classifyGate(severity: GateSeverity): 'blocker' | 'major' | 'minor' {
  return severity;
}

// Can Private Alpha launch given the current open gates?
export function canLaunchPrivateAlpha(gates: ReleaseGate[]): boolean {
  return !gates.some((g) => g.severity === GateSeverity.Blocker && g.status === 'open');
}

// Open gates grouped by severity (for the launch checklist view).
export function openGatesBySeverity(gates: ReleaseGate[]): Record<GateSeverity, ReleaseGate[]> {
  return {
    [GateSeverity.Blocker]: gates.filter((g) => g.severity === GateSeverity.Blocker && g.status === 'open'),
    [GateSeverity.Major]: gates.filter((g) => g.severity === GateSeverity.Major && g.status === 'open'),
    [GateSeverity.Minor]: gates.filter((g) => g.severity === GateSeverity.Minor && g.status === 'open'),
  };
}
