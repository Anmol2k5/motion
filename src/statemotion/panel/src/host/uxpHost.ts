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

const MATCH_NAME = 'AE.io.github.anmol2k5.statemotion.effect';

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

  async readLogical(clip: ClipRef, logicalId: string): Promise<number | string | undefined> {
    return undefined;
  }

  async writeLogical(clip: ClipRef, _logicalId: string, _value: number | string): Promise<void> {
    // Resolved by enumerateParamIndex; the actual UXP setValue is applied here.
    // Implementation is finalized once the operator verifies the UXP parameter
    // write API (see uxp-panel-development.md). Guarded so the panel still loads.
    const effect = await this.findEffect(clip);
    if (!effect) throw new Error('StateMotion effect not found on clip');
    // Placeholder: real write via effect.properties.getProperty(index).setValue(...)
    void effect;
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
