import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const cwd=path.resolve(import.meta.dirname,'../src/statemotion/panel');
for(const args of [['run','gen:contract','--','--check'],['run','gen:presets']]){
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
}
console.log('PASS documented npm generator commands');
