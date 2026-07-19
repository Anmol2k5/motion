// StateMotion Preset Panel — Diagnostics / About view.
//
// Displays available technical state. Distinguishes VERIFIED / AVAILABLE /
// UNAVAILABLE / UNKNOWN. Never claims host capabilities that have not been
// tested. The "Copy Debug Report" action generates a pure, non-sensitive text
// report (see domain/diagnostics.ts).

import { el, clear } from './components.ts';
import { buildDebugReport, EXPECTED_MATCH_NAME, type DiagnosticInput } from '../domain/diagnostics.ts';
import { getProductVersion } from '../domain/productVersion.ts';
import { SCHEMA_VERSION, BINDING_REVISION, PARAMETER_COUNT } from '../../../../../shared/generated/parameterBindings.ts';
import { Capability, VerifyState, capabilityLabel, type CapabilityMatrix } from '../domain/capability.ts';

export class DiagnosticsView {
  // Injected by main.ts: live snapshot data. Host-dependent fields default to
  // UNKNOWN / not-yet-verified and are only filled when operator-confirmed.
  constructor(private input: () => DiagnosticInput) {}

  render(container: HTMLElement): void {
    clear(container);
    const pv = getProductVersion();
    const input = this.input();
    const caps = input.capabilities ?? {};

    container.append(el('div', { class: 'sm-section-title', text: 'About' }));
    const about = el('div', {});
    about.append(row('Product', `${pv.name} v${pv.version}`));
    // Single clear Alpha indicator (not plastered everywhere).
    about.append(el('div', { class: 'sm-alpha-badge' }, [el('span', { text: `${pv.name} v${pv.version} Alpha` })]));
    container.append(about);

    container.append(el('div', { class: 'sm-section-title', text: 'Versions' }));
    const versions = el('div', {});
    versions.append(row('Product version', pv.version));
    versions.append(row('Preset format version', String(SCHEMA_VERSION)));
    versions.append(row('Parameter schema version', String(SCHEMA_VERSION)));
    versions.append(row('Binding revision', String(BINDING_REVISION)));
    versions.append(row('Expected parameter count', String(PARAMETER_COUNT)));
    container.append(versions);

    container.append(el('div', { class: 'sm-section-title', text: 'Environment' }));
    const env = el('div', {});
    env.append(row('Effect match name', EXPECTED_MATCH_NAME));
    env.append(row('Contract status', input.contractStatus ?? 'unknown'));
    env.append(row('Selection count', String(input.selectionCount ?? 0)));
    env.append(row('Last operation', input.lastOperation ?? 'none'));
    container.append(env);

    container.append(el('div', { class: 'sm-section-title', text: 'Capabilities' }));
    const capList = el('div', { class: 'sm-list' });
    const entries = Object.values(caps as CapabilityMatrix);
    if (!entries.length) {
      capList.append(el('div', { class: 'muted', text: 'No capability data yet (not yet operator-verified).' }));
    } else {
      for (const c of entries) {
        capList.append(el('div', { class: 'sm-row' }, [
          el('span', { class: 'label', text: capabilityLabel(c.capability) }),
          el('span', { class: `sm-verify sm-verify-${c.verify}`, text: c.verify }),
        ]));
      }
    }
    container.append(capList);

    const copyBtn = el('button', { class: 'sm-btn secondary', text: 'Copy Debug Report', 'aria-label': 'Copy debug report to clipboard' }) as HTMLButtonElement;
    copyBtn.addEventListener('click', () => this.copyReport(input));
    const copyRow = el('div', { class: 'sm-actionbar' }, [copyBtn]);
    container.append(copyRow);
  }

  private async copyReport(input: DiagnosticInput): Promise<void> {
    const report = buildDebugReport(input);
    try {
      await (navigator as any).clipboard?.writeText(report);
    } catch {
      // Clipboard may be unavailable in some hosts; ignore (diagnostic only).
    }
  }
}

function row(label: string, value: string): HTMLElement {
  return el('div', { class: 'sm-row' }, [
    el('span', { class: 'label', text: label }),
    el('span', { text: value }),
  ]);
}
