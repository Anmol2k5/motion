// StateMotion — product version tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/productVersion.test.ts

import assert from 'node:assert';
import {
  PRODUCT_VERSION,
  PRODUCT_NAME,
  PRODUCT_EDITION,
  getProductVersion,
} from './productVersion.ts';
import { SCHEMA_VERSION, BINDING_REVISION, PARAMETER_COUNT } from '../../../../../shared/generated/parameterBindings.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

// Product version is a fixed, well-formed semver-ish alpha string.
assert.match(PRODUCT_VERSION, /^0\.1\.0-alpha\.1$/, 'product version literal');
pass('product version is 0.1.0-alpha.1');

const info = getProductVersion();
assert.strictEqual(info.name, 'StateMotion');
assert.strictEqual(info.version, PRODUCT_VERSION);
assert.strictEqual(info.edition, 'Alpha');
assert.strictEqual(info.isAlpha, true);
pass('getProductVersion exposes name/version/edition/isAlpha');

// Critical: product version must NOT be coupled to contract dimensions.
// They are independent sources; the product version is a fixed literal that does
// not encode or depend on the contract numbers.
assert.strictEqual(typeof SCHEMA_VERSION, 'number');
assert.strictEqual(typeof BINDING_REVISION, 'number');
assert.strictEqual(typeof PARAMETER_COUNT, 'number');
// The product version is a standalone constant, not built from contract values.
assert.strictEqual(PRODUCT_VERSION, '0.1.0-alpha.1', 'product version is an independent literal');
// Bumping contract dimensions must not require touching the product version.
assert.notStrictEqual(PRODUCT_VERSION.includes('binding'), true);
assert.notStrictEqual(PRODUCT_VERSION.includes('schema'), true);
pass('product version is distinct from schema/binding/parameter-count');

console.log(`\nALL PASSED (${passed})`);
