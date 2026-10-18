import assert from 'node:assert/strict';
import {UxpUserInteraction} from './userInteraction.ts';
let saved='';const file={read:async()=>'{"test":true}',write:async(text:string)=>{saved=text;}};
const fs={getFileForOpening:async()=>file,getFileForSaving:async()=>file};
const interaction=new UxpUserInteraction(fs);
assert.equal(await interaction.importPreset(),'{"test":true}');await interaction.exportPreset('original.stmpreset','payload');assert.equal(saved,'payload');
const canceled=new UxpUserInteraction({getFileForOpening:async()=>null,getFileForSaving:async()=>null});assert.equal(await canceled.importPreset(),null);assert.equal(await canceled.exportPreset('x.stmpreset','x'),false,'cancel must not report a saved file');
console.log('PASS UXP picker IO and cancellation');
