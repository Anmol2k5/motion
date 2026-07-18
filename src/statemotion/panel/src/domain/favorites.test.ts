// StateMotion Preset Panel — favorites tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/favorites.test.ts

import assert from 'node:assert';
import { toggleFavorite, isFavorite, filterFavorites, emptyLibrary } from './favorites.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

(() => {
  const lib = emptyLibrary();
  assert.strictEqual(isFavorite(lib, 'p1'), false);
  const lib2 = toggleFavorite(lib, 'p1');
  assert.strictEqual(isFavorite(lib2, 'p1'), true, 'after toggle should be favorite');
  assert.strictEqual(isFavorite(lib, 'p1'), false, 'original lib unchanged (pure)');
  const lib3 = toggleFavorite(lib2, 'p1');
  assert.strictEqual(isFavorite(lib3, 'p1'), false, 'toggling off removes');
  pass('toggleFavorite is pure and idempotent-off');
})();

(() => {
  const lib = toggleFavorite(toggleFavorite(emptyLibrary(), 'p1'), 'p2');
  const filtered = filterFavorites(lib, [
    { presetId: 'p1', name: 'A' } as any,
    { presetId: 'pX', name: 'B' } as any,
    { presetId: 'p2', name: 'C' } as any,
  ]);
  assert.deepStrictEqual(filtered.map((p) => p.presetId).sort(), ['p1', 'p2']);
  pass('filterFavorites returns only favorited presets');
})();

console.log(`\nALL PASSED (${passed})`);
