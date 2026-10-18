import assert from 'node:assert/strict';
import { UxpHostBridge } from './uxpHost.ts';
import { BINDINGS } from '../../../../../shared/generated/parameterBindings.ts';
const bindings=[...BINDINGS].reverse();const values=new Map(bindings.map(b=>[b.logicalId,b.defaultVal]));
const component={getMatchName:async()=> 'AE.io.github.anmol2k5.statemotion.effect',getParamCount:()=>bindings.length,getParam:(index:number)=>{
 const b=bindings[index];return {displayName:b.wireName,getStartValue:async()=>({value:{value:values.get(b.logicalId)}}),createKeyframe:(value:unknown)=>value,createSetValueAction:(value:any)=>({run:()=>values.set(b.logicalId,value)})};
}};
const item={getComponentChain:async()=>({getComponentCount:()=>1,getComponentAtIndex:()=>component,createAppendComponentAction:()=>{}})};
let commits=0;
const project={getActiveSequence:async()=>({getSelection:async()=>({getTrackItems:async()=>[item]})}),executeTransaction:(f:any)=>{commits++;f({addAction:(a:any)=>{a.run();return true;}});return true;}};
class Color {constructor(public red:number,public green:number,public blue:number,public alpha:number){}}
const bridge=new UxpHostBridge({Project:{getActiveProject:async()=>project},Color} as never);
const [clip]=await bridge.getSelection();
assert.deepEqual(await bridge.getContract(clip),{schemaVersion:1,parameterCount:70,bindingRevision:4},'metadata resolves by identity');
assert.equal(await bridge.enumerateParamIndex(clip,'SM Manual Progress'),bindings.findIndex(x=>x.logicalId==='transition.manualProgress'));
await bridge.beginUndo('cancel test');await bridge.writeLogical(clip,'transition.manualProgress',.4);await bridge.cancelUndo();
assert.equal(commits,0);assert.equal(values.get('transition.manualProgress'),0);
await bridge.writeLogical(clip,'transition.manualProgress',.5);assert.equal(values.get('transition.manualProgress'),50);
console.log('PASS shuffled runtime binding and canceled staged actions');
await bridge.writeLogical(clip,'stroke.color1.a','#ff8000');
const color=values.get('stroke.color1.a') as unknown as Color;
assert.equal(color.red,1);assert.equal(color.green,128/255);assert.equal(color.blue,0);
assert.equal(await bridge.readLogical(clip,'stroke.color1.a'),'#ff8000');
