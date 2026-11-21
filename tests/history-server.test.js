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

test('history status exposes per-source and current-day write diagnostics',async()=>{
 const db={prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async first(){if(sql.includes('vehicle_observations'))return sql.includes('WHERE')?{total:4}:{total:12,latest:now/1000};if(sql.includes('stop_delay_events'))return sql.includes('WHERE')?{total:3}:{total:8,latest:now/1000};return null;},async all(){if(sql.includes('vehicle_observations'))return {results:[{source:'sta',total:7,latest:now/1000},{source:'trains',total:5,latest:now/1000}]};return {results:[{source:'trains',total:8,latest:now/1000}]};}};return statement;}};
 const response=await historyApi(new Request('https://radar.example/api/history/status'),{HISTORY_DB:db,HISTORY_COLLECTOR_ENABLED:'true'});
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.today.totalWrites,7);assert.equal(body.today.stopUpdates,3);
 assert.deepEqual(body.bySource.stopUpdates.map(row=>row.source),['trains']);
 assert.equal(body.projectedMaxWritesPerDay,13824);
});

test('history diagnostics expose trip ids and forecasts with or without delay values',async()=>{
 const db={prepare(sql){const statement={bind(){return statement;},async all(){
  if(sql.includes('GROUP BY source ORDER BY source'))return {results:[{source:'trains',total:95,withDelay:12,withoutDelay:83,distinctTrips:4,distinctStops:20,latest:now/1000}]};
  if(sql.includes('GROUP BY source,trip_id,trip_start_date'))return {results:[{source:'trains',trip_id:'16656',trip_start_date:'20261121',records:10,withDelay:2,withoutDelay:8,distinctStops:5,latest:now/1000}]};
  return {results:[{source:'trains',trip_id:'16656',trip_start_date:'20261121',stop_id:'A',stop_sequence:1,event_type:'arrival',delay_seconds:null,scheduled_at:1795280000,predicted_at:1795280060,collected_at:now/1000}]};
 }};return statement;}};
 const response=await historyApi(new Request('https://radar.example/api/history/diagnostics?source=trains&hours=168'),{HISTORY_DB:db});
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.scope,'stop-delay-diagnostics');assert.equal(body.bySource[0].total,95);
 assert.equal(body.bySource[0].withoutDelay,83);assert.equal(body.tripGroups[0].trip_id,'16656');
 assert.equal(body.latestUpdates[0].delay_seconds,null);
});
