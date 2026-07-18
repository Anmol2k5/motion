#!/usr/bin/env node
// StateMotion - Phase 0.1 vertical slice parameter-contract generator + validator.
//
// Single source of truth: shared/schema/parameter-contract.json
// Emits C++/TS bindings + docs + SHA-256 digest. Stdlib only; no dependency.
// Host-independent: contains NO Adobe SDK, no effect entry, no EffectParameterMap,
// no UXP, no GPU. (Per handoff: contract generation only.)
//
// Usage: node tools/generate-contract.js [--check]
//   default: write generated files.
//   --check: validate + assert C++/TS agreement + deterministic digest, exit nonzero on error.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'shared', 'schema', 'parameter-contract.json');
const GEN_DIR = path.join(ROOT, 'shared', 'generated');
const DOCS_GEN_DIR = path.join(ROOT, 'docs', 'generated');

// Fixed permanent enum tables (handoff 014 / clean-room). Reordering or reusing
// a value is rejected. These are the ground truth; the contract must match.
const REQUIRED_ENUMS = {
  ProgressMode: [
    ['AToB', 0], ['BToA', 1], ['AToBToA', 2], ['BToAToB', 3],
    ['HoldA', 4], ['HoldB', 5], ['Manual', 6],
  ],
  AlignmentMode: [
    ['ClipStart', 0], ['ClipEnd', 1], ['EntireClip', 2],
  ],
};

const KNOWN_NATIVE_TYPES = new Set(['FLOAT_SLIDER', 'POINT', 'ANGLE', 'POPUP']);
const WIRE_NAME_LIMIT = 31; // A_char[32], NUL-terminated (research 008 §5)
const POINT_DEFAULTS = new Set(['frameCenter', 'sourceCenter']);

function fail(msg) {
  throw new Error('CONTRACT VALIDATION FAILED: ' + msg);
}

// Deterministic canonical JSON: sorted keys, params sorted by diskId, no whitespace.
function canonicalize(contract) {
  const sortKeys = (obj) => {
    if (Array.isArray(obj)) return obj.map(sortKeys);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
      return out;
    }
    return obj;
  };
  const clone = sortKeys(contract);
  clone.parameters = clone.parameters.slice().sort((a, b) => a.diskId - b.diskId);
  for (const e of Object.keys(clone.enums)) {
    clone.enums[e].values = clone.enums[e].values.slice().sort((a, b) => a.value - b.value);
  }
  return JSON.stringify(clone);
}

function familyOf(diskId, ranges) {
  for (const [name, r] of Object.entries(ranges)) {
    if (diskId >= r.min && diskId <= r.max) return name;
  }
  return null;
}

// Expected family inferred from logicalId prefix (semantic allocation).
const FAMILY_PREFIX = { 'contract.': 'metadata', 'transition.': 'progressCurve', 'transform.': 'transform' };
function expectedFamily(logicalId) {
  for (const [pfx, fam] of Object.entries(FAMILY_PREFIX)) {
    if (logicalId.startsWith(pfx)) return fam;
  }
  return null;
}

