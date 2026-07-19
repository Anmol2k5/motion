// StateMotion — release gate model tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/releaseGates.test.ts

import assert from 'node:assert';
import {
  GateSeverity,
  canLaunchPrivateAlpha,
  openGatesBySeverity,
  type ReleaseGate,
} from './releaseGates.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

const blocker: ReleaseGate = { id: 'b1', title: 'plugin load', severity: GateSeverity.Blocker, status: 'open' };
const major: ReleaseGate = { id: 'm1', title: 'undo grouping', severity: GateSeverity.Major, status: 'open' };
const minor: ReleaseGate = { id: 'n1', title: 'spacing', severity: GateSeverity.Minor, status: 'open' };

// Blocker open -> cannot launch.
assert.strictEqual(canLaunchPrivateAlpha([blocker]), false);
assert.strictEqual(canLaunchPrivateAlpha([major, minor]), true);
pass('Private Alpha blocked while any BLOCKER is open');

// A blocker that is accepted/resolved does not block launch.
assert.strictEqual(canLaunchPrivateAlpha([{ ...blocker, status: 'accepted' }]), true);
pass('accepted/resolved blocker does not block launch');

const grouped = openGatesBySeverity([blocker, major, minor]);
assert.strictEqual(grouped[GateSeverity.Blocker].length, 1);
assert.strictEqual(grouped[GateSeverity.Major].length, 1);
assert.strictEqual(grouped[GateSeverity.Minor].length, 1);
pass('openGatesBySeverity groups correctly');

console.log(`\nALL PASSED (${passed})`);
