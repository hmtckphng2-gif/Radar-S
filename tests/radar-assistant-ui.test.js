import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('assistant map action and module are present but hidden until status approves free providers',()=>{
 const html=read('index.html'),ui=read('radar-assistant-ui.mjs'),menu=read('radar70-redesign.mjs');
 assert.match(html,/id="assistantBtn"[^>]*hidden/);assert.match(html,/radar-assistant-ui\.mjs/);assert.match(html,/radar-assistant\.css/);
 assert.match(ui,/\/api\/assistant\/status/);assert.match(ui,/data\.enabled===true/);assert.match(menu,/\['assistant','Radar-Assistent'/);assert.match(menu,/case 'assistant':window\.SuedtirolRadarAssistant/);
});

test('assistant UI sends only a question and ephemeral chat context, never location or persistent history',()=>{
 const ui=read('radar-assistant-ui.mjs');
 assert.match(ui,/JSON\.stringify\(\{question,history:chatHistory\.slice\(-6\)\}\)/);assert.match(ui,/cache:'no-store'/);assert.match(ui,/chatHistory=\[\]/);
 assert.doesNotMatch(ui,/geolocation|navigator\.permissions|localStorage|sessionStorage/);assert.match(ui,/AbortController/);assert.match(ui,/textContent/);
});

test('assistant sheet uses safe-area padding and accessible mobile touch targets',()=>{
 const css=read('radar-assistant.css');
 assert.match(css,/env\(safe-area-inset-bottom\)/);assert.match(css,/min-height:44px/);assert.match(css,/max-width:420px/);assert.match(css,/prefers-reduced-motion/);
});
