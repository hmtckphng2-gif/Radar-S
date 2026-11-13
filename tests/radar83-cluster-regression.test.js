import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('3D camera flight starts after the rendered scene is revealed',()=>{
 const source=read('../public/radar83-map.mjs');
 const flightStart=source.indexOf('map.jumpTo(flightStart);');
 const ready=source.indexOf("this.overlay.classList.add('sr83-ready');");
 const replay=source.indexOf('this.replay();',ready);
 assert.ok(flightStart>=0&&ready>flightStart&&replay>ready);
 assert.ok(!source.slice(flightStart,ready).includes('this.replay();'));
});
test('cinematic 3D is enabled by default without a query flag',()=>{
 const source=read('../public/radar83-logic.mjs');
 assert.ok(source.includes('cinematic3D:true'));
 assert.ok(source.includes("value!=='off'"));
});
test('clusters preload beyond the viewport without replacing vehicle markers',()=>{
 const source=read('../public/radar43.js');
 assert.ok(source.includes('map.getBounds().pad(.72)'));
 assert.ok(source.includes('bufferX=Math.round(size.x*.72)'));
 assert.ok(source.includes('clusteredKeys=new Set()'));
 assert.ok(!source.includes('const clusterCache=new Map()'));
});
