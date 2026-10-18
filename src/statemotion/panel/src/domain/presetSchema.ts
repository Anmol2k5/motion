import { isRecord, validateParameterValues, canonicalDefault } from './parameterValues.ts';
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

export interface PointValue { x: number; y: number; }
export type ParameterValue = number | string | boolean | PointValue;
export type ParameterValues = Record<string, ParameterValue>;

export interface CompatibleContract {
  schemaVersion: number;
  bindingRevision: number;
  parameterCount: number;
}

export interface CanonicalStateMotionConfig {
  parameters: ParameterValues;
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
  if(!isRecord(preset))return {ok:false,errors:['preset must be an object']};
  const p=preset, errors:string[]=[];
  if(p.formatId!==FORMAT_ID)errors.push('unsupported formatId');
  if(p.schemaVersion!==CURRENT_SCHEMA_VERSION)errors.push('unsupported schemaVersion');
  for(const field of REQUIRED_FIELDS)if(!(field in p))errors.push(`missing required field "${field}"`);
  for(const field of ['presetId','name','description','author','createdAt','modifiedAt','category'])
    if(typeof p[field]!=='string')errors.push(`${field} must be a string`);
  if(typeof p.presetId==='string'&&(!/^[a-z0-9][a-z0-9._-]{0,199}$/i.test(p.presetId)||p.presetId.includes('..')))
    errors.push('unsafe presetId');
  if(typeof p.name==='string'&&!p.name.trim())errors.push('name must not be empty');
  for(const field of ['createdAt','modifiedAt'])if(typeof p[field]==='string'&&!Number.isFinite(Date.parse(p[field] as string)))errors.push(`${field} invalid date`);
  for(const field of ['tags','collectionIds'])if(!Array.isArray(p[field])||!(p[field] as unknown[]).every(x=>typeof x==='string'))errors.push(`${field} must be a string array`);
  if(!isRecord(p.preview)||p.preview.kind!=='generated')errors.push('unsupported preview');
  if(!isRecord(p.compatibleContract)||p.compatibleContract.schemaVersion!==SCHEMA_VERSION||
      p.compatibleContract.bindingRevision!==BINDING_REVISION||p.compatibleContract.parameterCount!==PARAMETER_COUNT)
    errors.push('incompatible contract schemaVersion/bindingRevision/parameterCount');
  errors.push(...validateParameterValues(p.parameters).errors);
  return {ok:errors.length===0,errors};
}

// Historical contract pairs verified from committed schema history.
const LEGACY_CONTRACTS=new Set(['1:20','2:25','2:43','3:60','3:67']);
export function migratePreset(raw: unknown): StateMotionPreset {
  if(!isRecord(raw)||raw.formatId!==FORMAT_ID)throw new Error('unsupported preset format');
  if(raw.schemaVersion!==0&&raw.schemaVersion!==CURRENT_SCHEMA_VERSION)throw new Error('unsupported schemaVersion');
  const contract=raw.compatibleContract;
  if(!isRecord(contract)||contract.schemaVersion!==SCHEMA_VERSION)throw new Error('incompatible contract');
  const current=contract.bindingRevision===BINDING_REVISION&&contract.parameterCount===PARAMETER_COUNT;
  if(!current&&!LEGACY_CONTRACTS.has(`${contract.bindingRevision}:${contract.parameterCount}`))throw new Error('unsupported historical contract');
  const preset=structuredClone(raw) as unknown as StateMotionPreset;
  // Legacy fixtures use the same canonical units; only introduced fields/defaults differ.
  preset.schemaVersion=CURRENT_SCHEMA_VERSION;
  preset.compatibleContract={schemaVersion:SCHEMA_VERSION,bindingRevision:BINDING_REVISION,parameterCount:PARAMETER_COUNT};
  if(raw.schemaVersion===0){const now=new Date().toISOString();preset.createdAt??=now;preset.modifiedAt??=now;}
  const result=validatePreset(preset);
  if(!result.ok)throw new Error('invalid preset: '+result.errors.join('; '));
  return preset;
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
export function defaultValueFor(logicalId: string): ParameterValue | undefined {
  return canonicalDefault(logicalId);
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
