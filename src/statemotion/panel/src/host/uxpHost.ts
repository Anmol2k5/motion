// Premiere Pro 26.3 UXP adapter. Runtime calls follow @adobe/premierepro.

import type { premierepro } from '@adobe/premierepro';
import type { HostBridge, ClipRef } from './premiereAdapter.ts';
import type { CompatibleContract, ParameterValue } from '../domain/presetSchema.ts';
import { toNative, toCanonical } from './valueConversion.ts';
import { BINDINGS, getBinding } from '../../../../../shared/generated/parameterBindings.ts';

const MATCH_NAME = 'AE.io.github.anmol2k5.statemotion.effect';
type Runtime = Pick<premierepro, 'Project' | 'VideoFilterFactory' | 'PointF' | 'Color'>;

function loadRuntime(): Runtime {
  const runtime = (globalThis as any).require?.('premierepro');
  if (!runtime) throw new Error('Premiere Pro UXP API unavailable');
  return runtime;
}

export class UxpHostBridge implements HostBridge {
  private readonly items = new Map<string, any>();
  private readonly ids = new WeakMap<object, string>();
  private nextId = 1;
  private pendingActions: any[] | null = null;
  private pendingLabel = '';
  private readonly pendingEffects = new Map<string, any>();

  constructor(private readonly ppro: Runtime = loadRuntime()) {}

  async getSelection(): Promise<ClipRef[]> {
    const project = await this.ppro.Project.getActiveProject();
    const sequence = await project?.getActiveSequence();
    const selection = await sequence?.getSelection();
    const selected = await selection?.getTrackItems() ?? [];
    const clips: ClipRef[] = [];
    for (const item of selected) {
      try {
        const chain = await item.getComponentChain();
        if (typeof chain?.createAppendComponentAction !== 'function') continue;
        const clipId = this.remember(item);
        clips.push({ clipId });
      } catch { /* audio or unsupported item */ }
    }
    return clips;
  }

  async hasStateMotionEffect(clip: ClipRef): Promise<boolean> {
    return (await this.findEffect(clip)) !== null;
  }

  async getContract(clip: ClipRef): Promise<CompatibleContract | null> {
    const effect = await this.findEffect(clip);
    if (!effect || effect.getParamCount() < 3) return null;
    try {
      const schemaVersion = await this.readParamNumber(effect, this.paramIndex(effect,'SM Schema Version'));
      const parameterCount = await this.readParamNumber(effect, this.paramIndex(effect,'SM Param Count'));
      const bindingRevision = await this.readParamNumber(effect, this.paramIndex(effect,'SM Binding Rev'));
      return { schemaVersion, parameterCount, bindingRevision };
    } catch {
      return null;
    }
  }

  async enumerateParamIndex(clip: ClipRef, wireName: string): Promise<number | undefined> {
    const effect = await this.findEffect(clip);
    if (!effect || effect.getParamCount() < BINDINGS.length) return undefined;
    return this.paramIndex(effect,wireName);
  }

  async readLogical(clip: ClipRef, logicalId: string): Promise<ParameterValue | undefined> {
    const binding = getBinding(logicalId);
    if (!binding) return undefined;
    const effect = await this.findEffect(clip);
    const index = effect ? this.paramIndex(effect,binding.wireName) : undefined;
    if (!effect || index === undefined) throw new Error('Cannot resolve parameter');
    const keyframe = await effect.getParam(index).getStartValue();
    const raw = keyframe?.value?.value;
    if (raw === undefined) return undefined;
    if(binding.nativeType==='COLOR'){
      if(!raw||!['red','green','blue'].every(channel=>typeof raw[channel]==='number'&&Number.isFinite(raw[channel])))throw new Error('Invalid host color');
      const hex=['red','green','blue'].map(channel=>Math.round(Math.min(1,Math.max(0,raw[channel]))*255).toString(16).padStart(2,'0')).join('');
      return '#'+hex;
    }
    return toCanonical(logicalId, this.unmarshalNative(raw), binding);
  }

