// StateMotion — structured error message mapping tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/errorMessages.test.ts

import assert from 'node:assert';
import {
  ErrorCode,
  userMessage,
  messageFromError,
} from './errorMessages.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

// Every spec-mandated code maps to useful, non-empty text.
const cases: Array<[ErrorCode, string, string]> = [
  [ErrorCode.NoActiveSequence, 'No active sequence', 'Open a sequence'],
  [ErrorCode.NoSelection, 'No selection', 'Select a video clip'],
  [ErrorCode.StateMotionNotFound, 'StateMotion not applied', 'not applied to this clip'],
  [ErrorCode.ContractMismatch, 'Version incompatible', 'not compatible with this panel version'],
  [ErrorCode.NewerReadOnly, 'Newer project', 'Editing is disabled to protect'],
  [ErrorCode.ParameterNotFound, 'Control missing', 'could not find one of the required effect controls'],
];
for (const [code, titleNeedle, detailNeedle] of cases) {
  const m = userMessage(code);
  assert.strictEqual(m.code, code);
  assert.ok(m.title.length > 0 && m.detail.length > 0, `non-empty text for ${code}`);
  assert.ok(m.title.includes(titleNeedle), `title mentions "${titleNeedle}" for ${code}`);
  assert.ok(m.detail.includes(detailNeedle), `detail mentions "${detailNeedle}" for ${code}`);
}
pass('all required error codes map to useful user text');

// messageFromError prefers a structured code carried on the error.
const structured = Object.assign(new Error('raw host boom'), { code: ErrorCode.ParameterNotFound });
assert.strictEqual(messageFromError(structured).code, ErrorCode.ParameterNotFound);
pass('messageFromError uses carried structured code');

// Unknown/raw errors fall back to a safe generic (no raw text leakage).
const generic = messageFromError(new Error('Premiere internal 0xDEAD')); // stack/text never shown
assert.strictEqual(generic.code, ErrorCode.WriteFailed);
assert.ok(!generic.detail.includes('0xDEAD'), 'raw exception text is not leaked to the user');
pass('raw exception text is never leaked to user-facing message');

console.log(`\nALL PASSED (${passed})`);
