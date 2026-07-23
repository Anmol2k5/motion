// StateMotion Preset Panel — compatibility, parameter map, apply-plan tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/compatibility.test.ts

import assert from 'node:assert';
import { checkCompatibility, CompatLevel } from './compatibility.ts';
import { EffectParameterMap } from './parameterMap.ts';
import { buildApplyPlan, ItemStatus } from './applyPlan.ts';

import { PARAMETER_COUNT } from './presetSchema.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

// ---- compatibility ----
(() => {
  const ok = checkCompatibility({ schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT });
  assert.strictEqual(ok.level, CompatLevel.Ok, 'matching contract is Ok');
  pass('compatibility Ok for matching contract');
})();
(() => {
  const ro = checkCompatibility({ schemaVersion: 1, bindingRevision: 1, parameterCount: 22 });
  assert.strictEqual(ro.level, CompatLevel.ReadOnly, 'older param count -> read-only diagnostic');
  pass('compatibility ReadOnly for older parameterCount');
})();
(() => {
  const bad = checkCompatibility({ schemaVersion: 2, bindingRevision: 2, parameterCount: PARAMETER_COUNT });
  assert.strictEqual(bad.level, CompatLevel.Incompatible, 'newer schema -> incompatible');
  pass('compatibility Incompatible for newer schemaVersion');
})();

// ---- parameter map ----
(() => {
  // Host reports wireName -> runtime index. Map resolves logicalId -> index.
  const enumerate = (wireName: string): number | undefined => {
    const map: Record<string, number> = { 'SM Scale X B': 9 };
    return map[wireName];
  };
  const pm = new EffectParameterMap(enumerate);
  const idx = pm.resolve('transform.scaleX.b');
  assert.strictEqual(idx, 9, 'resolves logicalId to runtime index via wireName');
  pass('EffectParameterMap resolves logicalId -> runtime index');
})();
(() => {
  // Index drift / unknown wireName must not silently resolve.
  const enumerate = (_: string): number | undefined => undefined;
  const pm = new EffectParameterMap(enumerate);
  assert.strictEqual(pm.resolve('transform.scaleX.b'), undefined, 'unknown wireName -> undefined');
  pass('EffectParameterMap returns undefined for unknown wireName (no blind write)');
})();

// ---- apply plan ----
(() => {
  const selection = [
    { clipId: 'clip1', hasStateMotion: true, contract: { schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT } },
    { clipId: 'clip2', hasStateMotion: false, contract: null },
    { clipId: 'clip3', hasStateMotion: true, contract: { schemaVersion: 2, bindingRevision: 2, parameterCount: PARAMETER_COUNT } },
  ] as any[];
  const plan = buildApplyPlan(selection, 'presetX', {
    schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT,
  });
  const byId: Record<string, any> = {};
  for (const it of plan.items) byId[it.clipId] = it;
  assert.strictEqual(byId['clip1'].status, ItemStatus.Supported, 'clip1 supported');
  assert.strictEqual(byId['clip2'].status, ItemStatus.Unsupported, 'clip2 no effect');
  assert.strictEqual(byId['clip3'].status, ItemStatus.Incompatible, 'clip3 newer contract');
  assert.strictEqual(plan.summary.applied, 1);
  assert.strictEqual(plan.summary.skipped, 1);
  assert.strictEqual(plan.summary.failed, 1);
  pass('apply plan classifies supported/unsupported/incompatible');
})();

// ---- unknown contract blocks writes ----
(() => {
  const plan = buildApplyPlan(
    [{ clipId: 'c', hasStateMotion: true, contract: { schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT } } as any],
    'presetX',
    { schemaVersion: 5, bindingRevision: 2, parameterCount: PARAMETER_COUNT }, // preset claims unknown future contract
  );
  assert.strictEqual(plan.items[0].status, ItemStatus.Incompatible, 'preset with unknown contract is incompatible');
  assert.strictEqual(plan.summary.applied, 0);
  pass('preset declaring unknown contract is blocked');
})();

console.log(`\nALL PASSED (${passed})`);
