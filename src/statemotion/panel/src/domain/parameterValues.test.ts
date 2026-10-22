import assert from 'node:assert/strict';
import { validatePreset, deserializePreset, defaultValueFor } from './presetSchema.ts';
import { BUNDLED_PRESETS } from '../starter/bundledPresets.ts';
const valid=BUNDLED_PRESETS[0];
for(const bad of [
 {...valid,name:123}, {...valid,presetId:'../escape'}, {...valid,compatibleContract:null},
 {...valid,parameters:null},{...valid,parameters:[]},{...valid,tags:[1]},
 {...valid,parameters:{'transform.scaleX.a':{bad:true}}},
 {...valid,parameters:{'transform.opacity.a':2}},
 {...valid,parameters:{'transform.rotation.a':NaN}},
 {...valid,parameters:{'contract.schemaVersion':1}},
 {...valid,parameters:{'stroke.color1.a':'javascript:bad'}},
 {...valid,parameters:{'transform.position.a':{x:NaN,y:0}}},
 {...valid,parameters:{'transition.mode':99}},
]) assert.equal(validatePreset(bad).ok,false,'malformed preset must fail: '+JSON.stringify(bad));
assert.throws(()=>deserializePreset(JSON.stringify({...valid,schemaVersion:999,compatibleContract:{schemaVersion:999,bindingRevision:999,parameterCount:999}})),/unsupported|incompatible/i);
for(const preset of BUNDLED_PRESETS)assert.equal(validatePreset(preset).ok,true,preset.name);
console.log('PASS strict malformed/future presets and bundled originals');
assert.equal(defaultValueFor('transform.scaleX.a'),1);
assert.equal(defaultValueFor('transform.opacity.a'),1);
assert.equal(defaultValueFor('shadow.angle.a'),Math.PI*3/4);
assert.equal(defaultValueFor('stroke.color1.a'),'#ffffff','named schema color default must become canonical RGB');
const {BINDINGS}=await import('../../../../../shared/generated/parameterBindings.ts');
const {validateParameterValues}=await import('./parameterValues.ts');
const defaults=Object.fromEntries(BINDINGS.filter(b=>b.stateOwnership!=='metadata').map(b=>[b.logicalId,defaultValueFor(b.logicalId)]));
assert.equal(validateParameterValues(defaults).ok,true,'complete generated defaults must satisfy canonical validation');
