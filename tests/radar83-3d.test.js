import test from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLE_SPECS,vehicleKind,validHeading,modelYawRadians,makeVehicleMesh} from '../public/radar83-model.mjs';
import {enabled3D,target3DCamera,readProjectionMatrix,MAPLIBRE_VERSION,VECTOR_STYLE} from '../public/radar83-logic.mjs';
import {build3DBuildings,enable3DTerrain,make3DVehicleLayer} from '../public/radar83-map.mjs';

const NOW=1760900000000;
test('explicit switch can return users to intact Leaflet 2D map',()=>{
 assert.equal(enabled3D('?radar3d=off'),false);
 assert.equal(enabled3D('?radar3d=on'),true);
 assert.equal(enabled3D('?language=de'),true);
 assert.equal(MAPLIBRE_VERSION,'4.7.1');
 assert.ok(VECTOR_STYLE.includes('/styles/dark'));
});
test('camera rotates the MAP and tilts terrain, no arbitrary model spin',()=>{
 const camera=target3DCamera({lat:46.498,lng:11.353},17.4,90,4500);
 assert.deepEqual(camera.center,[11.353,46.498]);
 assert.equal(camera.pitch,72);
 assert.equal(camera.bearing,126);
 assert.equal(camera.duration,4500);
 assert.equal(target3DCamera({lat:92,lng:11},17,90,3000),null);
 assert.equal(target3DCamera({lat:46,lng:11},25,null,6000).zoom,18);
});
test('model is only rotated based on credible fresh heading',()=>{
 assert.equal(validHeading({bearing:89,timestamp:NOW/1000-30},120,NOW),89);
 assert.equal(validHeading({bearing:89,timestamp:NOW/1000-240},120,NOW),null);
 assert.equal(validHeading({bearing:89,timestamp:NOW/1000-30,stale:true},120,NOW),null);
 assert.equal(validHeading({bearing:null,timestamp:NOW/1000-30},120,NOW),null);
 assert.equal(modelYawRadians(90),-Math.PI/2);
 assert.equal(modelYawRadians(null),0);
 assert.equal(vehicleKind({kind:'bus'}),'bus');
 assert.equal(vehicleKind({kind:'train'}),'train');
 assert.ok(VEHICLE_SPECS.train.length>40);
});
test('custom WebGL layer is geographically anchored inside 3D MapLibre renderer',()=>{
 const layer=make3DVehicleLayer({}, {MercatorCoordinate:{}},null,{kind:'train'}, {lat:46.5,lng:11.35},null);
 assert.equal(layer.type,'custom');
 assert.equal(layer.renderingMode,'3d');
 assert.equal(layer.id,'sr83-selected-vehicle');
 assert.equal(layer.didRender,false);
 assert.equal(typeof layer.update,'function');
 assert.equal(typeof layer.render,'function');
 assert.equal(typeof layer.onAdd,'function');
 assert.equal(typeof layer.onRemove,'function');
});
test('vector buildings are extruded and terrain falls back when DEM unsupported',()=>{
 let building=null;const map={
  getSource:n=>n==='openmaptiles'?{}:null,getLayer:()=>null,
  getStyle:()=>({layers:[{type:'symbol',id:'labels'}]}),
  addLayer:(v,before)=>{building={v,before}}
 };
 assert.equal(build3DBuildings(map),true);
 assert.equal(building.v.type,'fill-extrusion');
 assert.equal(building.v['source-layer'],'building');
 assert.equal(building.before,'labels');
 let dem,terrain;
 const terrainMap={getSource:()=>null,addSource:(id,s)=>{dem=s},setTerrain:x=>{terrain=x}};
 assert.equal(enable3DTerrain(terrainMap),true);
 assert.equal(dem.type,'raster-dem');
 assert.equal(dem.encoding,'terrarium');
 assert.equal(terrain.source,'sr83-dem');
 assert.equal(enable3DTerrain({getSource:()=>null,addSource:()=>{throw Error('blocked')}}),false);
});
test('MapLibre projection matrix from either signature is accepted',()=>{
 const data=Array.from({length:16},(_,i)=>i===0||i===5||i===10||i===15?1:0);
 assert.deepEqual(readProjectionMatrix({defaultProjectionData:{mainMatrix:data}}),data);
 assert.deepEqual(readProjectionMatrix(new Float32Array(data)),new Float32Array(data));
 assert.equal(readProjectionMatrix([1,2]),null);
});
test('FLIRT-inspired train has detailed multipart 3D mesh and bus is separate',()=>{
 class Group{
  constructor(){this.children=[];this.userData={}}
  add(child){this.children.push(child)}
 }
 class Mesh{
  constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(){},copy(){return this},add(){return this},multiplyScalar(){return this}};this.rotation={};this.quaternion={setFromUnitVectors(){}}}
 }
 class Vector3{
  constructor(x,y,z){this.x=x;this.y=y;this.z=z}
  clone(){return new Vector3(this.x,this.y,this.z)}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
  length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}
  normalize(){return this}
 }
 class Material{constructor(opts){this.opts=opts}}
 const T={Group,Mesh,Vector3,MeshStandardMaterial:Material,BoxGeometry:class{},CylinderGeometry:class{}};
 const train=makeVehicleMesh(T,'train'),bus=makeVehicleMesh(T,'bus');
 assert.equal(train.userData.schematic,true);
 assert.equal(train.userData.kind,'train');
 assert.equal(bus.userData.kind,'bus');
 assert.ok(train.children.length>30);
 assert.ok(bus.children.length>20);
 assert.equal(train.children.filter(n=>n instanceof Group).length,3);
});
