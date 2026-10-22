import assert from 'node:assert/strict';
import {PremiereAdapter} from './premiereAdapter.ts';
import {BUNDLED_PRESETS} from '../starter/bundledPresets.ts';
const values:Record<string,unknown>={'transition.mode':6,'stroke.enabled.a':true,'transform.scaleX.a':2};let staged:Record<string,unknown>={};
const host={getSelection:async()=>[{clipId:'a'}],hasStateMotionEffect:async()=>true,getContract:async()=>({schemaVersion:1,bindingRevision:5,parameterCount:70}),enumerateParamIndex:async()=>0,readLogical:async()=>0,beginUndo:async()=>{staged={};},writeLogical:async(_c:any,id:string,value:unknown)=>{staged[id]=value;},endUndo:async()=>{Object.assign(values,staged);},cancelUndo:async()=>{staged={};},applyEffect:async()=>{},removeEffect:async()=>{}};
const report=await new PremiereAdapter(host).applyPresetToSelection(BUNDLED_PRESETS.find(p=>p.presetId==='bundled-quiet-fade')!);
assert.deepEqual(report.applied,['a']);assert.equal(values['transition.mode'],0,'preset restores automatic mode');assert.equal(values['stroke.enabled.a'],false,'preset clears previous FX');assert.equal(values['transform.scaleX.a'],1,'preset clears previous scale');assert.equal(values['transform.opacity.a'],0);
console.log('PASS sparse preset resolves a complete canonical state');
