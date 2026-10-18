// Minimal injected DOM for event/state tests. It does not certify Adobe layout.
export class TestElement {
  children:TestElement[]=[];parent:TestElement|null=null;attributes:Record<string,string>={};
  listeners:Record<string,((e:any)=>unknown)[]>={};value='';checked=false;disabled=false;style:Record<string,string>={};dataset:Record<string,string>={};
  private text='';tagName:string;
  constructor(tag:string){this.tagName=tag.toUpperCase();}
  set innerHTML(markup:string){
    this.children=[];
    const tags=[...markup.matchAll(/<([a-z]+)([^>]*)>/g)];
    let root:TestElement|null=null;
    for(const match of tags){const node=new TestElement(match[1]);for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g))node.setAttribute(attr[1],attr[2]);if(!root){root=node;this.append(node);}else root.append(node);}
  }
  get textContent():string{return this.text+this.children.map(c=>c.textContent).join('');}
  set textContent(value:string){this.text=value;this.children=[];}
  get className(){return this.attributes.class??'';}set className(v:string){this.attributes.class=v;}
  classList={add:(...v:string[])=>{this.className=[...new Set([...this.className.split(' '),...v])].join(' ');},remove:(v:string)=>{this.className=this.className.split(' ').filter(x=>x!==v).join(' ');},contains:(v:string)=>this.className.split(' ').includes(v)};
  setAttribute(k:string,v:string){this.attributes[k]=v;if(k==='value')this.value=v;if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;}
  getAttribute(k:string){return this.attributes[k]??null;}
  append(...nodes:any[]){for(const value of nodes){const node=typeof value==='string'?Object.assign(new TestElement('#text'),{textContent:value}):value;node.parent=this;this.children.push(node);}}
  appendChild(node:TestElement){this.append(node);return node;}
  get firstChild(){return this.children[0]??null;}get lastElementChild(){return this.children[this.children.length-1]??null;}
  removeChild(node:TestElement){this.children=this.children.filter(x=>x!==node);node.parent=null;return node;}
  remove(){this.parent?.removeChild(this);}
  addEventListener(type:string,fn:(e:any)=>unknown){(this.listeners[type]??=[]).push(fn);}
  removeEventListener(type:string,fn:(e:any)=>unknown){this.listeners[type]=(this.listeners[type]??[]).filter(x=>x!==fn);}
  async dispatch(type:string,extra:Record<string,unknown>={}){if(this.disabled)return;for(const fn of this.listeners[type]??[])await fn({target:this,key:'',preventDefault(){},stopPropagation(){},...extra});}
  click(){return this.dispatch('click');}
  getBoundingClientRect(){return {left:0,top:0,width:200,height:200};}
  focus(){(globalThis.document as any).activeElement=this;}
  matches(selector:string):boolean{
    if(selector.includes(','))return selector.split(',').some(x=>this.matches(x.trim()));
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
    const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if(attr)return attr[2]===undefined?attr[1] in this.attributes:this.attributes[attr[1]]===attr[2];
    return this.tagName.toLowerCase()===selector.toLowerCase();
  }
  querySelectorAll(selector:string):TestElement[]{return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
  querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
}
export function installDom(){
  const body=new TestElement('body');
  const document=Object.assign(new TestElement('document'),{body,activeElement:null,createElement:(tag:string)=>new TestElement(tag),getElementById:(id:string)=>body.querySelector(`[id="${id}"]`)});
  (globalThis as any).MouseEvent=class{};
  (globalThis as any).document=document;
  (globalThis as any).DOMParser=class{parseFromString(markup:string){const root=new TestElement('svg');for(const match of markup.matchAll(/<([a-z]+)([^>]*)>/g)){const node=new TestElement(match[1]);for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g))node.setAttribute(attr[1],attr[2]);root.append(node);}return {documentElement:root};}};
  return {document,container:new TestElement('div') as unknown as HTMLElement};
}
