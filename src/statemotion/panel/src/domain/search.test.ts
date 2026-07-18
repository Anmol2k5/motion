// StateMotion Preset Panel — search/filter/sort tests.
// Run: node --experimental-transform-types src/statemotion/panel/src/domain/search.test.ts

import assert from 'node:assert';
import { searchPresets, FilterKind, SortKind } from './search.ts';

let passed = 0;
function pass(name: string) { console.log(`PASS  ${name}`); passed++; }

const PRESETS = [
  { presetId: 'a', name: 'Soft Arrival', description: 'gentle scale', tags: ['entrance'], category: 'Entrances', createdAt: '2026-01-01T00:00:00Z', favorite: false },
  { presetId: 'b', name: 'Quick Drift', description: 'slide in', tags: ['slide', 'exit'], category: 'Slides', createdAt: '2026-03-01T00:00:00Z', favorite: true },
  { presetId: 'c', name: 'Center Bloom', description: 'zoom', tags: ['zoom', 'entrance'], category: 'Zooms', createdAt: '2026-02-01T00:00:00Z', favorite: false },
] as any[];

// search by name
(() => {
  const r = searchPresets(PRESETS, { query: 'drift' });
  assert.deepStrictEqual(r.map((p) => p.presetId), ['b']);
  pass('search matches name (substring, case-insensitive)');
})();

// search by tag
(() => {
  const r = searchPresets(PRESETS, { query: 'zoom' });
  assert.deepStrictEqual(r.map((p) => p.presetId), ['c']);
  pass('search matches tag');
})();

// search by description
(() => {
  const r = searchPresets(PRESETS, { query: 'slide' });
  assert.deepStrictEqual(r.map((p) => p.presetId), ['b']);
  pass('search matches description');
})();

// search by category
(() => {
  const r = searchPresets(PRESETS, { query: 'zoom' });
  assert.ok(r.length >= 1);
  pass('search matches category');
})();

// filter: favorites
(() => {
  const r = searchPresets(PRESETS, { filter: FilterKind.Favorites, favoriteIds: ['b'] });
  assert.deepStrictEqual(r.map((p) => p.presetId), ['b']);
  pass('filter Favorites');
})();

// filter: category
(() => {
  const r = searchPresets(PRESETS, { filter: FilterKind.Category, category: 'Zooms' });
  assert.deepStrictEqual(r.map((p) => p.presetId), ['c']);
  pass('filter by category');
})();

// sort A-Z
(() => {
  const r = searchPresets(PRESETS, { sort: SortKind.AZ });
  assert.strictEqual(r[0].presetId, 'c', 'A-Z first is Center Bloom');
  pass('sort A-Z');
})();

// sort newest
(() => {
  const r = searchPresets(PRESETS, { sort: SortKind.Newest });
  assert.strictEqual(r[0].presetId, 'b', 'newest is Quick Drift (2026-03)');
  pass('sort Newest');
})();

// combined query + filter + sort
(() => {
  const r = searchPresets(PRESETS, { query: 'entrance', filter: FilterKind.All, sort: SortKind.AZ });
  assert.deepStrictEqual(r.map((p) => p.presetId).sort(), ['a', 'c']);
  assert.strictEqual(r[0].presetId, 'c', 'A-Z: Center Bloom before Soft Arrival');
  pass('combined query + filter + sort');
})();

console.log(`\nALL PASSED (${passed})`);
