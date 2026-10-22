import assert from 'node:assert/strict';
import {installDom,TestElement} from '../testing/dom.ts';
import {accordion} from './components.ts';
installDom();const section=accordion('Transform',[],false) as unknown as TestElement;
const header=section.children[0];assert.equal(header.tagName,'BUTTON','accordion must be keyboard-operable button');
await header.click();assert.equal(header.getAttribute('aria-expanded'),'true');
console.log('PASS accessible accordion state');
