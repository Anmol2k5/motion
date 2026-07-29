// StateMotion Preset Panel — Inspector view (current selection status + apply).

import { el, clear, showState, accordion } from './components.ts';
import { CurveEditor } from './curveEditor.ts';
import {
  renderNumberRow,
  renderAbNumberRow,
  renderSelectRow,
  renderCheckboxRow,
  renderAbCheckboxRow,
} from './parameterControls.ts';
import { TypedStateConfig } from '../domain/typedConfig.ts';
import type { PremiereAdapter } from '../host/premiereAdapter.ts';
import type { PresetRepository } from '../domain/presetStorage.ts';
import type { StateMotionPreset, ParameterValue } from '../domain/presetSchema.ts';

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
      showState(container, '⚠️', 'No StateMotion effect', `${unsupported.length} selected clip(s) lack a StateMotion effect. Apply a preset to add one.`);
      container.lastElementChild?.classList.add('sm-warn');
      return;
    }

    // Clip Actions section
    container.append(el('div', { class: 'sm-header', text: 'CLIP ACTIONS' }));

    const applyBtn = el('button', { class: 'sm-action-btn', title: 'Apply last preset' }, [
      el('span', { text: '+ Apply' }),
    ]) as HTMLButtonElement;
    applyBtn.disabled = !this.lastPreset;
    applyBtn.addEventListener('click', () => {
      if (this.lastPreset) this.adapter.applyPresetToSelection(this.lastPreset, supported.map((c) => c.clipId));
    });

    const swapBtn = el('button', { class: 'sm-action-btn', title: 'Swap A ↔ B' }, [
      el('span', { text: '⇄ Swap A/B' }),
    ]) as HTMLButtonElement;
    swapBtn.addEventListener('click', async () => {
      for (const clip of supported) await this.adapter.swapStates(clip);
      this.render(container);
    });

    const removeBtn = el('button', { class: 'sm-action-btn', title: 'Remove Effect' }, [
      el('span', { text: '✕ Remove' }),
    ]);
    removeBtn.addEventListener('click', async () => {
      if (window.confirm('Remove StateMotion from selected clips?')) {
        for (const clip of supported) await this.adapter.removeEffect(clip);
        this.render(container);
      }
    });

    const actionGrid = el('div', { class: 'sm-actions-grid' }, [applyBtn, swapBtn, removeBtn]);
    container.append(actionGrid);

    // Accordions wrapper
    container.append(el('div', { class: 'sm-header', text: 'PARAMETERS' }));

    const clipId = supported[0].clipId;

    await this.renderTransitionControl(container, clipId);
    await this.renderCropControl(container, clipId);
    await this.renderShadowControl(container, clipId);
    await this.renderStrokeControl(container, clipId);
    await this.renderGlowControl(container, clipId);
    await this.renderMotionBlurControl(container, clipId);

    if (unsupported.length > 0) {
      const warn = el('p', {
        class: 'sm-warn',
        style: 'padding: 12px',
        text: `${unsupported.length} clip(s) skipped: no StateMotion effect.`,
      });
      container.append(warn);
    }
  }

  setLastPreset(p: StateMotionPreset | null) { this.lastPreset = p; }
  setRepository(repo: PresetRepository) { this.repository = repo; }
  private lastPreset: StateMotionPreset | null = null;
  private repository: PresetRepository | null = null;

  private async readConfig(clipId: string): Promise<TypedStateConfig> {
    try {
      const cfg = await this.adapter.readState({ clipId });
      return new TypedStateConfig(cfg);
    } catch {
      return new TypedStateConfig(null);
    }
  }

  private async renderTransitionControl(container: HTMLElement, clipId: string): Promise<void> {
    const MODES = ['A to B', 'B to A', 'A to B to A', 'B to A to B', 'Hold A', 'Hold B', 'Manual'];
    const ALIGNMENTS = ['Clip Start', 'Clip End', 'Entire Clip'];
    const EASING_LABELS = ['Linear', 'Ease In', 'Ease Out', 'Ease In/Out', 'Custom Bezier', 'Spring', 'Bounce'];

    const typed = await this.readConfig(clipId);
    const mode = typed.getNumber('transition.mode', 0);
    const alignment = typed.getNumber('transition.alignment', 0);
    const duration = typed.getNumber('transition.durationSeconds', 1.0);
    const delay = typed.getNumber('transition.delaySeconds', 0.0);
    const easing = typed.getNumber('transition.easing', 3);
    const curve = typed.getCurve();

    const content: HTMLElement[] = [];

    // Duration & Delay
    content.push(
      renderNumberRow({
        label: 'Duration',
        value: duration,
        unit: 's',
        min: 0,
        step: 0.1,
        onChange: (v) => this.writeLogical(clipId, 'transition.durationSeconds', v),
      }),
    );

    content.push(
      renderNumberRow({
        label: 'Delay',
        value: delay,
        unit: 's',
        min: 0,
        step: 0.1,
        onChange: (v) => this.writeLogical(clipId, 'transition.delaySeconds', v),
      }),
    );

    // Alignment & Mode
    content.push(
      renderSelectRow({
        label: 'Alignment',
        options: ALIGNMENTS,
        selectedIndex: alignment,
        onChange: (idx) => this.writeLogical(clipId, 'transition.alignment', idx),
      }),
    );

    content.push(
      renderSelectRow({
        label: 'Mode',
        options: MODES,
        selectedIndex: mode,
        onChange: (idx) => this.writeLogical(clipId, 'transition.mode', idx),
      }),
    );

    // Easing Dropdown & Specifics
    const easeRow = renderSelectRow({
      label: 'Easing Type',
      options: EASING_LABELS,
      selectedIndex: easing,
      onChange: (idx) => {
        this.writeLogical(clipId, 'transition.easing', idx);
        syncVisibility(idx);
      },
    });
    content.push(easeRow);

    const curveRow = el('div', { class: 'sm-control-row', style: 'justify-content: center;' }, []);
    const editor = new CurveEditor((newCurve) => {
      this.writeLogical(clipId, 'transition.curveX1', newCurve[0]);
      this.writeLogical(clipId, 'transition.curveY1', newCurve[1]);
      this.writeLogical(clipId, 'transition.curveX2', newCurve[2]);
      this.writeLogical(clipId, 'transition.curveY2', newCurve[3]);
    });
    editor.setCurve(curve);
    curveRow.append(editor.getElement());
    content.push(curveRow);

    const springRow = el('div', { class: 'sm-control-row' }, [
      el('span', { class: 'sm-control-label', text: 'Spring Settings...' }),
    ]);
    content.push(springRow);

    const bounceRow = el('div', { class: 'sm-control-row' }, [
      el('span', { class: 'sm-control-label', text: 'Bounce Settings...' }),
    ]);
    content.push(bounceRow);

    const syncVisibility = (valIdx: number) => {
      curveRow.style.display = valIdx === 4 ? 'flex' : 'none';
      springRow.style.display = valIdx === 5 ? 'flex' : 'none';
      bounceRow.style.display = valIdx === 6 ? 'flex' : 'none';
    };
    syncVisibility(easing);

    container.append(accordion('Transition', content, true));
  }

  private writeLogical(clipId: string, logicalId: string, value: ParameterValue): void {
    this.adapter.writeLogical({ clipId }, logicalId, value).catch(() => {});
  }

  private async renderCropControl(container: HTMLElement, clipId: string): Promise<void> {
    const CROP_FIELDS = [
      { idA: 'crop.left.a', idB: 'crop.left.b', label: 'Left' },
      { idA: 'crop.right.a', idB: 'crop.right.b', label: 'Right' },
      { idA: 'crop.top.a', idB: 'crop.top.b', label: 'Top' },
      { idA: 'crop.bottom.a', idB: 'crop.bottom.b', label: 'Bottom' },
      { idA: 'crop.cornerRadius.a', idB: 'crop.cornerRadius.b', label: 'Radius' },
    ] as const;

    const typed = await this.readConfig(clipId);
    const content: HTMLElement[] = CROP_FIELDS.map((item) =>
      renderAbNumberRow({
        label: item.label,
        valA: typed.getNumber(item.idA, 0),
        valB: typed.getNumber(item.idB, 0),
        scale: 100,
        min: 0,
        max: 100,
        onChangeA: (v) => this.writeLogical(clipId, item.idA, Math.min(1, Math.max(0, v))),
        onChangeB: (v) => this.writeLogical(clipId, item.idB, Math.min(1, Math.max(0, v))),
      }),
    );

    container.append(accordion('Crop & Mask', content, false));
  }

  private async renderShadowControl(container: HTMLElement, clipId: string): Promise<void> {
    const SHADOW_FIELDS = [
      { idA: 'shadow.opacity.a', idB: 'shadow.opacity.b', label: 'Opacity', scale: 100, max: 100, unit: '%' },
      { idA: 'shadow.angle.a', idB: 'shadow.angle.b', label: 'Angle', scale: 180 / Math.PI, max: 360, unit: '°' },
      { idA: 'shadow.distance.a', idB: 'shadow.distance.b', label: 'Distance', scale: 1, max: 1000, unit: 'px' },
      { idA: 'shadow.softness.a', idB: 'shadow.softness.b', label: 'Softness', scale: 1, max: 500, unit: 'px' },
    ] as const;

    const typed = await this.readConfig(clipId);
    const content: HTMLElement[] = SHADOW_FIELDS.map((item) =>
      renderAbNumberRow({
        label: item.label,
        valA: typed.getNumber(item.idA, 0),
        valB: typed.getNumber(item.idB, 0),
        scale: item.scale,
        max: item.max,
        unit: item.unit,
        onChangeA: (v) => this.writeLogical(clipId, item.idA, v),
        onChangeB: (v) => this.writeLogical(clipId, item.idB, v),
      }),
    );

    container.append(accordion('Drop Shadow', content, false));
  }

  private async renderStrokeControl(container: HTMLElement, clipId: string): Promise<void> {
    const typed = await this.readConfig(clipId);
    const content: HTMLElement[] = [];

    content.push(
      renderAbCheckboxRow({
        label: 'Enabled',
        checkedA: typed.getBoolean('stroke.enabled.a', false),
        checkedB: typed.getBoolean('stroke.enabled.b', false),
        onChangeA: (v) => this.writeLogical(clipId, 'stroke.enabled.a', v),
        onChangeB: (v) => this.writeLogical(clipId, 'stroke.enabled.b', v),
      }),
    );

    content.push(
      renderAbNumberRow({
        label: 'Width',
        valA: typed.getNumber('stroke.width.a', 10),
        valB: typed.getNumber('stroke.width.b', 10),
        scale: 1,
        max: 1000,
        unit: 'px',
        onChangeA: (v) => this.writeLogical(clipId, 'stroke.width.a', v),
        onChangeB: (v) => this.writeLogical(clipId, 'stroke.width.b', v),
      }),
    );

    content.push(
      renderAbNumberRow({
        label: 'Angle',
        valA: typed.getNumber('stroke.gradientAngle.a', 0),
        valB: typed.getNumber('stroke.gradientAngle.b', 0),
        scale: 180 / Math.PI,
        max: 360,
        unit: '°',
        onChangeA: (v) => this.writeLogical(clipId, 'stroke.gradientAngle.a', v),
        onChangeB: (v) => this.writeLogical(clipId, 'stroke.gradientAngle.b', v),
      }),
    );

    content.push(
      renderNumberRow({
        label: 'Cycle Speed',
        value: typed.getNumber('stroke.gradientCycleSpeed', 0),
        unit: 'Hz',
        min: -10,
        max: 10,
        step: 0.1,
        onChange: (v) => this.writeLogical(clipId, 'stroke.gradientCycleSpeed', v),
      }),
    );

    container.append(accordion('Stroke', content, false));
  }

  private async renderGlowControl(container: HTMLElement, clipId: string): Promise<void> {
    const typed = await this.readConfig(clipId);
    const content: HTMLElement[] = [];

    content.push(
      renderAbCheckboxRow({
        label: 'Enabled',
        checkedA: typed.getBoolean('glow.enabled.a', false),
        checkedB: typed.getBoolean('glow.enabled.b', false),
        onChangeA: (v) => this.writeLogical(clipId, 'glow.enabled.a', v),
        onChangeB: (v) => this.writeLogical(clipId, 'glow.enabled.b', v),
      }),
    );

    content.push(
      renderAbNumberRow({
        label: 'Amount',
        valA: typed.getNumber('glow.amount.a', 0),
        valB: typed.getNumber('glow.amount.b', 0),
        scale: 100,
        max: 100,
        unit: '%',
        onChangeA: (v) => this.writeLogical(clipId, 'glow.amount.a', v),
        onChangeB: (v) => this.writeLogical(clipId, 'glow.amount.b', v),
      }),
    );

    content.push(
      renderAbNumberRow({
        label: 'Radius',
        valA: typed.getNumber('glow.radius.a', 50),
        valB: typed.getNumber('glow.radius.b', 50),
        scale: 1,
        max: 1000,
        unit: 'px',
        onChangeA: (v) => this.writeLogical(clipId, 'glow.radius.a', v),
        onChangeB: (v) => this.writeLogical(clipId, 'glow.radius.b', v),
      }),
    );

    container.append(accordion('Glow', content, false));
  }

  private async renderMotionBlurControl(container: HTMLElement, clipId: string): Promise<void> {
    const typed = await this.readConfig(clipId);
    const content: HTMLElement[] = [];

    content.push(
      renderCheckboxRow({
        label: 'Enabled',
        checked: typed.getBoolean('motionBlur.enabled', false),
        onChange: (v) => this.writeLogical(clipId, 'motionBlur.enabled', v),
      }),
    );

    content.push(
      renderNumberRow({
        label: 'Angle',
        value: typed.getNumber('motionBlur.shutterAngle', 180),
        unit: '°',
        min: 0,
        max: 720,
        step: 1,
        onChange: (v) => this.writeLogical(clipId, 'motionBlur.shutterAngle', v),
      }),
    );

    content.push(
      renderNumberRow({
        label: 'Samples',
        value: typed.getNumber('motionBlur.samples', 8),
        unit: '',
        min: 2,
        max: 64,
        step: 1,
        onChange: (v) => this.writeLogical(clipId, 'motionBlur.samples', v),
      }),
    );

    container.append(accordion('Motion Blur', content, false));
  }
}
