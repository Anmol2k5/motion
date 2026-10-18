import { validatePreset } from '../domain/presetSchema.ts';
import { validateParameterValues } from '../domain/parameterValues.ts';
// StateMotion Preset Panel — PremiereAdapter (thin host seam).
//
// The adapter is the ONLY module that talks to Premiere. It depends on a
// HostBridge (the real UXP implementation at runtime, or a fake in tests).
// Runtime indexes never leave EffectParameterMap. Unknown/newer contracts are
// read-only diagnostics and are never written to.

import { buildApplyPlan, type SelectionItem, ItemStatus } from '../domain/applyPlan.ts';
import { checkCompatibility, CompatLevel } from '../domain/compatibility.ts';
import { getBinding, LOGICAL_IDS } from '../../../../../shared/generated/parameterBindings.ts';
import type { StateMotionPreset, CanonicalStateMotionConfig, ParameterValue } from '../domain/presetSchema.ts';

export interface ClipRef {
  clipId: string;
}

export interface HostBridge {
  getSelection(): Promise<ClipRef[]>;
  hasStateMotionEffect(clip: ClipRef): Promise<boolean>;
  getContract(clip: ClipRef): Promise<{ schemaVersion: number; bindingRevision: number; parameterCount: number } | null>;
  enumerateParamIndex(clip: ClipRef, wireName: string): Promise<number | undefined>;
  readLogical(clip: ClipRef, logicalId: string): Promise<ParameterValue | undefined>;
  writeLogical(clip: ClipRef, logicalId: string, value: ParameterValue): Promise<void>;
  beginUndo(label: string): Promise<void>;
  endUndo(): Promise<void>;
  cancelUndo(): Promise<void>;
  applyEffect(clip: ClipRef): Promise<void>;
  removeEffect(clip: ClipRef): Promise<void>;
}

export interface DetectResult {
  supported: ClipRef[];
  unsupported: ClipRef[];
}

export interface ApplyReport {
  warning?:string;
  applied: string[];
  skipped: string[];
  failed: string[];
  reasons: Record<string, string>;
}

