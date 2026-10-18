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
  if(view.filter===FilterKind.Collection&&view.collectionId){
    const members=new Set(library.collections[view.collectionId]?.presetIds??[]);
    list=allPresets.filter(p=>members.has(p.presetId));
  }
  // Favorites pre-filter using library metadata (presets carry no favorite flag).
  if (view.filter === FilterKind.Favorites) {
    list = filterFavorites(library, list);
  }
  const opts: SearchOptions = {
    query: view.query,
    // After favorites pre-filter, let searchPresets handle category/collection/query.
    filter: view.filter === FilterKind.Favorites || view.filter === FilterKind.Collection ? FilterKind.All : view.filter,
    category: view.category,
    collectionIds: view.collectionId ? [view.collectionId] : undefined,
    sort: view.sort,
  };
  const presets = searchPresets(list, { ...opts, favoriteIds: library.favoritePresetIds, recentlyUsed: library.recentlyUsed });
  return {
    presets,
    categories: knownCategories,
    favoriteIds: new Set(library.favoritePresetIds),
  };
}
