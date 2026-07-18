// valueConversion.test.ts
// Run: node --experimental-transform-types src/statemotion/panel/src/host/valueConversion.test.ts

import assert from 'node:assert';
import { toNative, toCanonical, UnknownLogicalId, ConversionTypeMismatch } from './valueConversion.ts';
import { getBinding, PARAMETER_COUNT, LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';

const b = (id: string) => getBinding(id)!;

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }
function throws(fn: () => unknown, ctor: Function) {
  try { fn(); } catch (e) { if (e instanceof ctor) return; throw e; }
  throw new Error('expected throw');
}

(() => {
  assert.strictEqual(toNative('transition.manualProgress', 0.5, b('transition.manualProgress')), 50);
  assert.strictEqual(toNative('transition.manualProgress', 1, b('transition.manualProgress')), 100);
  assert.strictEqual(toCanonical('transition.manualProgress', 50, b('transition.manualProgress')), 0.5);
  assert.strictEqual(toCanonical('transition.manualProgress', 100, b('transition.manualProgress')), 1);
  pass('manualProgress 0..1 <-> 0..100');
})();

(() => {
  assert.strictEqual(toNative('transition.durationSeconds', 2.5, b('transition.durationSeconds')), 2.5);
  assert.strictEqual(toCanonical('transition.delaySeconds', 0, b('transition.delaySeconds')), 0);
  pass('duration/delay identity round trip');
})();

(() => {
  assert.strictEqual(toNative('transform.scaleX.a', 1.3, b('transform.scaleX.a')), 130);
  assert.ok(Math.abs(toCanonical('transform.scaleX.a', 130, b('transform.scaleX.a')) - 1.3) < 1e-9);
  assert.ok(Math.abs(toCanonical('transform.scaleX.a', 50, b('transform.scaleX.a')) - 0.5) < 1e-9);
  pass('scale multiplier <-> percent');
})();

(() => {
  assert.strictEqual(toNative('transform.opacity.a', 1, b('transform.opacity.a')), 100);
  assert.strictEqual(toCanonical('transform.opacity.a', 50, b('transform.opacity.a')), 0.5);
  assert.strictEqual(toCanonical('transform.opacity.a', 250, b('transform.opacity.a')), 1);
  pass('opacity 0..1 <-> percent (canonical clamps to 0..1)');
})();

(() => {
  assert.ok(Math.abs(toNative('transform.rotation.a', Math.PI / 2, b('transform.rotation.a')) - 90) < 1e-9);
  assert.ok(Math.abs(toNative('transform.rotation.a', -Math.PI / 4, b('transform.rotation.a')) - (-45)) < 1e-9);
  assert.ok(Math.abs(toCanonical('transform.rotation.a', 180, b('transform.rotation.a')) - Math.PI) < 1e-9);
  pass('rotation radians <-> degrees');
})();

(() => {
  assert.deepStrictEqual(toNative('transform.position.a', { x: 0.5, y: 0.5 }, b('transform.position.a')), { x: 50, y: 50 });
  assert.deepStrictEqual(toNative('transform.position.a', 'frameCenter', b('transform.position.a')), { x: 50, y: 50 });
  assert.deepStrictEqual(toCanonical('transform.position.a', { x: 100, y: 100 }, b('transform.position.a')), { x: 1, y: 1 });
  pass('point normalized <-> percent, token resolves');
})();

(() => {
  assert.strictEqual(toNative('transition.mode', 3, b('transition.mode')), 3);
  assert.strictEqual(toCanonical('transition.mode', 5, b('transition.mode')), 5);
  pass('popup enum identity');
})();

(() => {
  throws(() => toNative('nope', 1, { nativeType: 'FLOAT_SLIDER' } as any), UnknownLogicalId);
  pass('unknown logical id throws');
})();

(() => {
  // rotation kind expects ANGLE; feed a FLOAT_SLIDER binding
  throws(() => toNative('transform.rotation.a', 1, b('transform.scaleX.a')), ConversionTypeMismatch);
  pass('logicalId/nativeType disagreement throws');
})();

(() => {
  for (const id of LOGICAL_IDS) {
    assert.doesNotThrow(() => toNative(id, 1, b(id)), UnknownLogicalId);
  }
  pass('all 20 logical ids have a conversion kind');
})();
