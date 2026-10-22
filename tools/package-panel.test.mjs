import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(readFileSync(path.join(root,'src/statemotion/panel/manifest.json')));
assert.equal(manifest.manifestVersion,5,'Premiere supports manifest schema 5');
assert.equal(manifest.host.app,'premierepro','Adobe host identifier');
assert.ok(Array.isArray(manifest.entrypoints));
assert.equal(manifest.requiredPermissions.clipboard,'readAndWrite');
const {packagePanel}=await import('./package-panel.mjs');
const temp=mkdtempSync(path.join(tmpdir(),'statemotion-package-'));
try{
 const a=packagePanel({root,output:path.join(temp,'a.zip')}),b=packagePanel({root,output:path.join(temp,'b.zip')});
 assert.equal(a.sha256,b.sha256,'deterministic package');
 assert.deepEqual(a.files,['dist/main.css','dist/main.js','index.html','manifest.json']);
 const fake=path.join(temp,'fake');mkdirSync(path.join(fake,'src/statemotion/panel'),{recursive:true});
 writeFileSync(path.join(fake,'src/statemotion/panel/manifest.json'),JSON.stringify(manifest));
 assert.throws(()=>packagePanel({root:fake,output:path.join(temp,'bad.zip')}),/missing|ENOENT/i);
}finally{rmSync(temp,{recursive:true,force:true});}
console.log('PASS manifest contract, deterministic archive, references and missing-asset failure');
