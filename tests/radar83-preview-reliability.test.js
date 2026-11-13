import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {positionFreshness} from '../public/radar83-logic.mjs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const now=1_800_000_000_000;

test('3D freshness accepts only recent, non-stale feed positions',()=>{
 const fresh=positionFreshness({timestamp:now/1000-60},now);
 assert.equal(fresh.fresh,true);assert.equal(fresh.ageSeconds,60);assert.equal(fresh.estimated,false);
 assert.equal(positionFreshness({timestamp:now/1000-181},now).fresh,false);
 assert.equal(positionFreshness({timestamp:now/1000-20,stale:true},now).fresh,false);
 assert.equal(positionFreshness({},now).fresh,false);
});

test('estimated positions are identified but never treated as missing timestamps',()=>{
 const q=positionFreshness({timestamp:now/1000-30,estimated:true},now);
 assert.equal(q.fresh,true);assert.equal(q.estimated,true);assert.match(q.label,/30 s alt/);
 assert.equal(positionFreshness({timestamp:now/1000+31},now).fresh,false);
});

test('the cinematic view has a bounded 35-second startup watchdog and visible loading state',()=>{
 const map=read('radar83-map.mjs'),css=read('radar83.css');
 assert.ok(map.includes('3D-Start nach 35 Sekunden abgebrochen'));
 assert.ok(map.includes('this.openTimeout=setTimeout'));
 assert.ok(map.includes('clearTimeout(this.openTimeout)'));
 assert.ok(map.includes('sr83-loading-state'));
 assert.ok(css.includes('.sr83-loading-state')&&css.includes('.sr83-spinner'));
});

test('3D focus/free controls and feed freshness labels are wired',()=>{
 const map=read('radar83-map.mjs');
 assert.ok(map.includes("focus.className='sr83-control'"));
 assert.ok(map.includes("free.className='sr83-control'"));
 assert.ok(map.includes('positionFreshness(vehicle)'));
 assert.ok(map.includes('if(this.touched||this.flying||!this.map||!quality.fresh)return;'));
});

test('production camera approach and animated close remain intact',()=>{
 const map=read('radar83-map.mjs');
 assert.ok(map.includes('const approachStart=approach3DCamera(handoff,target,.75)'));
 assert.ok(map.includes('const flightStart=approachStart'));
 assert.ok(map.includes('closeAnimated(){'));
 assert.ok(!map.includes('reverseReturn'));
});

test('3D resource cleanup disposes textures and hidden tabs skip GPU rendering',()=>{
 const map=read('radar83-map.mjs');
 assert.ok(map.includes('value?.isTexture&&!textures.has(value)'));
 assert.ok(map.includes('if(document.hidden)return'));
 assert.ok(map.includes('pixelRatio:Math.min(2,Math.max(1,Number(window.devicePixelRatio)||1))'));
});

test('GLB binaries are cached and parsed from bounded fetches',()=>{
 const model=read('radar83-model.mjs');
 assert.ok(model.includes('const modelBinaryCache=new Map()'));
 assert.ok(model.includes("fetch(url,{signal:controller.signal,cache:'force-cache'})"));
 assert.ok(model.includes("loader.parse(buffer,'/models/'"));
 assert.ok(model.includes('export function cachedModelBinaryCount()'));
});
