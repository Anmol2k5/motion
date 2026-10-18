import {cloneJson} from './jsonData.ts';
import { newId, assertSafeId } from './ids.ts';
import { isRecord } from './parameterValues.ts';
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

function validLibrary(value: unknown): value is LibraryModel {
  if(!isRecord(value)||!isRecord(value.collections))return false;
  for(const key of ['favoritePresetIds','collectionIds','recentlyUsed'])
    if(!Array.isArray(value[key])||!(value[key] as unknown[]).every(x=>typeof x==='string'))return false;
  try {
    for(const [id,c] of Object.entries(value.collections)){
      assertSafeId(id);
      if(!isRecord(c)||c.id!==id||typeof c.name!=='string'||!Array.isArray(c.presetIds)||!c.presetIds.every(x=>typeof x==='string'))return false;
    }
    return (value.collectionIds as string[]).every(id=>Object.prototype.hasOwnProperty.call(value.collections,id));
  }catch{return false;}
}

export class PresetRepository {
  private library: LibraryModel = cloneJson(EMPTY_LIBRARY);
  private pending: Promise<unknown> = Promise.resolve();
  private warnings = new Set<string>();
  private mutate<T>(operation:()=>Promise<T>): Promise<T> {
    const result=this.pending.then(operation,operation);
    this.pending=result.then(()=>{},()=>{});
    return result;
  }
  getWarnings(): string[] { return [...this.warnings]; }
  private async freshId(): Promise<string> {
    for(let attempt=0;attempt<100;attempt++){
      const id=newId();
      if(!(await this.fs.exists(this.userPath(id))))return id;
    }
    throw new Error('Could not allocate a unique preset ID');
  }

  constructor(private fs: FsLike, private root: string) {}

  private bundledDir(): string { return this.root + '/bundled'; }
  private userDir(): string { return this.root + '/user'; }
  private libPath(): string { return this.root + '/library.json'; }
  private userPath(id: string): string { assertSafeId(id); return `${this.userDir()}/${id}.stmpreset`; }
  private bundledPath(id: string): string { assertSafeId(id); return `${this.bundledDir()}/${id}.stmpreset`; }

  async init(): Promise<void> {
    return this.mutate(async()=>{
      await this.fs.mkdir(this.bundledDir()); await this.fs.mkdir(this.userDir());
      let recovered=cloneJson(EMPTY_LIBRARY);
      if(await this.fs.exists(this.libPath())){
        const original=await this.fs.readFile(this.libPath());
        try{
          const parsed=JSON.parse(original);
          if(!validLibrary(parsed))throw new Error('Invalid library metadata');
          recovered=parsed;
        }catch{
          const backup=this.root+'/library.backup-'+newId('recovery')+'.json';
          await this.fs.writeFile(backup,original);
          this.warnings.add('Library metadata was recovered; the original was saved in a backup.');
        }
      }
      await this.fs.writeFile(this.libPath(),JSON.stringify(recovered,null,2));
      this.library=recovered;
    });
  }

  getLibrary(): LibraryModel {
    return cloneJson(this.library);
  }

  async installBundled(presets: StateMotionPreset[]): Promise<void> { return this.mutate(()=>this.doInstallBundled(presets)); }

  async create(preset: StateMotionPreset): Promise<void> { return this.mutate(()=>this.doCreate(preset)); }

  async update(preset: StateMotionPreset): Promise<void> { return this.mutate(()=>this.doUpdate(preset)); }

  async duplicate(id: string): Promise<StateMotionPreset> { return this.mutate(()=>this.doDuplicate(id)); }

  async delete(id: string): Promise<void> { return this.mutate(()=>this.doDelete(id)); }

  async import(text: string): Promise<StateMotionPreset> { return this.mutate(()=>this.doImport(text)); }

  // Persist library metadata (favorites/collections/recently-used). The caller
  // passes an updated model; this keeps the repository the single writer.
  async saveLibrary(lib: LibraryModel): Promise<void> {
    return this.mutate(async()=>{
      if(!validLibrary(lib))throw new Error('Invalid library metadata');
      const next=cloneJson(lib);
      await this.fs.writeFile(this.libPath(),JSON.stringify(next,null,2));
      this.library=next;
    });
  }

