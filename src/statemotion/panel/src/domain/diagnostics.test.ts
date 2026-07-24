// StateMotion — diagnostics + debug report tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/diagnostics.test.ts

import assert from 'node:assert';
import {
  buildSnapshot,
  buildDebugReport,
  scanForSensitive,
  EXPECTED_MATCH_NAME,
} from './diagnostics.ts';
import { Capability, VerifyState, capabilityStatus } from './capability.ts';

import { PARAMETER_COUNT } from './presetSchema.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

// Snapshot carries the four distinct version dimensions.
const snap = buildSnapshot({ effectMatchName: EXPECTED_MATCH_NAME, contractStatus: 'compatible' });
assert.strictEqual(snap.productVersion, '0.1.0-alpha.1');
assert.strictEqual(snap.presetFormatVersion, 1);
assert.strictEqual(snap.parameterSchemaVersion, 1);
assert.strictEqual(snap.bindingRevision, 4);
assert.strictEqual(snap.expectedParameterCount, 70);
assert.strictEqual(snap.effectMatchName, EXPECTED_MATCH_NAME);
assert.strictEqual(snap.contractStatus, 'compatible');
pass('snapshot exposes product/schema/binding/parameter-count distinctly');

// Debug report is plain text and contains the required technical fields.
const report = buildDebugReport({
  effectMatchName: EXPECTED_MATCH_NAME,
  contractStatus: 'compatible',
  selectionCount: 2,
  selectionStatus: '2 clips',
  lastOperation: 'apply preset',
});
assert.ok(report.includes('StateMotion Version:'), 'has version line');
assert.ok(report.includes('Preset Format Version: 1'), 'has preset format version');
assert.ok(report.includes(`Expected Parameter Count: ${PARAMETER_COUNT}`), 'has expected param count');
assert.ok(report.includes('Binding Revision: 4'), 'has binding revision');
assert.ok(report.includes('Contract Status: compatible'), 'has contract status');
assert.ok(report.includes('Selection Count: 2'), 'has selection count');
assert.ok(report.includes('Last Operation: apply preset'), 'has last operation');
pass('debug report contains required non-sensitive technical fields');

// Sensitive-data exclusion: even if the caller passes garbage, the generator
// must not inject paths/usernames/clip names/preset contents. An unknown match
// name (e.g. a host path) is sanitized to unknown rather than echoed, and
// free-text selection status is never printed (only a count).
const dirty = buildDebugReport({
  effectMatchName: 'C:\\Users\\bob\\Desktop\\project.prproj',
  selectionStatus: 'clip "Wedding Clip"',
  lastError: 'boom',
});
assert.deepStrictEqual(scanForSensitive(dirty), [], 'no sensitive hints leaked');
assert.ok(!dirty.includes('Wedding Clip'), 'clip name excluded');
assert.ok(!dirty.includes('bob'), 'username excluded');
assert.ok(!dirty.includes('.prproj'), 'project path excluded');
assert.ok(!dirty.includes('C:\\'), 'match-name path excluded');
assert.ok(!dirty.includes('Selection Status:'), 'free-text selection status not printed');
pass('debug report excludes sensitive data even from dirty inputs');

// Capabilities appear only as capability + verify state.
const caps = { [Capability.Compatible]: capabilityStatus(Capability.Compatible, VerifyState.Verified, 'disk 25') };
const r2 = buildDebugReport({ capabilities: caps });
assert.ok(r2.includes(`${Capability.Compatible}: ${VerifyState.Verified}`), 'capability + verify state listed');
assert.ok(!r2.includes('disk 25'), 'capability detail (may contain paths) not in report');
pass('capabilities listed without raw detail');

console.log(`\nALL PASSED (${passed})`);