function validate(contract) {
  // --- enums: fixed, append-only, never reorder/reuse ---
  for (const [ename, required] of Object.entries(REQUIRED_ENUMS)) {
    const got = contract.enums[ename];
    if (!got) fail(`enum ${ename} missing`);
    const gotPairs = got.values
      .slice()
      .sort((a, b) => a.value - b.value)
      .map((v) => [v.name, v.value]);
    if (gotPairs.length !== required.length) {
      fail(`enum ${ename} value count ${gotPairs.length} != ${required.length}`);
    }
    for (let i = 0; i < required.length; i++) {
      if (gotPairs[i][0] !== required[i][0] || gotPairs[i][1] !== required[i][1]) {
        fail(`enum ${ename} entry ${i} is ${gotPairs[i]} expected ${required[i]} (reorder/reuse?)`);
      }
    }
  }

  if (contract.parameters.length !== contract.contractParameterCount && 'contractParameterCount' in contract) {
    // (reserved hook; real check below uses the metadata param default)
  }
  if (typeof contract.parameters.length !== 'number') fail('parameters must be an array');

  const logicalIds = new Set();
  const diskIds = new Set();
  const expectedCount = contract.parameters.length;
  const wireNames = new Set();
  const seenFamilies = new Set();

  for (const p of contract.parameters) {
    // duplicate logical id
    if (logicalIds.has(p.logicalId)) fail(`duplicate logicalId ${p.logicalId}`);
    logicalIds.add(p.logicalId);

    // duplicate disk id
    if (diskIds.has(p.diskId)) fail(`duplicate diskId ${p.diskId}`);
    diskIds.add(p.diskId);

    // disk id 0 / out of 1..9999
    if (p.diskId === 0) fail(`diskId 0 is reserved (input layer)`);
    if (p.diskId < 1 || p.diskId > 9999) fail(`diskId ${p.diskId} outside 1..9999`);

    // family range + reserved family + correct family for this logicalId
    const fam = familyOf(p.diskId, contract.diskIdRanges);
    if (!fam) fail(`diskId ${p.diskId} (${p.logicalId}) outside any declared range`);
    const exp = expectedFamily(p.logicalId);
    if (!exp) fail(`logicalId ${p.logicalId} has no known family prefix`);
    if (exp !== fam) fail(`param ${p.logicalId} diskId ${p.diskId} is in family ${fam}, expected ${exp}`);
    seenFamilies.add(fam);
    if (contract.diskIdRanges[fam].status === 'reserved') {
      fail(`param ${p.logicalId} diskId ${p.diskId} falls in reserved family ${fam}`);
    }

    // duplicate wire name + length limit
    if (wireNames.has(p.wireName)) fail(`duplicate wireName "${p.wireName}"`);
    wireNames.add(p.wireName);
    if (typeof p.wireName !== 'string' || p.wireName.length > WIRE_NAME_LIMIT) {
      fail(`wireName "${p.wireName}" exceeds ${WIRE_NAME_LIMIT} chars`);
    }

    // unknown native type
    if (!KNOWN_NATIVE_TYPES.has(p.nativeType)) {
      fail(`unknown nativeType ${p.nativeType} for ${p.logicalId}`);
    }

    // missing default
    if (!('default' in p)) fail(`missing default for ${p.logicalId}`);

    // missing old-project default (Adobe USE_VALUE_FOR_OLD_PROJECTS)
    if (!('oldProjectDefault' in p)) fail(`missing oldProjectDefault for ${p.logicalId}`);

    // type-specific default + range validation
    if (p.nativeType === 'POINT') {
      if (typeof p.default !== 'string' || !POINT_DEFAULTS.has(p.default)) {
        fail(`POINT default for ${p.logicalId} must be one of ${[...POINT_DEFAULTS]} (got ${JSON.stringify(p.default)})`);
      }
      if (p.range !== null) fail(`POINT ${p.logicalId} range must be null`);
    } else if (p.nativeType === 'POPUP') {
      const en = contract.enums[p.enumRef];
      if (!en) fail(`POPUP ${p.logicalId} references unknown enum ${p.enumRef}`);
      if (typeof p.default !== 'number' || !Number.isInteger(p.default)) {
        fail(`POPUP default for ${p.logicalId} must be integer enum value`);
      }
      if (!en.values.some((v) => v.value === p.default)) {
        fail(`POPUP default ${p.default} for ${p.logicalId} not in enum ${p.enumRef}`);
      }
      if (p.range !== null) fail(`POPUP ${p.logicalId} range must be null`);
    } else { // FLOAT_SLIDER / ANGLE
      if (typeof p.default !== 'number') fail(`default for ${p.logicalId} must be number`);
      if (p.nativeType === 'ANGLE') {
        if (p.range !== null) fail(`ANGLE ${p.logicalId} range must be null (multi-rev)`);
      } else {
        if (!p.range || typeof p.range.min !== 'number' || typeof p.range.max !== 'number') {
          fail(`FLOAT_SLIDER ${p.logicalId} missing numeric range`);
        }
        if (p.range.min >= p.range.max) fail(`range min>=max for ${p.logicalId}`);
        if (p.default < p.range.min || p.default > p.range.max) {
          fail(`default ${p.default} outside range for ${p.logicalId}`);
        }
        if (p.uiRange && (p.uiRange.min > p.uiRange.max)) fail(`uiRange min>max for ${p.logicalId}`);
      }
    }

    // required structural fields
    for (const f of ['introducedInSchema', 'timeVariance', 'serialization', 'fingerprint', 'stateOwnership', 'canonical']) {
      if (!(f in p)) fail(`missing field ${f} for ${p.logicalId}`);
    }
  }

  // wire-name limit also enforced above; reserved families must have zero entries
  const countParam = contract.parameters.find((p) => p.logicalId === 'contract.parameterCount');
  if (countParam && countParam.default !== expectedCount) {
    fail(`contract.parameterCount default ${countParam.default} != actual parameter count ${expectedCount}`);
  }
  for (const [name, r] of Object.entries(contract.diskIdRanges)) {
    if (r.status === 'reserved') {
      const inside = contract.parameters.filter((p) => p.diskId >= r.min && p.diskId <= r.max);
      if (inside.length) fail(`reserved family ${name} has entries: ${inside.map((p) => p.logicalId).join(', ')}`);
    }
  }
}

