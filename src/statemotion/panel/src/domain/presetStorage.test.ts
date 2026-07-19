// StateMotion Preset Panel — local preset repository tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/presetStorage.test.ts

import assert from 'node:assert';
import {
  PresetRepository,
  type FsLike,
} from './presetStorage.ts';
import { FORMAT_ID } from './presetSchema.ts';

let passed = 0;
function pass(name: string) {
  console.log(`PASS  ${name}`);
  passed++;
}

// Minimal in-memory FS implementing the subset the repo needs (sync + async).
function makeMemoryFs(): FsLike {
  const files = new Map<string, string>();
  return {
    async readFile(p: string) { const v = files.get(p); if (v === undefined) throw new Error('ENOENT ' + p); return v; },
    async writeFile(p: string, c: string) { files.set(p, c); },
    async deleteFile(p: string) { files.delete(p); },
    async exists(p: string) { return files.has(p); },
    async listFiles(p: string) {
      const prefix = p.endsWith('/') ? p : p + '/';
      const out = new Set<string>();
      for (const k of files.keys()) if (k.startsWith(prefix) && k.slice(prefix.length).indexOf('/') === -1) out.add(k);
      return [...out];
    },
    async mkdir(p: string) {
      // no-op for flat in-memory store; directories implicit
    },
  } as FsLike;
}

function samplePreset(id: string, name: string, category = 'Entrances') {
  return {
    formatId: FORMAT_ID,
    schemaVersion: 1,
    presetId: id,
    name,
    description: '',
    author: 'StateMotion',
    createdAt: '2026-07-18T00:00:00.000Z',
    modifiedAt: '2026-07-18T00:00:00.000Z',
    tags: [],
    category,
    collectionIds: [],
    compatibleContract: { schemaVersion: 1, bindingRevision: 2, parameterCount: 25 },
    parameters: {},
    preview: { kind: 'generated' },
  };
}

// ---- create + get ----
(async () => {
  const fs = makeMemoryFs();
  const repo = new PresetRepository(fs, '/data');
  await repo.init();
  const p = samplePreset('p1', 'Soft Arrival');
  await repo.create(p);
  const got = await repo.get('p1');
  assert.ok(got && got.presetId === 'p1', 'created preset should be retrievable');
  assert.ok((await repo.list()).length === 1, 'list should return 1');
  pass('create + get + list works');
})();

// ---- bundled immutable ----
(async () => {
  const fs = makeMemoryFs();
  // Seed a bundled preset file.
  const bundled = samplePreset('b1', 'Bundled One', 'Zooms');
  fs.writeFile('/data/bundled/b1.stmpreset', JSON.stringify(bundled));
  const repo = new PresetRepository(fs, '/data');
  await repo.init();
  const before = (await repo.list()).map((x) => x.presetId);
  assert.ok(before.includes('b1'), 'bundled preset should appear in list');
  // Attempt to delete a bundled preset -> must be refused.
  let refused = false;
  try { await repo.delete('b1'); } catch { refused = true; }
  assert.ok(refused, 'deleting a bundled preset must be refused');
  const after = await repo.list();
  assert.ok(after.some((x) => x.presetId === 'b1'), 'bundled preset must still exist');
  pass('bundled presets are listed but immutable');
})();

// ---- update ----
(async () => {
  const fs = makeMemoryFs();
  const repo = new PresetRepository(fs, '/data');
  await repo.init();
  await repo.create(samplePreset('p1', 'Original'));
  await repo.update({ ...samplePreset('p1', 'Original'), name: 'Renamed' });
  const got = await repo.get('p1');
  assert.strictEqual(got?.name, 'Renamed', 'update should change name');
  pass('update modifies a user preset');
})();

// ---- duplicate gets new id ----
(async () => {
  const fs = makeMemoryFs();
  const repo = new PresetRepository(fs, '/data');
  await repo.init();
  await repo.create(samplePreset('p1', 'Dup me'));
  const dup = await repo.duplicate('p1');
  assert.ok(dup.presetId !== 'p1', 'duplicate must have a new id');
  assert.strictEqual(dup.name, 'Dup me', 'duplicate keeps name');
  const ids = (await repo.list()).map((x) => x.presetId);
  assert.ok(ids.includes('p1') && ids.includes(dup.presetId), 'both originals + dup present');
  pass('duplicate creates a new presetId');
})();

// ---- delete ----
(async () => {
  const fs = makeMemoryFs();
  const repo = new PresetRepository(fs, '/data');
  await repo.init();
  await repo.create(samplePreset('p1', 'Bye'));
  await repo.delete('p1');
  assert.strictEqual(await repo.get('p1'), undefined, 'deleted preset gone');
  pass('delete removes a user preset');
})();

// ---- import writes user file ----
(async () => {
  const fs = makeMemoryFs();
  const repo = new PresetRepository(fs, '/data');
  await repo.init();
  const text = JSON.stringify(samplePreset('imp1', 'Imported'));
  const imported = await repo.import(text);
  const got = await repo.get(imported.presetId);
  assert.ok(got && got.name === 'Imported', 'imported preset persisted');
  pass('import writes a user preset file');
})();

// ---- export ----
(async () => {
  const fs = makeMemoryFs();
  const repo = new PresetRepository(fs, '/data');
  await repo.init();
  await repo.create(samplePreset('p1', 'Export me'));
  const text = await repo.export('p1');
  assert.ok(text.includes(FORMAT_ID), 'export includes formatId');
  pass('export emits serialized preset');
})();

console.log(`\nALL PASSED (${passed})`);
