import { TypedStateConfig } from './typedConfig.ts';
import assert from 'node:assert';
import { test } from 'node:test';

test('TypedStateConfig returns fallback on null/empty config', () => {
  const cfg = new TypedStateConfig(null);
  assert.strictEqual(cfg.getNumber('transform.scaleX.a', 100), 100);
  assert.strictEqual(cfg.getBoolean('motionBlur.enabled', true), true);
  assert.strictEqual(cfg.getString('stroke.color1.a', 'white'), 'white');
  assert.deepStrictEqual(cfg.getCurve(), [0.33, 0.0, 0.67, 1.0]);
});

test('TypedStateConfig reads typed numbers, booleans, strings, curves correctly', () => {
  const cfg = new TypedStateConfig({
    parameters: {
      'transform.scaleX.a': 150,
      'motionBlur.enabled': true,
      'stroke.color1.a': '#ff0000',
      'transition.curveX1': 0.1,
      'transition.curveY1': 0.2,
      'transition.curveX2': 0.8,
      'transition.curveY2': 0.9,
    },
  });

  assert.strictEqual(cfg.getNumber('transform.scaleX.a', 100), 150);
  assert.strictEqual(cfg.getBoolean('motionBlur.enabled', false), true);
  assert.strictEqual(cfg.getString('stroke.color1.a', 'white'), '#ff0000');
  assert.deepStrictEqual(cfg.getCurve(), [0.1, 0.2, 0.8, 0.9]);
});
