import assert from 'node:assert';
import { UxpHostBridge } from './uxpHost.ts';
import { BINDINGS } from '../../../../../shared/generated/parameterBindings.ts';

const MATCH = 'AE.io.github.anmol2k5.statemotion.effect';
const values = BINDINGS.map((binding) => binding.defaultVal);

function param(index: number) {
  return {
    async getStartValue() { return { value: { value: values[index] } }; },
    createKeyframe(value: unknown) { return { value: { value } }; },
    createSetValueAction(keyframe: any) {
      return { run: () => { values[index] = keyframe.value.value; } };
    },
  };
}

const component = {
  async getMatchName() { return MATCH; },
  getParamCount() { return BINDINGS.length; },
  getParam(index = 0) { return param(index); },
};
const components: any[] = [component];
const chain = {
  getComponentCount() { return components.length; },
  getComponentAtIndex(index: number) { return components[index]; },
  createAppendComponentAction(next: any) { return { run: () => components.push(next) }; },
};
const item = { async getComponentChain() { return chain; } };
const project = {
  async getActiveSequence() {
    return {
      async getSelection() {
        return { async getTrackItems() { return [item]; } };
      },
    };
  },
  executeTransaction(callback: (compound: any) => void) {
    callback({ addAction(action: any) { action.run(); return true; }, empty: false });
    return true;
  },
};
const ppro = {
  Project: { async getActiveProject() { return project; } },
  VideoFilterFactory: { async createComponent() { return component; } },
};

const bridge = new UxpHostBridge(ppro as never);
const selection = await bridge.getSelection();
assert.strictEqual(selection.length, 1);

import { PARAMETER_COUNT } from '../domain/presetSchema.ts';

const clip = selection[0];
assert.deepStrictEqual(await bridge.getContract(clip), {
  schemaVersion: 1,
  parameterCount: 67,
  bindingRevision: 3,
});

await bridge.writeLogical(clip, 'transition.manualProgress', 0.5);
assert.strictEqual(values[7], 50);
assert.strictEqual(await bridge.readLogical(clip, 'transition.manualProgress'), 0.5);
console.log('PASS  uses Premiere 26.3 selection and transaction APIs for read/write');
