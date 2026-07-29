// StateMotion Preset Panel — reusable parameter control builders.

import { el } from './components.ts';

export interface NumberRowOptions {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

export function renderNumberRow(opts: NumberRowOptions): HTMLElement {
  const input = el('input', {
    class: 'sm-input',
    type: 'number',
    min: opts.min !== undefined ? String(opts.min) : '',
    max: opts.max !== undefined ? String(opts.max) : '',
    step: opts.step !== undefined ? String(opts.step) : 'any',
    value: String(opts.value),
  }) as HTMLInputElement;

  input.addEventListener('change', () => {
    const val = parseFloat(input.value);
    if (Number.isFinite(val)) opts.onChange(val);
  });

  return el('div', { class: 'sm-control-row' }, [
    el('span', { class: 'sm-control-label', text: opts.label }),
    el('div', { class: 'sm-control-value' }, [
      input,
      opts.unit ? el('span', { class: 'sm-input-unit', text: opts.unit }) : '',
    ]),
  ]);
}

export interface AbNumberRowOptions {
  label: string;
  valA: number;
  valB: number;
  unit?: string;
  scale?: number;
  min?: number;
  max?: number;
  onChangeA: (val: number) => void;
  onChangeB: (val: number) => void;
}

export function renderAbNumberRow(opts: AbNumberRowOptions): HTMLElement {
  const scale = opts.scale ?? 1;
  const inputA = el('input', {
    class: 'sm-input',
    type: 'number',
    min: opts.min !== undefined ? String(opts.min) : '',
    max: opts.max !== undefined ? String(opts.max) : '',
    value: String(Math.round(opts.valA * scale)),
  }) as HTMLInputElement;

  const inputB = el('input', {
    class: 'sm-input',
    type: 'number',
    min: opts.min !== undefined ? String(opts.min) : '',
    max: opts.max !== undefined ? String(opts.max) : '',
    value: String(Math.round(opts.valB * scale)),
  }) as HTMLInputElement;

  inputA.addEventListener('change', () => {
    const v = parseFloat(inputA.value);
    if (Number.isFinite(v)) opts.onChangeA(v / scale);
  });

  inputB.addEventListener('change', () => {
    const v = parseFloat(inputB.value);
    if (Number.isFinite(v)) opts.onChangeB(v / scale);
  });

  return el('div', { class: 'sm-control-row' }, [
    el('span', { class: 'sm-control-label', text: opts.label }),
    el('div', { class: 'sm-control-value' }, [
      el('span', { text: 'A', style: 'color: var(--sm-text-dim); font-size: 11px' }),
      inputA,
      el('span', { text: 'B', style: 'color: var(--sm-text-dim); font-size: 11px; margin-left: 8px' }),
      inputB,
      opts.unit ? el('span', { class: 'sm-input-unit', text: opts.unit }) : '',
    ]),
  ]);
}

export interface SelectRowOptions {
  label: string;
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function renderSelectRow(opts: SelectRowOptions): HTMLElement {
  const select = el('select', { class: 'sm-select' }) as HTMLSelectElement;
  opts.options.forEach((label, i) => {
    const opt = el('option', { value: String(i), text: label }) as HTMLOptionElement;
    if (i === opts.selectedIndex) opt.selected = true;
    select.append(opt);
  });

  select.addEventListener('change', () => {
    opts.onChange(parseInt(select.value, 10));
  });

  return el('div', { class: 'sm-control-row' }, [
    el('span', { class: 'sm-control-label', text: opts.label }),
    el('div', { class: 'sm-control-value' }, [select]),
  ]);
}

export interface CheckboxRowOptions {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function renderCheckboxRow(opts: CheckboxRowOptions): HTMLElement {
  const input = el('input', { type: 'checkbox' }) as HTMLInputElement;
  input.checked = opts.checked;
  input.addEventListener('change', () => opts.onChange(input.checked));

  return el('div', { class: 'sm-control-row' }, [
    el('span', { class: 'sm-control-label', text: opts.label }),
    el('div', { class: 'sm-control-value' }, [input]),
  ]);
}

export interface AbCheckboxRowOptions {
  label: string;
  checkedA: boolean;
  checkedB: boolean;
  onChangeA: (checked: boolean) => void;
  onChangeB: (checked: boolean) => void;
}

export function renderAbCheckboxRow(opts: AbCheckboxRowOptions): HTMLElement {
  const inputA = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const inputB = el('input', { type: 'checkbox' }) as HTMLInputElement;
  inputA.checked = opts.checkedA;
  inputB.checked = opts.checkedB;

  inputA.addEventListener('change', () => opts.onChangeA(inputA.checked));
  inputB.addEventListener('change', () => opts.onChangeB(inputB.checked));

  return el('div', { class: 'sm-control-row' }, [
    el('span', { class: 'sm-control-label', text: opts.label }),
    el('div', { class: 'sm-control-value' }, [
      el('span', { text: 'A', style: 'color: var(--sm-text-dim); font-size: 11px' }),
      inputA,
      el('span', { text: 'B', style: 'color: var(--sm-text-dim); font-size: 11px; margin-left: 8px' }),
      inputB,
    ]),
  ]);
}
