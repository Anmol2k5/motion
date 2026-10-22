import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
assert.match(html,/<link[^>]+href="\.\/dist\/main\.css"/,'entry HTML must load emitted CSS');
console.log('PASS panel entry loads bundled stylesheet');
