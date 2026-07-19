// StateMotion Preset Panel — library view model tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/libraryModel.test.ts

import assert from 'node:assert';
import { buildLibraryViewModel, type LibraryViewState } from './libraryModel.ts';
import { FilterKind, SortKind } from './search.ts';
import { toggleFavorite, emptyLibrary } from './favorites.ts';
import type { StateMotionPreset } from './presetSchema.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

const PRESETS: StateMotionPreset[] = [
  { presetId: 'a', name: 'Soft Arrival', description: '', author: 'S', createdAt: '2026-01-01T00:00:00Z', tags: ['entrance'], category: 'Entrances', collectionIds: [], compatibleContract: { schemaVersion: 1, bindingRevision: 2, parameterCount: 25 }, parameters: {}, preview: { kind: 'generated' }, formatId: 'x', schemaVersion: 1 } as any,
  { presetId: 'b', name: 'Quick Drift', description: '', author: 'S', createdAt: '2026-03-01T00:00:00Z', tags: ['exit'], category: 'Exits', collectionIds: [], compatibleContract: { schemaVersion: 1, bindingRevision: 2, parameterCount: 25 }, parameters: {}, preview: { kind: 'generated' }, formatId: 'x', schemaVersion: 1 } as any,
  { presetId: 'c', name: 'Center Bloom', description: '', author: 'S', createdAt: '2026-02-01T00:00:00Z', tags: ['zoom'], category: 'Zooms', collectionIds: [], compatibleContract: { schemaVersion: 1, bindingRevision: 2, parameterCount: 25 }, parameters: {}, preview: { kind: 'generated' }, formatId: 'x', schemaVersion: 1 } as any,
];

const CATS = ['Entrances', 'Exits', 'Zooms'];
const baseView: LibraryViewState = { query: '', filter: FilterKind.All, sort: SortKind.AZ };

(() => {
  const vm = buildLibraryViewModel(PRESETS, emptyLibrary(), baseView, CATS);
  assert.strictEqual(vm.presets.length, 3, 'shows all presets');
  assert.deepStrictEqual(vm.categories, CATS);
  pass('library view shows all presets + categories');
})();

(() => {
  let lib = toggleFavorite(emptyLibrary(), 'a');
  const vm = buildLibraryViewModel(PRESETS, lib, { ...baseView, filter: FilterKind.Favorites }, CATS);
  assert.deepStrictEqual(vm.presets.map((p) => p.presetId), ['a'], 'favorites filter');
  pass('favorites filter narrows the list');
})();

(() => {
  const vm = buildLibraryViewModel(PRESETS, emptyLibrary(), { ...baseView, query: 'zoom' }, CATS);
  assert.deepStrictEqual(vm.presets.map((p) => p.presetId), ['c']);
  pass('query filters the library view');
})();

console.log(`\nALL PASSED (${passed})`);
