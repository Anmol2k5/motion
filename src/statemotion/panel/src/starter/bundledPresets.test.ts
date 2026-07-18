// StateMotion Preset Panel — bundled preset library tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/starter/bundledPresets.test.ts

import assert from 'node:assert';
import { BUNDLED_PRESETS, CATEGORIES } from './bundledPresets.ts';
import { validatePreset } from '../domain/presetSchema.ts';
import { LOGICAL_IDS, getBinding } from '../../../../../shared/generated/parameterBindings.ts';
import { toNative } from '../host/valueConversion.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

(() => {
  assert.ok(BUNDLED_PRESETS.length >= 12 && BUNDLED_PRESETS.length <= 20, 'ponytail target 12-20 presets');
  assert.strictEqual(new Set(BUNDLED_PRESETS.map((p) => p.presetId)).size, BUNDLED_PRESETS.length, 'preset ids unique');
  pass(`bundled library has ${BUNDLED_PRESETS.length} unique original presets (target 12-20)`);
})();

(() => {
  for (const p of BUNDLED_PRESETS) {
    const r = validatePreset(p);
    assert.ok(r.ok, `preset ${p.presetId} should validate: ${r.errors.join('; ')}`);
  }
  pass('every bundled preset passes schema validation');
})();

(() => {
  for (const p of BUNDLED_PRESETS) {
    for (const key of Object.keys(p.parameters)) {
      assert.ok(LOGICAL_IDS.includes(key), `preset ${p.presetId} uses valid logical id ${key}`);
    }
  }
  pass('all bundled preset parameter IDs are valid logical IDs');
})();

(() => {
  assert.ok(CATEGORIES.length >= 5, 'has several original categories');
  for (const p of BUNDLED_PRESETS) assert.ok(CATEGORIES.includes(p.category), `category ${p.category} declared`);
  pass('all preset categories are declared original categories');
})();

(() => {
  for (const p of BUNDLED_PRESETS) {
    const r = validatePreset(p);
    assert.ok(r.ok, `preset ${p.presetId} should validate: ${r.errors.join('; ')}`);
    for (const [id, v] of Object.entries(p.parameters)) {
      // opacity must be 0..1 canonical, not percent
      if (id.startsWith('transform.opacity')) assert.ok((v as number) <= 1, `${p.presetId} ${id} must be <= 1 canonical, got ${v}`);
      // rotation must be radians, not degrees (|rad| < ~6.3)
      if (id.startsWith('transform.rotation')) assert.ok(Math.abs(v as number) < 6.3, `${p.presetId} ${id} must be radians, got ${v}`);
      // every stored value must convert to a finite native value
      assert.doesNotThrow(() => toNative(id, v as any, getBinding(id)!), `preset ${p.presetId} ${id} converts to finite native`);
    }
  }
  pass('all bundled presets store true canonical units (radians / 0..1 opacity)');
})();

console.log(`\nALL PASSED (${passed})`);
