// StateMotion Preset Panel — bootstrap and tab routing.

import './ui/styles.css';
import { el, clear } from './ui/components.ts';
import { PresetRepository } from './domain/presetStorage.ts';
import { UxpFs } from './host/uxpFs.ts';
import { UxpHostBridge } from './host/uxpHost.ts';
import { PremiereAdapter } from './host/premiereAdapter.ts';
import { LibraryView } from './ui/library.ts';
import { InspectorView } from './ui/inspector.ts';
import { ManageView } from './ui/manage.ts';
import { DiagnosticsView } from './ui/diagnosticsView.ts';
import { EXPECTED_MATCH_NAME, type DiagnosticInput } from './domain/diagnostics.ts';
import { BUNDLED_PRESETS } from './starter/bundledPresets.ts';
import { toggleFavorite } from './domain/favorites.ts';
import type { LibraryModel } from './domain/presetStorage.ts';
import type { StateMotionPreset } from './domain/presetSchema.ts';

async function main(): Promise<void> {
  const app = document.getElementById('app')!;
  clear(app);
  app.append(el('div', { class: 'sm-tabs', role: 'tablist' }, []));
  const views = el('div', { class: 'sm-view' });
  app.append(views);

  const repo = new PresetRepository(new UxpFs(), 'statemotion-panel-data');
  let library: LibraryModel = { favoritePresetIds: [], collectionIds: [], collections: {}, recentlyUsed: [] };

  // Seed bundled presets on first run.
  await repo.init();
  for (const p of BUNDLED_PRESETS) {
    try { await repo.create(p); } catch { /* already present */ }
  }

  const adapter = new PremiereAdapter(new UxpHostBridge());
  const getLibrary = () => library;
  const setLibrary = (lib: LibraryModel) => { library = lib; };

  const libraryView = new LibraryView(repo, getLibrary, {
    onApply: async (p: StateMotionPreset) => {
      inspector.setLastPreset(p);
      const report = await adapter.applyPresetToSelection(p, (await adapter.detectSelection()).supported.map((c) => c.clipId));
      void report;
      // Record recently used (cap to last 12).
      const updated = { ...library, recentlyUsed: [p.presetId, ...library.recentlyUsed.filter((x) => x !== p.presetId)].slice(0, 12) };
      setLibrary(updated);
      await repo.saveLibrary(updated);
    },
    onToggleFavorite: async (id: string) => {
      const updated = toggleFavorite(library, id);
      setLibrary(updated);
      await repo.saveLibrary(updated);
    },
    getSelectionCount: () => selectionCount,
  });
  libraryView.setContainer(views);

  const inspector = new InspectorView(adapter);
  const manage = new ManageView(repo, getLibrary, setLibrary);
  manage.setContainer(views);

  // Diagnostics: live snapshot. Host-dependent fields stay UNKNOWN / not-yet
  // verified until an operator confirms them on real Premiere.
  const diagnostics = new DiagnosticsView((): DiagnosticInput => ({
    effectMatchName: EXPECTED_MATCH_NAME,
    contractStatus: 'unknown',
    selectionCount,
    selectionStatus: selectionCount > 0 ? `${selectionCount} clip(s)` : 'none',
    lastOperation: 'none',
  }));
  diagnostics.setContainer(views);

  let selectionCount = 0;
  async function refreshSelection() {
    selectionCount = (await adapter.detectSelection()).supported.length;
  }

  const tabs = [
    { id: 'library', label: 'Library', render: () => libraryView.render(views) },
    { id: 'inspector', label: 'Inspector', render: () => inspector.render(views) },
    { id: 'manage', label: 'Manage', render: () => manage.render(views) },
    { id: 'diagnostics', label: 'About', render: () => diagnostics.render(views) },
  ];
  const tabBar = app.querySelector('.sm-tabs') as HTMLElement;
  let active = 'library';
  function selectTab(id: string) {
    active = id;
    [...tabBar.children].forEach((c) => c.setAttribute('aria-selected', String((c as HTMLElement).dataset.id === id)));
    refreshSelection().then(() => tabs.find((t) => t.id === id)?.render());
  }
  for (const t of tabs) {
    const b = el('button', { class: 'sm-tab', role: 'tab', 'aria-selected': String(t.id === active), 'data-id': t.id, text: t.label });
    b.addEventListener('click', () => selectTab(t.id));
    tabBar.append(b);
  }

  // Re-render on project/selection changes if Premiere emits them.
  const pApp = (globalThis as any).app;
  if (pApp && pApp.addEventListener) {
    pApp.addEventListener('selectionChanged', () => { refreshSelection(); if (active === 'inspector' || active === 'library') tabs.find((t) => t.id === active)?.render(); });
  }

  await refreshSelection();
  await libraryView.render(views);
}

function toggleFav(lib: LibraryModel, id: string): LibraryModel {
  const has = lib.favoritePresetIds.includes(id);
  return {
    ...lib,
    favoritePresetIds: has ? lib.favoritePresetIds.filter((x) => x !== id) : [...lib.favoritePresetIds, id],
  };
}

main().catch(() => {
  const app = document.getElementById('app');
  if (app) app.textContent = 'StateMotion failed to load. Open the panel again or check the developer console.';
});
