import assert from 'node:assert';
import { PresetRepository, type FsLike } from '../domain/presetStorage.ts';
import { BUNDLED_PRESETS } from './bundledPresets.ts';

const files = new Map<string, string>();
const fs: FsLike = {
  async readFile(path) { return files.get(path)!; },
  async writeFile(path, content) { files.set(path, content); },
  async deleteFile(path) { files.delete(path); },
  async exists(path) { return files.has(path); },
  async listFiles(dir) {
    const prefix = `${dir}/`;
    return [...files.keys()].filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'));
  },
  async mkdir() {},
};

const repo = new PresetRepository(fs, 'data');
await repo.init();
await repo.installBundled(BUNDLED_PRESETS);

const installed = await repo.list();
assert.strictEqual(installed.length, BUNDLED_PRESETS.length);
assert.ok(installed.every((preset) => preset.presetId.startsWith('bundled-')));
console.log(`PASS  installs ${installed.length} bundled presets on first run`);
