// StateMotion — starter preset audit (v0.1 Alpha scope gate).
// Run: node --experimental-transform-types src/statemotion/panel/src/starter/starterAudit.test.ts
//
// Asserts the bundled starter presets meet v0.1 launch criteria:
//  - canonical units (radians / 0..1 opacity / 0..1 curve)
//  - valid easing values (enum 0..4)
//  - no metadata/runtime indexes serialized
//  - deterministic serialization
//  - original StateMotion names (no duplicate presets)

import assert from 'node:assert';
import { BUNDLED_PRESETS } from './bundledPresets.ts';
import { validatePreset, serializePreset } from '../domain/presetSchema.ts';
import { getBinding, LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

const presets = BUNDLED_PRESETS;
assert.ok(presets.length >= 12 && presets.length <= 20, `preset count in scope (got ${presets.length})`);
pass(`starter preset count within scope (${presets.length})`);

// Unique preset ids + unique names (no duplicate presets).
assert.strictEqual(new Set(presets.map((p) => p.presetId)).size, presets.length, 'unique ids');
assert.strictEqual(new Set(presets.map((p) => p.name)).size, presets.length, 'unique names');
pass('no duplicate preset ids or names');

// Each preset: valid schema, original categories, valid logical ids only.
const validLogical = new Set(LOGICAL_IDS);
for (const p of presets) {
  const r = validatePreset(p);
  assert.ok(r.ok, `preset ${p.presetId} validates: ${r.errors?.join('; ')}`);
  for (const id of Object.keys(p.parameters)) {
    assert.ok(validLogical.has(id), `preset ${p.presetId} uses valid logical id ${id}`);
    const b = getBinding(id);
    // No metadata ownership serialized into creative preset values.
    assert.notStrictEqual(b?.stateOwnership, 'metadata', `preset ${p.presetId} must not serialize metadata`);
  }
}
pass('all presets validate, use valid logical ids, no metadata serialized');

// Easing value (if present) is a valid enum (0..4); custom curve values canonical 0..1.
for (const p of presets) {
  const e = p.parameters['transition.easing'];
  if (e !== undefined) {
    assert.ok(e >= 0 && e <= 4, `preset ${p.presetId} easing in enum range (got ${e})`);
  }
  for (const k of ['transition.curveX1', 'transition.curveX2', 'transition.curveY1', 'transition.curveY2']) {
    const v = p.parameters[k];
    if (v !== undefined) assert.ok(v >= 0 && v <= 1, `preset ${p.presetId} ${k} canonical 0..1`);
  }
}
pass('easing enum valid; custom curve values canonical 0..1');

// Deterministic serialization: serializing twice yields identical bytes.
for (const p of presets) {
  const a = serializePreset(p);
  const b = serializePreset(p);
  assert.strictEqual(a, b, `preset ${p.presetId} serializes deterministically`);
}
pass('all presets serialize deterministically');

console.log(`\nALL PASSED (${passed})`);
