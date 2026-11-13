import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('vehicle sheet compacts its header on scroll and retains the production Ist/Soll explanation',()=>{
 const js=read('radar73.js'),css=read('radar73.css');
 assert.ok(js.includes("scroll.scrollTop>14"));
 assert.ok(js.includes("sheet.classList.toggle('sr73-compact',compact)"));
 assert.ok(js.includes("addEventListener('scroll',queue,{passive:true})"));
 assert.ok(js.includes('Ist/Soll beschreibt den Abstand'));
 assert.ok(css.includes('#sheet.sr73-compact .sheet-title'));
 assert.ok(css.includes('@media(max-width:749px)'));
});
