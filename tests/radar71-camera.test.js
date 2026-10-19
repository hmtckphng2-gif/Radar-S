import test from 'node:test';
import assert from 'node:assert/strict';
import {focusDuration,focusZoom,focusHeading,validFocusPoint,shortestRotation} from '../public/radar71-camera-logic.mjs';
const NOW=1760900000000;
test('cinematic focus runs slowly and respects reduced-motion',()=>{
 assert.ok(focusDuration(false,9,15)>=1600);
 assert.ok(focusDuration(false,14,15)>=1300);
 assert.equal(focusDuration(true,9,15),0);
 assert.ok(focusDuration(false,3,17)<=1950);
});
test('focus zoom does not zoom OUT or exceed Leaflet maximum',()=>{
 assert.equal(focusZoom(13,18,'train'),14.5);
 assert.equal(focusZoom(16,18,'train'),16);
 assert.equal(focusZoom(10,13,'bus'),13);
 assert.equal(focusZoom(11,18,'bus'),15);
});
test('camera direction only uses fresh, verified heading',()=>{
 const v={bearing:0,stale:false,timestamp:NOW/1000-5};
 assert.equal(focusHeading(v,NOW),0);
 assert.equal(focusHeading({...v,bearing:null},NOW),null);
 assert.equal(focusHeading({...v,bearing:''},NOW),null);
 assert.equal(focusHeading({...v,bearing:-20},NOW),null);
 assert.equal(focusHeading({...v,bearing:360},NOW),null);
 assert.equal(focusHeading({...v,stale:true},NOW),null);
 assert.equal(focusHeading({...v,timestamp:NOW/1000-200},NOW),null);
});
test('only valid feed/visible marker points can be centered',()=>{
 assert.deepEqual(validFocusPoint({lat:46.5,lon:11.35}),{lat:46.5,lng:11.35});
 assert.deepEqual(validFocusPoint({lat:46.5,lon:11.35},{lat:46.51,lng:11.4}),{lat:46.51,lng:11.4});
 assert.equal(validFocusPoint({lat:91,lon:11}),null);
 assert.equal(validFocusPoint({lat:'?',lon:11}),null);
});
test('rotation uses the shortest heading turn',()=>{
 assert.equal(shortestRotation(350,10),20);
 assert.equal(shortestRotation(10,350),-20);
 assert.equal(shortestRotation(90,180),90);
});
