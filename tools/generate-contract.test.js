// StateMotion — Phase 0.1 parameter-contract validation tests.
// Self-contained (Node assert only). Run: node tools/generate-contract.test.js
// Proves every required failure case, one valid generation, C++/TS agreement,
// and deterministic digest.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const GEN = path.join(ROOT, 'shared', 'generated');
const SCHEMA = path.join(ROOT, 'shared', 'schema', 'parameter-contract.json');

const { validate, canonicalize, main } = require('./generate-contract.js');

const base = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));

// Helper: clone base, mutate via fn, expect validate() to throw with substring.
function expectFail(name, mutate, needle) {
  const c = JSON.parse(JSON.stringify(base));
  mutate(c);
  let threw = false;
  try { validate(c); } catch (e) { threw = true; if (needle && !e.message.includes(needle)) throw new Error(`[${name}] wrong message: ${e.message}`); }
  assert.ok(threw, `[${name}] expected validation failure but it passed`);
  console.log(`PASS  ${name}`);
}

let passed = 0;
function pass(name) { console.log(`PASS  ${name}`); passed++; }

// ---- failure cases ----------------------------------------------------------

expectFail('duplicate logicalId', (c) => { c.parameters[1].logicalId = c.parameters[0].logicalId; }, 'duplicate logicalId');
expectFail('duplicate diskId', (c) => { c.parameters[1].diskId = c.parameters[0].diskId; }, 'duplicate diskId');
expectFail('diskId 0', (c) => { c.parameters[0].diskId = 0; }, 'diskId 0');
expectFail('diskId out of range (>9999)', (c) => { c.parameters[0].diskId = 10000; }, 'outside 1..9999');
expectFail('diskId out of range (<1)', (c) => { c.parameters[0].diskId = -1; }, 'outside 1..9999');
expectFail('param outside declared family range', (c) => { c.parameters.find(p => p.logicalId === 'transform.opacity.b').diskId = 60; }, 'expected transform');
expectFail('entry in reserved family (motionBlurQuality)', (c) => {
  c.parameters.push({ logicalId: 'quality.shutterAngle', diskId: 310, wireName: 'SM Shutter Angle', nativeType: 'FLOAT_SLIDER', default: 180, range: { min: 0, max: 360 }, uiRange: { min: 0, max: 360 }, introducedInSchema: 1, timeVariance: 'interpolatable', serialization: 'diskId', fingerprint: true, stateOwnership: 'A', canonical: 'deg', oldProjectDefault: 180 });
}, null);
expectFail('duplicate wireName', (c) => { c.parameters[1].wireName = c.parameters[0].wireName; }, 'duplicate wireName');
expectFail('wireName too long (>31)', (c) => { c.parameters[0].wireName = 'X'.repeat(32); }, 'exceeds 31');
expectFail('missing default', (c) => { delete c.parameters[0].default; }, 'missing default');
expectFail('invalid default type (number expected)', (c) => { c.parameters.find(p => p.logicalId === 'transform.scaleX.a').default = 'hundred'; }, 'must be number');
expectFail('invalid range (min>max)', (c) => { c.parameters.find(p => p.logicalId === 'transform.scaleX.a').range = { min: 100, max: 10 }; }, 'min>=max');
expectFail('default outside range', (c) => { const p = c.parameters.find(p => p.logicalId === 'transform.opacity.a'); p.default = 200; }, 'outside range');
expectFail('unknown native type', (c) => { c.parameters[0].nativeType = 'ARBITRARY_DATA'; }, 'unknown nativeType');
expectFail('enum reorder/reuse (ProgressMode)', (c) => { c.enums.ProgressMode.values[6].value = 0; }, 'reorder/reuse');
expectFail('enum missing value (ProgressMode)', (c) => { c.enums.ProgressMode.values.pop(); }, 'value count');
expectFail('missing oldProjectDefault', (c) => { delete c.parameters[0].oldProjectDefault; }, 'missing oldProjectDefault');
expectFail('POPUP default not in enum', (c) => { c.parameters.find(p => p.logicalId === 'transition.mode').default = 99; }, 'not in enum');
expectFail('POINT default invalid', (c) => { c.parameters.find(p => p.logicalId === 'transform.position.a').default = { x: 0, y: 0 }; }, 'must be one of');
expectFail('binding revision metadata mismatch', (c) => {
  c.parameters.find(p => p.logicalId === 'contract.bindingRevision').default = c.bindingRevision - 1;
}, 'contract.bindingRevision default');

// ---- valid generation -------------------------------------------------------

(function validGeneration() {
  const c = JSON.parse(JSON.stringify(base));
  validate(c); // must not throw
  const canonical = canonicalize(c);
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');
  assert.strictEqual(digest.length, 64);
  pass('valid contract passes validation + digest length 64');
})();

