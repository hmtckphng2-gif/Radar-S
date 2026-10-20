import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleLiveQuality,sourceHealth,delayDiscrepancy} from '../public/radar78-logic.mjs';
const now=1800000000000,stamp=Math.floor(now/1000);
test('only genuine recent observed feed updates qualify as current',()=>{
 assert.equal(vehicleLiveQuality({timestamp:stamp-30},now).kind,'current');
 assert.equal(vehicleLiveQuality({timestamp:stamp-120},now).kind,'delayed');
 assert.equal(vehicleLiveQuality({timestamp:stamp-30,positionType:'simuliert'},now).kind,'estimated');
 assert.equal(vehicleLiveQuality({timestamp:stamp-20,stale:true},now).kind,'last');
 assert.equal(vehicleLiveQuality({timestamp:stamp-360},now).kind,'last');
 assert.equal(vehicleLiveQuality({timestamp:null},now).live,false);
});
test('source health keeps nonlive reports visible in accounting',()=>{
 const q=sourceHealth([{source:'sta',timestamp:stamp-20},{source:'sta',timestamp:stamp-350},{source:'trains',timestamp:stamp-10,positionType:'geschätzt'}],now);
 assert.equal(q.sta.total,2);assert.equal(q.sta.current,1);assert.equal(q.sta.last,1);assert.equal(q.trains.estimated,1);
});
test('spatial divergence is not fabricated train lateness',()=>{
 assert.match(delayDiscrepancy(10,0),/Unterschiedliches/);
 assert.equal(delayDiscrepancy(0.5,0),null);
 assert.match(delayDiscrepancy(10,null),/keine bestätigte/);
});
