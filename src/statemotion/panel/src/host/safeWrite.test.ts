// StateMotion — safe-write policy tests (zero host writes on prevalidation failure).
// Run: node --experimental-transform-types src/statemotion/panel/src/host/safeWrite.test.ts

import assert from 'node:assert';
import { buildApplyPlan, type SelectionItem, ItemStatus } from '../domain/applyPlan.ts';
import { PremiereAdapter, type HostBridge, type ClipRef } from './premiereAdapter.ts';
import type { StateMotionPreset } from '../domain/presetSchema.ts';

import { PARAMETER_COUNT } from '../domain/presetSchema.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

const CURRENT_CONTRACT = { schemaVersion: 1, bindingRevision: 2, parameterCount: PARAMETER_COUNT };
const OLDER_CONTRACT = { schemaVersion: 1, bindingRevision: 1, parameterCount: 20 };
const NEWER_CONTRACT = { schemaVersion: 2, bindingRevision: 2, parameterCount: PARAMETER_COUNT };

// --- pure plan classification ------------------------------------------------
{
  const plan = buildApplyPlan(
    [{ clipId: 'a', hasStateMotion: true, contract: CURRENT_CONTRACT }],
    'p1', CURRENT_CONTRACT,
  );
  assert.strictEqual(plan.items[0].status, ItemStatus.Supported);
  assert.strictEqual(plan.summary.applied, 1);
  pass('current contract -> supported, applied');
}
{
  const plan = buildApplyPlan(
    [{ clipId: 'a', hasStateMotion: true, contract: OLDER_CONTRACT }],
    'p1', CURRENT_CONTRACT,
  );
  assert.strictEqual(plan.items[0].status, ItemStatus.Incompatible);
  assert.strictEqual(plan.summary.failed, 1);
  pass('older contract -> incompatible (read-only), failed (no write)');
}
{
  const plan = buildApplyPlan(
    [{ clipId: 'a', hasStateMotion: false, contract: null }],
    'p1', CURRENT_CONTRACT,
  );
  assert.strictEqual(plan.items[0].status, ItemStatus.Unsupported);
  assert.strictEqual(plan.summary.skipped, 1);
  pass('no StateMotion effect -> unsupported, skipped');
}
{
  const plan = buildApplyPlan(
    [{ clipId: 'a', hasStateMotion: true, contract: NEWER_CONTRACT }],
    'p1', CURRENT_CONTRACT,
  );
  assert.strictEqual(plan.items[0].status, ItemStatus.Incompatible);
  pass('newer contract -> incompatible, never written');
}

// --- adapter executes zero writes when plan is not Supported -----------------
class CountingBridge implements HostBridge {
  writes = 0;
  applies = 0;
  constructor(private contract: typeof CURRENT_CONTRACT | null) {}
  async getSelection(): Promise<ClipRef[]> { return []; }
  async hasStateMotionEffect(): Promise<boolean> { return true; }
  async getContract(): Promise<any> { return this.contract; }
  async enumerateParamIndex(): Promise<number | undefined> { return 0; }
  async readLogical(): Promise<number | string | undefined> { return undefined; }
  async writeLogical(): Promise<void> { this.writes++; }
  async beginUndo(): Promise<void> {}
  async endUndo(): Promise<void> {}
  async applyEffect(): Promise<void> { this.applies++; }
}

class FreshEffectBridge extends CountingBridge {
  private installed = false;
  readonly order: string[] = [];
  override async getSelection(): Promise<ClipRef[]> { return [{ clipId: 'selected' }]; }
  override async hasStateMotionEffect(): Promise<boolean> { return this.installed; }
  override async getContract(): Promise<any> { return this.installed ? CURRENT_CONTRACT : null; }
  override async beginUndo(): Promise<void> { this.order.push('begin'); }
  override async applyEffect(): Promise<void> { this.order.push('apply'); this.applies++; this.installed = true; }
  override async endUndo(): Promise<void> { this.order.push('end'); }
}

function fakePreset(contract: typeof CURRENT_CONTRACT): StateMotionPreset {
  return {
    formatId: 'io.github.anmol2k5.statemotion.preset',
    schemaVersion: 1,
    presetId: 'p1', name: 'P', description: '', author: 'S',
    createdAt: '2026-01-01T00:00:00Z', modifiedAt: '2026-01-01T00:00:00Z',
    tags: [], category: 'Entrances', collectionIds: [], compatibleContract: contract,
    parameters: { 'transform.opacity.a': 0, 'transform.opacity.b': 1 },
    preview: { kind: 'generated' },
  } as unknown as StateMotionPreset;
}

// Older contract clip: adapter must NOT write any parameter.
{
  const bridge = new CountingBridge(OLDER_CONTRACT);
  const adapter = new PremiereAdapter(bridge);
  const report = await adapter.applyPresetToSelection(fakePreset(CURRENT_CONTRACT), ['a']);
  assert.strictEqual(bridge.writes, 0, 'no write on older/incompatible contract');
  assert.strictEqual(report.failed.length, 1);
  pass('adapter performs ZERO host writes on incompatible contract');
}
// Newer contract clip: also zero writes.
{
  const bridge = new CountingBridge(NEWER_CONTRACT);
  const adapter = new PremiereAdapter(bridge);
  const report = await adapter.applyPresetToSelection(fakePreset(CURRENT_CONTRACT), ['a']);
  assert.strictEqual(bridge.writes, 0, 'no write on newer contract');
  pass('adapter performs ZERO host writes on newer contract');
}
// No StateMotion effect on clip, but contract null: applyEffect attempted, but
// then the post-apply contract is still null -> treated unsupported -> no writes.
{
  const bridge = new CountingBridge(null);
  const adapter = new PremiereAdapter(bridge);
  const report = await adapter.applyPresetToSelection(fakePreset(CURRENT_CONTRACT), ['a']);
  assert.strictEqual(bridge.writes, 0, 'no write when effect cannot be established');
  pass('adapter performs ZERO host writes when effect cannot be established');
}

// Omitting explicit ids must use the real host selection, including clips that
// do not have StateMotion yet, so the adapter can install and configure it.
{
  const bridge = new FreshEffectBridge(null);
  const adapter = new PremiereAdapter(bridge);
  const report = await adapter.applyPresetToSelection(fakePreset(CURRENT_CONTRACT));
  assert.strictEqual(bridge.applies, 1);
  assert.strictEqual(bridge.writes, 2);
  assert.deepStrictEqual(report.applied, ['selected']);
  assert.ok(bridge.order.indexOf('begin') < bridge.order.indexOf('apply'));
  pass('adapter applies a preset to the current selection and installs a missing effect');
}

{
  const bridge = new CountingBridge(NEWER_CONTRACT);
  const adapter = new PremiereAdapter(bridge);
  await assert.rejects(() => adapter.writeLogical({ clipId: 'a' }, 'transition.easing', 2));
  assert.strictEqual(bridge.writes, 0);
  pass('direct inspector edit never writes an incompatible contract');
}

console.log(`\nALL PASSED (${passed})`);
