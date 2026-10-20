import test from 'node:test';
import assert from 'node:assert/strict';
import {focusDuration,focusZoom,focusDistanceKm,focusHeading,validFocusPoint,shortestRotation} from '../public/radar71-camera-logic.mjs';
const NOW=1760900000000;
test('cinematic focus lasts 3-4s nearby and up to 5s for distant trips',()=>{
 const near=focusDuration(false,16,17,0.1),medium=focusDuration(false,13,17,4),far=focusDuration(false,9,17,90);
 assert.ok(near>=3200 && near<=4000);
 assert.ok(medium>=near && medium<=4500);
 assert.ok(far>medium && far<=5000);
 assert.equal(focusDuration(true,9,17,90),0);
 assert.equal(focusDistanceKm({lat:46.5,lng:11.35},{lat:46.5,lng:11.35}),0);
 assert.ok(focusDistanceKm({lat:46.5,lng:11.35},{lat:46.7,lng:11.4})>20);
});
test('focus zoom goes close without zooming out or exceeding maximum',()=>{
 assert.equal(focusZoom(13,18,'train'),17);
 assert.equal(focusZoom(17.5,18,'train'),17.5);
 assert.equal(focusZoom(10,13,'bus'),13);
 assert.equal(focusZoom(11,18,'bus'),17.5);
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
