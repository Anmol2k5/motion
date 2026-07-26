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

    await this.renderEasingControl(container, supported[0].clipId);
    await this.renderCropControl(container, supported[0].clipId);
    await this.renderShadowControl(container, supported[0].clipId);
    await this.renderStrokeControl(container, supported[0].clipId);
    await this.renderGlowControl(container, supported[0].clipId);
    await this.renderMotionBlurControl(container, supported[0].clipId);

    // Applied preset (best-effort detection by matching params is future work;
    // we show a manual Apply control here).
    const applyBtn = el('button', { class: 'sm-btn', text: 'Apply last selected preset' }) as HTMLButtonElement;
    applyBtn.disabled = !this.lastPreset;
    applyBtn.addEventListener('click', () => { if (this.lastPreset) this.adapter.applyPresetToSelection(this.lastPreset, supported.map((c) => c.clipId)); });
    
    const swapBtn = el('button', { class: 'sm-btn secondary', text: 'Swap A ↔ B' }) as HTMLButtonElement;
    swapBtn.addEventListener('click', async () => {
      for (const clip of supported) await this.adapter.swapStates(clip);
      this.render(container);
    });

    const removeBtn = el('button', { class: 'sm-btn secondary', text: 'Remove Effect', style: 'color: #ff5f56' }) as HTMLButtonElement;
    removeBtn.addEventListener('click', async () => {
      if (window.confirm('Remove StateMotion from selected clips?')) {
        for (const clip of supported) await this.adapter.removeEffect(clip);
        this.render(container);
      }
    });

    container.append(el('div', { class: 'sm-actionbar' }, [applyBtn, swapBtn, removeBtn]));

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
    const EASING_LABELS = ['Linear', 'EaseIn', 'EaseOut', 'EaseInOut', 'Custom', 'Spring', 'Bounce'];
    const CURVE_IDS = ['transition.curveX1', 'transition.curveY1', 'transition.curveX2', 'transition.curveY2'] as const;

    let easing = 3;
    let curve = [1 / 3, 0.0, 2 / 3, 1.0];
    let cfg: any = null;
    try {
      cfg = await this.adapter.readState({ clipId });
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
    const springRow = el('div', { class: 'sm-row sm-curve' }, []);
    const springInputs: HTMLInputElement[] = [];
    const SPRING_IDS = [
      { id: 'transition.spring.frequency', label: 'Freq', min: '0.1', max: '10', step: '0.1', dflt: 1.0 },
      { id: 'transition.spring.damping', label: 'Damp', min: '0', max: '2', step: '0.05', dflt: 0.5 },
      { id: 'transition.spring.initialVelocity', label: 'Vel', min: '-10', max: '10', step: '0.1', dflt: 0.0 }
    ];
    SPRING_IDS.forEach((def, i) => {
      let v = def.dflt;
      if (cfg && typeof cfg.parameters[def.id] === 'number') v = cfg.parameters[def.id] as number;
      const input = el('input', { type: 'number', min: def.min, max: def.max, step: def.step, value: String(v) }) as HTMLInputElement;
      input.classList.add('sm-curve-input');
      springInputs.push(input);
      springRow.append(el('span', { class: 'label', text: def.label }), input);
    });
    section.append(springRow);
    const applySpring = () => {
      SPRING_IDS.forEach((def, i) => {
        const v = parseFloat(springInputs[i].value);
        if (Number.isFinite(v)) this.writeEasing(clipId, def.id, v);
      });
    };
    springInputs.forEach((inp) => inp.addEventListener('change', applySpring));

    const bounceRow = el('div', { class: 'sm-row sm-curve' }, []);
    const bounceInputs: HTMLInputElement[] = [];
    const BOUNCE_IDS = [
      { id: 'transition.bounce.count', label: 'Count', min: '1', max: '8', step: '1', dflt: 3 },
      { id: 'transition.bounce.heightDecay', label: 'HDecay', min: '0', max: '1', step: '0.05', dflt: 0.5 },
      { id: 'transition.bounce.timeDecay', label: 'TDecay', min: '0', max: '1', step: '0.05', dflt: 0.5 },
      { id: 'transition.bounce.hangTime', label: 'Hang', min: '0', max: '1', step: '0.05', dflt: 0.0 }
    ];
    BOUNCE_IDS.forEach((def, i) => {
      let v = def.dflt;
      if (cfg && typeof cfg.parameters[def.id] === 'number') v = cfg.parameters[def.id] as number;
      const input = el('input', { type: 'number', min: def.min, max: def.max, step: def.step, value: String(v) }) as HTMLInputElement;
      input.classList.add('sm-curve-input');
      bounceInputs.push(input);
      bounceRow.append(el('span', { class: 'label', text: def.label }), input);
    });
    section.append(bounceRow);
    const applyBounce = () => {
      BOUNCE_IDS.forEach((def, i) => {
        const v = parseFloat(bounceInputs[i].value);
        if (Number.isFinite(v)) this.writeEasing(clipId, def.id, v);
      });
    };
    bounceInputs.forEach((inp) => inp.addEventListener('change', applyBounce));

    const syncCurveVisibility = () => {
      const val = select.value;
      curveRow.style.display = val === '4' ? '' : 'none';
      springRow.style.display = val === '5' ? '' : 'none';
      bounceRow.style.display = val === '6' ? '' : 'none';
      if (val === '4') applyCurve();
      if (val === '5') applySpring();
      if (val === '6') applyBounce();
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

    const section = el('div', { class: 'sm-section' });
    section.append(el('div', { class: 'sm-section-title', text: 'Crop & Rounded Mask (%)' }));

    for (const item of CROP_IDS) {
      const inputA = el('input', { type: 'number', min: '0', max: '100', value: String(values[item.idA] ?? 0) }) as HTMLInputElement;
      const inputB = el('input', { type: 'number', min: '0', max: '100', value: String(values[item.idB] ?? 0) }) as HTMLInputElement;
      inputA.classList.add('sm-curve-input');
      inputB.classList.add('sm-curve-input');

      inputA.addEventListener('change', () => {
        const v = parseFloat(inputA.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idA, Math.min(1, Math.max(0, v / 100))).catch(() => {});
      });
      inputB.addEventListener('change', () => {
        const v = parseFloat(inputB.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idB, Math.min(1, Math.max(0, v / 100))).catch(() => {});
      });

      const row = el('div', { class: 'sm-row' }, [
        el('span', { class: 'label', text: item.label }),
        el('span', { class: 'label', text: 'A' }), inputA,
        el('span', { class: 'label', text: 'B' }), inputB,
      ]);
      section.append(row);
    }
    container.append(section);
  }

  private async renderShadowControl(container: HTMLElement, clipId: string): Promise<void> {
    const SHADOW_IDS = [
      { idA: 'shadow.opacity.a', idB: 'shadow.opacity.b', label: 'Opacity (%)', scale: 100, max: 100 },
      { idA: 'shadow.angle.a', idB: 'shadow.angle.b', label: 'Angle (°)', scale: (180 / Math.PI), max: 360 },
      { idA: 'shadow.distance.a', idB: 'shadow.distance.b', label: 'Distance (px)', scale: 1, max: 1000 },
      { idA: 'shadow.softness.a', idB: 'shadow.softness.b', label: 'Softness (px)', scale: 1, max: 500 },
    ] as const;

    const values: Record<string, number> = {};
    try {
      const cfg = await this.adapter.readState({ clipId });
      for (const item of SHADOW_IDS) {
        values[item.idA] = typeof cfg.parameters[item.idA] === 'number' ? (cfg.parameters[item.idA] as number) * item.scale : 0;
        values[item.idB] = typeof cfg.parameters[item.idB] === 'number' ? (cfg.parameters[item.idB] as number) * item.scale : 0;
      }
    } catch { /* read-only or unsupported */ }

    const section = el('div', { class: 'sm-section' });
    section.append(el('div', { class: 'sm-section-title', text: 'Drop Shadow' }));

    for (const item of SHADOW_IDS) {
      const inputA = el('input', { type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idA] ?? 0)) }) as HTMLInputElement;
      const inputB = el('input', { type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idB] ?? 0)) }) as HTMLInputElement;
      inputA.classList.add('sm-curve-input');
      inputB.classList.add('sm-curve-input');

      inputA.addEventListener('change', () => {
        const v = parseFloat(inputA.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idA, v / item.scale).catch(() => {});
      });
      inputB.addEventListener('change', () => {
        const v = parseFloat(inputB.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, item.idB, v / item.scale).catch(() => {});
      });

      const row = el('div', { class: 'sm-row' }, [
        el('span', { class: 'label', text: item.label }),
        el('span', { class: 'label', text: 'A' }), inputA,
        el('span', { class: 'label', text: 'B' }), inputB,
      ]);
      section.append(row);
    }
    container.append(section);
  }

  private async renderStrokeControl(container: HTMLElement, clipId: string): Promise<void> {
    const STROKE_IDS = [
      { idA: 'stroke.enabled.a', idB: 'stroke.enabled.b', label: 'Enabled', type: 'checkbox' },
      { idA: 'stroke.width.a', idB: 'stroke.width.b', label: 'Width (px)', type: 'number', scale: 1, max: 1000 },
      { idA: 'stroke.color1.a', idB: 'stroke.color1.b', label: 'Color 1', type: 'text' },
      { idA: 'stroke.color2.a', idB: 'stroke.color2.b', label: 'Color 2', type: 'text' },
      { idA: 'stroke.gradientAngle.a', idB: 'stroke.gradientAngle.b', label: 'Angle (°)', type: 'number', scale: (180 / Math.PI), max: 360 },
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

    const section = el('div', { class: 'sm-section' });
    section.append(el('div', { class: 'sm-section-title', text: 'Stroke' }));

    for (const item of STROKE_IDS) {
      let inputA: HTMLInputElement, inputB: HTMLInputElement;
      if (item.type === 'checkbox') {
        inputA = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputB = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputA.checked = !!values[item.idA];
        inputB.checked = !!values[item.idB];
      } else if (item.type === 'number') {
        inputA = el('input', { type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idA] ?? 0)) }) as HTMLInputElement;
        inputB = el('input', { type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idB] ?? 0)) }) as HTMLInputElement;
        inputA.classList.add('sm-curve-input');
        inputB.classList.add('sm-curve-input');
      } else {
        inputA = el('input', { type: 'text', value: String(values[item.idA] ?? 'white') }) as HTMLInputElement;
        inputB = el('input', { type: 'text', value: String(values[item.idB] ?? 'white') }) as HTMLInputElement;
        inputA.classList.add('sm-curve-input');
        inputB.classList.add('sm-curve-input');
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

      const row = el('div', { class: 'sm-row' }, [
        el('span', { class: 'label', text: item.label }),
        el('span', { class: 'label', text: 'A' }), inputA,
        el('span', { class: 'label', text: 'B' }), inputB,
      ]);
      section.append(row);
    }
    
    // Cycle speed
    const cycleInput = el('input', { type: 'number', min: '-10', max: '10', step: '0.1', value: String(cycleSpeed) }) as HTMLInputElement;
    cycleInput.classList.add('sm-curve-input');
    cycleInput.addEventListener('change', () => {
        const v = parseFloat(cycleInput.value);
        if (Number.isFinite(v)) this.adapter.writeLogical({ clipId }, 'stroke.gradientCycleSpeed', v).catch(() => {});
    });
    section.append(el('div', { class: 'sm-row' }, [
        el('span', { class: 'label', text: 'Cycle Speed (Hz)' }),
        cycleInput
    ]));

    container.append(section);
  }

  private async renderGlowControl(container: HTMLElement, clipId: string): Promise<void> {
    const GLOW_IDS = [
      { idA: 'glow.enabled.a', idB: 'glow.enabled.b', label: 'Enabled', type: 'checkbox' },
      { idA: 'glow.amount.a', idB: 'glow.amount.b', label: 'Amount (%)', type: 'number', scale: 100, max: 100 },
      { idA: 'glow.radius.a', idB: 'glow.radius.b', label: 'Radius (px)', type: 'number', scale: 1, max: 1000 },
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

    const section = el('div', { class: 'sm-section' });
    section.append(el('div', { class: 'sm-section-title', text: 'Glow' }));

    for (const item of GLOW_IDS) {
      let inputA: HTMLInputElement, inputB: HTMLInputElement;
      if (item.type === 'checkbox') {
        inputA = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputB = el('input', { type: 'checkbox' }) as HTMLInputElement;
        inputA.checked = !!values[item.idA];
        inputB.checked = !!values[item.idB];
      } else {
        inputA = el('input', { type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idA] ?? 0)) }) as HTMLInputElement;
        inputB = el('input', { type: 'number', min: '0', max: String(item.max), value: String(Math.round(values[item.idB] ?? 0)) }) as HTMLInputElement;
        inputA.classList.add('sm-curve-input');
        inputB.classList.add('sm-curve-input');
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

      const row = el('div', { class: 'sm-row' }, [
        el('span', { class: 'label', text: item.label }),
        el('span', { class: 'label', text: 'A' }), inputA,
        el('span', { class: 'label', text: 'B' }), inputB,
      ]);
      section.append(row);
    }
    container.append(section);
  }

  private async renderMotionBlurControl(container: HTMLElement, clipId: string): Promise<void> {
    const MBLUR_IDS = [
      { id: 'motionBlur.enabled', label: 'Enabled', type: 'checkbox', dflt: false },
      { id: 'motionBlur.shutterAngle', label: 'Angle (°)', type: 'number', min: 0, max: 720, step: 1, dflt: 180 },
      { id: 'motionBlur.samples', label: 'Samples', type: 'number', min: 2, max: 64, step: 1, dflt: 8 },
    ] as const;

    const values: Record<string, any> = {};
    try {
      const cfg = await this.adapter.readState({ clipId });
      for (const item of MBLUR_IDS) {
        values[item.id] = cfg.parameters[item.id] ?? item.dflt;
      }
    } catch { /* read-only or unsupported */ }

    const section = el('div', { class: 'sm-section' });
    section.append(el('div', { class: 'sm-section-title', text: 'Motion Blur' }));

    const row = el('div', { class: 'sm-row sm-curve' }, []);
    for (const item of MBLUR_IDS) {
      let input: HTMLInputElement;
      if (item.type === 'checkbox') {
        input = el('input', { type: 'checkbox' }) as HTMLInputElement;
        input.checked = !!values[item.id];
        input.addEventListener('change', () => {
          this.adapter.writeLogical({ clipId }, item.id, input.checked).catch(() => {});
        });
      } else {
        input = el('input', { type: 'number', min: String(item.min), max: String(item.max), step: String(item.step), value: String(values[item.id]) }) as HTMLInputElement;
        input.classList.add('sm-curve-input');
        input.addEventListener('change', () => {
          const val = parseFloat(input.value);
          if (Number.isFinite(val)) this.adapter.writeLogical({ clipId }, item.id, val).catch(() => {});
        });
      }
      row.append(el('span', { class: 'label', text: item.label }), input);
    }
    section.append(row);
    container.append(section);
  }
}