export class PremiereAdapter {
  private pending:Promise<unknown>=Promise.resolve();
  constructor(private host: HostBridge) {}
  private exclusive<T>(run:()=>Promise<T>):Promise<T>{
    const result=this.pending.then(run,run);this.pending=result.then(()=>{},()=>{});return result;
  }
  private async transaction(label:string,run:()=>Promise<void>):Promise<void>{
    await this.host.beginUndo(label);
    try {await run();await this.host.endUndo();}
    catch(error){await this.host.cancelUndo();throw error;}
  }
  private async assertSelected(clip:ClipRef):Promise<void>{
    if(!(await this.host.getSelection()).some(c=>c.clipId===clip.clipId))throw new Error('Selection changed. Select the clip again.');
  }
  private async assertCompatible(clip:ClipRef):Promise<void>{
    const compat=checkCompatibility(await this.host.getContract(clip));
    if(compat.level===CompatLevel.ReadOnly)throw new ContractReadOnly(compat.reasons);
    if(compat.level!==CompatLevel.Ok)throw new ContractIncompatible(compat.reasons);
  }
  async detectSelection():Promise<DetectResult>{
    const supported:ClipRef[]=[],unsupported:ClipRef[]=[];
    for(const clip of await this.host.getSelection()){
      const has=await this.host.hasStateMotionEffect(clip);
      const compat=checkCompatibility(await this.host.getContract(clip));
      (has&&compat.level===CompatLevel.Ok?supported:unsupported).push(clip);
    }
    return {supported,unsupported};
  }
  async applyPresetToSelection(preset:StateMotionPreset,selectionClipIds?:string[]):Promise<ApplyReport>{
    return this.exclusive(async()=>{
      const selected=await this.host.getSelection();
      const clips=selectionClipIds?selectionClipIds.map(clipId=>({clipId})):selected;
      const report:ApplyReport={applied:[],skipped:[],failed:[],reasons:{}};
      const validation=validatePreset(preset);
      for(const clip of clips){
        try {
          if(!validation.ok)throw new Error('Invalid or incompatible preset');
          if(!selected.some(c=>c.clipId===clip.clipId))throw new Error('Selection changed');
          await this.transaction('StateMotion: apply '+preset.name,async()=>{
            if(!(await this.host.hasStateMotionEffect(clip)))await this.host.applyEffect(clip);
            await this.assertCompatible(clip);
            for(const [id,value] of Object.entries(preset.parameters)){
              const binding=getBinding(id)!;
              if(await this.host.enumerateParamIndex(clip,binding.wireName)===undefined)throw new Error('Cannot resolve required parameter');
            }
            for(const [id,value] of Object.entries(preset.parameters))await this.host.writeLogical(clip,id,value);
          });
          report.applied.push(clip.clipId);
        }catch(error){report.failed.push(clip.clipId);report.reasons[clip.clipId]=error instanceof ContractIncompatible||error instanceof ContractReadOnly?'Contract incompatible':error instanceof Error&&error.message==='Selection changed'?'Selection changed':'Operation failed; no staged changes were committed';}
      }
      return report;
    });
  }
  async getContract(clip:ClipRef){return this.host.getContract(clip);}
  async writeParameters(clip:ClipRef,values:Record<string,ParameterValue>):Promise<void>{
    return this.exclusive(async()=>{
      const result=validateParameterValues(values);
      if(!result.ok)throw new Error('Invalid parameter values');
      await this.assertCompatible(clip);await this.assertSelected(clip);
      for(const id of Object.keys(values))if(await this.host.enumerateParamIndex(clip,getBinding(id)!.wireName)===undefined)throw new Error('Cannot resolve required parameter');
      await this.transaction('StateMotion: edit parameters',async()=>{
        for(const [id,value] of Object.entries(values))await this.host.writeLogical(clip,id,value);
      });
    });
  }
  async writeLogical(clip:ClipRef,id:string,value:ParameterValue):Promise<void>{return this.writeParameters(clip,{[id]:value});}
  async readState(clip:ClipRef):Promise<CanonicalStateMotionConfig>{
    await this.assertCompatible(clip);
    if(!(await this.host.hasStateMotionEffect(clip)))throw new Error('No StateMotion effect on clip');
    const parameters:Record<string,ParameterValue>={};
    for(const id of LOGICAL_IDS){if(!isCreative(id))continue;const value=await this.host.readLogical(clip,id);if(value!==undefined)parameters[id]=value;}
    return {parameters};
  }
  async removeEffect(clip:ClipRef):Promise<void>{
    return this.exclusive(async()=>{await this.assertSelected(clip);await this.assertCompatible(clip);await this.transaction('StateMotion: remove effect',()=>this.host.removeEffect(clip));});
  }
  async swapStates(clip:ClipRef):Promise<void>{
    return this.exclusive(async()=>{
      await this.assertSelected(clip);const state=await this.readState(clip);
      const values:Record<string,ParameterValue>={};
      for(const id of Object.keys(state.parameters)){
        const target=id.endsWith('.a')?id.slice(0,-2)+'.b':id.endsWith('.b')?id.slice(0,-2)+'.a':id;
        if(target!==id&&state.parameters[target]!==undefined)values[id]=state.parameters[target];
      }
      await this.transaction('StateMotion: swap states',async()=>{for(const [id,value] of Object.entries(values))await this.host.writeLogical(clip,id,value);});
    });
  }
  async runSelectionAction(action:'swap'|'remove',clips:ClipRef[]):Promise<ApplyReport>{
    const report:ApplyReport={applied:[],skipped:[],failed:[],reasons:{}};
    for(const clip of clips){try{if(action==='swap')await this.swapStates(clip);else await this.removeEffect(clip);report.applied.push(clip.clipId);}catch{report.failed.push(clip.clipId);report.reasons[clip.clipId]='Operation failed; retry this clip';}}
    return report;
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
