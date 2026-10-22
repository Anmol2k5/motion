import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installDom,TestElement} from '../testing/dom.ts';
import {MemoryFs} from '../testing/memoryFs.ts';
import {PresetRepository} from '../domain/presetStorage.ts';
import {startPanel} from '../bootstrap.ts';
import {BUNDLED_PRESETS} from '../starter/bundledPresets.ts';
async function setup(){
 const {container}=installDom(),fs=new MemoryFs(),repo=new PresetRepository(fs,'data');
 const adapter={detectSelection:async()=>({supported:[{clipId:'a'}],unsupported:[]}),getContract:async()=>({schemaVersion:1,bindingRevision:5,parameterCount:70}),applyPresetToSelection:async()=>({applied:['a'],failed:[],skipped:[],reasons:{}})};
 const interaction={prompt:async()=>null,confirm:async()=>true,importPreset:async()=>null,exportPreset:async()=>false};
 await startPanel(container,{repo,adapter,interaction} as never);return {root:container as unknown as TestElement,fs,repo};
}
await test('favorites survive navigation during a pending metadata save',async()=>{
 const {root,fs,repo}=await setup();let release:()=>void=()=>{},started:()=>void=()=>{};
 const blocked=new Promise<void>(resolve=>release=resolve),writing=new Promise<void>(resolve=>started=resolve);let firstWrite=true;
 fs.beforeWrite=async path=>{if(path.endsWith('library.json')&&firstWrite){firstWrite=false;started();await blocked;}};
 const first=root.querySelector('[aria-label="Favorite Soft Arrival"]')!.click();await writing;
 await root.querySelector('[data-tab="diagnostics"]')!.click();await root.querySelector('[data-tab="library"]')!.click();
 const second=root.querySelector('[aria-label="Favorite Quiet Fade"]')!.click();release();await Promise.all([first,second]);
 assert.equal(repo.getLibrary().favoritePresetIds.includes('bundled-soft-arrival'),true,'first successful favorite retained');
 assert.equal(repo.getLibrary().favoritePresetIds.includes('bundled-quiet-fade'),true,'second successful favorite retained');
});
await test('deleting a preset cannot resurrect favorite/recent references',async()=>{
 const {root,repo}=await setup();await repo.create({...BUNDLED_PRESETS[0],presetId:'user-delete',name:'Delete Me'});
 await root.querySelector('[data-tab="library"]')!.click();await root.querySelector('[aria-label="Favorite Delete Me"]')!.click();await root.querySelector('[aria-label="Delete Me"]')!.click();
 await root.querySelector('[data-tab="manage"]')!.click();await root.querySelector('[data-action="delete"]')!.click();
 await root.querySelector('[data-tab="library"]')!.click();await root.querySelector('[aria-label="Favorite Soft Arrival"]')!.click();
 assert.equal(repo.getLibrary().favoritePresetIds.includes('user-delete'),false);
 assert.equal(repo.getLibrary().recentlyUsed.includes('user-delete'),false);
});
