import type {FsLike} from '../domain/presetStorage.ts';
export class MemoryFs implements FsLike {
 files=new Map<string,string>();
 beforeWrite?: (path:string,text:string)=>Promise<void>;
 async readFile(path:string){if(!this.files.has(path))throw new Error('Missing file');return this.files.get(path)!;}
 async writeFile(path:string,text:string){await this.beforeWrite?.(path,text);this.files.set(path,text);}
 async deleteFile(path:string){this.files.delete(path);}
 async exists(path:string){return this.files.has(path);}
 async listFiles(path:string){return [...this.files.keys()].filter(file=>file.startsWith(path+'/'));}
 async mkdir(_path:string){}
}
