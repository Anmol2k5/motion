import assert from 'node:assert/strict';
import {PremiereAdapter} from './premiereAdapter.ts';
import {BUNDLED_PRESETS} from '../starter/bundledPresets.ts';
for(const phase of ['prepare','stage'])for(const action of ['edit','apply']){
 let selected='a',commits=0,cancels=0;
 const host={getSelection:async()=>[{clipId:selected}],hasStateMotionEffect:async()=>true,getContract:async()=>({schemaVersion:1,bindingRevision:5,parameterCount:70}),
 enumerateParamIndex:async()=>{if(phase==='prepare')selected='b';return 0;},readLogical:async()=>0,
 beginUndo:async()=>{},writeLogical:async()=>{if(phase==='stage')selected='b';},endUndo:async()=>{commits++;},cancelUndo:async()=>{cancels++;},applyEffect:async()=>{},removeEffect:async()=>{}};
 const adapter=new PremiereAdapter(host);
 if(action==='edit')await adapter.writeLogical({clipId:'a'},'transform.scaleX.a',1.2).catch(()=>{});else await adapter.applyPresetToSelection(BUNDLED_PRESETS[0]);
 assert.equal(commits,0,phase+' '+action+' cannot commit stale selection');assert.equal(cancels,1);
}
console.log('PASS selection changes during preparation/staging cancel at commit boundary');
