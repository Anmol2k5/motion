import assert from 'node:assert';
import { UxpFs } from './uxpFs.ts';

class Entry {
  readonly children = new Map<string, Entry>();
  content = '';
  constructor(readonly name: string, readonly isFolder: boolean) {}
  async getEntry(name: string) {
    const entry = this.children.get(name);
    if (!entry) throw new Error('ENOENT');
    return entry;
  }
  async createFolder(name: string) {
    const entry = new Entry(name, true);
    this.children.set(name, entry);
    return entry;
  }
  async createFile(name: string) {
    const entry = new Entry(name, false);
    this.children.set(name, entry);
    return entry;
  }
  async getEntries() { return [...this.children.values()]; }
  async read() { return this.content; }
  async write(content: string) { this.content = content; }
  async delete() { throw new Error('test deletes through parent'); }
}

const root = new Entry('data', true);
const fs = new UxpFs({ async getDataFolder() { return root; } } as never);

await fs.mkdir('state/user');
await fs.writeFile('state/user/example.stmpreset', '{"ok":true}');
assert.strictEqual(await fs.readFile('state/user/example.stmpreset'), '{"ok":true}');
assert.deepStrictEqual(await fs.listFiles('state/user'), ['state/user/example.stmpreset']);
assert.strictEqual(await fs.exists('state/user/example.stmpreset'), true);
console.log('PASS  uses the UXP data folder for preset storage');
