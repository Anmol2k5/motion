import { el } from '../ui/components.ts';
export interface UserInteraction {
 prompt(message:string,initial?:string):Promise<string|null>;
 confirm(message:string):Promise<boolean>;
 importPreset():Promise<string|null>;
 exportPreset(filename:string,text:string):Promise<boolean>;
}
export class UxpUserInteraction implements UserInteraction {
 constructor(private suppliedFs?:any){}
 private fs():any {
   const fs=this.suppliedFs??(globalThis as any).require?.('uxp')?.storage?.localFileSystem;
   if(!fs)throw new Error('UXP file picker unavailable');return fs;
 }
 async importPreset():Promise<string|null>{
   const selected=await this.fs().getFileForOpening({types:['stmpreset'],allowMultiple:false});
   const file=Array.isArray(selected)?selected[0]:selected;
   return file?await file.read():null;
 }
 async exportPreset(filename:string,text:string):Promise<boolean>{
   const file=await this.fs().getFileForSaving(filename,{types:['stmpreset']});
   if(!file)return false;await file.write(text);return true;
 }
 private dialog(message:string,initial?:string):Promise<string|null>{
   return new Promise(resolve=>{
     const dialog=el('dialog',{class:'sm-dialog','aria-label':message});
     dialog.append(el('p',{text:message}));
     const input=initial===undefined?null:el('input',{class:'sm-input',value:initial,'aria-label':message});
     if(input)dialog.append(input);
     const finish=(result:string|null)=>{if(typeof dialog.close==='function')dialog.close();dialog.remove();resolve(result);};
     const ok=el('button',{class:'sm-btn',text:'Continue',type:'button'}),cancel=el('button',{class:'sm-btn secondary',text:'Cancel',type:'button'});
     ok.addEventListener('click',()=>finish(input?input.value:'yes'));cancel.addEventListener('click',()=>finish(null));
     dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
     input?.addEventListener('keydown',event=>{if(event.key==='Enter')finish(input.value);});
     dialog.append(el('div',{class:'sm-actionbar'},[cancel,ok]));document.body.append(dialog);
     if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');input?.focus();
   });
 }
 async prompt(message:string,initial=''):Promise<string|null>{return this.dialog(message,initial);}
 async confirm(message:string):Promise<boolean>{return (await this.dialog(message))!==null;}
}
