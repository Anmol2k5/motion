// StateMotion Preset Panel — PremiereAdapter (thin host seam).
//
// The adapter is the ONLY module that talks to Premiere. It depends on a
// HostBridge (the real UXP implementation at runtime, or a fake in tests).
// Runtime indexes never leave EffectParameterMap. Unknown/newer contracts are
// read-only diagnostics and are never written to.

import { buildApplyPlan, type SelectionItem, ItemStatus } from '../domain/applyPlan.ts';
import { checkCompatibility, CompatLevel } from '../domain/compatibility.ts';
import { getBinding, LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';
import type { StateMotionPreset, CanonicalStateMotionConfig } from '../domain/presetSchema.ts';

export interface ClipRef {
  clipId: string;
}

export interface HostBridge {
  getSelection(): Promise<ClipRef[]>;
  hasStateMotionEffect(clip: ClipRef): Promise<boolean>;
  getContract(clip: ClipRef): Promise<{ schemaVersion: number; bindingRevision: number; parameterCount: number } | null>;
  enumerateParamIndex(clip: ClipRef, wireName: string): Promise<number | undefined>;
  readLogical(clip: ClipRef, logicalId: string): Promise<number | string | undefined>;
  writeLogical(clip: ClipRef, logicalId: string, value: number | string): Promise<void>;
  beginUndo(label: string): Promise<void>;
  endUndo(): Promise<void>;
  applyEffect(clip: ClipRef): Promise<void>;
}

export interface DetectResult {
  supported: ClipRef[];
  unsupported: ClipRef[];
}

export interface ApplyReport {
  applied: string[];
  skipped: string[];
  failed: string[];
  reasons: Record<string, string>;
}

export class PremiereAdapter {
  constructor(private host: HostBridge) {}

  async detectSelection(): Promise<DetectResult> {
    const selection = await this.host.getSelection();
    const supported: ClipRef[] = [];
    const unsupported: ClipRef[] = [];
    for (const clip of selection) {
      const has = await this.host.hasStateMotionEffect(clip);
      const contract = await this.host.getContract(clip);
      const compat = checkCompatibility(contract);
      if (has && compat.level !== CompatLevel.Incompatible) supported.push(clip);
      else unsupported.push(clip);
    }
    return { supported, unsupported };
  }

  // Apply a preset to the given selection clip ids. Uses buildApplyPlan for
  // classification, then writes only resolvable logical params inside one undo.
  async applyPresetToSelection(preset: StateMotionPreset, selectionClipIds: string[]): Promise<ApplyReport> {
    const clips: ClipRef[] = selectionClipIds.map((id) => ({ clipId: id }));
    const items: SelectionItem[] = [];
    for (const clip of clips) {
      const has = await this.host.hasStateMotionEffect(clip);
      let contract = await this.host.getContract(clip);
      if (!has && contract === null) {
        // No effect: apply it (reuse, do not duplicate), then read its contract.
        await this.host.applyEffect(clip);
        contract = await this.host.getContract(clip);
      }
      // After a successful apply, the clip now has the effect. Report the
      // post-apply truth so the plan treats it as supported.
      const effectiveHas = has || contract !== null;
      items.push({ clipId: clip.clipId, hasStateMotion: effectiveHas, contract });
    }

    const plan = buildApplyPlan(items, preset.presetId, preset.compatibleContract);
    const report: ApplyReport = { applied: [], skipped: [], failed: [], reasons: {} };

    await this.host.beginUndo('StateMotion: apply preset ' + preset.name);
    try {
      for (const item of plan.items) {
        if (item.status !== ItemStatus.Supported) {
          if (item.status === ItemStatus.Unsupported) report.skipped.push(item.clipId);
          else report.failed.push(item.clipId);
          report.reasons[item.clipId] = item.reason;
          continue;
        }
        const clip: ClipRef = { clipId: item.clipId };
        for (const [logicalId, value] of Object.entries(preset.parameters)) {
          const binding = getBinding(logicalId);
          if (!binding) continue; // unknown logical id -> never write blindly
          const index = await this.host.enumerateParamIndex(clip, binding.wireName);
          if (index === undefined) continue; // index drift -> skip, no blind write
          await this.host.writeLogical(clip, logicalId, value);
        }
        report.applied.push(item.clipId);
      }
    } finally {
      await this.host.endUndo();
    }
    return report;
  }

  async getContract(clip: ClipRef) {
    return this.host.getContract(clip);
  }

  async readState(clip: ClipRef): Promise<CanonicalStateMotionConfig> {
    const contract = await this.host.getContract(clip);
    const compat = checkCompatibility(contract);
    if (compat.level === CompatLevel.Incompatible) throw new ContractIncompatible(compat.reasons);
    if (compat.level === CompatLevel.ReadOnly) throw new ContractReadOnly(compat.reasons);
    if (!(await this.host.hasStateMotionEffect(clip))) throw new Error('No StateMotion effect on clip');

    const parameters: Record<string, number | string> = {};
    for (const id of LOGICAL_IDS) {
      if (!isCreative(id)) continue; // never read metadata
      const v = await this.host.readLogical(clip, id);
      if (v === undefined) continue;
      parameters[id] = v;
    }
    return { parameters };
  }
}

export class ContractIncompatible extends Error {
  constructor(public reasons: string[]) { super('Contract incompatible: ' + reasons.join('; ')); }
}

export class ContractReadOnly extends Error {
  constructor(public reasons: string[]) { super('Contract read-only: ' + reasons.join('; ')); }
}

// Pure filter: creative params only (exclude hidden metadata ownership).
function isCreative(logicalId: string): boolean {
  const b = getBinding(logicalId);
  return !!b && b.stateOwnership !== 'metadata';
}
