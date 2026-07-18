// StateMotion Preset Panel — contract compatibility check.
// Compares a preset/effect contract against the current generated contract.

import { SCHEMA_VERSION, BINDING_REVISION, PARAMETER_COUNT } from '../../../../../shared/generated/parameterBindings.ts';
import type { CompatibleContract } from './presetSchema.ts';

export enum CompatLevel {
  Ok = 'ok',
  ReadOnly = 'readonly',
  Incompatible = 'incompatible',
}

export interface CompatResult {
  level: CompatLevel;
  reasons: string[];
}

export function checkCompatibility(contract: CompatibleContract | null | undefined): CompatResult {
  const reasons: string[] = [];
  if (!contract) {
    return { level: CompatLevel.Incompatible, reasons: ['missing contract'] };
  }
  // Newer schema: we cannot safely write -> incompatible (read-only diagnostic).
  if (contract.schemaVersion > SCHEMA_VERSION) {
    reasons.push(`preset/effect schemaVersion ${contract.schemaVersion} > current ${SCHEMA_VERSION}`);
    return { level: CompatLevel.Incompatible, reasons };
  }
  if (contract.bindingRevision > BINDING_REVISION) {
    reasons.push(`bindingRevision ${contract.bindingRevision} > current ${BINDING_REVISION}`);
    return { level: CompatLevel.Incompatible, reasons };
  }
  if (contract.parameterCount !== PARAMETER_COUNT) {
    reasons.push(`parameterCount ${contract.parameterCount} != current ${PARAMETER_COUNT} (older project)`);
    return { level: CompatLevel.ReadOnly, reasons };
  }
  return { level: CompatLevel.Ok, reasons };
}
