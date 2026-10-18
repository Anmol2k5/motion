// Dependency-free, deterministic STORE ZIP for the development panel.
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(import.meta.dirname,'..');
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const [filename,data] of entries){
  const name=Buffer.from(filename),crc=crc32(data),header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);
  header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
  local.push(header,name,data);
  const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(33,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);central.push(directory,name);offset+=header.length+name.length+data.length;
 }
 const centralBytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,centralBytes,end]);
}
export function packagePanel({root=repo,output=path.join(root,'dist/statemotion-panel-dev.zip')}={}){
 const panel=path.join(root,'src/statemotion/panel'),manifest=JSON.parse(readFileSync(path.join(panel,'manifest.json'),'utf8'));
 if(manifest.manifestVersion!==5||manifest.host?.app!=='premierepro'||!manifest.entrypoints?.some(entry=>entry.type==='panel'))throw Error('Unsupported Premiere panel manifest');
 const html=readFileSync(path.join(panel,manifest.main),'utf8');
 if(!/href="\.\/dist\/main\.css"/.test(html)||!/src="\.\/dist\/main\.js"/.test(html)||/type="module"/.test(html))throw Error('Missing supported panel entry assets');
 const files=new Set(['manifest.json',manifest.main]);
 for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))files.add(match[1].replace(/^\.\//,''));
 for(const icon of manifest.icons??[])files.add(icon.path);
 const sorted=[...files].sort();
 const entries=sorted.map(file=>{
  if(!file||file.includes('..')||path.isAbsolute(file)||file.includes(':')||file.includes('node_modules')||/\.(aex|dll)$/i.test(file))throw Error('Unsafe package entry');
  const full=path.join(panel,file);if(!statSync(full).isFile())throw Error('Missing package file '+file);
  const bytes=readFileSync(full);if(!bytes.length)throw Error('Missing nonempty package file '+file);return [file,bytes];
 });
 const archive=zip(entries);mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,archive);
 return {output,files:sorted,sha256:createHash('sha256').update(archive).digest('hex')};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(packagePanel(),null,2));
