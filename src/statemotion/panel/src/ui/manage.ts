// StateMotion Preset Panel — Manage view (user presets, collections, import/export).

import { el, clear, showState } from './components.ts';
import type { PresetRepository, LibraryModel } from '../domain/presetStorage.ts';
import { createCollection, renameCollection, deleteCollection, addToCollection, removeFromCollection } from '../domain/collections.ts';
import { toggleFavorite } from '../domain/favorites.ts';
import type { StateMotionPreset } from '../domain/presetSchema.ts';

export class ManageView {
  constructor(
    private repo: PresetRepository,
    private getLibrary: () => LibraryModel,
    private setLibrary: (lib: LibraryModel) => void,
  ) {}

  async render(container: HTMLElement): Promise<void> {
    clear(container);
    const all = await this.repo.list();
    const library = this.getLibrary();
    const userPresets = all.filter((p) => p.presetId.startsWith('user-'));

    container.append(el('div', { class: 'sm-section-title', text: `User presets (${userPresets.length})` }));
    if (userPresets.length === 0) {
      showState(container, '📁', 'No user presets yet', 'Create one from the Inspector or duplicate a bundled preset.');
      return;
    }
    const list = el('div', { class: 'sm-list' });
    for (const p of userPresets) {
      list.append(this.renderUserRow(p));
    }
    container.append(list);

    container.append(el('div', { class: 'sm-section-title', text: `Collections (${library.collectionIds.length})` }));
    const colList = el('div', { class: 'sm-list' });
    for (const id of library.collectionIds) {
      const c = library.collections[id];
      colList.append(el('div', { class: 'sm-row' }, [
        el('span', { class: 'label', text: c.name }),
        el('span', { text: `${c.presetIds.length} presets` }),
      ]));
    }
    if (library.collectionIds.length === 0) {
      colList.append(el('p', { class: 'muted', text: 'No collections. Create one to group presets.' }));
    }
    container.append(colList);

    const newColBtn = el('button', { class: 'sm-btn secondary', text: '+ New collection' }) as HTMLButtonElement;
    newColBtn.addEventListener('click', () => {
      const name = window.prompt('Collection name?', 'My Collection');
      if (!name) return;
      const id = 'col-' + Date.now().toString(36);
      this.setLibrary(createCollection(library, id, name));
      this.render(container);
    });
    container.append(el('div', { class: 'sm-actionbar' }, [newColBtn]));
  }

  private renderUserRow(p: StateMotionPreset): HTMLElement {
    const rename = el('button', { class: 'sm-btn secondary', text: 'Rename' });
    rename.addEventListener('click', async () => {
      const name = window.prompt('Rename preset', p.name);
      if (!name) return;
      await this.repo.update({ ...p, name, modifiedAt: new Date().toISOString() });
      this.render(this.lastContainer!);
    });
    const dup = el('button', { class: 'sm-btn secondary', text: 'Duplicate' });
    dup.addEventListener('click', async () => { await this.repo.duplicate(p.presetId); this.render(this.lastContainer!); });
    const exp = el('button', { class: 'sm-btn secondary', text: 'Export' });
    exp.addEventListener('click', async () => {
      const text = await this.repo.export(p.presetId);
      this.download(p.name + '.stmpreset', text);
    });
    const del = el('button', { class: 'sm-btn secondary', text: 'Delete' });
    del.addEventListener('click', async () => {
      if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
      await this.repo.delete(p.presetId);
      this.render(this.lastContainer!);
    });
    return el('div', { class: 'sm-row' }, [
      el('span', { text: p.name }),
      el('div', { style: 'display:flex; gap:4px' }, [rename, dup, exp, del]),
    ]);
  }

  private download(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private lastContainer: HTMLElement | null = null;
  setContainer(c: HTMLElement) { this.lastContainer = c; }
}
