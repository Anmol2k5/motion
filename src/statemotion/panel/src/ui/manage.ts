import {el,clear} from './components.ts';
import {OperationStatus} from './operationStatus.ts';
import {UxpUserInteraction,type UserInteraction} from '../host/userInteraction.ts';
import {newId} from '../domain/ids.ts';
import {createCollection,renameCollection,deleteCollection,addToCollection,removeFromCollection} from '../domain/collections.ts';
import type {PresetRepository,LibraryModel} from '../domain/presetStorage.ts';
export class ManageView {
 private generation=0;
 private notice='';
 constructor(private repo:PresetRepository,private getLibrary:()=>LibraryModel,private setLibrary:(lib:LibraryModel)=>void,private interaction:UserInteraction=new UxpUserInteraction(),private capture?:()=>Promise<void>){}
 setContainer(_container:HTMLElement){}
 async render(container:HTMLElement):Promise<void>{
  const generation=++this.generation;clear(container);
  const status=new OperationStatus(container);status.element.textContent=this.notice;container.append(status.element);
  let presets;
  try{presets=await this.repo.list();}catch{status.element.textContent='Presets could not be loaded.';return;}
  if(generation!==this.generation)return;
  const save=async(update:(current:LibraryModel)=>LibraryModel)=>{this.setLibrary(await this.repo.updateLibrary(update));};
  const button=(label:string,id:string,run:()=>Promise<void|boolean>)=>{
   const element=el('button',{class:'sm-btn secondary',text:label,'data-action':id});
   element.addEventListener('click',()=>status.run(async()=>{const result=await run();this.notice=result===false?'Canceled.':'Saved.';await this.render(container);}));return element;
  };
  const capture=button('Capture selected clip','capture',async()=>{await this.capture?.();});capture.disabled=!this.capture;
  container.append(el('div',{class:'sm-actionbar'},[
   button('Import preset','import',async()=>{const text=await this.interaction.importPreset();if(text===null)return false;await this.repo.import(text);}),
   capture,
   button('New collection','new-collection',async()=>{const name=await this.interaction.prompt('Collection name');if(name?.trim())await save(library=>createCollection(library,newId('col'),name.trim()));}),
  ]));
  container.append(el('h2',{text:'Collections'}));
  const library=this.getLibrary();
  for(const id of library.collectionIds){const collection=library.collections[id];
   container.append(el('div',{class:'sm-row'},[
    el('span',{text:collection.name}),
    button('Rename','collection-rename',async()=>{const name=await this.interaction.prompt('Rename collection',collection.name);if(name?.trim())await save(library=>renameCollection(library,id,name.trim()));}),
    button('Delete','collection-delete',async()=>{if(await this.interaction.confirm('Delete this collection? Presets are kept.'))await save(library=>deleteCollection(library,id));}),
   ]));
  }
  container.append(el('h2',{text:'Presets'}));
  for(const preset of presets){
   const row=el('div',{class:'sm-managed-preset'},[el('span',{text:preset.name})]);
   row.append(button('Export','export',async()=>{return this.interaction.exportPreset(preset.name.replace(/[^a-z0-9._-]/gi,'_')+'.stmpreset',await this.repo.export(preset.presetId));}));
   row.append(button('Duplicate','duplicate',async()=>{await this.repo.duplicate(preset.presetId);}));
   if(!preset.presetId.startsWith('bundled-')){
    row.append(button('Rename','rename',async()=>{const name=await this.interaction.prompt('Preset name',preset.name);if(name?.trim())await this.repo.update({...preset,name:name.trim(),modifiedAt:new Date().toISOString()});}));
    row.append(button('Delete','delete',async()=>{if(await this.interaction.confirm('Delete this user preset?'))await this.repo.delete(preset.presetId);}));
   }
   for(const id of library.collectionIds){const collection=library.collections[id],member=collection.presetIds.includes(preset.presetId);
    row.append(button((member?'Remove from ':'Add to ')+collection.name,'membership',async()=>{await save(library=>(library.collections[id]?.presetIds.includes(preset.presetId)?removeFromCollection:addToCollection)(library,id,preset.presetId));}));
   }
   container.append(row);
  }
  for(const warning of this.repo.getWarnings?.()??[])container.append(el('p',{class:'sm-warn',text:warning}));
 }
}
