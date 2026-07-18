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

export interface SearchOptions {
  query?: string;
  filter?: FilterKind;
  category?: string;
  collectionIds?: string[]; // presets whose collectionIds intersect these
  sort?: SortKind;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
}

function matchesQuery(p: { name: string; description: string; tags: string[]; category: string }, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return (
    normalize(p.name).includes(q) ||
    normalize(p.description).includes(q) ||
    p.tags.some((t) => normalize(t).includes(q)) ||
    normalize(p.category).includes(q)
  );
}

function passesFilter(p: any, opts: SearchOptions): boolean {
  switch (opts.filter) {
    case FilterKind.Favorites:
      return p.favorite === true;
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

function sortPresets<T extends { name: string; createdAt: string; presetId: string }>(list: T[], sort: SortKind): T[] {
  const out = list.slice();
  switch (sort) {
    case SortKind.AZ:
      out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case SortKind.Newest:
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case SortKind.RecentlyUsed:
      // recentlyUsed handled by caller order; stable by presetId as fallback.
      out.sort((a, b) => a.presetId.localeCompare(b.presetId));
      break;
    default:
      break;
  }
  return out;
}

export function searchPresets<T extends { name: string; description: string; tags: string[]; category: string; presetId: string; createdAt: string }>(
  presets: T[],
  opts: SearchOptions = {},
): T[] {
  const filter = opts.filter ?? FilterKind.All;
  const sort = opts.sort ?? SortKind.AZ;
  const query = opts.query ?? '';
  const filtered = presets.filter((p) => matchesQuery(p, query) && passesFilter(p, { ...opts, filter }));
  return sortPresets(filtered, sort);
}