  async writeLogical(clip: ClipRef, logicalId: string, value: ParameterValue): Promise<void> {
    const binding = getBinding(logicalId);
    if (!binding) throw new Error(`Unknown logical ID ${logicalId}`);
    const effect = await this.findEffect(clip);
    const index = effect ? this.paramIndex(effect,binding.wireName) : undefined;
    if (!effect || index === undefined) throw new Error(`Cannot resolve parameter ${logicalId}`);
    const param = effect.getParam(index);
    let native = this.marshalNative(toNative(logicalId, value, binding));
    if(binding.nativeType==='COLOR'){
      if(typeof value!=='string'||!/^#[a-f0-9]{6}$/i.test(value)||!this.ppro.Color)throw new Error('Unsupported color');
      native=new (this.ppro.Color as any)(parseInt(value.slice(1,3),16)/255,parseInt(value.slice(3,5),16)/255,parseInt(value.slice(5,7),16)/255,1);
    }
    await this.addAction(param.createSetValueAction(param.createKeyframe(native)), 'StateMotion: edit parameter');
  }

  async beginUndo(label: string): Promise<void> {
    if (this.pendingActions) throw new Error('Nested Premiere transaction');
    this.pendingActions = [];
    this.pendingLabel = label;
  }

  async endUndo(): Promise<void> {
    const actions = this.pendingActions ?? [];
    const label = this.pendingLabel;
    this.pendingActions = null;
    this.pendingLabel = '';
    this.pendingEffects.clear();
    if (!actions.length) return;
    const project = await this.ppro.Project.getActiveProject();
    const ok = project.executeTransaction((compound: any) => {
      for (const action of actions) if(!compound.addAction(action))throw new Error('Premiere rejected an action');
    }, label);
    if (!ok) throw new Error('Premiere transaction failed');
  }

  async applyEffect(clip: ClipRef): Promise<void> {
    const item = this.resolveClip(clip);
    if (!item) throw new Error('Selected clip is no longer available');
    const chain = await item.getComponentChain();
    const effect = await this.ppro.VideoFilterFactory.createComponent(MATCH_NAME);
    this.pendingEffects.set(clip.clipId, effect);
    await this.addAction(chain.createAppendComponentAction(effect), 'StateMotion: add effect');
  }

  async removeEffect(clip: ClipRef): Promise<void> {
    const effect = await this.findEffect(clip);
    if (!effect) return;
    const item = this.resolveClip(clip);
    if (!item) throw new Error('Selected clip is no longer available');
    const chain = await item.getComponentChain();
    await this.addAction(chain.createRemoveComponentAction(effect), 'StateMotion: remove effect');
    this.pendingEffects.delete(clip.clipId);
  }

  private async addAction(action: any, label: string): Promise<void> {
    if (this.pendingActions) {
      this.pendingActions.push(action);
      return;
    }
    const project = await this.ppro.Project.getActiveProject();
    const ok = project.executeTransaction((compound: any) => compound.addAction(action), label);
    if (!ok) throw new Error('Premiere transaction failed');
  }

  private remember(item: object): string {
    let id = this.ids.get(item);
    if (!id) { id = `selection-${this.nextId++}`; this.ids.set(item, id); }
    this.items.set(id, item);
    return id;
  }

  private resolveClip(clip: ClipRef): any {
    return this.items.get(clip.clipId) ?? null;
  }

  private async findEffect(clip: ClipRef): Promise<any> {
    const pending = this.pendingEffects.get(clip.clipId);
    if (pending) return pending;
    const item = this.resolveClip(clip);
    if (!item) return null;
    const chain = await item.getComponentChain();
    for (let i = 0; i < chain.getComponentCount(); i++) {
      const component = chain.getComponentAtIndex(i);
      if (await component.getMatchName() === MATCH_NAME) return component;
    }
    return null;
  }

  private paramIndex(effect:any, wireName:string):number|undefined {
    const matches:number[]=[];
    for(let i=0;i<effect.getParamCount();i++)if(effect.getParam(i).displayName===wireName)matches.push(i);
    return matches.length===1?matches[0]:undefined;
  }
  async cancelUndo():Promise<void>{this.pendingActions=null;this.pendingLabel='';this.pendingEffects.clear();}
  private async readParamNumber(effect: any, index: number|undefined): Promise<number> {
    if(index===undefined)throw new Error('Cannot resolve contract metadata');
    const keyframe = await effect.getParam(index).getStartValue();
    const value = Number(keyframe?.value?.value);
    if (!Number.isFinite(value)) throw new Error('Invalid contract metadata');
    return value;
  }

  private marshalNative(value: any): any {
    if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
      return new (this.ppro.PointF as any)(value.x, value.y);
    }
    return value;
  }

  private unmarshalNative(value: any): any {
    if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
      return { x: value.x, y: value.y };
    }
    return value;
  }
}
