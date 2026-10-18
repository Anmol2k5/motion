// Inspector edits canonical values; native units and transactions stay in the host seam.
import { el, clear, showState, accordion } from './components.ts';
import { OperationStatus } from './operationStatus.ts';
import { CurveEditor } from './curveEditor.ts';
import { BINDINGS, type ParameterBinding } from '../../../../../shared/generated/parameterBindings.ts';
import { canonicalDefault } from '../domain/parameterValues.ts';
import { buildUserPresetFromConfig, type ParameterValue, type StateMotionPreset, type CanonicalStateMotionConfig } from '../domain/presetSchema.ts';
import type { PremiereAdapter, ApplyReport } from '../host/premiereAdapter.ts';
import type { PresetRepository } from '../domain/presetStorage.ts';
export interface InspectorOptions {
  promptName?:(initial:string)=>Promise<string|null>;
  confirmRemoval?:()=>Promise<boolean>;
  onOperation?:(report:ApplyReport)=>void;
}
const ENUMS:Record<string,string[]>={ProgressMode:['A to B','B to A','A to B to A','B to A to B','Hold A','Hold B','Manual'],AlignmentMode:['Clip Start','Clip End','Entire Clip'],EasingMode:['Linear','Ease In','Ease Out','Ease In/Out','Custom Bezier','Spring','Bounce']};
const displayNumber=(value:number)=>String(Number(value.toFixed(6)));
export class InspectorView {
  private lastPreset:StateMotionPreset|null=null;
  private repository:PresetRepository|null=null;
  private generation=0;
  constructor(private adapter:PremiereAdapter,private options:InspectorOptions={}){}
  setLastPreset(p:StateMotionPreset|null){this.lastPreset=p;}
  setRepository(repo:PresetRepository){this.repository=repo;}
  async render(container:HTMLElement):Promise<void>{
    const generation=++this.generation;clear(container);
    let detection,config:CanonicalStateMotionConfig;
    try{
      detection=await this.adapter.detectSelection();
      if(generation!==this.generation)return;
      if(!detection.supported.length){showState(container,'','No compatible clip',detection.unsupported.length?'Apply a preset to a supported clip, or update an incompatible effect.':'Select a video clip in the timeline.');return;}
      config=await this.adapter.readState(detection.supported[0]);
    }catch{if(generation===this.generation)showState(container,'','Could not read selection','Editing is unavailable. Refresh the Inspector to retry.');return;}
    if(generation!==this.generation)return;
    const clip=detection.supported[0],snapshot={...config.parameters};
    container.append(el('p',{class:'muted',text:'Editing the first compatible selected clip. Apply, swap and remove act on the selected compatible clips.'}));
    const status=new OperationStatus(container);container.append(status.element);
    const reportResult=(report:ApplyReport)=>{
      status.element.textContent=`${report.applied.length} updated, ${report.failed.length} failed, ${report.skipped.length} skipped.`;
      this.options.onOperation?.(report);
    };
    const actions=el('div',{class:'sm-actionbar'});
    const action=(label:string,id:string,run:()=>Promise<void>)=>{
      const button=el('button',{class:'sm-btn secondary',text:label,'data-action':id});
      button.addEventListener('click',()=>status.run(run));actions.append(button);return button;
    };
    const apply=action('Apply last preset','apply',async()=>{if(this.lastPreset)reportResult(await this.adapter.applyPresetToSelection(this.lastPreset,detection.supported.map(c=>c.clipId)));});
    apply.disabled=!this.lastPreset;
    action('Swap A/B','swap',async()=>{reportResult(await this.adapter.runSelectionAction('swap',detection.supported));await this.render(container);});
    action('Remove effect','remove',async()=>{if(await this.options.confirmRemoval?.()){reportResult(await this.adapter.runSelectionAction('remove',detection.supported));await this.render(container);}});
    const capture=action('Capture preset','capture',async()=>{
      const name=await this.options.promptName?.('My StateMotion preset');if(!name?.trim()||!this.repository)return;
      const selected=await this.adapter.detectSelection();if(!selected.supported.some(c=>c.clipId===clip.clipId))throw new Error('Selection changed');
      const state=await this.adapter.readState(clip),contract=await this.adapter.getContract(clip);
      await this.repository.create({...buildUserPresetFromConfig(state,contract),name:name.trim()});
      status.element.textContent='Preset saved to your library.';
    });capture.disabled=!this.repository||!this.options.promptName;
    container.append(actions);
    const write=async(values:Record<string,ParameterValue>,restore:()=>void)=>status.run(async()=>{
      try{await this.adapter.writeParameters(clip,values);Object.assign(snapshot,values);this.options.onOperation?.({applied:[clip.clipId],failed:[],skipped:[],reasons:{}});}
      catch(error){restore();this.options.onOperation?.({applied:[],failed:[clip.clipId],skipped:[],reasons:{[clip.clipId]:'Parameter write failed'}});throw error;}
    });
    const row=(binding:ParameterBinding):HTMLElement=>{
      const id=binding.logicalId,value=()=>snapshot[id]??canonicalDefault(id)!;
      const label=binding.wireName.replace(/^SM /,'');
      const wrap=el('label',{class:'sm-control-row'},[el('span',{class:'sm-control-label',text:label})]);
      const common={'data-param':id,'aria-label':label};
      if(binding.nativeType==='POINT'){
        const point=()=>typeof value()==='string'?{x:.5,y:.5}:value() as {x:number;y:number};
        for(const axis of ['x','y'] as const){
          const input=el('input',{...common,'data-axis':axis,type:'number',step:'any',class:'sm-input',value:displayNumber(point()[axis]*100),'aria-label':label+' '+axis+' (%)'});
          input.addEventListener('change',()=>{const number=Number(input.value);if(!input.value.trim()||!Number.isFinite(number)){input.value=displayNumber(point()[axis]*100);return;}
            return write({[id]:{...point(),[axis]:number/100}},()=>{input.value=displayNumber(point()[axis]*100);});});wrap.append(input);
        }
        wrap.append(el('span',{text:'%'}));return wrap;
      }
      if(binding.nativeType==='POPUP'){
        const select=el('select',{...common,class:'sm-select'});
        ENUMS[binding.enumRef].forEach((text,index)=>{const option=el('option',{text,value:String(index)});option.selected=index===value();select.append(option);});select.value=String(value());
        select.addEventListener('change',()=>write({[id]:Number(select.value)},()=>{select.value=String(value());}));wrap.append(select);return wrap;
      }
      if(binding.nativeType==='CHECKBOX'){
        const checkbox=el('input',{...common,type:'checkbox'});checkbox.checked=value()===true;
        checkbox.addEventListener('change',()=>write({[id]:checkbox.checked},()=>{checkbox.checked=value()===true;}));wrap.append(checkbox);return wrap;
      }
      if(binding.nativeType==='COLOR'){
        const input=el('input',{...common,type:'color',value:String(value())});
        input.addEventListener('change',()=>write({[id]:input.value},()=>{input.value=String(value());}));wrap.append(input);return wrap;
      }
      const percent=/^(transform\.(scale|opacity)|crop\.|shadow\.opacity|glow\.amount|transition\.manualProgress)/.test(id);
      const factor=binding.nativeType==='ANGLE'?180/Math.PI:percent?100:1;
      const input=el('input',{...common,type:'number',step:id==='motionBlur.samples'?'1':'any',class:'sm-input',value:displayNumber(Number(value())*factor)});
      if(binding.nativeType==='FLOAT_SLIDER'){input.min=String(binding.validMin);input.max=String(binding.validMax);}
      input.addEventListener('change',()=>{
        const number=Number(input.value);
        if(!input.value.trim()||!Number.isFinite(number)){input.value=displayNumber(Number(value())*factor);return;}
        return write({[id]:number/factor},()=>{input.value=displayNumber(Number(value())*factor);});
      });
      wrap.append(input,el('span',{class:'sm-input-unit',text:binding.nativeType==='ANGLE'?'°':percent?'%':id.endsWith('Seconds')?'s':''}));return wrap;
    };
    for(const [prefix,title] of [['transform.','Transform A/B'],['transition.','Transition'],['crop.','Crop & Mask'],['stroke.','Stroke'],['glow.','Glow'],['shadow.','Drop Shadow'],['motionBlur.','Motion Blur']]){
      const controls=BINDINGS.filter(b=>b.logicalId.startsWith(prefix)).map(row);
      if(prefix==='transition.'){
        const editor=new CurveEditor(curve=>{
          const ids=['transition.curveX1','transition.curveY1','transition.curveX2','transition.curveY2'];
          void write(Object.fromEntries(ids.map((id,index)=>[id,curve[index]])),()=>editor.setCurve(ids.map(id=>Number(snapshot[id]??canonicalDefault(id)))));
        });
        editor.setCurve(['transition.curveX1','transition.curveY1','transition.curveX2','transition.curveY2'].map(id=>Number(snapshot[id]??canonicalDefault(id))));controls.push(editor.getElement());
      }
      container.append(accordion(title,controls,prefix==='transform.'||prefix==='transition.'));
    }
    if(detection.unsupported.length)container.append(el('p',{class:'sm-warn',text:`${detection.unsupported.length} selected clip(s) are unavailable or incompatible.`}));
  }
}
