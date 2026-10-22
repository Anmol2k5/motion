// Windows-only native rebuild. Never installs plugins or certifies Premiere behavior.
import {spawnSync} from 'node:child_process';
import {existsSync,statSync,readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(import.meta.dirname,'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const text=result=>(result.stdout??'')+(result.stderr??'')+(result.error?.message??'');
export function preflightNative({platform=process.platform,sdk=process.env.STATEMOTION_SDK,msbuild=process.env.STATEMOTION_MSBUILD||'MSBuild.exe',run=spawnSync}={}){
 const blockers=[],tools={};
 if(platform!=='win32')blockers.push('Native build requires Windows x64 with a Visual Studio x64 developer environment.');
 if(!sdk)blockers.push('Set STATEMOTION_SDK to the official Adobe After Effects Effect SDK root.');
 else {
  for(const file of ['Examples/Headers/AE_Effect.h','Examples/Headers/AE_Macros.h','Examples/Resources/PiPLTool.exe']){
   const full=path.join(sdk,file);if(!existsSync(full)||!statSync(full).isFile())blockers.push('Missing SDK file: '+file);
  }
  for(const dir of ['Examples/Headers/SP','Examples/Headers/Win','Examples/Util']){
   const full=path.join(sdk,dir);if(!existsSync(full)||!statSync(full).isDirectory())blockers.push('Missing SDK directory: '+dir);
  }
 }
 if(platform==='win32')for(const [command,args] of [[msbuild,['/version','/nologo']],['cl.exe',['/?']]]){
  const result=run(command,args,{encoding:'utf8',shell:false});tools[command]=text(result);
  if(result.status!==0)blockers.push(`Cannot run ${command}; use an x64 Visual Studio developer prompt with the v142 toolset and Windows SDK.`);
 }
 return {ready:blockers.length===0,blockers,tools,hostValidation:'NOT_YET_TESTED'};
}
export function buildNative({root=repo,sdk=process.env.STATEMOTION_SDK,platform=process.platform,msbuild=process.env.STATEMOTION_MSBUILD||'MSBuild.exe',run=spawnSync,outputRoot=path.join(root,'build/native-validation')}={}){
 const readiness=preflightNative({platform,sdk,msbuild,run});
 if(!readiness.ready)throw Error(readiness.blockers.join('\n'));
 mkdirSync(outputRoot,{recursive:true});const runDir=mkdtempSync(path.join(outputRoot,'run-'));
 const evidence={status:'failed',startedAt:new Date().toISOString(),runDir,configuration:'Release',platform:'x64',hostValidation:'NOT_YET_TESTED',tools:readiness.tools};
 const save=()=>writeFileSync(path.join(runDir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 try{
  const git=args=>{
   const result=run('git',args,{cwd:root,encoding:'utf8',shell:false});
   if(result.status!==0)throw Error('Cannot record source provenance: '+text(result));return result.stdout.trim();
  };
  evidence.source={commit:git(['rev-parse','HEAD']),dirty:git(['status','--porcelain']).length>0};
  const contract=JSON.parse(readFileSync(path.join(root,'shared/schema/parameter-contract.json'),'utf8'));
  evidence.contract={schemaVersion:contract.schemaVersion,bindingRevision:contract.bindingRevision,parameterCount:contract.parameters.length};
  evidence.sdk={effectHeaderSha256:digest(readFileSync(path.join(sdk,'Examples/Headers/AE_Effect.h'))),piplToolSha256:digest(readFileSync(path.join(sdk,'Examples/Resources/PiPLTool.exe')))};
  const contractCheck=run(process.execPath,['tools/generate-contract.js','--check'],{cwd:root,encoding:'utf8',shell:false});
  writeFileSync(path.join(runDir,'contract.log'),text(contractCheck));
  if(contractCheck.status!==0)throw Error('Generated contract check failed; see contract.log');
  const output=path.join(runDir,'bin'),intermediate=path.join(runDir,'obj');
  mkdirSync(output);mkdirSync(intermediate);
  const args=[path.join(root,'src/statemotion/adobe/statemotion_effect.sln'),'/t:Rebuild','/p:Configuration=Release','/p:Platform=x64',`/p:OutDir=${output}${path.sep}`,`/p:IntDir=${intermediate}${path.sep}`,'/nologo'];
  evidence.command={executable:msbuild,args};save();
  const result=run(msbuild,args,{cwd:root,encoding:'utf8',shell:false,maxBuffer:32*1024*1024,env:{...process.env,STATEMOTION_SDK:sdk}});
  writeFileSync(path.join(runDir,'build.log'),text(result));evidence.buildExitCode=result.status;
  if(result.status!==0)throw Error('Native build failed; see build.log');
  const binary=path.join(output,'StateMotion.aex');if(!existsSync(binary))throw Error('Native output missing after rebuild');
  const bytes=readFileSync(binary),pe=bytes.length>=64?bytes.readUInt32LE(60):0;
  if(bytes.length<64||bytes.toString('ascii',0,2)!=='MZ'||pe<64||pe+24>bytes.length||bytes.toString('ascii',pe,pe+4)!=='PE\0\0'||bytes.readUInt16LE(pe+4)!==0x8664||(bytes.readUInt16LE(pe+22)&0x2000)===0)throw Error('Native output must be an AMD64 PE DLL');
  evidence.binary={path:binary,bytes:bytes.length,sha256:digest(bytes)};
  const checklist=readFileSync(path.join(root,'docs/releases/v0.1-alpha-test-checklist.md'),'utf8');
  writeFileSync(path.join(runDir,'host-checklist.md'),`# Desktop validation for this build\n\nSource commit: ${evidence.source.commit}\nSource has uncommitted changes: ${evidence.source.dirty}\nNative SHA-256: ${evidence.binary.sha256}\nBinding revision: ${evidence.contract.bindingRevision}\n\nOperator: NOT RECORDED\nPremiere version: NOT RECORDED\nSDK version: NOT RECORDED (identify your installed SDK; hashes are in evidence.json)\nInstalled native SHA-256: NOT RECORDED\nEvidence attachments: NOT RECORDED\n\nAll host results: NOT YET TESTED. Build success does not close any host gate.\nRecord actual steps/results and attachment paths beside checked items.\n\n${checklist}`);
  evidence.status='built';
  return evidence;
 }catch(error){evidence.error=error.message;throw error;}
 finally{evidence.finishedAt=new Date().toISOString();save();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.slice(2).some(arg=>arg!=='--check'))throw Error('Usage: node tools/build-native.mjs [--check]');
  const result=process.argv.includes('--check')?preflightNative():buildNative();
  console.log(JSON.stringify(result,null,2));if(result.ready===false)process.exitCode=1;
 }catch(error){console.error(error.message);process.exitCode=1;}
}