// ---- emitters ---------------------------------------------------------------

function toCamel(logicalId) {
  return logicalId
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

function emitIdsHpp(contract) {
  const L = [];
  L.push('// GENERATED by tools/generate-contract.js - do not edit.');
  L.push('// Source of truth: shared/schema/parameter-contract.json');
  L.push('#ifndef STATEMOTION_PARAMETER_IDS_HPP');
  L.push('#define STATEMOTION_PARAMETER_IDS_HPP');
  L.push('');
  L.push('namespace statemotion { namespace ids {');
  L.push('');
  for (const [ename, pairs] of Object.entries(REQUIRED_ENUMS)) {
    L.push(`enum class ${ename} : int {`);
    L.push(pairs.map(([n, v]) => `  ${n} = ${v}`).join(',\n'));
    L.push('};');
    L.push('');
  }
  L.push(`inline constexpr int kSchemaVersion = ${contract.schemaVersion};`);
  L.push(`inline constexpr int kBindingRevision = ${contract.bindingRevision};`);
  L.push(`inline constexpr int kParameterCount = ${contract.parameters.length};`);
  L.push('');
  for (const p of contract.parameters) {
    const c = toCamel(p.logicalId);
    L.push(`inline constexpr int k${c.charAt(0).toUpperCase() + c.slice(1)} = ${p.diskId};`);
  }
  L.push('');
  L.push('} // namespace ids');
  L.push('} // namespace statemotion');
  L.push('#endif // STATEMOTION_PARAMETER_IDS_HPP');
  return L.join('\n') + '\n';
}

function emitBindingsHpp(contract, digest) {
  const L = [];
  L.push('// GENERATED by tools/generate-contract.js - do not edit.');
  L.push('// Source of truth: shared/schema/parameter-contract.json');
  L.push('#ifndef STATEMOTION_PARAMETER_BINDINGS_HPP');
  L.push('#define STATEMOTION_PARAMETER_BINDINGS_HPP');
  L.push('');
  L.push('#include "parameter_ids.hpp"');
  L.push('#include <cstddef>');
  L.push('');
  L.push('namespace statemotion { namespace contract {');
  L.push('');
  L.push('struct ParameterBinding {');
  L.push('  const char* logicalId;');
  L.push('  int diskId;');
  L.push('  const char* wireName;');
  L.push('  const char* nativeType;');
  L.push('  const char* stateOwnership;');
  L.push('  const char* timeVariance;');
  L.push('};');
  L.push('');
  L.push(`inline constexpr char kContractDigest[] = "${digest}";`);
  L.push('');
  L.push(`inline constexpr ParameterBinding kBindings[${contract.parameters.length}] = {`);
  L.push(contract.parameters.map((p) =>
    `  {"${p.logicalId}", ${p.diskId}, "${p.wireName}", "${p.nativeType}", "${p.stateOwnership}", "${p.timeVariance}"}`,
  ).join(',\n'));
  L.push('};');
  L.push('');
  L.push('} // namespace contract');
  L.push('} // namespace statemotion');
  L.push('#endif // STATEMOTION_PARAMETER_BINDINGS_HPP');
  return L.join('\n') + '\n';
}

function emitIdsTs(contract) {
  const L = [];
  L.push('// GENERATED by tools/generate-contract.js - do not edit.');
  L.push('// Source of truth: shared/schema/parameter-contract.json');
  L.push('');
  for (const [ename, pairs] of Object.entries(REQUIRED_ENUMS)) {
    L.push(`export enum ${ename} {`);
    L.push(pairs.map(([n, v]) => `  ${n} = ${v}`).join(',\n'));
    L.push('}');
    L.push('');
  }
  L.push(`export const SCHEMA_VERSION = ${contract.schemaVersion};`);
  L.push(`export const BINDING_REVISION = ${contract.bindingRevision};`);
  L.push(`export const PARAMETER_COUNT = ${contract.parameters.length};`);
  L.push('');
  for (const p of contract.parameters) {
    const c = toCamel(p.logicalId);
    L.push(`export const ${c.charAt(0).toUpperCase() + c.slice(1)} = ${p.diskId};`);
  }
  L.push('');
  return L.join('\n');
}

function emitBindingsTs(contract, digest) {
  const L = [];
  L.push('// GENERATED by tools/generate-contract.js - do not edit.');
  L.push('// Source of truth: shared/schema/parameter-contract.json');
  L.push('// Consumed by the UXP panel. Logical IDs are canonical; raw native');
  L.push('// indexes are NEVER part of this contract (sealed in EffectParameterMap).');
  L.push('');
  L.push('export interface ParameterBinding {');
  L.push('  logicalId: string;');
  L.push('  diskId: number;');
  L.push('  wireName: string;');
  L.push('  nativeType: string;');
  L.push('  stateOwnership: string;');
  L.push('  timeVariance: string;');
  L.push('  defaultVal: number | string;');
  L.push('  validMin: number;');
  L.push('  validMax: number;');
  L.push('  uiMin: number;');
  L.push('  uiMax: number;');
  L.push('  enumRef: string;');
  L.push('  oldDefault: number | string;');
  L.push('}');
  L.push('');
  L.push(`export const CONTRACT_DIGEST = "${digest}";`);
  L.push(`export const SCHEMA_VERSION = ${contract.schemaVersion};`);
  L.push(`export const BINDING_REVISION = ${contract.bindingRevision};`);
  L.push(`export const PARAMETER_COUNT = ${contract.parameters.length};`);
  L.push('');
  L.push(`export const BINDINGS: ParameterBinding[] = [`);
  L.push(contract.parameters.map((p) => {
    const def = typeof p.default === 'string' ? `"${p.default}"` : p.default;
    const old = typeof p.oldProjectDefault === 'string' ? `"${p.oldProjectDefault}"` : p.oldProjectDefault;
    const rmin = p.range ? p.range.min : 0;
    const rmax = p.range ? p.range.max : 0;
    const umin = p.uiRange ? p.uiRange.min : 0;
    const umax = p.uiRange ? p.uiRange.max : 0;
    const en = p.enumRef || '';
    return `  { logicalId: "${p.logicalId}", diskId: ${p.diskId}, wireName: "${p.wireName}", nativeType: "${p.nativeType}", stateOwnership: "${p.stateOwnership}", timeVariance: "${p.timeVariance}", defaultVal: ${def}, validMin: ${rmin}, validMax: ${rmax}, uiMin: ${umin}, uiMax: ${umax}, enumRef: "${en}", oldDefault: ${old} },`;
  }).join('\n'));
  L.push('];');
  L.push('');
  L.push('const byLogicalId = new Map<string, ParameterBinding>(');
  L.push('  BINDINGS.map((b) => [b.logicalId, b] as const));');
  L.push('');
  L.push('export function getBinding(logicalId: string): ParameterBinding | undefined {');
  L.push('  return byLogicalId.get(logicalId);');
  L.push('}');
  L.push('');
  L.push('export const LOGICAL_IDS: readonly string[] = BINDINGS.map((b) => b.logicalId);');
  L.push('');
  return L.join('\n');
}

function emitMarkdown(contract, digest) {
  const L = [];
  L.push(`# StateMotion Parameter Contract (generated)`);
  L.push('');
  L.push(`- schemaVersion: ${contract.schemaVersion}`);
  L.push(`- bindingRevision: ${contract.bindingRevision}`);
  L.push(`- parameterCount: ${contract.parameters.length}`);
  L.push(`- SHA-256: \`${digest}\``);
  L.push('');
  L.push(`> GENERATED from shared/schema/parameter-contract.json. Do not edit by hand.`);
  L.push('');
  L.push(`## Enums`);
  for (const [ename, e] of Object.entries(contract.enums)) {
    L.push('');
    L.push(`### ${ename}`);
    L.push(e.values.map((v) => `- ${v.name} = ${v.value}`).join('\n'));
  }
  L.push('');
  L.push(`## Parameters`);
  L.push('');
  L.push(`| logicalId | diskId | wireName | nativeType | default | range | timeVariance | state |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  for (const p of contract.parameters) {
    const rng = p.range ? `${p.range.min}..${p.range.max}` : (p.nativeType === 'POPUP' ? p.enumRef : 'n/a');
    L.push(`| ${p.logicalId} | ${p.diskId} | ${p.wireName} | ${p.nativeType} | ${JSON.stringify(p.default)} | ${rng} | ${p.timeVariance} | ${p.stateOwnership} |`);
  }
  L.push('');
  return L.join('\n');
}

// ---- main -------------------------------------------------------------------

function main() {
  const checkOnly = process.argv.includes('--check');
  const contract = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  validate(contract);

  const canonical = canonicalize(contract);
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');

  const idsHpp = emitIdsHpp(contract);
  const bindingsHpp = emitBindingsHpp(contract, digest);
  const idsTs = emitIdsTs(contract);
  const bindingsTs = emitBindingsTs(contract, digest);
  const md = emitMarkdown(contract, digest);

  if (!checkOnly) {
    fs.mkdirSync(GEN_DIR, { recursive: true });
    fs.mkdirSync(DOCS_GEN_DIR, { recursive: true });
    fs.writeFileSync(path.join(GEN_DIR, 'parameter_ids.hpp'), idsHpp);
    fs.writeFileSync(path.join(GEN_DIR, 'parameter_bindings.hpp'), bindingsHpp);
    fs.writeFileSync(path.join(GEN_DIR, 'parameterIds.ts'), idsTs);
    fs.writeFileSync(path.join(GEN_DIR, 'parameterBindings.ts'), bindingsTs);
    fs.writeFileSync(path.join(DOCS_GEN_DIR, 'parameter-contract.md'), md);
    fs.writeFileSync(path.join(GEN_DIR, 'parameter-contract.sha256'), digest + '\n');
    console.log(`Generated bindings. ${contract.parameters.length} params, digest ${digest.slice(0, 16)}...`);
  }

  // C++/TS agreement: both must expose the same diskId multiset from bindings.
  const extractDisks = (src) => {
    // C++:   { "logicalId", <diskId>, ...
    // TS:    { logicalId: "...", diskId: <diskId>, ...
    const reCpp = /\{\s*"[^"]+",\s*(\d+),/g;
    const reTs = /logicalId:\s*"[^"]+",\s*diskId:\s*(\d+),/g;
    const out = [];
    let mm;
    while ((mm = reCpp.exec(src)) !== null) out.push(Number(mm[1]));
    while ((mm = reTs.exec(src)) !== null) out.push(Number(mm[1]));
    return out.sort((a, b) => a - b);
  };
  const cppDisks = extractDisks(bindingsHpp);
  const tsDisks = extractDisks(bindingsTs);
  if (cppDisks.length !== tsDisks.length) fail(`binding diskId count C++ ${cppDisks.length} != TS ${tsDisks.length}`);
  for (let i = 0; i < cppDisks.length; i++) {
    if (cppDisks[i] !== tsDisks[i]) fail(`binding diskId mismatch at ${i}: C++ ${cppDisks[i]} TS ${tsDisks[i]}`);
  }
  if (cppDisks.length !== contract.parameters.length) fail(`binding count ${cppDisks.length} != ${contract.parameters.length}`);

  console.log(checkOnly ? 'CHECK OK' : 'WROTE OK');
  return digest;
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { validate, canonicalize, familyOf, main, REQUIRED_ENUMS };
