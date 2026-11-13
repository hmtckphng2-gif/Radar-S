import test from 'node:test';
import assert from 'node:assert/strict';
import {trainHistory,supportedRecovery} from '../public/radar57-logic.mjs';
const now=Date.parse('2026-10-18T18:00:00Z');
test('historical delay uses only matching train and measured days',()=>{
 const a=[{number:'16884',day:'2026-10-16',minutes:12,t:now-172800000},{number:'16884',day:'2026-10-17',minutes:18,t:now-86400000},{number:'12345',day:'2026-10-17',minutes:99,t:now-86400000}];
 const result=trainHistory(a,'16884','2026-10-18');
 assert.equal(result.count,2);assert.equal(result.dayCount,2);assert.equal(result.mean,15);assert.equal(result.sufficient,false);
});
test('grounded stop-specific recovery from fresh GTFS-RT',()=>{
 const row={kind:'train',source:'sta',stopId:'trento',delaySec:840};
 const update={fetchedAt:now-2000,tripStartDate:'20261018',stops:[{stopId:'mori',departure:{delay:1200}},{stopId:'trento',arrival:{delay:840}}]};
 const result=supportedRecovery(row,update,{sta_updates:'ok'},now,'2026-10-18');
 assert.equal(result.gained,6);assert.equal(result.upstreamMinutes,20);assert.equal(result.targetMinutes,14);
});
test('stale, mismatched, and unknown predictions are rejected',()=>{
 const row={kind:'train',source:'sta',stopId:'trento',delaySec:840};
 const update={fetchedAt:now-150000,tripStartDate:'20261018',stops:[{stopId:'mori',departure:{delay:1200}},{stopId:'trento',departure:{delay:840}}]};
 assert.equal(supportedRecovery(row,update,{sta_updates:'ok'},now,'2026-10-18'),null);
 assert.equal(supportedRecovery(row,{...update,fetchedAt:now},{sta_updates:'error'},now,'2026-10-18'),null);
 assert.equal(supportedRecovery({...row,delaySec:null},{...update,fetchedAt:now},{sta_updates:'ok'},now,'2026-10-18'),null);
 assert.equal(supportedRecovery(row,{...update,fetchedAt:now},{sta_updates:'ok'},now,'2026-10-17'),null);
});
test('no invented recovery if the earlier stop reports no delay',()=>{
 const row={kind:'train',source:'sta',stopId:'trento',delaySec:840};
 const update={fetchedAt:now,stops:[{stopId:'mori',departure:{time:42}},{stopId:'trento',departure:{delay:840}}]};
 assert.equal(supportedRecovery(row,update,{sta_updates:'ok'},now,'2026-10-18'),null);
});
