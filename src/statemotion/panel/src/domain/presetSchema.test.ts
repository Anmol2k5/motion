// StateMotion Preset Panel — preset domain model + schema validation tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/presetSchema.test.ts
// TDD: these tests start RED and guide presetSchema.ts.

import assert from 'node:assert';
import {
  FORMAT_ID,
  SCHEMA_VERSION,
  PARAMETER_COUNT,
  validatePreset,
  migratePreset,
  serializePreset,
  deserializePreset,
  PRESET_EXTENSION,
  buildUserPresetFromConfig,
  type CanonicalStateMotionConfig,
} from './presetSchema.ts';

let passed = 0;
function pass(name: string) {
  console.log(`PASS  ${name}`);
  passed++;
}

function basePreset(overrides: Record<string, unknown> = {}) {
  return {
    formatId: FORMAT_ID,
    schemaVersion: SCHEMA_VERSION,
    presetId: 'p-soft-arrival',
    name: 'Soft Arrival',
    description: 'Gentle scale-up entrance',
    author: 'StateMotion',
    createdAt: '2026-07-18T00:00:00.000Z',
    modifiedAt: '2026-07-18T00:00:00.000Z',
    tags: ['entrance', 'scale'],
    category: 'Entrances',
    collectionIds: [],
    compatibleContract: { schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT },
    parameters: { 'transform.scaleX.a': 1.0, 'transform.scaleX.b': 1.15 },
    preview: { kind: 'generated' },
    ...overrides,
  };
}

// ---- valid ----
(() => {
  const p = basePreset();
  assert.ok(validatePreset(p).ok, 'valid preset should pass');
  pass('valid preset passes validation');
})();

// ---- invalid formatId ----
(() => {
  const p = basePreset({ formatId: 'com.evil.other' });
  const r = validatePreset(p);
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => e.includes('formatId')), 'should report formatId error');
  pass('rejects wrong formatId');
})();

// ---- unsupported schema ----
(() => {
  const p = basePreset({ schemaVersion: 999 });
  const r = validatePreset(p);
  assert.ok(!r.ok, 'unsupported schemaVersion should fail');
  pass('rejects unsupported schemaVersion');
})();

// ---- missing required field ----
(() => {
  const p: Record<string, unknown> = basePreset();
  delete p.name;
  const r = validatePreset(p);
  assert.ok(!r.ok, 'missing name should fail');
  pass('rejects missing required field (name)');
})();

// ---- invalid logical id in parameters ----
(() => {
  const p = basePreset({ parameters: { 'transform.bogus.a': 1.0 } });
  const r = validatePreset(p);
  assert.ok(!r.ok, 'unknown logicalId should fail');
  assert.ok(r.errors.some((e) => e.includes('transform.bogus.a')), 'should name the bad id');
  pass('rejects invalid logical parameter ID');
})();

// ---- incompatible contract ----
(() => {
  const p = basePreset({ compatibleContract: { schemaVersion: 1, bindingRevision: 1, parameterCount: 5 } });
  const r = validatePreset(p);
  assert.ok(!r.ok, 'parameterCount 5 should be incompatible');
  pass('rejects incompatible contract (parameterCount)');
})();

// ---- unknown optional fields preserved ----
(() => {
  const p = basePreset({ customNote: 'keep me', ui: { accent: 'cyan' } });
  const round = deserializePreset(serializePreset(p));
  assert.strictEqual((round as Record<string, unknown>).customNote, 'keep me');
  assert.strictEqual(((round as Record<string, unknown>).ui as Record<string, unknown>).accent, 'cyan');
  pass('preserves unknown optional fields on round-trip');
})();

// ---- import/export round trip ----
(() => {
  const p = basePreset();
  const text = serializePreset(p);
  assert.ok(text.includes(FORMAT_ID), 'serialized text must contain formatId');
  const back = deserializePreset(text);
  assert.strictEqual(back.presetId, p.presetId);
  assert.strictEqual(back.parameters['transform.scaleX.b'], 1.15);
  pass('import/export round-trip preserves preset');
})();

// ---- deterministic serialization ----
(() => {
  const a = serializePreset(basePreset());
  const b = serializePreset(basePreset());
  assert.strictEqual(a, b, 'serialization must be deterministic');
  pass('serializePreset is deterministic');
})();

// ---- migration: older schema migrates forward ----
(() => {
  // A hypothetical schema 0 preset (no createdAt/modifiedAt) is upgraded.
  const legacy = {
    formatId: FORMAT_ID,
    schemaVersion: 0,
    presetId: 'p-legacy',
    name: 'Legacy',
    description: '',
    author: 'StateMotion',
    tags: [],
    category: 'Custom',
    collectionIds: [],
    compatibleContract: { schemaVersion: 1, bindingRevision: 2, parameterCount: 25 },
    parameters: {},
    preview: { kind: 'generated' },
  };
  const migrated = migratePreset(legacy);
  assert.strictEqual(migrated.schemaVersion, SCHEMA_VERSION, 'should migrate to current schema');
  assert.ok(typeof migrated.createdAt === 'string', 'migration should synthesize createdAt');
  assert.ok(typeof migrated.modifiedAt === 'string', 'migration should synthesize modifiedAt');
  pass('migratePreset upgrades older schema and fills required fields');
})();

// ---- extension constant ----
(() => {
  assert.strictEqual(PRESET_EXTENSION, '.stmpreset');
  pass('preset extension is .stmpreset');
})();

// ---- buildUserPresetFromConfig ----
(() => {
  const cfg: CanonicalStateMotionConfig = { parameters: { 'transform.opacity.b': 1, 'transition.manualProgress': 0.5 } };
  const preset = buildUserPresetFromConfig(cfg, null);
  assert.ok(validatePreset(preset).ok, 'built preset should validate');
  assert.strictEqual(preset.formatId, FORMAT_ID);
  assert.strictEqual(preset.category, 'Custom');
  assert.strictEqual(preset.parameters['transition.manualProgress'], 0.5);
  assert.strictEqual(preset.compatibleContract.schemaVersion, SCHEMA_VERSION);
  pass('buildUserPresetFromConfig produces a valid preset');
})();

console.log(`\nALL PASSED (${passed})`);
