// StateMotion Preset Panel — runtime UXP HostBridge.
//
// IMPORTANT: This talks to Premiere via UXP APIs. The exact surface varies by
// installed Premiere version and the UXP SDK. Every call is guarded; failures
// surface as structured errors to the UI rather than crashes. Verified vs
// unavailable capabilities are recorded in docs/implementation/uxp-panel-development.md.
//
// StateMotion match name (permanent): AE.io.github.anmol2k5.statemotion.effect

import type { HostBridge, ClipRef } from './premiereAdapter.ts';
import type { CompatibleContract } from '../domain/presetSchema.ts';
import { toNative, toCanonical } from './valueConversion.ts';

const MATCH_NAME = 'AE.io.github.anmol2k5.statemotion.effect';

import { getBinding } from '../../../../../shared/generated/parameterBindings.ts';

function logicalIdToWireName(logicalId: string): string | undefined {
  return getBinding(logicalId)?.wireName;
}

export class UxpHostBridge implements HostBridge {
  // --- selection -------------------------------------------------------------
  async getSelection(): Promise<ClipRef[]> {
    const app = (globalThis as any).app;
    if (!app || !app.project || !app.project.activeSequence) return [];
    const seq = app.project.activeSequence;
    const out: ClipRef[] = [];
    const visit = (items: any) => {
      for (const item of items || []) {
        if (item && typeof item.getProvidingSequence === 'function') out.push({ clipId: String(item.nodeId ?? item.id ?? out.length) });
      }
    };
    if (seq.videoTracks) for (const t of seq.videoTracks) visit(t.clips);
    return out;
  }

  async hasStateMotionEffect(clip: ClipRef): Promise<boolean> {
    return (await this.getContract(clip)) !== null;
  }

  async getContract(_clip: ClipRef): Promise<CompatibleContract | null> {
    // Resolve the StateMotion effect instance on the clip and read its
    // contract metadata params (disk 1/2/3). If the API cannot reach them, the
    // clip is reported as no-StateMotion (safe default).
    try {
      const effect = await this.findEffect(_clip);
      if (!effect) return null;
      const sv = await this.readParamNumber(effect, 1);
      const pc = await this.readParamNumber(effect, 2);
      const br = await this.readParamNumber(effect, 3);
      if (sv === undefined || pc === undefined || br === undefined) return null;
      return { schemaVersion: sv, bindingRevision: br, parameterCount: pc };
    } catch {
      return null;
    }
  }

  async enumerateParamIndex(_clip: ClipRef, wireName: string): Promise<number | undefined> {
    try {
      const effect = await this.findEffect(_clip);
      if (!effect || !effect.properties) return undefined;
      const props = effect.properties;
      for (let i = 0; i < (props.numProperties ?? 0); i++) {
        const p = props.getProperty(i);
        if (p && p.displayName === wireName) return i;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private marshalNative(_logicalId: string, native: number | string | { x: number; y: number }): unknown {
    return native; // identity until Premiere POINT shape is operator-verified
  }
  private unmarshalNative(_logicalId: string, raw: unknown): number | string | { x: number; y: number } {
    return raw as number | string | { x: number; y: number };
  }

  async readLogical(clip: ClipRef, logicalId: string): Promise<number | string | undefined> {
    const binding = getBinding(logicalId);
    if (!binding) return undefined;
    const effect = await this.findEffect(clip);
    if (!effect) return undefined;
    const wireName = logicalIdToWireName(logicalId);
    const index = wireName ? await this.enumerateParamIndex(clip, wireName) : undefined;
    if (index === undefined) return undefined;
    const prop = effect.properties?.getProperty?.(index);
    if (!prop || typeof prop.getValue !== 'function') return undefined;
    const native = this.unmarshalNative(logicalId, prop.getValue());
    return toCanonical(logicalId, native as any, binding);
  }

  async writeLogical(clip: ClipRef, logicalId: string, value: number | string): Promise<void> {
    const binding = getBinding(logicalId);
    if (!binding) throw new Error(`Unknown logical ID ${logicalId}`);
    const effect = await this.findEffect(clip);
    if (!effect) throw new Error('StateMotion effect not found on clip');
    const wireName = logicalIdToWireName(logicalId);
    const index = wireName ? await this.enumerateParamIndex(clip, wireName) : undefined;
    if (index === undefined) throw new Error(`Cannot resolve parameter ${logicalId} on clip`);
    const prop = effect.properties?.getProperty?.(index);
    if (!prop || typeof prop.setValue !== 'function') {
      throw new Error(`UXP setValue unavailable for ${logicalId} (unverified host API)`);
    }
    const native = toNative(logicalId, value, binding);
    prop.setValue(this.marshalNative(logicalId, native));
  }

  async beginUndo(label: string): Promise<void> {
    const app = (globalThis as any).app;
    if (app && typeof app.beginUndo === 'function') app.beginUndo(label);
  }

  async endUndo(): Promise<void> {
    const app = (globalThis as any).app;
    if (app && typeof app.endUndo === 'function') app.endUndo();
  }

  async applyEffect(clip: ClipRef): Promise<void> {
    const app = (globalThis as any).app;
    if (!app || !app.project || !app.project.activeSequence) throw new Error('No active sequence');
    const seq = app.project.activeSequence;
    const item = this.resolveClip(clip);
    if (!item || typeof item.addEffect !== 'function') throw new Error('Cannot add effect to clip');
    // Add by match name (never by display name / index 0).
    item.addEffect(MATCH_NAME);
  }

  // --- helpers ----------------------------------------------------------------
  private resolveClip(clip: ClipRef): any {
    const app = (globalThis as any).app;
    const seq = app?.project?.activeSequence;
    if (!seq) return null;
    for (const t of seq.videoTracks || []) {
      for (const c of t.clips || []) {
        if (String(c.nodeId ?? c.id) === clip.clipId) return c;
      }
    }
    return null;
  }

  private async findEffect(clip: ClipRef): Promise<any> {
    const item = this.resolveClip(clip);
    if (!item || !item.components) return null;
    for (const comp of item.components) {
      const match = comp && (comp.matchName === MATCH_NAME || comp.displayName === 'StateMotion');
      if (match) return comp;
    }
    return null;
  }

  private async readParamNumber(effect: any, diskId: number): Promise<number | undefined> {
    try {
      const props = effect.properties;
      for (let i = 0; i < (props.numProperties ?? 0); i++) {
        const p = props.getProperty(i);
        if (p && p.persistentID === String(diskId)) return Number(p.getValue());
      }
    } catch { /* ignore */ }
    return undefined;
  }
}
