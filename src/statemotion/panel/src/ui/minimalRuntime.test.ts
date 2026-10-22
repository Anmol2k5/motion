import assert from 'node:assert/strict';
import {installDom} from '../testing/dom.ts';
import {svgFromString} from './components.ts';
import {PresetRepository} from '../domain/presetStorage.ts';
installDom();const parser=(globalThis as any).DOMParser,clone=globalThis.structuredClone;
delete (globalThis as any).DOMParser;delete (globalThis as any).structuredClone;
try{
 const fs={mkdir:async()=>{},exists:async()=>false,writeFile:async()=>{},readFile:async()=>'',deleteFile:async()=>{},listFiles:async()=>[]};
 const repo=new PresetRepository(fs,'data');await repo.init();assert.deepEqual(repo.getLibrary().recentlyUsed,[]);
 assert.doesNotThrow(()=>svgFromString('<svg><rect width="10" height="10"/></svg>'));
}finally{(globalThis as any).DOMParser=parser;(globalThis as any).structuredClone=clone;}
console.log('PASS documented DOM APIs and JSON-data cloning without browser-only globals');
