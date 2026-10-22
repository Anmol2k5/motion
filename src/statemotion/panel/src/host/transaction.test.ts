import assert from 'node:assert/strict';
import { PremiereAdapter } from './premiereAdapter.ts';
import { BUNDLED_PRESETS } from '../starter/bundledPresets.ts';
import { BINDING_REVISION,PARAMETER_COUNT,SCHEMA_VERSION } from '../domain/presetSchema.ts';
const contract={schemaVersion:SCHEMA_VERSION,bindingRevision:BINDING_REVISION,parameterCount:PARAMETER_COUNT};
const committed:Record<string,unknown>={};let staged:Record<string,unknown>|null=null;let commits=0,cancels=0;let fail=true;
const host={
 getSelection:async()=>[{clipId:'a'},{clipId:'b'}], hasStateMotionEffect:async()=>true,getContract:async()=>contract,
 enumerateParamIndex:async()=>0,readLogical:async()=>0,
 beginUndo:async()=>{assert.equal(staged,null,'no nested transaction');staged={};},
 writeLogical:async(clip:{clipId:string},id:string,value:unknown)=>{await Promise.resolve();if(fail&&clip.clipId==='a'&&id==='transform.scaleY.a')throw Error('injected');staged![clip.clipId+id]=value;},
 endUndo:async()=>{commits++;Object.assign(committed,staged);staged=null;},cancelUndo:async()=>{cancels++;staged=null;},applyEffect:async()=>{},removeEffect:async()=>{},
};
const adapter=new PremiereAdapter(host);
const preset={...BUNDLED_PRESETS[0],parameters:{'transform.scaleX.a':.5,'transform.scaleY.a':.5}};
let report;
try{report=await adapter.applyPresetToSelection(preset);}catch{}
assert.equal(cancels,1,'failed staged clip must cancel');assert.equal(commits,1,'successful next clip must commit');
assert.deepEqual(report?.failed,['a']);assert.deepEqual(report?.applied,['b']);
assert.equal(Object.keys(committed).some(x=>x.startsWith('a')),false,'failed clip commits nothing');
fail=false;
await Promise.all([adapter.writeLogical({clipId:'a'},'transition.curveX1',.2),adapter.writeLogical({clipId:'a'},'transition.curveX2',.7)]);
const before=commits;
await adapter.writeParameters({clipId:'a'},{'transition.curveX1':.2,'transition.curveY1':.1,'transition.curveX2':.7,'transition.curveY2':.9});
assert.equal(commits,before+1,'curve must be one transaction');
const invalid=await adapter.applyPresetToSelection({...preset,parameters:{'contract.schemaVersion':1}});
assert.deepEqual(invalid.applied,[]);
await assert.rejects(()=>adapter.writeLogical({clipId:'stale'},'transition.easing',2),/selection/i);
console.log('PASS cancellation, partial bulk result, serialized edits, curve atomicity, validation, stale selection');
