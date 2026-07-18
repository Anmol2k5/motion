// StateMotion Preset Panel — deterministic preview card tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/preview/previewCard.test.ts

import assert from 'node:assert';
import { renderPreviewSvg, describePresetMotion } from './previewCard.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

(() => {
  const svg = renderPreviewSvg({ presetId: 'x', name: 'Test', parameters: { 'transform.scaleX.b': 1.2, 'transform.scaleY.b': 1.2, 'transform.rotation.b': 30, 'transform.opacity.a': 0, 'transform.opacity.b': 100 }, category: 'Zooms' } as any);
  assert.ok(svg.startsWith('<svg'), 'output is svg');
  assert.ok(svg.includes('Test'), 'svg includes preset name');
  pass('renderPreviewSvg returns an SVG string with the preset name');
})();

(() => {
  // Determinism: same input -> identical output.
  const p: any = { presetId: 'x', name: 'D', parameters: { 'transform.scaleX.b': 1.5 }, category: 'C' };
  assert.strictEqual(renderPreviewSvg(p), renderPreviewSvg(p), 'deterministic');
  pass('renderPreviewSvg is deterministic');
})();

(() => {
  // Scale is reflected in the SVG geometry.
  const small = renderPreviewSvg({ presetId: 'x', name: 'S', parameters: { 'transform.scaleX.b': 100, 'transform.scaleY.b': 100 }, category: 'C' } as any);
  const big = renderPreviewSvg({ presetId: 'x', name: 'B', parameters: { 'transform.scaleX.b': 150, 'transform.scaleY.b': 150 }, category: 'C' } as any);
  assert.notStrictEqual(small, big, 'scale change alters preview');
  assert.ok(big.includes('width="51"'), 'big scale encoded as larger width (34*1.5=51)');
  pass('preview reflects scale values');
})();

(() => {
  // Rotation encoded.
  const r = renderPreviewSvg({ presetId: 'x', name: 'R', parameters: { 'transform.rotation.b': 45 }, category: 'C' } as any);
  assert.ok(r.includes('rotate(45') || r.includes('45'), 'rotation encoded');
  pass('preview reflects rotation');
})();

(() => {
  // Opacity fade described.
  const d = describePresetMotion({ presetId: 'x', name: 'O', parameters: { 'transform.opacity.a': 0, 'transform.opacity.b': 100 }, category: 'C' } as any);
  assert.ok(/fade|opacity/i.test(d), 'describes fade: ' + d);
  pass('describePresetMotion mentions opacity fade');
})();

console.log(`\nALL PASSED (${passed})`);
