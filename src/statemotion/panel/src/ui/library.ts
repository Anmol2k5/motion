import {el,clear,svgFromString} from './components.ts';
import {OperationStatus} from './operationStatus.ts';
import {CATEGORIES} from '../starter/bundledPresets.ts';
import {buildLibraryViewModel,type LibraryViewState} from '../domain/libraryModel.ts';
import {FilterKind,SortKind} from '../domain/search.ts';
import {renderPreviewSvg} from '../preview/previewCard.ts';
import type {PresetRepository,LibraryModel} from '../domain/presetStorage.ts';
import type {StateMotionPreset} from '../domain/presetSchema.ts';
import type {ApplyReport} from '../host/premiereAdapter.ts';
export interface LibraryCallbacks {
 onApply:(preset:StateMotionPreset)=>void|Promise<void|ApplyReport>;
 onToggleFavorite:(id:string)=>void|Promise<void>;
 getSelectionCount:()=>number|Promise<number>;
}
export class LibraryView {
 private view:LibraryViewState={query:'',filter:FilterKind.All,sort:SortKind.AZ};
 private listMode=false;
 private generation=0;
 constructor(private repo:PresetRepository,private getLibrary:()=>LibraryModel,private cb:LibraryCallbacks){}
 setContainer(_container:HTMLElement){}
 async render(container:HTMLElement):Promise<void>{
  const generation=++this.generation;clear(container);
  const status=new OperationStatus(container),grid=el('div',{class:'sm-grid'}),chips=el('div',{class:'sm-chips'});
  const search=el('input',{class:'sm-search',type:'search',value:this.view.query,'aria-label':'Search presets',placeholder:'Search presets'});
  const sort=el('select',{'aria-label':'Sort presets',class:'sm-select'});
  for(const [label,value] of [['A–Z',SortKind.AZ],['Newest',SortKind.Newest],['Recently used',SortKind.RecentlyUsed]])sort.append(el('option',{text:label,value}));sort.value=this.view.sort;
  let refreshId=0;
  const refresh=async()=>{
   const request=++refreshId;
   try{
    const all=await this.repo.list();if(generation!==this.generation||request!==refreshId)return;
    const lib=this.getLibrary(),model=buildLibraryViewModel(all,lib,this.view,CATEGORIES);
    clear(grid);clear(chips);grid.className=this.listMode?'sm-list':'sm-grid';
    const chip=(text:string,filter:FilterKind,category?:string,collectionId?:string)=>{
     const active=this.view.filter===filter&&this.view.category===category&&this.view.collectionId===collectionId;
     const button=el('button',{text,class:'sm-chip','aria-pressed':String(active)});
     button.addEventListener('click',()=>{this.view={...this.view,filter,category,collectionId};return refresh();});chips.append(button);
    };
    chip('All',FilterKind.All);chip('Favorites',FilterKind.Favorites);chip('User',FilterKind.User);
    for(const category of CATEGORIES)chip(category,FilterKind.Category,category);
    for(const id of lib.collectionIds)chip(lib.collections[id].name,FilterKind.Collection,undefined,id);
    for(const preset of model.presets){
     const card=el('div',{class:'sm-card',tabindex:'0',role:'button','aria-label':preset.name},[svgFromString(renderPreviewSvg(preset)),el('div',{class:'sm-card-name',text:preset.name}),el('div',{class:'sm-card-cat',text:preset.category})]);
     const apply=()=>status.run(async()=>{
      if((await this.cb.getSelectionCount())<=0){status.element.textContent='Select a video clip before applying a preset.';return;}
      const report=await this.cb.onApply(preset);
      if(report)status.element.textContent=`${report.applied.length} applied, ${report.failed.length} failed, ${report.skipped.length} skipped. ${report.warning??''}`;
     });
     card.addEventListener('click',apply);card.addEventListener('keydown',event=>{if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();return apply();}});
     const favorite=el('button',{class:'sm-fav',text:model.favoriteIds.has(preset.presetId)?'★':'☆','aria-label':'Favorite '+preset.name});
     favorite.addEventListener('click',event=>{event.stopPropagation();return status.run(async()=>{await this.cb.onToggleFavorite(preset.presetId);await refresh();});});card.append(favorite);grid.append(card);
    }
    if(!model.presets.length)grid.append(el('p',{text:'No presets match this filter.'}));
   }catch{if(request===refreshId)status.element.textContent='Presets could not be loaded. Try opening Library again.';}
  };
  search.addEventListener('input',()=>{this.view.query=search.value;return refresh();});
  sort.addEventListener('change',()=>{this.view.sort=sort.value as SortKind;return refresh();});
  const toggle=el('button',{class:'sm-btn secondary',text:'Toggle grid/list'});toggle.addEventListener('click',()=>{this.listMode=!this.listMode;return refresh();});
  container.append(el('div',{class:'sm-toolbar'},[search,sort,toggle]),status.element,chips,grid);
  await refresh();
  for(const warning of this.repo.getWarnings?.()??[])container.append(el('p',{class:'sm-warn',text:warning}));
 }
}
