// UXP data-folder filesystem adapter.

import type { FsLike } from '../domain/presetStorage.ts';

function loadLocalFileSystem(): any {
  const uxp = (globalThis as any).require?.('uxp') ?? (globalThis as any).uxp;
  const fs = uxp?.storage?.localFileSystem;
  if (!fs) throw new Error('UXP localFileSystem unavailable');
  return fs;
}

export class UxpFs implements FsLike {
  constructor(private readonly localFileSystem: any = loadLocalFileSystem()) {}

  async readFile(path: string): Promise<string> {
    return (await this.entry(path)).read();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { parent, name } = await this.parent(path, true);
    let file: any;
    try { file = await parent.getEntry(name); }
    catch { file = await parent.createFile(name, { overwrite: true }); }
    await file.write(content);
  }

  async deleteFile(path: string): Promise<void> {
    await (await this.entry(path)).delete();
  }

  async exists(path: string): Promise<boolean> {
    try { await this.entry(path); return true; }
    catch { return false; }
  }

  async listFiles(dir: string): Promise<string[]> {
    const folder = await this.entry(dir);
    const prefix = dir.replace(/\/+$/, '');
    return (await folder.getEntries()).map((entry: any) => `${prefix}/${entry.name}`);
  }

  async mkdir(dir: string): Promise<void> {
    await this.folder(dir, true);
  }

  private parts(path: string): string[] {
    return path.split('/').filter(Boolean);
  }

  private async folder(path: string, create: boolean): Promise<any> {
    let folder = await this.localFileSystem.getDataFolder();
    for (const name of this.parts(path)) {
      try { folder = await folder.getEntry(name); }
      catch {
        if (!create) throw new Error(`Folder not found: ${path}`);
        folder = await folder.createFolder(name);
      }
    }
    return folder;
  }

  private async parent(path: string, create: boolean): Promise<{ parent: any; name: string }> {
    const parts = this.parts(path);
    const name = parts.pop();
    if (!name) throw new Error('Invalid empty path');
    return { parent: await this.folder(parts.join('/'), create), name };
  }

  private async entry(path: string): Promise<any> {
    const { parent, name } = await this.parent(path, false);
    return parent.getEntry(name);
  }
}
