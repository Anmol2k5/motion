import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runCheck} from './verify-development.mjs';
const logs=mkdtempSync(path.join(tmpdir(),'statemotion-verify-'));
try{
 assert.throws(()=>runCheck('injected',process.execPath,['-e','process.exit(7)'],{cwd:process.cwd(),logDir:logs}),error=>error.status===7);
 assert.doesNotThrow(()=>runCheck('success',process.execPath,['-e','console.log("actual assertions passed")'],{cwd:process.cwd(),logDir:logs}));
}finally{rmSync(logs,{recursive:true,force:true});}
console.log('PASS child failure status and successful execution');
