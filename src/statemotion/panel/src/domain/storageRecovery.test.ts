import assert from 'node:assert/strict';
import { PresetRepository } from './presetStorage.ts';
import { BUNDLED_PRESETS } from '../starter/bundledPresets.ts';
import { buildLibraryViewModel } from './libraryModel.ts';
import { FilterKind,SortKind } from './search.ts';
class Memory {
 files=new Map<string,string>(); failBackup=false; failLibrary=false;
 async readFile(p:string){if(!this.files.has(p))throw Error('missing');return this.files.get(p)!;}
 async writeFile(p:string,v:string){if((this.failBackup&&p.includes('backup'))||(this.failLibrary&&p.endsWith('library.json')))throw Error('disk failure');this.files.set(p,v);}
 async exists(p:string){return this.files.has(p);} async mkdir(){}
 async deleteFile(p:string){this.files.delete(p);}
 async listFiles(p:string){return [...this.files.keys()].filter(x=>x.startsWith(p+'/'));}
}
const fs=new Memory();fs.files.set('data/library.json','BROKEN');const repo=new PresetRepository(fs,'data');await repo.init();
assert.equal([...fs.files].some(([p,v])=>p.includes('backup')&&v==='BROKEN'),true,'corrupt original must be backed up');
const broken=new Memory();broken.files.set('data/library.json','ORIGINAL');broken.failBackup=true;
await assert.rejects(()=>new PresetRepository(broken,'data').init());assert.equal(broken.files.get('data/library.json'),'ORIGINAL');
const before=repo.getLibrary();fs.failLibrary=true;
await assert.rejects(()=>repo.saveLibrary({...before,recentlyUsed:['x']}));assert.deepEqual(repo.getLibrary(),before);fs.failLibrary=false;
await repo.installBundled(BUNDLED_PRESETS);const stamp=Date.now;Date.now=()=>42;
try{const copies=await Promise.all(Array.from({length:8},()=>repo.duplicate(BUNDLED_PRESETS[0].presetId)));assert.equal(new Set(copies.map(x=>x.presetId)).size,8);}finally{Date.now=stamp;}
const lib=repo.getLibrary();lib.collectionIds=['col-test'];lib.collections['col-test']={id:'col-test',name:'Test',presetIds:[BUNDLED_PRESETS[0].presetId]};
assert.equal(buildLibraryViewModel(BUNDLED_PRESETS,lib,{query:'',filter:FilterKind.Collection,collectionId:'col-test',sort:SortKind.AZ},[]).presets.length,1);
console.log('PASS backups, failed recovery, memory durability, concurrent IDs, collection membership');
