import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveClusterCollisions} from '../public/radar44-logic.mjs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('overlapping train/bus cluster chips merge without losing members or type counts',()=>{
 const placed=resolveClusterCollisions([
  {keys:['b1','b2'],count:2,buses:2,trains:0,staleCount:1,x:100,y:100},
  {keys:['t1','t2','t3'],count:3,buses:0,trains:3,staleCount:0,x:150,y:100},
  {keys:['b3','b4'],count:2,buses:2,trains:0,staleCount:0,x:240,y:100}
 ],{width:390,height:844},{markerWidth:58,markerHeight:34,gap:8,padding:37});
 assert.equal(placed.length,2);
 assert.equal(placed[0].count,5);
 assert.deepEqual(placed[0].keys,['b1','b2','t1','t2','t3']);
 assert.equal(placed[0].buses,2);
 assert.equal(placed[0].trains,3);
 assert.equal(placed[0].staleCount,1);
});

test('separate clusters are clamped fully inside a 390px viewport',()=>{
 const placed=resolveClusterCollisions([
  {keys:['a','b'],count:2,buses:2,trains:0,staleCount:0,x:1,y:2},
  {keys:['c','d'],count:2,buses:0,trains:2,staleCount:0,x:389,y:842}
 ],{width:390,height:844},{markerWidth:58,markerHeight:34,gap:8,padding:37});
 assert.equal(placed.length,2);
 for(const c of placed){assert.ok(c.x>=37&&c.x<=353);assert.ok(c.y>=25&&c.y<=819)}
});

test('collision resolution keeps non-overlapping cluster chips separate',()=>{
 const placed=resolveClusterCollisions([
  {keys:['a','b'],count:2,buses:2,trains:0,x:80,y:120},
  {keys:['c','d'],count:2,buses:2,trains:0,x:180,y:120}
 ],{width:390,height:844},{markerWidth:58,markerHeight:34,gap:8,padding:37});
 assert.equal(placed.length,2);
 assert.ok(Math.abs(placed[0].x-placed[1].x)>=66);
});

test('390px clusters show a type icon, not a clipped Busse text label',()=>{
 const css=read('radar91-preview-block2.css'),renderer=read('radar43.js');
 assert.ok(css.includes('@media (max-width:749px)'));
 assert.ok(css.includes('.sr43-cluster-kind-label { display:none!important; }'));
 assert.ok(renderer.includes('resolveClusterCollisions(buffered'));
 assert.ok(renderer.includes('sr43-cluster-kind-icon'));
 assert.ok(renderer.includes('iconSize:[iconWidth,34]'));
});

test('the version leaves the brand and is shown in the menu',()=>{
 const html=read('index.html'),menu=read('radar60.js');
 assert.ok(html.includes('<div class="brand-title">RADAR</div>'));
 assert.ok(!html.includes('<em>9.9.5</em>'));
 assert.ok(menu.includes('SÜDTIROL RADAR · VERSION 9.9.5'));
});

test('DE is the real visible language button with a 44px target',()=>{
 const html=read('index.html'),css=read('radar91-preview-block2.css');
 assert.ok(html.includes('id="langBtn"')&&html.includes('<span id="langText">DE</span>'));
 assert.ok(css.includes('width:44px!important')&&css.includes('height:44px!important'));
 assert.ok(css.includes('#sr50MapTab #langBtn span { display:inline!important'));
 assert.ok(css.includes('#sr50MapTab #langBtn::after { content:none!important'));
});

test('right-side menu and layer controls have fixed spacing and do not hide the menu in sheets or 3D',()=>{
 const css=read('radar91-preview-block2.css');
 assert.ok(css.includes('top:calc(env(safe-area-inset-top,0px) + 64px)!important'));
 assert.ok(css.includes('top:calc(env(safe-area-inset-top,0px) + 116px)!important'));
 assert.ok(css.includes('body:has(#sheet.open) #sr60Launch'));
 assert.ok(css.includes('body.sr83-cinematic #sr60Launch'));
 assert.ok(css.includes('pointer-events:auto!important'));
});
