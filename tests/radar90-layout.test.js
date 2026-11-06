import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enabled3D} from '../public/radar83-logic.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../public/index.html');
const css=read('../public/radar90-preview-block1.css');
const app=read('../public/app.js');
const horizon=read('../public/radar67.js');
const map3d=read('../public/radar83-map.mjs');

test('390px mobile header stays compact and uses one language control',()=>{
  assert.match(css,/@media\s*\(max-width:\s*749px\)/);
  assert.match(css,/min-height:\s*52px/);
  assert.match(css,/\.sr58-language-toggle\s*\{\s*display:none/);
  assert.match(horizon,/row\.append\(launch\)/);
  assert.match(html,/id="langBtn"/);
  assert.match(css,/#rhSearchTrigger/);
  assert.match(css,/\.sr60-launch\s*\{[^}]*position:static/s);
});

test('disturbance chip is outside the header row and status colors encode live, delayed, offline',()=>{
  assert.match(css,/\.mf-quickrow\s*\{\s*position:fixed/);
  assert.match(css,/\.mf-good \.status-dot|#statusBtn\.mf-good \.status-dot/);
  assert.match(css,/\.mf-warn \.status-dot|#statusBtn\.mf-warn \.status-dot/);
  assert.match(css,/\.mf-bad \.status-dot|#statusBtn\.mf-bad \.status-dot/);
});

test('sheet close controls are 44px X buttons and the handle supports drag dismissal',()=>{
  assert.match(html,/id="closeSheet" class="close" type="button" aria-label="Details schließen"[^>]*><\/button>/);
  assert.match(css,/#closeSheet,#sr50MapTab #closeStations[^}]*44px/s);
  assert.match(app,/handle\.addEventListener\('pointerdown'/);
  assert.match(app,/handle\.addEventListener\('pointermove'/);
  assert.match(app,/if\(delta>78\)closeSheets\(\)/);
});

test('right-side controls are separated and map tools hide while sheets are open',()=>{
  assert.match(css,/#rhToolsTrigger[^}]*top:calc\(env\(safe-area-inset-top,0px\) \+ 64px\)/s);
  assert.match(css,/\.rh-tools-panel[^}]*top:calc\(env\(safe-area-inset-top,0px\) \+ 110px\)/s);
  assert.match(css,/:has\(#stationSheet\.open\) #rhToolsTrigger/);
  assert.match(css,/\.sr86-nearby-panel[^}]*left:12px/);
});

test('3D info is inside the detail sheet and model credit is under Quellen',()=>{
  assert.match(map3d,/infoCard\.insertAdjacentElement/);
  assert.match(map3d,/summary\.textContent='Quellen'/);
  assert.doesNotMatch(map3d,/overlay\.append\(meta\)/);
  assert.doesNotMatch(map3d,/overlay\.append\(credit\)/);
});

test('3D stays disabled by default and cannot be activated by a query parameter',()=>{
  assert.equal(enabled3D(''),false);
  assert.equal(enabled3D('?radar3d=off'),false);
  assert.equal(enabled3D('?radar3d=on'),false);
});

test('empty timetable placeholder is hidden after a confirmed empty result',()=>{
  assert.match(app,/section\.hidden=!rows\.length;empty\.hidden=true/);
});
