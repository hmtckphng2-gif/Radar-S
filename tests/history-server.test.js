import test from 'node:test';
import assert from 'node:assert/strict';
import {observationRows,stopDelayRows} from '../public/radar-history-logic.mjs';
import {historyApi,collectHistory} from '../public/radar-history-worker.mjs';
const now=Date.parse('2026-10-19T19:00:00Z');
test('only fresh actual feed observations are retained',()=>{
 const rows=observationRows({vehicles:[{id:'sta:1',source:'sta',kind:'bus',lat:46.5,lon:11.3,observedAt:'2026-10-19T18:59:00Z',positionType:'simulated'},{id:'old',source:'sta',kind:'bus',lat:46,lon:11,observedAt:'2026-10-19T17:00:00Z'}]},now);
 assert.equal(rows.length,1);assert.equal(rows[0].positionType,'simulated');
});
test('store only explicit stop predictions, not inferred arrivals',()=>{
 const rows=stopDelayRows({header:{timestamp:now/1000},entity:[{tripUpdate:{trip:{tripId:'T1',startDate:'20261019'},stopTimeUpdate:[{stopId:'A',stopSequence:1,arrival:{delay:120,time:1792436400}},{stopId:'B',stopSequence:2}]}}]},'trains',now);
 assert.equal(rows.length,1);assert.equal(rows[0].delaySeconds,120);assert.equal(rows[0].eventType,'arrival');
});
test('history API refuses to claim storage before binding exists',async()=>{
 const response=await historyApi(new Request('https://radar.example/api/history/status'),{});assert.equal(response.status,503);assert.equal((await response.json()).enabled,false);
});
test('scheduled collector remains disabled until a D1 binding exists',async()=>{
 const response=await collectHistory({},now);assert.equal(response.ok,false);
});
