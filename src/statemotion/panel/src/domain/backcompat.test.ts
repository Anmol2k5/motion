// StateMotion — easing back-compat matrix (gen A/B/C).
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/backcompat.test.ts

import assert from 'node:assert';
import {
  validatePreset,
  migratePreset,
  serializePreset,
  deserializePreset,
  defaultValueFor,
  PARAMETER_COUNT,
} from './presetSchema.ts';
import { checkCompatibility, CompatLevel } from './compatibility.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

// A: legacy preset (bindingRevision 1, no easing) migrates and validates; missing
// easing resolves to the EASE_IN_OUT default when applied.
(() => {
  const legacy = {
    formatId: 'io.github.anmol2k5.statemotion.preset',
    schemaVersion: 1,
    presetId: 'legacy-1',
    name: 'Legacy Entrance',
    description: '',
    author: 'S',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    tags: ['entrance'],
    category: 'Entrances',
    collectionIds: [],
    compatibleContract: { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 },
    parameters: { 'transform.opacity.a': 0, 'transform.opacity.b': 1 },
    preview: { kind: 'generated' },
  };
  const m = migratePreset(legacy);
  const r = validatePreset(m);
  assert.ok(r.ok, 'migrated legacy preset validates: ' + r.errors.join('; '));
  // Easing absent in legacy -> apply uses the contract default (EASE_IN_OUT = 3).
  assert.strictEqual(defaultValueFor('transition.easing'), 3, 'easing default is EASE_IN_OUT');
  assert.strictEqual(m.parameters['transition.easing'], undefined, 'legacy kept no easing key');
  pass('A: legacy preset migrates + easing defaults to EASE_IN_OUT');
})();

// B: Custom-curve preset round-trips through serialize/deserialize intact.
(() => {
  const p = {
    formatId: 'io.github.anmol2k5.statemotion.preset',
    schemaVersion: 1,
    presetId: 'custom-1',
    name: 'Custom Curve',
    description: '',
    author: 'S',
    createdAt: '2026-07-18T00:00:00Z',
    modifiedAt: '2026-07-18T00:00:00Z',
    tags: ['custom'],
    category: 'Custom',
    collectionIds: [],
    compatibleContract: { schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT },
    parameters: {
      'transition.easing': 4,
      'transition.curveX1': 0.25, 'transition.curveY1': 0.1,
      'transition.curveX2': 0.25, 'transition.curveY2': 1.0,
    },
    preview: { kind: 'generated' },
  };
  const round = deserializePreset(serializePreset(p as any));
  assert.strictEqual(round.parameters['transition.easing'], 4, 'easing preserved');
  assert.strictEqual(round.parameters['transition.curveX1'], 0.25, 'curveX1 preserved');
  assert.strictEqual(round.parameters['transition.curveY2'], 1.0, 'curveY2 preserved');
  const r = validatePreset(round);
  assert.ok(r.ok, 'custom preset validates: ' + r.errors.join('; '));
  pass('B: custom-curve preset round-trips');
})();

// C: an older project (parameterCount 20) is ReadOnly, never written blindly.
(() => {
  const ro = checkCompatibility({ schemaVersion: 1, bindingRevision: 1, parameterCount: 20 });
  assert.strictEqual(ro.level, CompatLevel.ReadOnly, 'older project is read-only');
  const cur = checkCompatibility({ schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT });
  assert.strictEqual(cur.level, CompatLevel.Ok, 'current contract is Ok');
  pass('C: older project contract is ReadOnly');
})();

console.log(`\nALL PASSED (${passed})`);
