import test from 'node:test';
import assert from 'node:assert/strict';
import {modelKind,headingRadians,createVehicleMesh,cinematicPose} from '../public/radar82-3d.mjs';
test('vehicle types are generic when type is not confirmed',()=>{
 assert.equal(modelKind({kind:'bus'}),'bus');
 assert.equal(modelKind({kind:'train'}),'train');
 assert.equal(modelKind({kind:'unknown'}),'train');
});
test('3D heading is deterministic and missing heading stays neutral',()=>{
 assert.equal(headingRadians(null),0);
 assert.equal(headingRadians(90),-Math.PI/2);
});
test('3D geometry creates actual meshes rather than flat marker CSS',()=>{
 class Group{constructor(){this.children=[]}add(x){this.children.push(x)}}
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(){}};this.rotation={}}}
 class Material{constructor(props){this.props=props}}
 const T={Group,Mesh,MeshStandardMaterial:Material,BoxGeometry:class{},CylinderGeometry:class{}};
 for(const kind of ['bus','train']){
  const m=createVehicleMesh(T,kind);
  assert.ok(m.children.length>12);
  assert.ok(m.children.every(x=>x instanceof Mesh));
 }
});

test('cinematic orbit descends and rotates progressively',()=>{
 const start=cinematicPose(0),mid=cinematicPose(.5),end=cinematicPose(1);
 assert.ok(start.elevation>mid.elevation && mid.elevation>end.elevation);
 assert.ok(start.yaw<mid.yaw && mid.yaw<end.yaw);
 assert.ok(end.radius<start.radius);
 assert.deepEqual(cinematicPose(9),end);
});
