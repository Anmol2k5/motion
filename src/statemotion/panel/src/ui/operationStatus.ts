import { el } from './components.ts';
export class OperationStatus {
  readonly element:HTMLElement;
  private busy=false;
  constructor(private scope:HTMLElement){this.element=el('p',{class:'sm-operation-status',role:'status','aria-live':'polite'});}
  async run(action:()=>Promise<void>):Promise<void>{
    if(this.busy)return;
    this.busy=true;this.element.textContent='Working…';
    const controls=[...this.scope.querySelectorAll('button, input, select')] as (HTMLButtonElement|HTMLInputElement|HTMLSelectElement)[];
    const previous=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
    try{await action();if(this.element.textContent==='Working…')this.element.textContent='Saved.';}
    catch{this.element.textContent='The operation could not be completed. Your confirmed values were restored. Try again.';}
    finally{controls.forEach((control,index)=>control.disabled=previous[index]);this.busy=false;}
  }
}
