// premiereAdapter.test.ts
// Run: node --experimental-transform-types src/statemotion/panel/src/host/premiereAdapter.test.ts

import assert from 'node:assert';
import { PremiereAdapter, ContractIncompatible, ContractReadOnly } from './premiereAdapter.ts';
import type { HostBridge, ClipRef } from './premiereAdapter.ts';
import { toCanonical } from './valueConversion.ts';
import { getBinding, type ParameterBinding } from '../../../../../shared/generated/parameterBindings.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

const b = (id: string): ParameterBinding => getBinding(id)!;

// Native-state bridge: stores native values keyed by logical id, converts
// native -> canonical on readLogical (mirrors UxpHostBridge).
function fakeBridgeWithState(native: Record<string, number | string>): HostBridge {
  const contract = {
    schemaVersion: Number(native['contract.schemaVersion'] ?? 1),
    parameterCount: Number(native['contract.parameterCount'] ?? 20),
    bindingRevision: Number(native['contract.bindingRevision'] ?? 1),
  };
  return {
    getSelection: async () => [],
    hasStateMotionEffect: async () => true,
    getContract: async () => contract,
    enumerateParamIndex: async (_c, _w) => 0,
    readLogical: async (_c: ClipRef, id: string) => {
      if (!(id in native)) return undefined;
      return toCanonical(id, native[id], b(id));
    },
    writeLogical: async () => {},
    beginUndo: async () => {},
    endUndo: async () => {},
    applyEffect: async () => {},
  };
}

function fakeBridgeWithContract(contract: { schemaVersion: number; bindingRevision: number; parameterCount: number }): HostBridge {
  return {
    getSelection: async () => [],
    hasStateMotionEffect: async () => true,
    getContract: async () => contract,
    enumerateParamIndex: async () => 0,
    readLogical: async () => 0,
    writeLogical: async () => {},
    beginUndo: async () => {},
    endUndo: async () => {},
    applyEffect: async () => {},
  };
}

(async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithState({
    'transition.manualProgress': 50,
    'transform.scaleX.b': 130,
    'transform.opacity.b': 100,
    'contract.schemaVersion': 1,
    'contract.parameterCount': 20,
    'contract.bindingRevision': 1,
  }));
  const cfg = await adapter.readState({ clipId: 'c1' });
  assert.strictEqual(cfg.parameters['transition.manualProgress'], 0.5);
  assert.ok(Math.abs((cfg.parameters['transform.scaleX.b'] as number) - 1.3) < 1e-9);
  assert.strictEqual(cfg.parameters['transform.opacity.b'], 1);
  assert.strictEqual(cfg.parameters['contract.schemaVersion'], undefined);
  pass('readState returns canonical creative config, excludes metadata');
})();

(async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithContract({ schemaVersion: 2, bindingRevision: 1, parameterCount: 20 }));
  let threw = false;
  try { await adapter.readState({ clipId: 'c1' }); } catch (e) { threw = e instanceof ContractIncompatible; }
  assert.ok(threw);
  pass('readState throws ContractIncompatible on incompatible contract');
})();

(async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithContract({ schemaVersion: 1, bindingRevision: 1, parameterCount: 17 }));
  let threw = false;
  try { await adapter.readState({ clipId: 'c1' }); } catch (e) { threw = e instanceof ContractReadOnly; }
  assert.ok(threw);
  pass('readState throws ContractReadOnly on older parameterCount');
})();

(async () => {
  const adapter = new PremiereAdapter(fakeBridgeWithState({
    'transition.manualProgress': 50,
    'contract.schemaVersion': 1, 'contract.parameterCount': 20, 'contract.bindingRevision': 1,
  }));
  const contract = await adapter.getContract({ clipId: 'c1' });
  assert.strictEqual(contract?.schemaVersion, 1);
  pass('getContract passthrough returns contract');
})();
