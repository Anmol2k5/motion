// StateMotion Preset Panel — bundled preset library tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/starter/bundledPresets.test.ts

import assert from 'node:assert';
import { BUNDLED_PRESETS, CATEGORIES } from './bundledPresets.ts';
import { validatePreset } from '../domain/presetSchema.ts';
import { LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';

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

console.log(`\nALL PASSED (${passed})`);
