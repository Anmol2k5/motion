import {el,clear} from './ui/components.ts';
import {ViewRouter} from './ui/routing.ts';
import {LibraryView} from './ui/library.ts';
import {InspectorView} from './ui/inspector.ts';
import {ManageView} from './ui/manage.ts';
import {DiagnosticsView} from './ui/diagnosticsView.ts';
import {EXPECTED_MATCH_NAME,type DiagnosticInput} from './domain/diagnostics.ts';
import {checkCompatibility,CompatLevel} from './domain/compatibility.ts';
import {toggleFavorite} from './domain/favorites.ts';
import {buildUserPresetFromConfig} from './domain/presetSchema.ts';
import {BUNDLED_PRESETS} from './starter/bundledPresets.ts';
import type {PresetRepository,LibraryModel} from './domain/presetStorage.ts';
import type {PremiereAdapter,ApplyReport} from './host/premiereAdapter.ts';
import type {UserInteraction} from './host/userInteraction.ts';
export interface PanelDependencies {repo:PresetRepository;adapter:PremiereAdapter;interaction:UserInteraction;}
export async function startPanel(app:HTMLElement,{repo,adapter,interaction}:PanelDependencies):Promise<void>{
 clear(app);await repo.init();await repo.installBundled(BUNDLED_PRESETS);
 let selectionCount=0,selectionRequest=0;
 const diagnostic:DiagnosticInput={effectMatchName:EXPECTED_MATCH_NAME,selectionCount:0,contractStatus:'unknown',lastOperation:'none'};
 const record=(report:ApplyReport,label:string)=>{
  diagnostic.lastOperation=`${label}: ${report.applied.length} applied, ${report.failed.length} failed, ${report.skipped.length} skipped`;
  diagnostic.lastErrorCode=report.failed.length?'OperationFailed':null;
 };
 const getLibrary=()=>repo.getLibrary();
 const capture=async()=>{
  const before=await adapter.detectSelection(),clip=before.supported[0];if(!clip)throw new Error('Select a compatible clip');
  const name=await interaction.prompt('Preset name','My StateMotion preset');if(!name?.trim())return;
  if(!(await adapter.detectSelection()).supported.some(c=>c.clipId===clip.clipId))throw new Error('Selection changed');
  const preset=buildUserPresetFromConfig(await adapter.readState(clip),await adapter.getContract(clip));
  await repo.create({...preset,name:name.trim()});record({applied:[clip.clipId],failed:[],skipped:[],reasons:{}},'Capture preset');
 };
 const inspector=new InspectorView(adapter,{promptName:initial=>interaction.prompt('Preset name',initial),confirmRemoval:()=>interaction.confirm('Remove StateMotion from selected clips?'),onOperation:report=>record(report,'Inspector')});inspector.setRepository(repo);
 const libraryView=new LibraryView(repo,getLibrary,{
  getSelectionCount:async()=>{const selection=await adapter.detectSelection();return selection.supported.length+selection.unsupported.length;},
  onApply:async preset=>{
   const report=await adapter.applyPresetToSelection(preset);record(report,'Apply preset');
   if(report.applied.length){
    inspector.setLastPreset(preset);
    try{await repo.updateLibrary(library=>({...library,recentlyUsed:[preset.presetId,...library.recentlyUsed.filter(id=>id!==preset.presetId)].slice(0,12)}));}
    catch{diagnostic.lastErrorCode='StorageWriteFailed';report.warning='Applied, but recent history could not be saved.';}
   }
   return report;
  },
  onToggleFavorite:async id=>{await repo.updateLibrary(library=>toggleFavorite(library,id));},
 });
 const manage=new ManageView(repo,getLibrary,()=>{},interaction,capture);
 const diagnostics=new DiagnosticsView(()=>({...diagnostic}));
 const tabBar=el('div',{class:'sm-tabs',role:'tablist','aria-label':'StateMotion views'}),views=el('div',{class:'sm-view'});app.append(tabBar,views);
 const router=new ViewRouter(views,()=>{diagnostic.lastErrorCode='ViewLoadFailed';});
 const tabs=[{id:'library',label:'Library',render:(target:HTMLElement)=>libraryView.render(target)},
  {id:'inspector',label:'Inspector',render:(target:HTMLElement)=>inspector.render(target)},
  {id:'manage',label:'Manage',render:(target:HTMLElement)=>manage.render(target)},
  {id:'diagnostics',label:'About',render:(target:HTMLElement)=>diagnostics.render(target)}];
 const buttons:HTMLButtonElement[]=[];
 const selectTab=async(index:number)=>{
  const request=++selectionRequest;
  buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
  await router.show(async target=>{
   target.id='sm-panel-'+tabs[index].id;target.setAttribute('aria-labelledby','sm-tab-'+tabs[index].id);
   const detection=await adapter.detectSelection(),clips=[...detection.supported,...detection.unsupported];
   const compatibility=clips.length?checkCompatibility(await adapter.getContract(clips[0])):null;
   if(request!==selectionRequest)return;
   selectionCount=clips.length;diagnostic.selectionCount=selectionCount;diagnostic.selectionStatus=selectionCount?`${selectionCount} clip(s)`:'none';
   diagnostic.contractStatus=compatibility?.level===CompatLevel.Ok?'compatible':compatibility?.level===CompatLevel.ReadOnly?'read-only':compatibility?'incompatible':'unknown';
   await tabs[index].render(target);
  });
 };
 tabs.forEach((tab,index)=>{
  const button=el('button',{class:'sm-tab',role:'tab',id:'sm-tab-'+tab.id,'data-tab':tab.id,'aria-controls':'sm-panel-'+tab.id,text:tab.label});
  button.addEventListener('click',()=>selectTab(index));
  button.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();buttons[next].focus();return selectTab(next);});
  buttons.push(button);tabBar.append(button);
 });
 await selectTab(0);
}
