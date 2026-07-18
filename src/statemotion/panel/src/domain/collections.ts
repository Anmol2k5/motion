// StateMotion Preset Panel — collections (pure operations over LibraryModel).
// Original StateMotion collections; deleting a collection never deletes presets.

import type { LibraryModel } from './presetStorage.ts';

export function createCollection(
  lib: LibraryModel,
  id: string,
  name: string,
): LibraryModel {
  if (lib.collections[id]) return lib;
  return {
    ...lib,
    collectionIds: [...lib.collectionIds, id],
    collections: { ...lib.collections, [id]: { id, name, presetIds: [] } },
  };
}

export function renameCollection(lib: LibraryModel, id: string, name: string): LibraryModel {
  const c = lib.collections[id];
  if (!c) return lib;
  return {
    ...lib,
    collections: { ...lib.collections, [id]: { ...c, name } },
  };
}

export function deleteCollection(lib: LibraryModel, id: string): LibraryModel {
  if (!lib.collections[id]) return lib;
  const collections = { ...lib.collections };
  delete collections[id];
  return {
    ...lib,
    collectionIds: lib.collectionIds.filter((x) => x !== id),
    collections,
  };
}

export function addToCollection(lib: LibraryModel, id: string, presetId: string): LibraryModel {
  const c = lib.collections[id];
  if (!c || c.presetIds.includes(presetId)) return lib;
  return {
    ...lib,
    collections: { ...lib.collections, [id]: { ...c, presetIds: [...c.presetIds, presetId] } },
  };
}

export function removeFromCollection(lib: LibraryModel, id: string, presetId: string): LibraryModel {
  const c = lib.collections[id];
  if (!c) return lib;
  return {
    ...lib,
    collections: { ...lib.collections, [id]: { ...c, presetIds: c.presetIds.filter((p) => p !== presetId) } },
  };
}

export function listCollectionPresets(lib: LibraryModel, id: string): string[] {
  return lib.collections[id]?.presetIds ?? [];
}
