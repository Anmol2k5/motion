// StateMotion Preset Panel — search, filtering, and sorting (pure functions).

export enum FilterKind {
  All = 'all',
  Favorites = 'favorites',
  User = 'user',
  Collection = 'collection',
  Category = 'category',
}

export enum SortKind {
  AZ = 'az',
  Newest = 'newest',
  RecentlyUsed = 'recentlyUsed',
}

type FilterablePreset = {
  presetId: string;
  name: string;
  description: string;
  tags: string[];
  category: string;
  collectionIds?: string[];
  createdAt?: string;
};

export interface SearchOptions {
  query?: string;
  filter?: FilterKind;
  category?: string;
  collectionIds?: string[]; // presets whose collectionIds intersect these
  sort?: SortKind;
  favoriteIds?: string[]; // for the Favorites filter
  recentlyUsed?: string[]; // ordered preset ids for RecentlyUsed sort
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
}

function matchesQuery(p: FilterablePreset, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return (
    normalize(p.name).includes(q) ||
    normalize(p.description).includes(q) ||
    p.tags.some((t) => normalize(t).includes(q)) ||
    normalize(p.category).includes(q)
  );
}

function passesFilter(p: FilterablePreset, opts: SearchOptions): boolean {
  switch (opts.filter) {
    case FilterKind.Favorites:
      return (opts.favoriteIds ?? []).includes(p.presetId);
    case FilterKind.User:
      return typeof p.presetId === 'string' && p.presetId.startsWith('user-');
    case FilterKind.Category:
      return opts.category ? p.category === opts.category : true;
    case FilterKind.Collection:
      if (!opts.collectionIds || opts.collectionIds.length === 0) return true;
      return (p.collectionIds ?? []).some((c: string) => opts.collectionIds!.includes(c));
    case FilterKind.All:
    default:
      return true;
  }
}

function sortPresets<T extends FilterablePreset>(list: T[], sort: SortKind, opts: SearchOptions): T[] {
  const out = list.slice();
  switch (sort) {
    case SortKind.AZ:
      out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case SortKind.Newest:
      out.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      break;
    case SortKind.RecentlyUsed:
      if (opts.recentlyUsed && opts.recentlyUsed.length) {
        const rank = new Map(opts.recentlyUsed.map((id, i) => [id, i]));
        out.sort((a, b) => (rank.get(a.presetId) ?? 1e9) - (rank.get(b.presetId) ?? 1e9));
      }
      break;
    default:
      break;
  }
  return out;
}

export function searchPresets<T extends FilterablePreset>(
  presets: T[],
  opts: SearchOptions = {},
): T[] {
  const filter = opts.filter ?? FilterKind.All;
  const sort = opts.sort ?? SortKind.AZ;
  const query = opts.query ?? '';
  const filtered = presets.filter((p) => matchesQuery(p, query) && passesFilter(p, { ...opts, filter }));
  return sortPresets(filtered, sort, opts);
}
