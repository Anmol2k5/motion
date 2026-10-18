// Browser DOM smoke with an explicitly fake Adobe host; never host certification.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'build/browser-smoke');mkdirSync(output,{recursive:true});
const temp=mkdtempSync(path.join(tmpdir(),'statemotion-browser-'));
const bindingSource=readFileSync(path.join(root,'shared/generated/parameterBindings.ts'),'utf8');
const bindings=[...bindingSource.matchAll(/  \{ logicalId: (.+) \},/g)].map(match=>Function('return ({logicalId:'+match[1]+'})')());
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root,'src/statemotion/panel/dist/main.css'))}"></head><body><div id="app"></div><pre id="smoke-result"></pre><script>
const bindings=${JSON.stringify(bindings)};
class Folder{constructor(name=''){this.name=name;this.entries=new Map()}async getEntry(name){if(!this.entries.has(name))throw Error('missing');return this.entries.get(name)}async createFolder(name){const folder=new Folder(name);this.entries.set(name,folder);return folder}async createFile(name){const parent=this,file={name,text:'',async read(){return this.text},async write(text){this.text=text},async delete(){parent.entries.delete(name)}};this.entries.set(name,file);return file}async getEntries(){return [...this.entries.values()]}}
const data=new Folder();class PointF{constructor(x,y){this.x=x;this.y=y}}class Color{constructor(red,green,blue,alpha=1){Object.assign(this,{red,green,blue,alpha})}}
const components=[];let commits=0;
function makeEffect(){const values=bindings.map(b=>b.nativeType==='POPUP'?b.defaultVal+1:b.nativeType==='POINT'?new PointF(50,50):b.nativeType==='ANGLE'?b.defaultVal*180/Math.PI:b.nativeType==='COLOR'?new Color(1,1,1):b.defaultVal);return {values,getMatchName:async()=> 'AE.io.github.anmol2k5.statemotion.effect',getParamCount:()=>bindings.length,getParam(index){return {displayName:bindings[index].wireName,getStartValue:async()=>({value:{value:values[index]}}),createKeyframe:value=>({value:{value}}),createSetValueAction:key=>({run:()=>values[index]=key.value.value})}}}}
const chain={getComponentCount:()=>components.length,getComponentAtIndex:i=>components[i],createAppendComponentAction:effect=>({run:()=>components.push(effect)}),createRemoveComponentAction:effect=>({run:()=>components.splice(components.indexOf(effect),1)})};
const item={getComponentChain:async()=>chain};const project={getActiveSequence:async()=>({getSelection:async()=>({getTrackItems:async()=>[item]})}),executeTransaction(callback){const actions=[];callback({addAction(action){actions.push(action);return true}});actions.forEach(action=>action.run());commits++;return true}};
window.require=name=>name==='premierepro'?{Project:{getActiveProject:async()=>project},VideoFilterFactory:{createComponent:async()=>makeEffect()},PointF,Color}:name==='uxp'?{storage:{localFileSystem:{getDataFolder:async()=>data,getFileForOpening:async()=>null,getFileForSaving:async()=>null}}}:null;
delete window.DOMParser;delete window.structuredClone;
window.addEventListener('error',event=>{document.getElementById('smoke-result').textContent='FAIL '+event.message});
</script><script src="${pathToFileURL(path.join(root,'src/statemotion/panel/dist/main.js'))}"></script><script>
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{try{
await wait(150);const card=document.querySelector('.sm-card');if(!card)throw Error('Library did not render');card.click();await wait(80);if(components.length!==1)throw Error('Apply did not add effect');
document.querySelector('[data-tab="inspector"]').click();await wait(80);const scale=document.querySelector('[data-param="transform.scaleX.a"]');if(!scale)throw Error('Inspector missing');scale.value='125.5';scale.dispatchEvent(new Event('change'));await wait(80);
if(components[0].values[bindings.findIndex(b=>b.logicalId==='transform.scaleX.a')]!==125.49999999999999&&Math.abs(components[0].values[bindings.findIndex(b=>b.logicalId==='transform.scaleX.a')]-125.5)>1e-8)throw Error('Canonical edit did not reach host seam');
if(!document.querySelector('svg'))throw Error('Curve SVG absent');
document.querySelector('[data-tab="manage"]').click();await wait(80);if(!document.querySelector('[data-action="import"]'))throw Error('Manage did not render');
document.querySelector('[data-tab="inspector"]').click();await wait(80);
const result=document.getElementById('smoke-result');result.textContent='PASS fake-host browser: preset apply, inspector, canonical write, tab routing, SVG';result.dataset.status='passed';
}catch(error){document.getElementById('smoke-result').textContent='FAIL '+error.message}})();
</script></body></html>`;
const file=path.join(temp,'smoke.html');writeFileSync(file,html);
const server=createServer((request,response)=>{
 if(request.url==='/smoke.html'){response.setHeader('Content-Type','text/html');response.end(html.replaceAll(pathToFileURL(path.join(root,'src/statemotion/panel/dist/main.css')).href,'/main.css').replaceAll(pathToFileURL(path.join(root,'src/statemotion/panel/dist/main.js')).href,'/main.js'));}
 else if(request.url==='/main.js'||request.url==='/main.css'){response.setHeader('Content-Type',request.url.endsWith('.js')?'application/javascript':'text/css');response.end(readFileSync(path.join(root,'src/statemotion/panel/dist',request.url.slice(1))));}
 else{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const pageUrl='http://127.0.0.1:'+server.address().port+'/smoke.html';
const browser=spawn(process.env.CHROMIUM||'chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(temp,'profile'),'about:blank'],{env:{...process.env,XDG_CACHE_HOME:path.join(temp,'cache')},stdio:['ignore','ignore','pipe']});
let stderr='',socket;
try{
 const endpoint=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Chromium startup timeout')),15000);
  browser.on('error',error=>{clearTimeout(timer);reject(error);});
  browser.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
 });
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const waiter=pending.get(message.id);if(waiter){pending.delete(message.id);message.error?waiter.reject(Error(message.error.message)):waiter.resolve(message.result);}}});
 const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await command('Target.createTarget',{url:pageUrl});
 const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 await command('Emulation.setDeviceMetricsOverride',{width:420,height:900,deviceScaleFactor:1,mobile:false},sessionId);
 await command('Page.enable',{},sessionId);
 const result=await command('Runtime.evaluate',{expression:`new Promise(resolve=>{const poll=()=>{const status=document.getElementById('smoke-result');if(status?.dataset.status==='passed'||status?.textContent.startsWith('FAIL'))resolve({status:status.dataset.status,text:status.textContent,html:document.documentElement.outerHTML});else setTimeout(poll,50)};poll();setTimeout(()=>resolve({status:'timeout',text:document.body?.textContent,html:document.documentElement.outerHTML}),10000)})`,awaitPromise:true,returnByValue:true},sessionId);
 const report=result.result?.value;writeFileSync(path.join(output,'dom.html'),report?.html??JSON.stringify(result));
 if(report?.status!=='passed')throw Error('Browser smoke failed: '+report?.text);
 const screenshot=await command('Page.captureScreenshot',{format:'png'},sessionId);writeFileSync(path.join(output,'inspector.png'),Buffer.from(screenshot.data,'base64'));
 console.log('PASS actual Chromium DOM with fake Adobe host; screenshot: '+path.join(output,'inspector.png'));
}finally{server.close();writeFileSync(path.join(output,'browser.log'),stderr);socket?.close();browser.kill('SIGTERM');await new Promise(resolve=>{if(browser.exitCode!==null)resolve();else{browser.once('exit',resolve);setTimeout(()=>{browser.kill('SIGKILL');resolve();},2000).unref();}});rmSync(temp,{recursive:true,force:true});}
