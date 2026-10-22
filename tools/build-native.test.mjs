import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const moduleFile=path.join(import.meta.dirname,'build-native.mjs');
assert.ok((await import('node:fs')).existsSync(moduleFile),'native build/evidence runner must exist');
const {buildNative,preflightNative}=await import('./build-native.mjs');
const root=path.resolve(import.meta.dirname,'..'),temp=mkdtempSync(path.join(tmpdir(),'sm-native-'));
try{
 const sdk=path.join(temp,'SDK with spaces');
 for(const file of ['Examples/Headers/AE_Effect.h','Examples/Headers/AE_Macros.h','Examples/Resources/PiPLTool.exe']){mkdirSync(path.dirname(path.join(sdk,file)),{recursive:true});writeFileSync(path.join(sdk,file),'sdk fixture');}
 for(const dir of ['Examples/Headers/SP','Examples/Headers/Win','Examples/Util'])mkdirSync(path.join(sdk,dir),{recursive:true});
 assert.ok(preflightNative({platform:'linux',sdk,run:()=>{throw Error('must not execute Windows commands');}}).blockers.some(s=>/Windows/.test(s)));
 assert.ok(preflightNative({platform:'win32',sdk:'',run:()=>({status:0,stdout:'tool'})}).blockers.some(s=>/STATEMOTION_SDK/.test(s)));
 assert.equal(preflightNative({platform:'win32',sdk,run:()=>({status:1,stderr:'not found'})}).ready,false);
 assert.equal(preflightNative({platform:'win32',sdk:path.join(temp,'missing'),run:()=>({status:0})}).ready,false);
 let mode='success',builds=0;
 const run=(command,args,options)=>{
  assert.equal(options.shell,false,'paths and arguments cannot be shell-interpolated');
  if(command==='git')return {status:0,stdout:args[0]==='rev-parse'?'a'.repeat(40)+'\n':''};
  if(args.includes('/t:Rebuild')){
   builds++;
   if(mode==='fail')return {status:17,stderr:'compiler failed'};
   const output=args.find(a=>a.startsWith('/p:OutDir=')).slice('/p:OutDir='.length);
   if(mode!=='missing'){
    const bytes=Buffer.alloc(256);bytes.write('MZ');bytes.writeUInt32LE(128,60);bytes.write('PE\0\0',128);bytes.writeUInt16LE(mode==='wrong-machine'?0x14c:0x8664,132);bytes.writeUInt16LE(0x2000,150);
    mkdirSync(output,{recursive:true});writeFileSync(path.join(output,'StateMotion.aex'),bytes);
   }
   return {status:0,stdout:'build finished'};
  }
  return {status:0,stdout:'tool available'};
 };
 const options={root,sdk,platform:'win32',run,outputRoot:path.join(temp,'runs')};
 const first=buildNative(options),second=buildNative(options);
 assert.notEqual(first.runDir,second.runDir,'each build must reject stale output by isolation');
 assert.equal(first.status,'built');assert.equal(first.hostValidation,'NOT_YET_TESTED');
 assert.equal(first.contract.parameterCount,70);assert.equal(first.contract.bindingRevision,5);
 assert.match(first.binary.sha256,/^[a-f0-9]{64}$/);assert.equal(first.source.commit,'a'.repeat(40));
 assert.equal(JSON.parse(readFileSync(path.join(first.runDir,'evidence.json'))).status,'built');
 for(const failure of ['fail','missing','wrong-machine']){
  mode=failure;assert.throws(()=>buildNative(options),/failed|missing|AMD64/i);
 }
 assert.equal(builds,5);
 const reports=readdirSync(options.outputRoot).map(dir=>JSON.parse(readFileSync(path.join(options.outputRoot,dir,'evidence.json'))));
 assert.equal(reports.filter(r=>r.status==='failed').length,3,'failed builds retain failed evidence');
 assert.ok(reports.every(r=>r.hostValidation==='NOT_YET_TESTED'));
 assert.match(readFileSync(path.join(first.runDir,'host-checklist.md'),'utf8'),new RegExp(first.binary.sha256));
 const project=readFileSync(path.join(root,'src/statemotion/adobe/statemotion_effect.vcxproj'),'utf8');
 for(const event of project.matchAll(/<PreBuildEvent>\s*<Command>([\s\S]*?)<\/Command>/g)){
  assert.equal((event[1].match(/if errorlevel 1 exit \/b/g)??[]).length,3,'each PiPL pipeline step must stop on failure');
 }
}finally{rmSync(temp,{recursive:true,force:true});}
console.log('PASS native preflight, isolated build evidence, failure propagation, stale/malformed binary rejection and PiPL failure guards (simulated Windows toolchain)');
