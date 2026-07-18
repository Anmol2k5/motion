// uxpHost.test.ts
// Run: node --experimental-transform-types src/statemotion/panel/src/host/uxpHost.test.ts

import assert from 'node:assert';
import { UxpHostBridge } from './uxpHost.ts';
import { getBinding } from '../../../../../shared/generated/parameterBindings.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

const MATCH = 'AE.io.github.anmol2k5.statemotion.effect';

(async () => {
  const written: Record<string, unknown> = {};
  const setValue = (v: unknown) => { written['transition.manualProgress'] = v; };
  const getProperty = (_i: number) => ({ displayName: 'SM Manual Progress', setValue, getValue: () => 50 });
  (globalThis as any).app = {
    project: {
      activeSequence: {
        videoTracks: [{
          clips: [{
            nodeId: 'c1',
            components: [{ matchName: MATCH, properties: { numProperties: 1, getProperty } }],
          }],
        }],
      },
    },
  };
  const bridge = new UxpHostBridge();
  await bridge.writeLogical({ clipId: 'c1' }, 'transition.manualProgress', 0.5);
  assert.strictEqual(written['transition.manualProgress'], 50);
  pass('writeLogical converts canonical -> native before setValue');
})();

(async () => {
  const getProperty = (_i: number) => ({ displayName: 'SM Manual Progress', getValue: () => 50 });
  (globalThis as any).app = {
    project: {
      activeSequence: {
        videoTracks: [{
          clips: [{
            nodeId: 'c1',
            components: [{ matchName: MATCH, properties: { numProperties: 1, getProperty } }],
          }],
        }],
      },
    },
  };
  const bridge = new UxpHostBridge();
  const v = await bridge.readLogical({ clipId: 'c1' }, 'transition.manualProgress');
  assert.strictEqual(v, 0.5);
  pass('readLogical converts native -> canonical');
})();
