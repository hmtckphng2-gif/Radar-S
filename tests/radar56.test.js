import test from 'node:test';
import assert from 'node:assert/strict';
import {freshUpdate,stopDelay,connectionAssessment,findConnections,feedQuality,spatialWarning,journeyProgress,aggregateHistory} from '../public/radar56-logic.mjs';
const now=Date.parse('2026-10-18T18:00:00Z'),day='2026-10-18',status={sta_updates:'ok',sta:'ok'};
const incoming={fetchedAt:now-10000,tripStartDate:'20261018',stops:[{stopId:'BZ',stopSequence:2,arrival:{delay:60}}]};
const outgoing={fetchedAt:now-20000,tripStartDate:'20261018',stops:[{stopId:'BZ',stopSequence:1,departure:{delay:120}}]};
test('fresh update requires source freshness and matching service day',()=>{
 assert.equal(freshUpdate(incoming,'sta',status,day,now),true);
 assert.equal(freshUpdate({...incoming,tripStartDate:'20261017'},'sta',status,day,now),false);
 assert.equal(freshUpdate({...incoming,fetchedAt:now-130000},'sta',status,day,now),false);
});
test('strict stop matching rejects conflicting sequence and never substitutes trip delay',()=>{
 assert.equal(stopDelay(incoming,'BZ',2),60);
 assert.equal(stopDelay({...incoming,delay:360},'OTHER',5),null);
 assert.equal(stopDelay(incoming,'BZ',7),60);
 assert.equal(stopDelay({...incoming,stops:[...incoming.stops,{stopId:'ZZ',stopSequence:3}]},'BZ',3),null);
});
test('connection confidence requires two fresh stop-specific updates',()=>{
 assert.equal(connectionAssessment({plan:5000,rt:0},{plan:5500,rt:null}).kind,'plan');
 assert.equal(connectionAssessment({plan:5000,rt:240},{plan:5300,rt:0}).kind,'risk');
 assert.equal(connectionAssessment({plan:5000,rt:0},{plan:5300,rt:0}).kind,'tight');
 assert.equal(connectionAssessment({plan:5000,rt:0},{plan:6000,rt:0}).kind,'likely');
});
test('findConnections uses exact station, valid index, and ignores cancelled trips',()=>{
 const db={meta:{ready:true,days:[day]},trips:{a:['RA','Meran','S','100',0,true],b:['RB','Trento','S','200',0,true],c:['RB','Trento','S','201',0,true]},routes:{RA:['100','',2],RB:['200','',2]}};
 const details={times:{a:[['A',3500,3505,1],['BZ',4100,4200,2]],b:[['BZ',4700,4705,1]],c:[['XX',4600,4650,1]]},stops:{BZ:['Bolzano']}};
 const ups=new Map([['sta:a',incoming],['sta:b',outgoing]]);
 const r=findConnections({source:'sta',tripId:'a',db,details,updates:ups,statuses:status,serviceDay:day,nowSec:4000,now});
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].tripId,'b');assert.equal(r.rows[0].assessment.kind,'likely');
 const cancelled=new Map(ups);cancelled.set('sta:b',{...outgoing,scheduleRelationship:'CANCELED'});
 assert.equal(findConnections({source:'sta',tripId:'a',db,details,updates:cancelled,statuses:status,serviceDay:day,nowSec:4000,now}).rows.length,0);
});
test('reported vs estimated vs stale remain distinct',()=>{
 assert.equal(feedQuality({source:'sta',timestamp:now/1000-20,positionType:'reported'},status,now).level,'reported');
 assert.equal(feedQuality({source:'trains',timestamp:now/1000-20,positionType:'Estimated'}, {...status,trains:'ok'},now).level,'estimated');
 assert.equal(feedQuality({source:'sta',stale:true,timestamp:now/1000-20},status,now).level,'stale');
 assert.match(spatialWarning(10,0,{level:'reported'}),/trotz/);
 assert.equal(spatialWarning(2,0,{level:'reported'}),null);
});
test('journey progress describes schedule only, and analytics handle missing history',()=>{
 const t=[['a',3000,3020,1],['b',3900,3920,2],['c',4500,4520,3]];
 assert.deepEqual(journeyProgress(t,3900).plannedPassed,1);
 const agg=aggregateHistory([{day,count:2,samples:1,observed:3,delayed:1,sum:12}],7,day);
 assert.equal(agg.observed,3);assert.equal(agg.average,4);assert.equal(agg.latePercent,100/3);
});
