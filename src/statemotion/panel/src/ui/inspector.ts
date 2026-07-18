// StateMotion Preset Panel — Inspector view (current selection status + apply).

import { el, clear, showState } from './components.ts';
import type { PremiereAdapter } from '../host/premiereAdapter.ts';
import type { PresetRepository } from '../domain/presetStorage.ts';
import { buildUserPresetFromConfig, type StateMotionPreset } from '../domain/presetSchema.ts';

export class InspectorView {
  constructor(private adapter: PremiereAdapter) {}

  async render(container: HTMLElement): Promise<void> {
    clear(container);
    const detection = await this.adapter.detectSelection();
    const supported = detection.supported;
    const unsupported = detection.unsupported;

    if (supported.length === 0 && unsupported.length === 0) {
      showState(container, '🎞️', 'No clip selected', 'Select a clip in the timeline to inspect its StateMotion state.');
      return;
    }
    if (supported.length === 0) {
      showState(container, '⚠️', 'No StateMotion effect', `${unsupported.length} selected clip(s) lack a StateMotion effect. Apply a preset to add one.`, );
      container.lastElementChild?.classList.add('sm-warn');
      return;
    }

    container.append(el('div', { class: 'sm-section-title', text: `Selection (${supported.length} StateMotion clip${supported.length > 1 ? 's' : ''})` }));
    const summary = el('div', {});
    for (const clip of supported) {
      const row = el('div', { class: 'sm-row' }, [
        el('span', { class: 'label', text: clip.clipId }),
        el('span', { text: 'StateMotion ✓' }),
      ]);
      summary.append(row);
    }
    container.append(summary);

    // Applied preset (best-effort detection by matching params is future work;
    // we show a manual Apply control here).
    const applyBtn = el('button', { class: 'sm-btn', text: 'Apply last selected preset' }) as HTMLButtonElement;
    applyBtn.disabled = !this.lastPreset;
    applyBtn.addEventListener('click', () => { if (this.lastPreset) this.adapter.applyPresetToSelection(this.lastPreset, supported.map((c) => c.clipId)); });
    container.append(el('div', { class: 'sm-actionbar' }, [applyBtn]));

    if (this.repository) {
      const createBtn = el('button', { class: 'sm-btn', text: 'Create preset from selection' }) as HTMLButtonElement;
      createBtn.addEventListener('click', async () => {
        try {
          const clip = supported[0];
          const cfg = await this.adapter.readState(clip);
          const contract = await this.adapter.getContract(clip);
          const preset = buildUserPresetFromConfig(cfg, contract);
          await this.repository!.create(preset);
          showState(container, '✅', 'Preset created', `Saved "${preset.name}" from ${clip.clipId}.`);
        } catch (e) {
          showState(container, '⚠️', 'Create failed', String((e as Error).message));
        }
      });
      container.append(el('div', { class: 'sm-actionbar' }, [createBtn]));
    }

    if (unsupported.length > 0) {
      const warn = el('p', { class: 'sm-warn', text: `${unsupported.length} clip(s) skipped: no StateMotion effect.` });
      container.append(warn);
    }
  }

  setLastPreset(p: StateMotionPreset | null) { this.lastPreset = p; }
  setRepository(repo: PresetRepository) { this.repository = repo; }
  private lastPreset: StateMotionPreset | null = null;
  private repository: PresetRepository | null = null;
}
