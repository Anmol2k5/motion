// StateMotion — diagnostics + copy-debug-report (pure, no host calls).
//
// Builds a structured diagnostic snapshot and a plain-text report. Generation is
// PURE and UNIT-TESTED. The report contains ONLY non-sensitive technical state.
// It must NEVER include: project/media paths, usernames, private file paths,
// clip names (unless explicitly required), preset contents, or user content.

import { getProductVersion } from './productVersion.ts';
import { SCHEMA_VERSION, BINDING_REVISION, PARAMETER_COUNT } from '../../../../../shared/generated/parameterBindings.ts';
import { Capability, VerifyState, type CapabilityMatrix } from './capability.ts';

export interface DiagnosticSnapshot {
  productVersion: string;
  productEdition: string;
  presetFormatVersion: number; // = SCHEMA_VERSION
  parameterSchemaVersion: number; // = SCHEMA_VERSION (contract schema)
  bindingRevision: number;
  expectedParameterCount: number;
  effectMatchName: string | null;
  contractStatus: 'compatible' | 'read-only' | 'incompatible' | 'unknown';
  selectionStatus: string;
  selectionCount: number;
  capabilities: CapabilityMatrix;
  lastOperation: string;
  lastError: string | null;
  lastErrorCode: string | null;
  buildInfo: string;
}

export interface DiagnosticInput {
  productVersion?: string;
  productEdition?: string;
  effectMatchName?: string | null;
  contractStatus?: DiagnosticSnapshot['contractStatus'];
  selectionStatus?: string;
  selectionCount?: number;
  capabilities?: CapabilityMatrix;
  lastOperation?: string;
  lastError?: string | null;
  lastErrorCode?: string | null;
  buildInfo?: string;
}

const MATCH_NAME = 'AE.io.github.anmol2k5.statemotion.effect';

// Only the known constant is safe to surface. Arbitrary match-name strings could
// contain host paths; never echo unknown values into the debug report.
function safeMatchName(value: string | null | undefined): string | null {
  return value === MATCH_NAME ? MATCH_NAME : null;
}

export function buildSnapshot(input: DiagnosticInput = {}): DiagnosticSnapshot {
  const pv = getProductVersion();
  return {
    productVersion: input.productVersion ?? pv.version,
    productEdition: input.productEdition ?? pv.edition,
    presetFormatVersion: SCHEMA_VERSION,
    parameterSchemaVersion: SCHEMA_VERSION,
    bindingRevision: BINDING_REVISION,
    expectedParameterCount: PARAMETER_COUNT,
    effectMatchName: safeMatchName(input.effectMatchName),
    contractStatus: input.contractStatus ?? 'unknown',
    selectionStatus: input.selectionStatus ?? 'unknown',
    selectionCount: input.selectionCount ?? 0,
    capabilities: input.capabilities ?? {},
    lastOperation: input.lastOperation ?? 'none',
    lastError: input.lastError ?? null,
    lastErrorCode: input.lastErrorCode ?? null,
    buildInfo: input.buildInfo ?? '',
  };
}

// Plain-text debug report. Deliberately excludes sensitive fields.
export function buildDebugReport(input: DiagnosticInput = {}): string {
  const s = buildSnapshot(input);
  const lines: string[] = [];
  lines.push('=== StateMotion Debug Report ===');
  lines.push(`StateMotion Version: ${s.productVersion} (${s.productEdition})`);
  lines.push(`Panel Version: ${s.productVersion}`);
  lines.push(`Preset Format Version: ${s.presetFormatVersion}`);
  lines.push(`Parameter Schema Version: ${s.parameterSchemaVersion}`);
  lines.push(`Binding Revision: ${s.bindingRevision}`);
  lines.push(`Expected Parameter Count: ${s.expectedParameterCount}`);
  lines.push(`Effect Match Name: ${s.effectMatchName ?? '(unknown)'}`);
  lines.push(`Contract Status: ${s.contractStatus}`);
  lines.push(`Selection Count: ${s.selectionCount}`);
  lines.push(`Last Operation: ${s.lastOperation}`);
  lines.push(`Last Structured Error: ${s.lastErrorCode ?? 'none'}`);
  if (s.buildInfo) lines.push(`Build Info: ${s.buildInfo}`);
  // Capabilities: only capability + verify state, never raw detail with paths.
  const caps = Object.values(s.capabilities);
  if (caps.length) {
    lines.push('Capabilities:');
    for (const c of caps) {
      lines.push(`  - ${c.capability}: ${c.verify}`);
    }
  }
  lines.push('=== End Report ===');
  return lines.join('\n');
}

export const EXPECTED_MATCH_NAME = MATCH_NAME;

// Assert a debug report contains no obvious sensitive data. Used in tests and
// as a guard. Returns the list of forbidden substrings found (empty = clean).
const SENSITIVE_HINTS = [
  'username', 'C:\\', 'D:\\', '/Users/', '/home/', ':\\', '.aex', '.prproj',
  'clip name', 'project path', 'file path', 'media',
];
export function scanForSensitive(report: string): string[] {
  const lower = report.toLowerCase();
  return SENSITIVE_HINTS.filter((h) => lower.includes(h.toLowerCase()));
}
