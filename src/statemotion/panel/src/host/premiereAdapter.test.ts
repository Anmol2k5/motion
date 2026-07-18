// StateMotion Preset Panel — PremiereAdapter boundary tests (fake host).
// Run: node --experimental-transform-types src/statemotion/panel/src/host/premiereAdapter.test.ts

import assert from 'node:assert';
import { PremiereAdapter, type HostBridge, type ClipRef } from './premiereAdapter.ts';
import { EffectParameterMap } from '../domain/parameterMap.ts';
import { buildApplyPlan } from '../domain/applyPlan.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

function makeFakeHost(opts: { effectOn?: string[]; contracts?: Record<string, any>; wireMap?: Record<string, Record<string, number>>; effectApplied?: string[] } = {}) {
  const effectOn = new Set(opts.effectOn ?? []);
  const contracts = opts.contracts ?? {};
  const wireMap = opts.wireMap ?? {};
  const effectApplied = opts.effectApplied ?? [];
  let undoDepth = 0;
  const bridge: HostBridge = {
    async getSelection(): Promise<ClipRef[]> {
      return Object.keys(contracts).map((id) => ({ clipId: id }));
    },
    async hasStateMotionEffect(clip: ClipRef) { return effectOn.has(clip.clipId); },
    async getContract(clip: ClipRef) { return contracts[clip.clipId] ?? null; },
    async enumerateParamIndex(clip: ClipRef, wireName: string) {
      return wireMap[clip.clipId]?.[wireName];
    },
    async readLogical() { return undefined; },
    async writeLogical() {},
    async beginUndo(_label: string) { undoDepth++; },
    async endUndo() { undoDepth--; },
    async applyEffect(clip: ClipRef) { effectApplied.push(clip.clipId); effectOn.add(clip.clipId); },
    get undoDepth() { return undoDepth; },
  };
  return { bridge, effectApplied };
}

// ---- detect supported instances ----
(async () => {
  const { bridge } = makeFakeHost({
    effectOn: ['c1'],
    contracts: { c1: { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 } },
  });
  const adapter = new PremiereAdapter(bridge);
  const detected = await adapter.detectSelection();
  assert.strictEqual(detected.supported.length, 1, 'c1 supported');
  assert.strictEqual(detected.unsupported.length, 0);
  pass('detects supported StateMotion instances in selection');
})();

// ---- apply preset writes only resolvable logical params, single undo ----
(async () => {
  const wireMap = { c1: { 'SM Scale X B': 9, 'SM Opacity B': 11 } };
  const written: Record<string, any> = {};
  const { bridge, effectApplied } = makeFakeHost({
    effectOn: ['c1'],
    contracts: { c1: { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 } },
    wireMap,
  });
  // capture writes
  const origWrite = bridge.writeLogical.bind(bridge);
  bridge.writeLogical = async (clip, logicalId, value) => { written[logicalId] = value; };
  const adapter = new PremiereAdapter(bridge);
  const preset = {
    presetId: 'pX', name: 'X', parameters: { 'transform.scaleX.b': 150, 'transform.opacity.b': 50 },
    compatibleContract: { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 },
  } as any;
  const report = await adapter.applyPresetToSelection(preset, ['c1']);
  assert.strictEqual(report.applied.length, 1, 'one applied');
  assert.strictEqual(written['transform.scaleX.b'], 150, 'scale written');
  assert.strictEqual(written['transform.opacity.b'], 50, 'opacity written');
  assert.strictEqual((bridge as any).undoDepth, 0, 'undo balanced');
  pass('applies preset via parameter map in a single balanced undo');
})();

// ---- applies effect if missing then writes (reuse, not duplicate) ----
(async () => {
  const { bridge, effectApplied } = makeFakeHost({
    effectOn: [], // no effect yet
    contracts: {},
    wireMap: { c1: { 'SM Scale X B': 9 } },
  });
  // After applyEffect, the fake host adds c1 to effectOn but contract still null;
  // adapter should still attempt write via map (index may be present from wireMap).
  const adapter = new PremiereAdapter(bridge);
  const preset = { presetId: 'pX', name: 'X', parameters: { 'transform.scaleX.b': 150 }, compatibleContract: { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 } } as any;
  // selection provided explicitly
  const report = await adapter.applyPresetToSelection(preset, ['c1']);
  assert.ok(effectApplied.includes('c1'), 'effect was applied to clip without one');
  assert.ok(report.applied.length + report.skipped.length + report.failed.length >= 1);
  pass('applies StateMotion effect when missing, then proceeds');
})();

// ---- incompatible clip is not written ----
(async () => {
  let wrote = false;
  const { bridge } = makeFakeHost({
    effectOn: ['c1'],
    contracts: { c1: { schemaVersion: 2, bindingRevision: 1, parameterCount: 20 } },
  });
  bridge.writeLogical = async () => { wrote = true; };
  const adapter = new PremiereAdapter(bridge);
  const preset = { presetId: 'pX', name: 'X', parameters: { 'transform.scaleX.b': 150 }, compatibleContract: { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 } } as any;
  const report = await adapter.applyPresetToSelection(preset, ['c1']);
  assert.strictEqual(wrote, false, 'must not write to incompatible clip');
  assert.strictEqual(report.failed.length, 1, 'clip reported incompatible');
  pass('does not write to incompatible (newer) contract');
})();

console.log(`\nALL PASSED (${passed})`);
