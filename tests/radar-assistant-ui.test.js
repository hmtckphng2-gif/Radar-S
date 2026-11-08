import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('chat-first shell has four navigation destinations and opens after assistant status check',()=>{
 const html=read('index.html'),ui=read('radar-assistant-ui.mjs');
 assert.match(html,/id="assistantBtn"[^>]*hidden/);assert.match(html,/radar-assistant-ui\.mjs/);assert.match(html,/radar-assistant\.css/);
 for(const id of ['chat','map','departures','favorites'])assert.match(ui,new RegExp("\\['"+id+"'"));
 assert.match(ui,/\/api\/assistant\/status/);assert.match(ui,/open\(\);document\.addEventListener/);
});
test('assistant uses only live API and ephemeral chat context, never location or persistent storage',()=>{
 const ui=read('radar-assistant-ui.mjs');
 assert.match(ui,/JSON\.stringify\(\{question,history:history\.slice\(-6\)\}\)/);assert.match(ui,/cache:'no-store'/);assert.match(ui,/history=\[\]/);
 assert.doesNotMatch(ui,/geolocation|navigator\.permissions|localStorage|sessionStorage/);assert.match(ui,/AbortController/);assert.match(ui,/textContent/);
});
test('chat shell respects mobile safe areas, accessible touch targets and reduced motion',()=>{
 const css=read('radar-assistant.css');
 assert.match(css,/env\(safe-area-inset-bottom\)/);assert.match(css,/min-height:46px/);assert.match(css,/max-width:700px/);assert.match(css,/prefers-reduced-motion/);
});
test('map and legacy departures/favorites remain connected to existing navigation APIs',()=>{
 const ui=read('radar-assistant-ui.mjs');
 assert.match(ui,/SuedtirolRadar70\?\.navigate\?\.\('map'\)/);assert.match(ui,/SuedtirolRadar50\?\.switchTab\?\.\(id\)/);
});
