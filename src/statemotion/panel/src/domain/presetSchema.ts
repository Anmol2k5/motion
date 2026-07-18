// StateMotion Preset Panel — preset domain model + schema validation.
//
// Original preset format: io.github.anmol2k5.statemotion.preset
// Parameters are keyed ONLY by logical ID (never Premiere runtime indexes).
// Unknown optional fields are preserved on round-trip. Migrations are explicit
// and keyed by schemaVersion.

import {
  SCHEMA_VERSION,
  BINDING_REVISION,
  PARAMETER_COUNT,
  LOGICAL_IDS,
  getBinding,
} from '../../../../../shared/generated/parameterBindings.ts';

export const FORMAT_ID = 'io.github.anmol2k5.statemotion.preset';
export const PRESET_EXTENSION = '.stmpreset';
export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;
export { SCHEMA_VERSION, BINDING_REVISION, PARAMETER_COUNT } from '../../../../../shared/generated/parameterBindings.ts';

export type ParameterValues = Record<string, number | string>;

export interface CompatibleContract {
  schemaVersion: number;
  bindingRevision: number;
  parameterCount: number;
}

export interface StateMotionPreset {
  formatId: string;
  schemaVersion: number;
  presetId: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  modifiedAt: string;
  tags: string[];
  category: string;
  collectionIds: string[];
  compatibleContract: CompatibleContract;
  parameters: ParameterValues;
  preview: { kind: string; [k: string]: unknown };
  // Unknown optional fields are preserved here on load.
  [key: string]: unknown;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const REQUIRED_FIELDS: (keyof StateMotionPreset)[] = [
  'formatId',
  'schemaVersion',
  'presetId',
  'name',
  'description',
  'author',
  'createdAt',
  'modifiedAt',
  'tags',
  'category',
  'collectionIds',
  'compatibleContract',
  'parameters',
  'preview',
];

const KNOWN_OPTIONAL = new Set([
  'formatId', 'schemaVersion', 'presetId', 'name', 'description', 'author',
  'createdAt', 'modifiedAt', 'tags', 'category', 'collectionIds',
  'compatibleContract', 'parameters', 'preview',
]);

export function validatePreset(preset: unknown): ValidationResult {
  const errors: string[] = [];
  if (!preset || typeof preset !== 'object') {
    return { ok: false, errors: ['preset must be an object'] };
  }
  const p = preset as Record<string, unknown>;

  if (p.formatId !== FORMAT_ID) {
    errors.push(`formatId must be "${FORMAT_ID}" (got ${JSON.stringify(p.formatId)})`);
  }
  if (typeof p.schemaVersion !== 'number' || p.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push(`unsupported schemaVersion (got ${JSON.stringify(p.schemaVersion)}, supported ${CURRENT_SCHEMA_VERSION})`);
  }

  for (const f of REQUIRED_FIELDS) {
    if (!(f in p)) errors.push(`missing required field "${f}"`);
  }

  if (p.tags !== undefined && !Array.isArray(p.tags)) errors.push('tags must be an array');
  if (p.collectionIds !== undefined && !Array.isArray(p.collectionIds)) errors.push('collectionIds must be an array');

  // Parameter logical IDs must exist in the contract.
  if (p.parameters && typeof p.parameters === 'object') {
    for (const key of Object.keys(p.parameters as object)) {
      if (!LOGICAL_IDS.includes(key)) {
        errors.push(`parameter uses invalid logical ID "${key}"`);
      }
    }
  }

  // Compatibility: contract must match the current generated contract.
  const cc = p.compatibleContract as CompatibleContract | undefined;
  if (cc && typeof cc === 'object') {
    if (cc.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`incompatible contract schemaVersion ${cc.schemaVersion} != ${SCHEMA_VERSION}`);
    }
    if (cc.bindingRevision !== BINDING_REVISION) {
      errors.push(`incompatible contract bindingRevision ${cc.bindingRevision} != ${BINDING_REVISION}`);
    }
    if (cc.parameterCount !== PARAMETER_COUNT) {
      errors.push(`incompatible contract parameterCount ${cc.parameterCount} != ${PARAMETER_COUNT}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// Explicit forward migration. Add cases as schema versions grow.
export function migratePreset(raw: unknown): StateMotionPreset {
  const p = raw as Record<string, unknown>;
  if (typeof p.schemaVersion === 'number' && p.schemaVersion === CURRENT_SCHEMA_VERSION) {
    // Already current; just normalize via validation-free copy.
    return p as unknown as StateMotionPreset;
  }
  // Legacy schema 0: lacked createdAt/modifiedAt.
  const now = new Date().toISOString();
  const migrated: StateMotionPreset = {
    formatId: FORMAT_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    presetId: String(p.presetId ?? 'p-' + Math.random().toString(36).slice(2, 10)),
    name: String(p.name ?? 'Untitled'),
    description: String(p.description ?? ''),
    author: String(p.author ?? 'StateMotion'),
    createdAt: String(p.createdAt ?? now),
    modifiedAt: String(p.modifiedAt ?? now),
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    category: String(p.category ?? 'Custom'),
    collectionIds: Array.isArray(p.collectionIds) ? (p.collectionIds as string[]) : [],
    compatibleContract: (p.compatibleContract as CompatibleContract) ?? {
      schemaVersion: SCHEMA_VERSION,
      bindingRevision: BINDING_REVISION,
      parameterCount: PARAMETER_COUNT,
    },
    parameters: (p.parameters as ParameterValues) ?? {},
    preview: (p.preview as { kind: string }) ?? { kind: 'generated' },
  };
  // Preserve unknown optional fields.
  for (const k of Object.keys(p)) {
    if (!KNOWN_OPTIONAL.has(k)) migrated[k] = p[k];
  }
  return migrated;
}

// Deterministic serialization: stable key order, sorted parameter keys,
// fixed JSON formatting (2-space). Round-trips via deserializePreset.
export function serializePreset(preset: StateMotionPreset): string {
  const ordered: Record<string, unknown> = {};
  const keys = Object.keys(preset).sort();
  for (const k of keys) ordered[k] = (preset as Record<string, unknown>)[k];
  if (ordered.parameters && typeof ordered.parameters === 'object') {
    const params = ordered.parameters as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const pk of Object.keys(params).sort()) sorted[pk] = params[pk];
    ordered.parameters = sorted;
  }
  return JSON.stringify(ordered, null, 2);
}

export function deserializePreset(text: string): StateMotionPreset {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return migratePreset(parsed);
}

// Convenience: resolve a logical parameter value to its numeric/string default
// when absent from a preset (used by preview + apply planning).
export function defaultValueFor(logicalId: string): number | string | undefined {
  return getBinding(logicalId)?.defaultVal;
}

// Build a valid user preset from a live canonical config + contract. Used by the
// inspector "Create preset from selection" action. Always produces a preset that
// passes validatePreset (fallback contract matches the current generated contract).
export function buildUserPresetFromConfig(
  cfg: CanonicalStateMotionConfig,
  contract: CompatibleContract | null,
): StateMotionPreset {
  const now = new Date().toISOString();
  const compatibleContract: CompatibleContract = contract ?? {
    schemaVersion: SCHEMA_VERSION,
    bindingRevision: BINDING_REVISION,
    parameterCount: PARAMETER_COUNT,
  };
  return {
    formatId: FORMAT_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    presetId: 'user-' + Date.now().toString(36),
    name: 'StateMotion preset',
    description: '',
    author: 'StateMotion',
    createdAt: now,
    modifiedAt: now,
    tags: [],
    category: 'Custom',
    collectionIds: [],
    compatibleContract,
    parameters: { ...cfg.parameters },
    preview: { kind: 'generated' },
  };
}
