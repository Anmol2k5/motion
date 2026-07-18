// StateMotion Preset Panel — Library view model (pure).
// Builds the visible preset list from repo state + UI filter state.

import { searchPresets, FilterKind, SortKind, type SearchOptions } from './search.ts';
import type { StateMotionPreset } from './presetSchema.ts';
import type { LibraryModel } from './presetStorage.ts';
import { filterFavorites } from './favorites.ts';

export interface LibraryViewState {
  query: string;
  filter: FilterKind;
  category?: string;
  collectionId?: string;
  sort: SortKind;
}

export interface LibraryViewModel {
  presets: StateMotionPreset[];
  categories: string[];
  favoriteIds: Set<string>;
}

export function buildLibraryViewModel(
  allPresets: StateMotionPreset[],
  library: LibraryModel,
  view: LibraryViewState,
  knownCategories: string[],
): LibraryViewModel {
  let list = allPresets;
  // Favorites pre-filter using library metadata (presets carry no favorite flag).
  if (view.filter === FilterKind.Favorites) {
    list = filterFavorites(library, list);
  }
  const opts: SearchOptions = {
    query: view.query,
    // After favorites pre-filter, let searchPresets handle category/collection/query.
    filter: view.filter === FilterKind.Favorites ? FilterKind.All : view.filter,
    category: view.category,
    collectionIds: view.collectionId ? [view.collectionId] : undefined,
    sort: view.sort,
  };
  const presets = searchPresets(list, opts);
  return {
    presets,
    categories: knownCategories,
    favoriteIds: new Set(library.favoritePresetIds),
  };
}
