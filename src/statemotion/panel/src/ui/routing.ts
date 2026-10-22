import {clear,el} from './components.ts';
export class ViewRouter {
 private generation=0;
 constructor(private container:HTMLElement,private onFailure?:()=>void){}
 async show(render:(target:HTMLElement)=>void|Promise<void>):Promise<void>{
  const generation=++this.generation;clear(this.container);
  // Each asynchronous view owns a node. A later navigation detaches it.
  const target=el('div',{role:'tabpanel'});this.container.append(target);
  try{await render(target);}catch{if(generation===this.generation){target.textContent='This view could not be loaded. Try opening it again.';this.onFailure?.();}}
 }
}
