// StateMotion Preset Panel — collections tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/collections.test.ts

import assert from 'node:assert';
import {
  createCollection,
  renameCollection,
  deleteCollection,
  addToCollection,
  removeFromCollection,
  listCollectionPresets,
} from './collections.ts';
import { emptyLibrary } from './favorites.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

(() => {
  const lib = createCollection(emptyLibrary(), 'c1', 'Travel');
  assert.strictEqual(lib.collections['c1']?.name, 'Travel', 'collection created with name');
  assert.ok(lib.collectionIds.includes('c1'), 'collection id tracked');
  pass('createCollection adds a collection');
})();

(() => {
  let lib = createCollection(emptyLibrary(), 'c1', 'Travel');
  lib = addToCollection(lib, 'c1', 'p1');
  lib = addToCollection(lib, 'c1', 'p2');
  lib = addToCollection(lib, 'c1', 'p1'); // idempotent
  assert.deepStrictEqual(lib.collections['c1'].presetIds.sort(), ['p1', 'p2']);
  lib = removeFromCollection(lib, 'c1', 'p1');
  assert.deepStrictEqual(lib.collections['c1'].presetIds, ['p2']);
  pass('addToCollection idempotent; removeFromCollection works');
})();

(() => {
  let lib = createCollection(emptyLibrary(), 'c1', 'Travel');
  lib = addToCollection(lib, 'c1', 'p1');
  lib = renameCollection(lib, 'c1', 'Movement');
  assert.strictEqual(lib.collections['c1'].name, 'Movement');
  assert.deepStrictEqual(lib.collections['c1'].presetIds, ['p1'], 'rename keeps members');
  pass('renameCollection preserves members');
})();

(() => {
  let lib = createCollection(emptyLibrary(), 'c1', 'Travel');
  lib = addToCollection(lib, 'c1', 'p1');
  // Deleting a collection must NOT delete the preset.
  lib = deleteCollection(lib, 'c1');
  assert.strictEqual(lib.collections['c1'], undefined, 'collection removed');
  assert.ok(!lib.collectionIds.includes('c1'), 'id untracked');
  assert.strictEqual(lib.favoritePresetIds.includes('p1'), false, 'presets not destroyed');
  pass('deleteCollection removes collection but not presets');
})();

(() => {
  let lib = createCollection(emptyLibrary(), 'c1', 'Travel');
  lib = addToCollection(lib, 'c1', 'p1');
  lib = addToCollection(lib, 'c1', 'p2');
  const ids = listCollectionPresets(lib, 'c1');
  assert.deepStrictEqual(ids.sort(), ['p1', 'p2']);
  pass('listCollectionPresets returns member ids');
})();

console.log(`\nALL PASSED (${passed})`);
