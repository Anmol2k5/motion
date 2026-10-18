import assert from 'node:assert/strict';
import {installDom,TestElement} from '../testing/dom.ts';
import {DiagnosticsView} from './diagnosticsView.ts';
const {container}=installDom();const root=container as unknown as TestElement;
new DiagnosticsView(()=>({lastOperation:'Apply: 2 applied, 1 failed',contractStatus:'compatible'})).render(container);
assert.match(root.textContent,/2 applied, 1 failed/);
await root.querySelector('[aria-label="Copy debug report to clipboard"]')!.click();
assert.match(root.textContent,/clipboard.*unavailable|could not copy/i,'clipboard absence must be visible');
console.log('PASS diagnostic snapshot and unavailable clipboard feedback');
