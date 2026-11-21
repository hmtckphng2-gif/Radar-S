import test from 'node:test';
import assert from 'node:assert/strict';
import {remainingBudget,changedStopEvents,summarizeDelays,gtfsTripShortName,routeProgress,DAILY_WRITE_BUDGET,PER_RUN_VEHICLES,PER_RUN_STOP_EVENTS,simulateDailyWrites} from '../public/radar75-history-logic.mjs';
test('history daily budget never exceeds conservative cap',()=>{assert.equal(remainingBudget(15000),0);assert.equal(remainingBudget(14999),1);assert.equal(remainingBudget(999999),0);assert.equal(remainingBudget(0),DAILY_WRITE_BUDGET)});
test('unchanged stop forecasts are suppressed',()=>{const r={source:'sta',tripId:'1',tripStartDate:'20261020',stopId:'BZ',stopSequence:1,eventType:'arrival',delaySeconds:120,predictedAt:1770000000};const k='sta|1|20261020|BZ|1|arrival';assert.deepEqual(changedStopEvents([r],new Map([[k,{delaySeconds:120,predictedAt:1770000000}]])),[]);assert.equal(changedStopEvents([r],new Map([[k,{delaySeconds:60,predictedAt:1770000000}]] )).length,1)});
test('dedupe identical stop events in one feed and cap rows',()=>{const a={source:'sta',tripId:'1',tripStartDate:'20261020',stopId:'BZ',stopSequence:1,eventType:'arrival',delaySeconds:120,predictedAt:10};assert.equal(changedStopEvents([a,a],new Map(),1).length,1)});
test('history analytics uses only numeric forecast values',()=>{assert.deepEqual(summarizeDelays([{delay_seconds:60},{delay_seconds:120},{delay_seconds:-60}]),{sampleCount:3,averageMinutes:0.7,medianMinutes:1,latePercent:33,kind:'feed_forecasts_not_confirmed_arrivals'});assert.equal(summarizeDelays([]).averageMinutes,null)});
test('history collector remains opt-in and cron disabled in deployment configuration',async()=>{const fs=await import('node:fs/promises');const cfg=JSON.parse(await fs.readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.deepEqual(cfg.triggers.crons,[]);const code=await fs.readFile(new URL('../public/radar-history-worker.mjs',import.meta.url),'utf8');assert.match(code,/HISTORY_COLLECTOR_ENABLED/)});

test('stop sampling round-robins all feeds and trips instead of starving later sources',()=>{
 const rows=[];
 for(const source of ['sta','trentino','trains'])for(let trip=1;trip<=8;trip++)for(let stop=1;stop<=3;stop++)rows.push({source,tripId:source+'-'+trip,tripStartDate:'20261119',stopId:source+'-stop-'+stop,stopSequence:stop,eventType:'arrival',delaySeconds:trip*10+stop,predictedAt:1000+stop});
 const selected=changedStopEvents(rows,new Map(),12,0);
 const counts=Object.fromEntries(['sta','trentino','trains'].map(source=>[source,selected.filter(row=>row.source===source).length]));
 assert.deepEqual(counts,{sta:4,trentino:4,trains:4});
 for(const source of Object.keys(counts)){const trips=selected.filter(row=>row.source===source).map(row=>row.tripId);assert.equal(new Set(trips).size,4);}
});

test('stop sampling rotates its starting trip between collector runs',()=>{
 const rows=[];for(let trip=1;trip<=6;trip++)rows.push({source:'trains',tripId:'T'+trip,tripStartDate:'20261119',stopId:'S'+trip,stopSequence:1,eventType:'arrival',delaySeconds:60,predictedAt:1000});
 const first=changedStopEvents(rows,new Map(),2,0).map(row=>row.tripId);
 const next=changedStopEvents(rows,new Map(),2,1).map(row=>row.tripId);
 assert.notDeepEqual(first,next);
});

test('GTFS trip ids expose the exact static trip_short_name for v and p identifiers',()=>{
 assert.equal(gtfsTripShortName('0083_10083_0_v_1-18367-3CB8-0083_v_1-18367-3CB8-0083'),'18367');
 assert.equal(gtfsTripShortName('0083_60083_0_p_6-315-24D-0083_p_6-315-24D-0083'),'315');
 assert.equal(gtfsTripShortName('not-a-gtfs-trip-id'),null);
});
test('route progress compares consecutive arrival forecasts and reports recovered or lost minutes',()=>{
 const rows=[
  {source:'trains',trip_id:'T1',trip_start_date:'20261121',stop_id:'A',stop_sequence:1,event_type:'arrival',delay_seconds:300},
  {source:'trains',trip_id:'T1',trip_start_date:'20261121',stop_id:'A',stop_sequence:1,event_type:'departure',delay_seconds:360},
  {source:'trains',trip_id:'T1',trip_start_date:'20261121',stop_id:'B',stop_sequence:2,event_type:'arrival',delay_seconds:120},
  {source:'trains',trip_id:'T1',trip_start_date:'20261121',stop_id:'C',stop_sequence:3,event_type:'arrival',delay_seconds:420}
 ];
 const progress=routeProgress(rows);
 assert.deepEqual(progress.map(x=>[x.fromStopId,x.toStopId,x.changeMinutes,x.status]),[['A','B',-3,'recovered'],['B','C',5,'lost']]);
});
