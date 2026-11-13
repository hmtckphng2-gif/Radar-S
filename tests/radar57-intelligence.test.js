import test from 'node:test';
import assert from 'node:assert/strict';
import {supportedRecovery,trainHistory} from '../public/radar57-logic.mjs';

const now=Date.now(),statuses={sta_updates:'ok'};
const row={kind:'train',source:'sta',stopId:'trento',serviceDay:'2026-10-18',delaySec:840};
const update={fetchedAt:now,tripStartDate:'2026-10-18',stops:[
 {stopId:'mori',arrival:{delay:1200}},
 {stopId:'trento',departure:{delay:840}},
 {stopId:'bozen',departure:{delay:720}}]};

test('recovery uses only fresh same-service-day stop-specific GTFS delay',()=>{
 assert.deepEqual(supportedRecovery(row,update,statuses,now,'2026-10-18'),{gained:6,upstreamMinutes:20,targetMinutes:14,source:'GTFS-RT',upstreamStopId:'mori'});
});
test('stale, wrong day and invalid source updates cannot support a recovery',()=>{
 assert.equal(supportedRecovery(row,{...update,fetchedAt:now-130000},statuses,now,'2026-10-18'),null);
 assert.equal(supportedRecovery(row,update,statuses,now,'2026-10-19'),null);
 assert.equal(supportedRecovery(row,update,{sta_updates:'error'},now,'2026-10-18'),null);
 assert.equal(supportedRecovery(row,{...update,stops:[update.stops[1]]},statuses,now,'2026-10-18'),null);
});
test('no fabricated time gain where stop forecast is absent or unchanged',()=>{
 assert.equal(supportedRecovery({...row,delaySec:null},update,statuses,now),null);
 assert.equal(supportedRecovery({...row,cancelled:true},update,statuses,now),null);
 assert.equal(supportedRecovery(row,{...update,stops:[{stopId:'mori',arrival:{delay:840}},update.stops[1]]},statuses,now),null);
 assert.equal(supportedRecovery(row,{...update,stops:[{stopId:'mori',arrival:{delay:1200}},{stopId:'trento',departure:{delay:600}}]},statuses,now),null);
});
test('history is weighted by actual observations, with sufficiency threshold',()=>{
 const data=[{number:'16884',day:'2026-10-16',count:3,total:30,minutes:10,t:now-2*86400000},{number:'16884',day:'2026-10-17',count:3,total:60,minutes:20,t:now-86400000},{number:'16884',day:'2026-10-18',count:2,total:40,minutes:20,t:now},{number:'1826',day:'2026-10-18',count:100,total:999,minutes:9.99,t:now}];
 const h=trainHistory(data,'16884','2026-10-18');
 assert.equal(h.count,8);assert.equal(h.dayCount,3);assert.equal(h.sufficient,true);
 assert.equal(h.mean,16.25);
 assert.equal(trainHistory(data,'1826','2026-10-18').sufficient,false);
 assert.equal(trainHistory([], '16884','2026-10-18').mean,null);
});
