import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {start3DCamera,target3DCamera,use3DTerrain} from '../public/radar83-logic.mjs';
import {waitFor3DScene,waitFor3DModel} from '../public/radar83-map.mjs';

test('cinematic camera begins wide, then moves toward real train coordinates',()=>{
 const p={lat:46.497,lng:11.34};
 const end=target3DCamera(p,17,60,3800),start=start3DCamera(p,60,end.zoom);
 assert.ok(start.zoom<end.zoom,'the camera comes closer');
 assert.ok(start.pitch>end.pitch,'the camera descends to the height of the train');
 assert.notDeepEqual(start.center,end.center);
 assert.ok(end.duration>=3200 && end.duration<=5000);
 assert.deepEqual(end.center,[p.lng,p.lat]);
});
test('iPhone 3D DEM terrain is opt-in to avoid black sky/tile rendering issues',()=>{
 assert.equal(use3DTerrain('?radar3d=on'),false);
 assert.equal(use3DTerrain('?radar3d=on&terrain=on'),true);
});
function fakeMap(){
 const m=new Map();return {
  on:(name,fn)=>{m.set(name,fn)},off:(name)=>{m.delete(name)},
  emit:(name)=>m.get(name)?.(),isStyleLoaded:()=>true,
  getSource:(name)=>name==='openmaptiles'?{}:null,
  sourceLoaded:true,isSourceLoaded(){return this.sourceLoaded},areTilesLoaded:()=>true,
  setSourceLoaded(value){this.sourceLoaded=value},triggerRepaint(){}
 };
}
test('3D scene waits for its real vector source, not just the style shell',async()=>{
 const map=fakeMap();map.setSourceLoaded(false);
 let ready=false;const pending=waitFor3DScene(map,150).then(()=>{ready=true});
 map.emit('render');await Promise.resolve();assert.equal(ready,false);
 map.setSourceLoaded(true);map.emit('render');await pending;assert.equal(ready,true);
});
test('3D scene does not wait for unrelated shaded-relief raster tiles',async()=>{
 const map=fakeMap();map.areTilesLoaded=()=>false;
 await waitFor3DScene(map,30);
});
test('3D model render must be confirmed before revealing the map',async()=>{
 const map=fakeMap(),layer={didRender:false,renderError:false};
 const ready=waitFor3DModel(map,layer,150);layer.didRender=true;map.emit('render');await ready;
});
test('the replay button and real camera animation remain wired',()=>{
 const src=readFileSync(new URL('../public/radar83-map.mjs',import.meta.url),'utf8');
 assert.match(src,/this\.replay\(\)/);
 assert.match(src,/map\.easeTo\(/);
 assert.match(src,/await waitFor3DScene\(map\)/);
 assert.match(src,/this\.leaflet\.flyTo\(\[point\.lat,point\.lng\]/);
 assert.match(src,/handoff3DCamera\(liveCenter,liveZoom\)/);
 assert.match(src,/await waitFor3DModel\(map,this\.layer\)/);
 assert.doesNotMatch(src,/new Vehicle3DOverlay\(/);
});

test('updated 3D entrypoint bypasses the previous service-worker asset cache',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const camera=readFileSync(new URL('../public/radar71-camera.mjs',import.meta.url),'utf8');
 assert.ok(html.includes('radar71-camera.mjs?v=9.9.5'));
 assert.ok(camera.includes('radar83-map.mjs?v=9.9.5'));
});
