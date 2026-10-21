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
  isSourceLoaded:()=>true,areTilesLoaded:()=>true,
  triggerRepaint(){}
 };
}
test('3D scene only becomes ready after real vector tiles are loaded',async()=>{
 const map=fakeMap();await waitFor3DScene(map,30);
 let loaded=false;map.areTilesLoaded=()=>loaded;
 const pending=waitFor3DScene(map,150);
 loaded=true;map.emit('render');await pending;
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
 assert.match(src,/await waitFor3DModel\(map,this\.layer\)/);
 assert.doesNotMatch(src,/new Vehicle3DOverlay\(/);
});
