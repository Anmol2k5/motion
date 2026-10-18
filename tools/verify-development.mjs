// Every child keeps its exit status; logs identify one current verification run.
import {spawnSync} from 'node:child_process';
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
export function runCheck(label,command,args,{cwd=root,logDir}={}){
 if(!logDir)throw Error('A verification log directory is required');mkdirSync(logDir,{recursive:true});
 const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024,shell:false});
 const output=(result.stdout??'')+(result.stderr??'')+(result.error?.message??'');
 const file=path.join(logDir,label.replace(/[^a-z0-9._-]/gi,'_')+'.log');writeFileSync(file,output);
 if(result.status!==0){const error=new Error(`${label} failed; ${file}\n${output.slice(-2000)}`);error.status=result.status||1;throw error;}
 console.log('PASS '+label);return output;
}
function suites(dir){return readdirSync(path.join(root,dir)).filter(name=>name.endsWith('_test.cpp')).sort().map(name=>path.join(dir,name));}
export function verifyDevelopment(){
 if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js 24 or newer is required');
 const logDir=path.join(root,'build/verification','run-'+Date.now()),bin=path.join(logDir,'bin');mkdirSync(bin,{recursive:true});
 const check=(label,command,args,options={})=>runCheck(label,command,args,{logDir,...options});
 check('contract-check',process.execPath,['tools/generate-contract.js','--check']);
 check('contract-tests',process.execPath,['tools/generate-contract.test.js']);
 check('typescript-progress',process.execPath,['--experimental-transform-types','src/statemotion/progress/progressEngine.test.ts']);
 const native=['src/statemotion/renderer','src/statemotion/progress','src/statemotion/adobe'].flatMap(suites);
 if(!native.length)throw Error('No native test suites discovered');
 for(const source of native){
  const name=path.basename(source,'.cpp'),binary=path.join(bin,name+(process.platform==='win32'?'.exe':''));
  check('build-'+name,process.env.CXX||'g++',['-std=c++17','-O2','-I','src/statemotion/renderer','-I','src/statemotion/progress','-I','src/statemotion/adobe','-I','shared/generated',source,'src/statemotion/renderer/transform_render.cpp','src/statemotion/progress/progress_engine.cpp','src/statemotion/progress/easing.cpp','-o',binary]);
  check(name,binary,[]);
 }
 const npm=process.platform==='win32'?'npm.cmd':'npm',panel=path.join(root,'src/statemotion/panel');
 check('panel-typecheck',npm,['run','typecheck'],{cwd:panel});
 const output=check('panel-tests',npm,['test'],{cwd:panel});
 const count=Number(output.match(/ALL TEST SUITES PASSED \((\d+)\)/)?.[1]);if(!count)throw Error('Panel tests did not report completed nonzero suites');
 check('panel-build',npm,['run','build'],{cwd:panel});
 check('package-tests',process.execPath,['tools/package-panel.test.mjs']);
 check('verification-runner-tests',process.execPath,['tools/verify-development.test.mjs']);
 const project=readFileSync(path.join(root,'src/statemotion/adobe/statemotion_effect.vcxproj'),'utf8');
 const sources=[...project.matchAll(/<ClCompile Include="([^"]+)"/g)].map(match=>match[1]);
 if(new Set(sources).size!==sources.length)throw Error('Duplicate native MSBuild source entries');
 const summary={nativeSuites:native.length,panelSuites:count,result:'passed',logDir,nativeAdobeBuild:'not run: requires supported desktop and SDK'};
 writeFileSync(path.join(logDir,'summary.json'),JSON.stringify(summary,null,2));writeFileSync(path.join(root,'build/verification/latest.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{verifyDevelopment();}catch(error){console.error(error.message);process.exitCode=error.status||1;}
