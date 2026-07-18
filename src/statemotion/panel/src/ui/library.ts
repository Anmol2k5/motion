// StateMotion Preset Panel — Library view (browse / search / favorite / apply).

import { el, clear, showState, svgFromString } from './components.ts';
import { BUNDLED_PRESETS, CATEGORIES } from '../starter/bundledPresets.ts';
import {
  buildLibraryViewModel, type LibraryViewState,
} from '../domain/libraryModel.ts';
import { FilterKind, SortKind } from '../domain/search.ts';
import { toggleFavorite } from '../domain/favorites.ts';
import { renderPreviewSvg } from '../preview/previewCard.ts';
import type { PresetRepository, LibraryModel } from '../domain/presetStorage.ts';
import type { StateMotionPreset } from '../domain/presetSchema.ts';

export interface LibraryCallbacks {
  onApply: (preset: StateMotionPreset) => void;
  onToggleFavorite: (presetId: string) => void;
  getSelectionCount: () => number;
}

export class LibraryView {
  private view: LibraryViewState = { query: '', filter: FilterKind.All, sort: SortKind.AZ };
  private listMode = false;

  constructor(
    private repo: PresetRepository,
    private getLibrary: () => LibraryModel,
    private cb: LibraryCallbacks,
  ) {}

  async render(container: HTMLElement): Promise<void> {
    clear(container);
    const all = await this.repo.list();
    const library = this.getLibrary();
    const vm = buildLibraryViewModel(all, library, this.view, CATEGORIES);

    // Toolbar: search + sort + view toggle
    const search = el('input', { class: 'sm-search', type: 'search', placeholder: 'Search presets', 'aria-label': 'Search presets' }) as HTMLInputElement;
    search.value = this.view.query;
    search.addEventListener('input', () => { this.view.query = search.value; this.render(container); });

    const sort = el('select', { class: 'sm-chip', 'aria-label': 'Sort presets' }) as HTMLSelectElement;
    for (const [label, val] of [['A–Z', SortKind.AZ], ['Newest', SortKind.Newest], ['Recently used', SortKind.RecentlyUsed]] as [string, SortKind][]) {
      const o = el('option', { value: val, text: label }) as HTMLOptionElement;
      if (val === this.view.sort) o.selected = true;
      sort.append(o);
    }
    sort.addEventListener('change', () => { this.view.sort = sort.value as SortKind; this.render(container); });

    const toggle = el('button', { class: 'sm-chip', 'aria-pressed': String(this.listMode), text: this.listMode ? 'List' : 'Grid' }) as HTMLButtonElement;
    toggle.addEventListener('click', () => { this.listMode = !this.listMode; this.render(container); });

    container.append(el('div', { class: 'sm-toolbar' }, [search, sort, toggle]));

    // Chips: filters + categories
    const chipRow = el('div', { class: 'sm-chips' });
    const filters: [string, FilterKind][] = [
      ['All', FilterKind.All], ['Favorites', FilterKind.Favorites], ['User', FilterKind.User],
    ];
    for (const [label, f] of filters) {
      const chip = el('button', { class: 'sm-chip', 'aria-pressed': String(this.view.filter === f), text: label });
      chip.addEventListener('click', () => { this.view.filter = f; this.render(container); });
      chipRow.append(chip);
    }
    for (const cat of CATEGORIES) {
      const active = this.view.filter === FilterKind.Category && this.view.category === cat;
      const chip = el('button', { class: 'sm-chip', 'aria-pressed': String(active), text: cat });
      chip.addEventListener('click', () => {
        if (active) { this.view.filter = FilterKind.All; this.view.category = undefined; }
        else { this.view.filter = FilterKind.Category; this.view.category = cat; }
        this.render(container);
      });
      chipRow.append(chip);
    }
    container.append(chipRow);

    // Grid / List
    const grid = el('div', { class: this.listMode ? 'sm-list' : 'sm-grid' });
    if (vm.presets.length === 0) {
      showState(grid, '🔍', 'No presets found', 'Try a different search or filter.');
    }
    for (const p of vm.presets) {
      grid.append(this.renderCard(p, vm.favoriteIds.has(p.presetId)));
    }
    container.append(grid);

    // Action bar
    const count = this.cb.getSelectionCount();
    const applyBtn = el('button', { class: 'sm-btn', text: count > 0 ? `Apply to ${count} clip${count > 1 ? 's' : ''}` : 'Apply (select a clip)' }) as HTMLButtonElement;
    applyBtn.disabled = count === 0;
    applyBtn.addEventListener('click', () => {
      const sel = vm.presets.find((p) => p.presetId === this.selectedId);
      if (sel) this.cb.onApply(sel);
    });
    container.append(el('div', { class: 'sm-actionbar' }, [applyBtn]));
  }

  private selectedId: string | null = null;

  private renderCard(p: StateMotionPreset, favorite: boolean): HTMLElement {
    const fav = el('button', { class: 'sm-fav', 'aria-pressed': String(favorite), 'aria-label': favorite ? `Unfavorite ${p.name}` : `Favorite ${p.name}`, title: 'Favorite', text: favorite ? '★' : '☆' });
    fav.addEventListener('click', (e) => { e.stopPropagation(); this.cb.onToggleFavorite(p.presetId); this.render(this.lastContainer!); });
    const card = el('div', { class: 'sm-card', tabindex: '0', role: 'button', 'aria-label': `${p.name}, ${p.category}` }, [
      svgFromString(renderPreviewSvg(p)),
      el('div', { class: 'sm-card-name', text: p.name }),
      el('div', { class: 'sm-card-cat', text: p.category }),
      fav,
    ]);
    card.addEventListener('click', () => { this.selectedId = p.presetId; this.cb.onApply(p); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectedId = p.presetId; this.cb.onApply(p); } });
    return card;
  }

  private lastContainer: HTMLElement | null = null;
  setContainer(c: HTMLElement) { this.lastContainer = c; }
}
