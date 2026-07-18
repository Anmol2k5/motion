// StateMotion Preset Panel — favorites (pure operations over LibraryModel).
// Never mutate bundled/user preset files; favorites are library metadata only.

import type { LibraryModel } from './presetStorage.ts';

export function emptyLibrary(): LibraryModel {
  return { favoritePresetIds: [], collectionIds: [], collections: {}, recentlyUsed: [] };
}

export function isFavorite(lib: LibraryModel, presetId: string): boolean {
  return lib.favoritePresetIds.includes(presetId);
}

export function toggleFavorite(lib: LibraryModel, presetId: string): LibraryModel {
  const has = lib.favoritePresetIds.includes(presetId);
  const favoritePresetIds = has
    ? lib.favoritePresetIds.filter((id) => id !== presetId)
    : [...lib.favoritePresetIds, presetId];
  return { ...lib, favoritePresetIds };
}

export function filterFavorites<T extends { presetId: string }>(
  lib: LibraryModel,
  presets: T[],
): T[] {
  return presets.filter((p) => lib.favoritePresetIds.includes(p.presetId));
}
