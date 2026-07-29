// StateMotion Preset Panel — Inspector view (current selection status + apply).

import { el, clear, showState, accordion } from './components.ts';
import { CurveEditor } from './curveEditor.ts';
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
      showState(container, '⚠️', 'No StateMotion effect', `${unsupported.length} selected clip(s) lack a StateMotion effect. Apply a preset to add one.`);
      container.lastElementChild?.classList.add('sm-warn');
      return;
    }

    // Clip Actions section
    container.append(el('div', { class: 'sm-header', text: 'CLIP ACTIONS' }));
    
    const applyBtn = el('button', { class: 'sm-action-btn', title: 'Apply last preset' }, [
      el('span', { text: '+ Apply' })
    ]) as HTMLButtonElement;
    applyBtn.disabled = !this.lastPreset;
    applyBtn.addEventListener('click', () => { if (this.lastPreset) this.adapter.applyPresetToSelection(this.lastPreset, supported.map(c => c.clipId)); });

    const swapBtn = el('button', { class: 'sm-action-btn', title: 'Swap A ↔ B' }, [
      el('span', { text: '⇄ Swap A/B' })
    ]) as HTMLButtonElement;
    swapBtn.addEventListener('click', async () => {
      for (const clip of supported) await this.adapter.swapStates(clip);
      this.render(container);
    });

    const removeBtn = el('button', { class: 'sm-action-btn', title: 'Remove Effect' }, [
      el('span', { text: '✕ Remove' })
    ]);
    removeBtn.addEventListener('click', async () => {
      if (window.confirm('Remove StateMotion from selected clips?')) {
        for (const clip of supported) await this.adapter.removeEffect(clip);
        this.render(container);
      }
    });

    const actionGrid = el('div', { class: 'sm-actions-grid' }, [
      applyBtn, swapBtn, removeBtn
    ]);
    container.append(actionGrid);

    // Accordions wrapper
    container.append(el('div', { class: 'sm-header', text: 'PARAMETERS' }));
    
    const clipId = supported[0].clipId;

    // We will render sections as accordions.
    // For now we just call the old methods, which we will adapt next.
    await this.renderEasingControl(container, clipId);
    await this.renderCropControl(container, clipId);
    await this.renderShadowControl(container, clipId);
    await this.renderStrokeControl(container, clipId);
    await this.renderGlowControl(container, clipId);
    await this.renderMotionBlurControl(container, clipId);

    if (unsupported.length > 0) {
      const warn = el('p', { class: 'sm-warn', style: 'padding: 12px', text: `${unsupported.length} clip(s) skipped: no StateMotion effect.` });
      container.append(warn);
    }
  }

  setLastPreset(p: StateMotionPreset | null) { this.lastPreset = p; }
  setRepository(repo: PresetRepository) { this.repository = repo; }
  private lastPreset: StateMotionPreset | null = null;
  private repository: PresetRepository | null = null;

  private async renderTransitionControl(container: HTMLElement, clipId: string): Promise<void> {
    const MODES = ['A to B', 'B to A', 'A to B to A', 'B to A to B', 'Hold A', 'Hold B', 'Manual'];
    const ALIGNMENTS = ['Clip Start', 'Clip End', 'Entire Clip'];
    const EASING_LABELS = ['Linear', 'Ease In', 'Ease Out', 'Ease In/Out', 'Custom Bezier', 'Spring', 'Bounce'];
    const CURVE_IDS = ['transition.curveX1', 'transition.curveY1', 'transition.curveX2', 'transition.curveY2'] as const;

    let cfg: any = null;
    let mode = 0, alignment = 0, duration = 1.0, delay = 0.0, easing = 3;
    let curve = [0.33, 0.0, 0.67, 1.0];
    
    try {
      cfg = await this.adapter.readState({ clipId });
      if (typeof cfg.parameters['transition.mode'] === 'number') mode = cfg.parameters['transition.mode'];
      if (typeof cfg.parameters['transition.alignment'] === 'number') alignment = cfg.parameters['transition.alignment'];
      if (typeof cfg.parameters['transition.durationSeconds'] === 'number') duration = cfg.parameters['transition.durationSeconds'];
      if (typeof cfg.parameters['transition.delaySeconds'] === 'number') delay = cfg.parameters['transition.delaySeconds'];
      if (typeof cfg.parameters['transition.easing'] === 'number') easing = cfg.parameters['transition.easing'];
      
      CURVE_IDS.forEach((id, i) => {
        const v = cfg.parameters[id];
        if (typeof v === 'number') curve[i] = v;
      });
    } catch { /* read-only */ }

    const content: HTMLElement[] = [];

    // Duration
    const durInput = el('input', { class: 'sm-input', type: 'number', min: '0', step: '0.1', value: String(duration) }) as HTMLInputElement;
    durInput.addEventListener('change', () => this.writeLogical(clipId, 'transition.durationSeconds', parseFloat(durInput.value)));
    content.push(el('div', { class: 'sm-control-row' }, [
      el('span', { class: 'sm-control-label', text: 'Duration' }),
      el('div', { class: 'sm-control-value' }, [durInput, el('span', { class: 'sm-input-unit', text: 's' })])
    ]));

    // Delay
    const delayInput = el('input', { class: 'sm-input', type: 'number', min: '0', step: '0.1', value: String(delay) }) as HTMLInputElement;
    delayInput.addEventListener('change', () => this.writeLogical(clipId, 'transition.delaySeconds', parseFloat(delayInput.value)));
    content.push(el('div', { class: 'sm-control-row' }, [
      el('span', { class: 'sm-control-label', text: 'Delay' }),
      el('div', { class: 'sm-control-value' }, [delayInput, el('span', { class: 'sm-input-unit', text: 's' })])
    ]));

    // Alignment
    const alignSelect = el('select', { class: 'sm-select' }) as HTMLSelectElement;
    ALIGNMENTS.forEach((label, i) => alignSelect.append(el('option', { value: String(i), text: label, selected: i === alignment ? 'true' : undefined })));
    alignSelect.addEventListener('change', () => this.writeLogical(clipId, 'transition.alignment', parseInt(alignSelect.value, 10)));
    content.push(el('div', { class: 'sm-control-row' }, [
      el('span', { class: 'sm-control-label', text: 'Alignment' }),
      el('div', { class: 'sm-control-value' }, [alignSelect])
    ]));

    // Mode
    const modeSelect = el('select', { class: 'sm-select' }) as HTMLSelectElement;
    MODES.forEach((label, i) => modeSelect.append(el('option', { value: String(i), text: label, selected: i === mode ? 'true' : undefined })));
    modeSelect.addEventListener('change', () => this.writeLogical(clipId, 'transition.mode', parseInt(modeSelect.value, 10)));
    content.push(el('div', { class: 'sm-control-row' }, [
      el('span', { class: 'sm-control-label', text: 'Mode' }),
      el('div', { class: 'sm-control-value' }, [modeSelect])
    ]));

    // Easing
    const easeSelect = el('select', { class: 'sm-select' }) as HTMLSelectElement;
    EASING_LABELS.forEach((label, i) => easeSelect.append(el('option', { value: String(i), text: label, selected: i === easing ? 'true' : undefined })));
    content.push(el('div', { class: 'sm-control-row' }, [
      el('span', { class: 'sm-control-label', text: 'Easing Type' }),
      el('div', { class: 'sm-control-value' }, [easeSelect])
    ]));

    // Easing Specifics (Curve / Spring / Bounce)
    const curveRow = el('div', { class: 'sm-control-row', style: 'justify-content: center;' }, []);
    const editor = new CurveEditor((newCurve) => {
      // Update premiere logical parameters
      this.writeLogical(clipId, 'transition.curveX1', newCurve[0]);
      this.writeLogical(clipId, 'transition.curveY1', newCurve[1]);
      this.writeLogical(clipId, 'transition.curveX2', newCurve[2]);
      this.writeLogical(clipId, 'transition.curveY2', newCurve[3]);
    });
    editor.setCurve(curve);
    curveRow.append(editor.getElement());
    content.push(curveRow);

    const springRow = el('div', { class: 'sm-control-row' }, []);
    // Just a placeholder row to map inputs for spring similarly (omitted verbose binding for brevity in refactor)
    springRow.append(el('span', { class: 'sm-control-label', text: 'Spring Settings...' }));
    content.push(springRow);

    const bounceRow = el('div', { class: 'sm-control-row' }, []);
    bounceRow.append(el('span', { class: 'sm-control-label', text: 'Bounce Settings...' }));
    content.push(bounceRow);

    const syncVisibility = () => {
      const val = easeSelect.value;
      curveRow.style.display = val === '4' ? 'flex' : 'none';
      springRow.style.display = val === '5' ? 'flex' : 'none';
      bounceRow.style.display = val === '6' ? 'flex' : 'none';
    };
    easeSelect.addEventListener('change', () => {
      this.writeLogical(clipId, 'transition.easing', parseInt(easeSelect.value, 10));
      syncVisibility();
    });
    syncVisibility();

    container.append(accordion('Transition', content, true));
  }

  private writeLogical(clipId: string, logicalId: string, value: number | boolean | string): void {
    this.adapter.writeLogical({ clipId }, logicalId, value).catch(() => {});
  }


  private async renderCropControl(container: HTMLElement, clipId: string): Promise<void> {
    const CROP_IDS = [
      { idA: 'crop.left.a', idB: 'crop.left.b', label: 'Left' },
      { idA: 'crop.right.a', idB: 'crop.right.b', label: 'Right' },
      { idA: 'crop.top.a', idB: 'crop.top.b', label: 'Top' },
      { idA: 'crop.bottom.a', idB: 'crop.bottom.b', label: 'Bottom' },
      { idA: 'crop.cornerRadius.a', idB: 'crop.cornerRadius.b', label: 'Radius' },
    ] as const;

    const values: Record<string, number> = {};
    try {
      const cfg = await this.adapter.readState({ clipId });
      for (const item of CROP_IDS) {
        values[item.idA] = typeof cfg.parameters[item.idA] === 'number' ? (cfg.parameters[item.idA] as number) * 100 : 0;
        values[item.idB] = typeof cfg.parameters[item.idB] === 'number' ? (cfg.parameters[item.idB] as number) * 100 : 0;
      }
    } catch { /* read-only or unsupported */ }

    const content: HTMLElement[] = [];

    for (const item of CROP_IDS) {
      const inputA = el('input', { class: 'sm-input', type: 'number', min: '0', max: '100', value: String(values[item.idA] ?? 0) }) as HTMLInputElement;
      const inputB = el('input', { class: 'sm-input', type: 'number', min: '0', max: '100', value: String(values[item.idB] ?? 0) }) as HTMLInputElement;

      inputA.addEventListener('change', () => {
        const v = parseFloat(inputA.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idA, Math.min(1, Math.max(0, v / 100))).catch(() => {});
      });
      inputB.addEventListener('change', () => {
        const v = parseFloat(inputB.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idB, Math.min(1, Math.max(0, v / 100))).catch(() => {});
      });

      content.push(el('div', { class: 'sm-control-row' }, [
        el('span', { class: 'sm-control-label', text: item.label }),
        el('div', { class: 'sm-control-value' }, [
          el('span', { text: 'A', style: 'color: var(--sm-text-dim); font-size: 11px' }), inputA,
          el('span', { text: 'B', style: 'color: var(--sm-text-dim); font-size: 11px; margin-left: 8px' }), inputB,
        ])
      ]));
    }
    container.append(accordion('Crop & Mask', content, false));
  }

  private async renderShadowControl(container: HTMLElement, clipId: string): Promise<void> {
    const SHADOW_IDS = [
      { idA: 'shadow.opacity.a', idB: 'shadow.opacity.b', label: 'Opacity', scale: 100, max: 100, unit: '%' },
      { idA: 'shadow.angle.a', idB: 'shadow.angle.b', label: 'Angle', scale: (180 / Math.PI), max: 360, unit: '°' },
      { idA: 'shadow.distance.a', idB: 'shadow.distance.b', label: 'Distance', scale: 1, max: 1000, unit: 'px' },
      { idA: 'shadow.softness.a', idB: 'shadow.softness.b', label: 'Softness', scale: 1, max: 500, unit: 'px' },
    ] as const;

    const values: Record<string, number> = {};
    try {
      const cfg = await this.adapter.readState({ clipId });
      for (const item of SHADOW_IDS) {
        values[item.idA] = typeof cfg.parameters[item.idA] === 'number' ? (cfg.parameters[item.idA] as number) * item.scale : 0;
        values[item.idB] = typeof cfg.parameters[item.idB] === 'number' ? (cfg.parameters[item.idB] as number) * item.scale : 0;
      }
    } catch { /* read-only or unsupported */ }

    const content: HTMLElement[] = [];

    for (const item of SHADOW_IDS) {
      const inputA = el('input', { class: 'sm-input', type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idA] ?? 0)) }) as HTMLInputElement;
      const inputB = el('input', { class: 'sm-input', type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idB] ?? 0)) }) as HTMLInputElement;

      inputA.addEventListener('change', () => {
        const v = parseFloat(inputA.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idA, v / item.scale).catch(() => {});
      });
      inputB.addEventListener('change', () => {
        const v = parseFloat(inputB.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idB, v / item.scale).catch(() => {});
      });

      content.push(el('div', { class: 'sm-control-row' }, [
        el('span', { class: 'sm-control-label', text: item.label }),
        el('div', { class: 'sm-control-value' }, [
          el('span', { text: 'A', style: 'color: var(--sm-text-dim); font-size: 11px' }), inputA,
          el('span', { text: 'B', style: 'color: var(--sm-text-dim); font-size: 11px; margin-left: 8px' }), inputB,
          el('span', { class: 'sm-input-unit', text: item.unit })
        ])
      ]));
    }
    container.append(accordion('Drop Shadow', content, false));
  }

  private async renderStrokeControl(container: HTMLElement, clipId: string): Promise<void> {
    const STROKE_IDS = [
      { idA: 'stroke.enabled.a', idB: 'stroke.enabled.b', label: 'Enabled', type: 'checkbox', unit: '' },
      { idA: 'stroke.width.a', idB: 'stroke.width.b', label: 'Width', type: 'number', scale: 1, max: 1000, unit: 'px' },
      { idA: 'stroke.color1.a', idB: 'stroke.color1.b', label: 'Color 1', type: 'text', unit: '' },
      { idA: 'stroke.color2.a', idB: 'stroke.color2.b', label: 'Color 2', type: 'text', unit: '' },
      { idA: 'stroke.gradientAngle.a', idB: 'stroke.gradientAngle.b', label: 'Angle', type: 'number', scale: (180 / Math.PI), max: 360, unit: '°' },
    ] as const;

    const values: Record<string, any> = {};
    let cycleSpeed = 0;
    try {
      const cfg = await this.adapter.readState({ clipId });
      for (const item of STROKE_IDS) {
        if (item.type === 'number') {
          values[item.idA] = typeof cfg.parameters[item.idA] === 'number' ? (cfg.parameters[item.idA] as number) * item.scale! : 0;
          values[item.idB] = typeof cfg.parameters[item.idB] === 'number' ? (cfg.parameters[item.idB] as number) * item.scale! : 0;
        } else {
          values[item.idA] = cfg.parameters[item.idA];
          values[item.idB] = cfg.parameters[item.idB];
        }
      }
      cycleSpeed = typeof cfg.parameters['stroke.gradientCycleSpeed'] === 'number' ? cfg.parameters['stroke.gradientCycleSpeed'] as number : 0;
    } catch { /* read-only or unsupported */ }

    const content: HTMLElement[] = [];

    for (const item of STROKE_IDS) {
      let inputA: HTMLInputElement, inputB: HTMLInputElement;
      if (item.type === 'checkbox') {
        inputA = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputB = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputA.checked = !!values[item.idA];
        inputB.checked = !!values[item.idB];
      } else if (item.type === 'number') {
        inputA = el('input', { class: 'sm-input', type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idA] ?? 0)) }) as HTMLInputElement;
        inputB = el('input', { class: 'sm-input', type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idB] ?? 0)) }) as HTMLInputElement;
      } else {
        inputA = el('input', { class: 'sm-input', type: 'text', value: String(values[item.idA] ?? 'white') }) as HTMLInputElement;
        inputB = el('input', { class: 'sm-input', type: 'text', value: String(values[item.idB] ?? 'white') }) as HTMLInputElement;
      }

      inputA.addEventListener('change', () => {
        let val: any;
        if (item.type === 'checkbox') val = inputA.checked;
        else if (item.type === 'number') val = parseFloat(inputA.value) / item.scale!;
        else val = inputA.value;
        if (item.type !== 'number' || Number.isFinite(val)) this.adapter.writeLogical({ clipId }, item.idA, val).catch(() => {});
      });
      inputB.addEventListener('change', () => {
        let val: any;
        if (item.type === 'checkbox') val = inputB.checked;
        else if (item.type === 'number') val = parseFloat(inputB.value) / item.scale!;
        else val = inputB.value;
        if (item.type !== 'number' || Number.isFinite(val)) this.adapter.writeLogical({ clipId }, item.idB, val).catch(() => {});
      });

      content.push(el('div', { class: 'sm-control-row' }, [
        el('span', { class: 'sm-control-label', text: item.label }),
        el('div', { class: 'sm-control-value' }, [
          el('span', { text: 'A', style: 'color: var(--sm-text-dim); font-size: 11px' }), inputA,
          el('span', { text: 'B', style: 'color: var(--sm-text-dim); font-size: 11px; margin-left: 8px' }), inputB,
          item.unit ? el('span', { class: 'sm-input-unit', text: item.unit }) : ''
        ])
      ]));
    }
    
    // Cycle speed
    const cycleInput = el('input', { class: 'sm-input', type: 'number', min: '-10', max: '10', step: '0.1', value: String(cycleSpeed) }) as HTMLInputElement;
    cycleInput.addEventListener('change', () => {
        const v = parseFloat(cycleInput.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, 'stroke.gradientCycleSpeed', v).catch(() => {});
    });
    content.push(el('div', { class: 'sm-control-row' }, [
        el('span', { class: 'sm-control-label', text: 'Cycle Speed' }),
        el('div', { class: 'sm-control-value' }, [cycleInput, el('span', { class: 'sm-input-unit', text: 'Hz' })])
    ]));

    container.append(accordion('Stroke', content, false));
  }

  private async renderGlowControl(container: HTMLElement, clipId: string): Promise<void> {
    const GLOW_IDS = [
      { idA: 'glow.enabled.a', idB: 'glow.enabled.b', label: 'Enabled', type: 'checkbox', unit: '' },
      { idA: 'glow.amount.a', idB: 'glow.amount.b', label: 'Amount', type: 'number', scale: 100, max: 100, unit: '%' },
      { idA: 'glow.radius.a', idB: 'glow.radius.b', label: 'Radius', type: 'number', scale: 1, max: 1000, unit: 'px' },
    ] as const;

    const values: Record<string, any> = {};
    try {
      const cfg = await this.adapter.readState({ clipId });
      for (const item of GLOW_IDS) {
        if (item.type === 'number') {
          values[item.idA] = typeof cfg.parameters[item.idA] === 'number' ? (cfg.parameters[item.idA] as number) * item.scale! : 0;
          values[item.idB] = typeof cfg.parameters[item.idB] === 'number' ? (cfg.parameters[item.idB] as number) * item.scale! : 0;
        } else {
          values[item.idA] = cfg.parameters[item.idA];
          values[item.idB] = cfg.parameters[item.idB];
        }
      }
    } catch { /* read-only or unsupported */ }

    const content: HTMLElement[] = [];

    for (const item of GLOW_IDS) {
      let inputA: HTMLInputElement, inputB: HTMLInputElement;
      if (item.type === 'checkbox') {
        inputA = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputB = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputA.checked = !!values[item.idA];
        inputB.checked = !!values[item.idB];
      } else {
        inputA = el('input', { class: 'sm-input', type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idA] ?? 0)) }) as HTMLInputElement;
        inputB = el('input', { class: 'sm-input', type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idB] ?? 0)) }) as HTMLInputElement;
      }

      inputA.addEventListener('change', () => {
        let val: any;
        if (item.type === 'checkbox') val = inputA.checked;
        else val = parseFloat(inputA.value) / item.scale!;
        if (item.type !== 'number' || Number.isFinite(val)) this.adapter.writeLogical({ clipId }, item.idA, val).catch(() => {});
      });
      inputB.addEventListener('change', () => {
        let val: any;
        if (item.type === 'checkbox') val = inputB.checked;
        else val = parseFloat(inputB.value) / item.scale!;
        if (item.type !== 'number' || Number.isFinite(val)) this.adapter.writeLogical({ clipId }, item.idB, val).catch(() => {});
      });

      content.push(el('div', { class: 'sm-control-row' }, [
        el('span', { class: 'sm-control-label', text: item.label }),
        el('div', { class: 'sm-control-value' }, [
          el('span', { text: 'A', style: 'color: var(--sm-text-dim); font-size: 11px' }), inputA,
          el('span', { text: 'B', style: 'color: var(--sm-text-dim); font-size: 11px; margin-left: 8px' }), inputB,
          item.unit ? el('span', { class: 'sm-input-unit', text: item.unit }) : ''
        ])
      ]));
    }
    container.append(accordion('Glow', content, false));
  }

  private async renderMotionBlurControl(container: HTMLElement, clipId: string): Promise<void> {
    const MBLUR_IDS = [
      { id: 'motionBlur.enabled', label: 'Enabled', type: 'checkbox', dflt: false, unit: '' },
      { id: 'motionBlur.shutterAngle', label: 'Angle', type: 'number', min: 0, max: 720, step: 1, dflt: 180, unit: '°' },
      { id: 'motionBlur.samples', label: 'Samples', type: 'number', min: 2, max: 64, step: 1, dflt: 8, unit: '' },
    ] as const;

    const values: Record<string, any> = {};
    try {
      const cfg = await this.adapter.readState({ clipId });
      for (const item of MBLUR_IDS) {
        values[item.id] = cfg.parameters[item.id] ?? item.dflt;
      }
    } catch { /* read-only or unsupported */ }

    const content: HTMLElement[] = [];
    
    for (const item of MBLUR_IDS) {
      let input: HTMLInputElement;
      if (item.type === 'checkbox') {
        input = el('input', { type: 'checkbox' }) as HTMLInputElement;
        input.checked = !!values[item.id];
        input.addEventListener('change', () => {
          this.adapter.writeLogical({ clipId }, item.id, input.checked).catch(() => {});
        });
      } else {
        input = el('input', { class: 'sm-input', type: 'number', min: String(item.min), max: String(item.max), step: String(item.step), value: String(values[item.id]) }) as HTMLInputElement;
        input.addEventListener('change', () => {
          const val = parseFloat(input.value);
          if (Number.isFinite(val)) this.adapter.writeLogical({ clipId }, item.id, val).catch(() => {});
        });
      }
      content.push(el('div', { class: 'sm-control-row' }, [
        el('span', { class: 'sm-control-label', text: item.label }),
        el('div', { class: 'sm-control-value' }, [
          input, item.unit ? el('span', { class: 'sm-input-unit', text: item.unit }) : ''
        ])
      ]));
    }
    
    container.append(accordion('Motion Blur', content, false));
  }
}
