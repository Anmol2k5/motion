// StateMotion Preset Panel — UXP filesystem adapter (FsLike).
// Guards every call; surfaces errors rather than crashing the panel.

import type { FsLike } from '../domain/presetStorage.ts';

export class UxpFs implements FsLike {
  private storage: any;

  constructor() {
    const uxp = (globalThis as any).require?.('uxp') ?? (globalThis as any).uxp;
    this.storage = uxp?.storage?.localFileSystem?.getPluginFolder?.() ?? null;
  }

  private async root(): Promise<any> {
    if (!this.storage) throw new Error('UXP localFileSystem unavailable');
    return this.storage;
  }

  private join(...parts: string[]): string {
    return parts.filter(Boolean).join('/');
  }

  async readFile(path: string): Promise<string> {
    const fs = (globalThis as any).require?.('fs');
    if (!fs) throw new Error('fs unavailable');
    return fs.readFileSync(path, 'utf8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fs = (globalThis as any).require?.('fs');
    if (!fs) throw new Error('fs unavailable');
    const dir = path.split('/').slice(0, -1).join('/');
    fs.mkdirSync?.(dir, { recursive: true });
    fs.writeFileSync(path, content, 'utf8');
  }

  async deleteFile(path: string): Promise<void> {
    const fs = (globalThis as any).require?.('fs');
    fs?.unlinkSync?.(path);
  }

  async exists(path: string): Promise<boolean> {
    const fs = (globalThis as any).require?.('fs');
    try { return !!fs?.statSync?.(path); } catch { return false; }
  }

  async listFiles(dir: string): Promise<string[]> {
    const fs = (globalThis as any).require?.('fs');
    if (!fs || !fs.existsSync?.(dir)) return [];
    return fs.readdirSync(dir).map((f: string) => this.join(dir, f));
  }

  async mkdir(dir: string): Promise<void> {
    const fs = (globalThis as any).require?.('fs');
    fs?.mkdirSync?.(dir, { recursive: true });
  }
}
