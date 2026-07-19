// StateMotion — capability model tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/capability.test.ts

import assert from 'node:assert';
import {
  VerifyState,
  Capability,
  capabilityStatus,
  capabilityLabel,
} from './capability.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

// All required capability enum members exist (spec checklist).
const required = [
  'PanelLoaded', 'NoActiveSequence', 'NoSelection', 'UnsupportedSelection',
  'NativeEffectMissing', 'StateMotionNotApplied', 'Compatible', 'OlderSupported',
  'NewerReadOnly', 'InvalidContract', 'ParameterMissing', 'ParameterTypeMismatch',
  'HostOperationUnsupported', 'WriteFailed', 'ReadFailed',
];
for (const r of required) {
  assert.ok((Capability as any)[r] !== undefined, `capability ${r} present`);
}
pass('all 15 capability enum members present');

// All verify states present.
for (const v of ['Verified', 'Available', 'Unavailable', 'Unknown']) {
  assert.ok((VerifyState as any)[v] !== undefined, `verify ${v} present`);
}
pass('all 4 verify states present');

const s = capabilityStatus(Capability.Compatible, VerifyState.Verified, 'disk 25');
assert.strictEqual(s.capability, Capability.Compatible);
assert.strictEqual(s.verify, VerifyState.Verified);
assert.strictEqual(s.detail, 'disk 25');
pass('capabilityStatus builds structured status');

assert.strictEqual(capabilityLabel(Capability.NoActiveSequence), 'No active sequence');
assert.strictEqual(capabilityLabel(Capability.WriteFailed), 'Write failed');
pass('capabilityLabel returns original StateMotion wording (no raw exception text)');

console.log(`\nALL PASSED (${passed})`);
