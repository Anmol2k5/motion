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

    // Live easing control for the first supported clip.
    await this.renderEasingControl(container, supported[0].clipId);

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

  private async renderEasingControl(container: HTMLElement, clipId: string): Promise<void> {
    const EASING_LABELS = ['Linear', 'EaseIn', 'EaseOut', 'EaseInOut', 'Custom'];
    const CURVE_IDS = ['transition.curveX1', 'transition.curveY1', 'transition.curveX2', 'transition.curveY2'] as const;

    let easing = 3;
    let curve = [0.42, 0.0, 0.58, 1.0];
    try {
      const cfg = await this.adapter.readState({ clipId });
      if (typeof cfg.parameters['transition.easing'] === 'number') easing = cfg.parameters['transition.easing'] as number;
      CURVE_IDS.forEach((id, i) => {
        const v = cfg.parameters[id];
        if (typeof v === 'number') curve[i] = v;
      });
    } catch {
      // Read-only / unsupported clip: show controls disabled but no live write.
    }

    const section = el('div', { class: 'sm-section' });
    section.append(el('div', { class: 'sm-section-title', text: 'Easing' }));

    const select = el('select', { class: 'sm-select' }) as HTMLSelectElement;
    EASING_LABELS.forEach((label, i) => {
      const opt = el('option', { value: String(i), text: label }) as HTMLOptionElement;
      if (i === easing) opt.selected = true;
      select.append(opt);
    });
    section.append(el('div', { class: 'sm-row' }, [el('span', { class: 'label', text: 'Curve' }), select]));

    const curveRow = el('div', { class: 'sm-row sm-curve' }, []);
    const inputs: HTMLInputElement[] = [];
    CURVE_IDS.forEach((id, i) => {
      const input = el('input', { type: 'number', min: '0', max: '1', step: '0.01', value: String(curve[i]) }) as HTMLInputElement;
      input.classList.add('sm-curve-input');
      inputs.push(input);
      curveRow.append(el('span', { class: 'label', text: id.replace('transition.curve', '') }), input);
    });
    section.append(curveRow);
    const applyCurve = () => {
      CURVE_IDS.forEach((id, i) => {
        const v = parseFloat(inputs[i].value);
        if (Number.isFinite(v)) this.writeEasing(clipId, id, Math.min(1, Math.max(0, v)));
      });
    };
    const syncCurveVisibility = () => {
      const custom = select.value === '4';
      curveRow.style.display = custom ? '' : 'none';
      if (custom) applyCurve();
    };
    select.addEventListener('change', () => {
      this.writeEasing(clipId, 'transition.easing', parseInt(select.value, 10));
      syncCurveVisibility();
    });
    inputs.forEach((inp) => inp.addEventListener('change', applyCurve));
    syncCurveVisibility();

    container.append(section);
  }

  private writeEasing(clipId: string, logicalId: string, value: number): void {
    this.adapter.writeLogical({ clipId }, logicalId, value).catch(() => {});
  }
}