  private isBundled(id: string): boolean {
    return id.startsWith('bundled-');
  }

  private async doInstallBundled(presets: StateMotionPreset[]): Promise<void> {
    for (const preset of presets) {
      const res = validatePreset(preset);
      if (!this.isBundled(preset.presetId) || !res.ok) throw new Error('invalid bundled preset: ' + preset.presetId);
      await this.fs.writeFile(this.bundledPath(preset.presetId), serializePreset(preset));
    }
  }

  async list(): Promise<StateMotionPreset[]> {
    const out: StateMotionPreset[] = [];
    const dirs = [this.bundledDir(), this.userDir()];
    for (const dir of dirs) {
      for (const f of await this.fs.listFiles(dir)) {
        if (!f.endsWith('.stmpreset')) continue;
        try {
          out.push(deserializePreset(await this.fs.readFile(f)));
        } catch {
          this.warnings.add('Some preset files could not be loaded; the original files were preserved.');
        }
      }
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

  private async doCreate(preset: StateMotionPreset): Promise<void> {
    const res = validatePreset(preset);
    if (!res.ok) throw new Error('invalid preset: ' + res.errors.join('; '));
    const id = preset.presetId;
    if (this.isBundled(id)) throw new Error('cannot create over a bundled id');
    if (await this.fs.exists(this.userPath(id))) throw new Error('preset already exists: ' + id);
    await this.fs.writeFile(this.userPath(id), serializePreset(preset));
  }

  private async doUpdate(preset: StateMotionPreset): Promise<void> {
    const res = validatePreset(preset);
    if (!res.ok) throw new Error('invalid preset: ' + res.errors.join('; '));
    const id = preset.presetId;
    if (this.isBundled(id)) throw new Error('bundled presets are immutable');
    if (!(await this.fs.exists(this.userPath(id)))) throw new Error('unknown user preset: ' + id);
    await this.fs.writeFile(this.userPath(id), serializePreset(preset));
  }

  private async doDuplicate(id: string): Promise<StateMotionPreset> {
    const src = await this.get(id);
    if (!src) throw new Error('unknown preset: ' + id);
    const newId = await this.freshId();
    const copy: StateMotionPreset = {
      ...cloneJson(src),
      presetId: newId,
      name: src.name,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    await this.fs.writeFile(this.userPath(newId), serializePreset(copy));
    return copy;
  }

  private async doDelete(id: string): Promise<void> {
    if (this.isBundled(id)) throw new Error('bundled presets are immutable');
    if (!(await this.fs.exists(this.userPath(id)))) throw new Error('unknown user preset: ' + id);
    await this.fs.deleteFile(this.userPath(id));
    const next=cloneJson(this.library);
    next.favoritePresetIds=next.favoritePresetIds.filter(x=>x!==id);
    next.recentlyUsed=next.recentlyUsed.filter(x=>x!==id);
    for(const c of Object.values(next.collections))c.presetIds=c.presetIds.filter(x=>x!==id);
    await this.fs.writeFile(this.libPath(),JSON.stringify(next,null,2));
    this.library=next;
  }

  private async doImport(text: string): Promise<StateMotionPreset> {
    const preset = migratePreset(JSON.parse(text));
    const res = validatePreset(preset);
    if (!res.ok) throw new Error('invalid imported preset: ' + res.errors.join('; '));
    // Force a fresh user id so imports never collide with bundled ids.
    const id = await this.freshId();
    const stamped: StateMotionPreset = { ...cloneJson(preset), presetId: id };
    await this.fs.writeFile(this.userPath(id), serializePreset(stamped));
    return stamped;
  }

  async export(id: string): Promise<string> {
    const preset = await this.get(id);
    if (!preset) throw new Error('unknown preset: ' + id);
    return serializePreset(preset);
  }
}
