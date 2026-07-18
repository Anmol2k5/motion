// StateMotion Preset Panel — local preset repository (storage).
//
// File-backed repository. Host-independent: the FS surface is injected so tests
// use an in-memory FS and the runtime uses UXP localFileSystem. Bundled presets
// live under <root>/bundled and are read-only. User presets under <root>/user.
// Library metadata (favorites, collections, recently used) lives at
// <root>/library.json and is never a server/DB.

import {
  FORMAT_ID,
  deserializePreset,
  serializePreset,
  migratePreset,
  validatePreset,
  type StateMotionPreset,
} from './presetSchema.ts';

export interface FsLike {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(dir: string): Promise<string[]>;
  mkdir(dir: string): Promise<void>;
}

export interface LibraryModel {
  favoritePresetIds: string[];
  collectionIds: string[];
  collections: Record<string, { id: string; name: string; presetIds: string[] }>;
  recentlyUsed: string[];
}

const EMPTY_LIBRARY: LibraryModel = {
  favoritePresetIds: [],
  collectionIds: [],
  collections: {},
  recentlyUsed: [],
};

function userId(id: string): string {
  return 'user-' + id;
}

export class PresetRepository {
  private library: LibraryModel = structuredClone(EMPTY_LIBRARY);

  constructor(private fs: FsLike, private root: string) {}

  private bundledDir(): string { return this.root + '/bundled'; }
  private userDir(): string { return this.root + '/user'; }
  private libPath(): string { return this.root + '/library.json'; }
  private userPath(id: string): string { return `${this.userDir()}/${id}.stmpreset`; }
  private bundledPath(id: string): string { return `${this.bundledDir()}/${id}.stmpreset`; }

  async init(): Promise<void> {
    await this.fs.mkdir(this.bundledDir());
    await this.fs.mkdir(this.userDir());
    if (await this.fs.exists(this.libPath())) {
      try {
        const raw = await this.fs.readFile(this.libPath());
        const parsed = JSON.parse(raw) as Partial<LibraryModel>;
        this.library = { ...structuredClone(EMPTY_LIBRARY), ...parsed };
        if (!this.library.collections) this.library.collections = {};
      } catch {
        this.library = structuredClone(EMPTY_LIBRARY);
      }
    }
    await this.persistLibrary();
  }

  getLibrary(): LibraryModel {
    return structuredClone(this.library);
  }

  // Persist library metadata (favorites/collections/recently-used). The caller
  // passes an updated model; this keeps the repository the single writer.
  async saveLibrary(lib: LibraryModel): Promise<void> {
    this.library = structuredClone(lib);
    await this.persistLibrary();
  }

  private async persistLibrary(): Promise<void> {
    await this.fs.writeFile(this.libPath(), JSON.stringify(this.library, null, 2));
  }

  private isBundled(id: string): boolean {
    return id.startsWith('bundled-');
  }

  async list(): Promise<StateMotionPreset[]> {
    const out: StateMotionPreset[] = [];
    for (const f of await this.fs.listFiles(this.bundledDir())) {
      if (!f.endsWith('.stmpreset')) continue;
      out.push(deserializePreset(await this.fs.readFile(f)));
    }
    for (const f of await this.fs.listFiles(this.userDir())) {
      if (!f.endsWith('.stmpreset')) continue;
      out.push(deserializePreset(await this.fs.readFile(f)));
    }
    return out;
  }

  async get(id: string): Promise<StateMotionPreset | undefined> {
    if (await this.fs.exists(this.userPath(id))) {
      return deserializePreset(await this.fs.readFile(this.userPath(id)));
    }
    if (await this.fs.exists(this.bundledPath(id))) {
      return deserializePreset(await this.fs.readFile(this.bundledPath(id)));
    }
    return undefined;
  }

  async create(preset: StateMotionPreset): Promise<void> {
    const res = validatePreset(preset);
    if (!res.ok) throw new Error('invalid preset: ' + res.errors.join('; '));
    const id = preset.presetId;
    if (this.isBundled(id)) throw new Error('cannot create over a bundled id');
    if (await this.fs.exists(this.userPath(id))) throw new Error('preset already exists: ' + id);
    await this.fs.writeFile(this.userPath(id), serializePreset(preset));
  }

  async update(preset: StateMotionPreset): Promise<void> {
    const res = validatePreset(preset);
    if (!res.ok) throw new Error('invalid preset: ' + res.errors.join('; '));
    const id = preset.presetId;
    if (this.isBundled(id)) throw new Error('bundled presets are immutable');
    if (!(await this.fs.exists(this.userPath(id)))) throw new Error('unknown user preset: ' + id);
    await this.fs.writeFile(this.userPath(id), serializePreset(preset));
  }

  async duplicate(id: string): Promise<StateMotionPreset> {
    const src = await this.get(id);
    if (!src) throw new Error('unknown preset: ' + id);
    const newId = userId(id + '-' + Date.now().toString(36));
    const copy: StateMotionPreset = {
      ...structuredClone(src),
      presetId: newId,
      name: src.name,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    await this.fs.writeFile(this.userPath(newId), serializePreset(copy));
    return copy;
  }

  async delete(id: string): Promise<void> {
    if (this.isBundled(id)) throw new Error('bundled presets are immutable');
    if (!(await this.fs.exists(this.userPath(id)))) throw new Error('unknown user preset: ' + id);
    await this.fs.deleteFile(this.userPath(id));
  }

  async import(text: string): Promise<StateMotionPreset> {
    const preset = migratePreset(JSON.parse(text));
    const res = validatePreset(preset);
    if (!res.ok) throw new Error('invalid imported preset: ' + res.errors.join('; '));
    // Force a fresh user id so imports never collide with bundled ids.
    const id = userId(preset.presetId + '-' + Date.now().toString(36));
    const stamped: StateMotionPreset = { ...structuredClone(preset), presetId: id };
    await this.fs.writeFile(this.userPath(id), serializePreset(stamped));
    return stamped;
  }

  async export(id: string): Promise<string> {
    const preset = await this.get(id);
    if (!preset) throw new Error('unknown preset: ' + id);
    return serializePreset(preset);
  }
}

// Re-export the FS contract for callers/tests.
export type { FsLike };