// ---- determinism ------------------------------------------------------------

(function determinism() {
  const a = crypto.createHash('sha256').update(canonicalize(base)).digest('hex');
  const b = crypto.createHash('sha256').update(canonicalize(JSON.parse(JSON.stringify(base)))).digest('hex');
  assert.strictEqual(a, b);
  pass('canonical digest deterministic across deep clones');
})();

// ---- generated output agreement + existence ----------------------------------

(function generatedOutputs() {
  main(); // writes files
  const files = [
    'parameter_ids.hpp', 'parameter_bindings.hpp', 'parameterIds.ts', 'parameterBindings.ts', 'parameter-contract.sha256',
  ];
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(GEN, f)), `missing generated ${f}`);
  }
  const cpp = fs.readFileSync(path.join(GEN, 'parameter_ids.hpp'), 'utf8');
  const ts = fs.readFileSync(path.join(GEN, 'parameterIds.ts'), 'utf8');
  assert.ok(cpp.includes('enum class ProgressMode'), 'C++ missing ProgressMode enum');
  assert.ok(ts.includes('export enum ProgressMode'), 'TS missing ProgressMode enum');
  // TS panel mirror must carry the full binding fields the panel relies on
  // (logical IDs are canonical; no raw native index is exposed here).
  const bts = fs.readFileSync(path.join(GEN, 'parameterBindings.ts'), 'utf8');
  assert.ok(bts.includes('export interface ParameterBinding'), 'TS missing ParameterBinding interface');
  assert.ok(bts.includes('defaultVal'), 'TS binding missing defaultVal');
  assert.ok(bts.includes('enumRef'), 'TS binding missing enumRef');
  assert.ok(bts.includes('oldDefault'), 'TS binding missing oldDefault');
  assert.ok(bts.includes('getBinding'), 'TS binding missing getBinding lookup');
  assert.ok(bts.includes('"transform.scaleX.a"'), 'TS binding missing scaleX.a');
  // C++/TS agreement: regenerate and re-check via --check path.
  const { execSync } = require('child_process');
  execSync(`node ${path.join(__dirname, 'generate-contract.js')} --check`, { stdio: 'pipe' });
  pass('generated C++/TS bindings exist, enums present, TS mirror fields present, --check agreement passes');
})();

// ---- digest artifact matches -------------------------------------------------

(function digestArtifact() {
  const c = JSON.parse(JSON.stringify(base));
  const expected = crypto.createHash('sha256').update(canonicalize(c)).digest('hex');
  const onDisk = fs.readFileSync(path.join(GEN, 'parameter-contract.sha256'), 'utf8').trim();
  assert.strictEqual(onDisk, expected, 'stored digest does not match recomputed');
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'generated', 'parameter-contract.md'), 'utf8');
  assert.ok(md.includes(expected), 'markdown missing digest');
  pass('stored SHA-256 artifact matches recomputed + present in markdown');
})();

// ---- enhanced C++ binding fields (native registration) ----------------------

(function enhancedCppBinding() {
  main(); // ensure files are current
  const cpp = fs.readFileSync(path.join(GEN, 'parameter_bindings.hpp'), 'utf8');
  assert.ok(cpp.includes('struct ParameterBinding'), 'missing ParameterBinding struct');
  assert.ok(cpp.includes('double defaultNum;'), 'missing defaultNum field');
  assert.ok(cpp.includes('double oldDefaultNum;'), 'missing oldDefaultNum field');
  assert.ok(cpp.includes('int enumCount;'), 'missing enumCount field');
  // A FLOAT_SLIDER with a range must emit validMin/Max and a nonzero default.
  assert.ok(cpp.includes('"transform.scaleX.a", 102, "SM Scale X A", "FLOAT_SLIDER", "A", "interpolatable", 100, 0.01, 10000'), 'scaleX.a binding numbers wrong');
  // A POPUP must emit enumCount (7 for ProgressMode) and enumRef.
  assert.ok(cpp.includes('"transition.mode", 50, "SM Mode", "POPUP", "transition", "static", 0, 0, 0, 0, 0, 0, 2, 7, "ProgressMode"'), 'transition.mode popup binding wrong');
  // A POINT must emit defaultNum 0 (native resolves center).
  assert.ok(cpp.includes('"transform.position.a", 100, "SM Position A", "POINT", "A", "interpolatable", 0,'), 'position.a POINT default must be 0');
  // parameterCount metadata new-default 43 (shadow params added), old-default 20.
  assert.ok(cpp.includes('"contract.parameterCount", 2, "SM Param Count", "FLOAT_SLIDER", "metadata", "static", 43, 1, 9999, 1, 9999, 20,'), 'parameterCount old default wrong');
  pass('enhanced C++ binding fields present and match contract');
})();

console.log(`\nALL PASSED (${passed} explicit checks + valid/agreement groups)`);
