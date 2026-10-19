import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVehicles} from '../public/core.js';
import {mergeStationDepartures} from '../public/radar53-logic.mjs';
const now=Date.now();
const vehicleFeed={entity:[{id:'v',vehicle:{trip:{trip_id:'t',route_id:'r'},vehicle:{id:'v'},position:{latitude:46.5,longitude:11.35},timestamp:now/1000}}]};
test('an explicit bus route remains a bus even in the trains source',()=>{
 const db={trains:{trips:{t:['r','Bozen','','16685']},routes:{r:['110','Bus',3]}}};
 assert.equal(parseVehicles(vehicleFeed,'trains',db,now).vehicles[0].kind,'bus');
});
test('same target and time are insufficient to merge anonymous cross-source trains',()=>{
 const a={source:'sta',tripId:'a',number:'REG',headsign:'Trento',sec:67000};
 const b={...a,source:'trains',tripId:'b',number:'16773'};
 assert.equal(mergeStationDepartures([a,b]).length,2);
});
test('two missing trip IDs must not count as confirmed same-source identity',()=>{
 const a={source:'sta',number:'REG',headsign:'Trento',sec:67000};
 assert.equal(mergeStationDepartures([a,{...a,sec:67030}]).length,2);
});
test('confirmed train number and service day allow duplicate consolidation',()=>{
 const a={source:'sta',tripId:'a',number:'16773',headsign:'Trento',sec:67000,serviceDay:'2026-10-18',stationKey:'bozen',directionId:'0'};
 assert.equal(mergeStationDepartures([a,{...a,source:'trains',tripId:'b',delaySec:120}]).length,1);
});
test('same train number on different days stays separate',()=>{
 const a={source:'sta',tripId:'a',number:'16773',headsign:'Trento',sec:67000,serviceDay:'2026-10-18'};
 assert.equal(mergeStationDepartures([a,{...a,source:'trains',serviceDay:'2026-10-19'}]).length,2);
});
const logic=await import('../public/radar54-logic.mjs').catch(()=>({}));
test('stale positions never animate',()=>{assert.equal(logic.motionDuration?.({stale:true,timestamp:now/1000},null,now),0)});
test('same observation timestamp never animates',()=>{assert.equal(logic.motionDuration?.({timestamp:now/1000},now/1000,now),0)});
test('new fresh observation uses a brief transition',()=>{assert.equal(logic.motionDuration?.({timestamp:now/1000},now/1000-20,now),900)});
test('platforms come from explicit metadata, never a stop ID suffix',()=>{
 assert.deepEqual(logic.platformInfo?.(['Bozen',46.5,11.3,'2'],null),{planned:'2',current:'2',changed:false,live:false});
 assert.equal(logic.platformInfo?.(['Bozen',46.5,11.3],null)?.current,null);
});
test('day history has data gaps instead of invented measurements',()=>{
 const daily=logic.aggregateDays?.([{number:'16685',day:'2026-10-17',minutes:4,t:now-86400000}], '16685',7,'2026-10-18');
 assert.equal(daily?.length,7);assert.equal(daily?.at(-1).minutes,null);assert.equal(daily?.at(-2).minutes,4);
});
import {buildDepartureRows} from '../public/radar51-logic.mjs';
test('STA railway departures retain the official train number and platform',()=>{
 const date=new Date('2026-10-18T16:00:00Z');const indexes={sta:{meta:{ready:true,days:['2026-10-18']},routes:{r:['REG','Rail',2]},trips:{t:['r','Trento','','16773','s',true,'0']}}};
 const details={sta:{stops:{s:['Bozen',46.5,11.3,'3']},times:{t:[['s',67000,67000,1]]}}};
 const row=buildDepartureRows([{source:'sta',stopId:'s',name:'Bozen'}],indexes,details,new Map(),{}, {now:date}).rows[0];
 assert.equal(row.number,'16773');assert.equal(row.platform.current,'3');assert.equal(row.kind,'train');
});
test('assigned realtime platform is read via its actual GTFS stop',()=>{
 assert.equal(logic.platformInfo?.(['Bozen',46,11,'2'],{stop_time_properties:{assigned_stop_id:'p4'}},{p4:['Bozen',46,11,'4']})?.current,'4');
});
test('different buses from different feeds must not be merged by numeric line',()=>{
 const a={source:'sta',tripId:'a',kind:'bus',number:'110',headsign:'Bozen',sec:67000,serviceDay:'2026-10-18'};
 assert.equal(mergeStationDepartures([a,{...a,source:'trentino',tripId:'b'}]).length,2);
});
import {recordObservation} from '../public/radar54-logic.mjs';
test('recording rejects stale samples and throttles repeated observations',()=>{
 const s={number:'16685',day:'2026-10-18',source:'trains',tripId:'r',minutes:3,t:now};
 assert.equal(recordObservation([],s,now).length,1);
 assert.equal(recordObservation([s],{...s,t:now+20000},now+20000).length,1);
 assert.equal(recordObservation([],{...s,t:now-180000},now).length,0);
});
test('train-only board is filtered before the departure row limit',()=>{
 const date=new Date('2026-10-18T16:00:00Z'),trips={},times={};
 for(let i=0;i<90;i++){trips['b'+i]=['bus','Bozen','','','s',true,'0'];times['b'+i]=[['s',64900+i,64900+i,1]]}
 trips.t=['r','Trento','','16773','s',true,'0'];times.t=[['s',67000,67000,1]];
 const db={meta:{ready:true,days:['2026-10-18']},routes:{r:['REG','Rail',2],bus:['110','Bus',3]},trips};
 const result=buildDepartureRows([{source:'sta',stopId:'s',name:'Bozen'}],{sta:db},{sta:{stops:{s:['Bozen',46.5,11.3]},times}},new Map(),{}, {now:date,kind:'train'});
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].number,'16773');
});
test('history observations accumulate into one daily record instead of evicting old days',()=>{
 const s={number:'16685',day:'2026-10-18',source:'trains',tripId:'r',minutes:3,t:now};
 let rows=recordObservation([],s,now);rows=recordObservation(rows,{...s,minutes:9,t:now+300000},now+300000);
 assert.equal(rows.length,1);assert.equal(aggregateDays(rows,'16685',1,'2026-10-18')[0].minutes,6);assert.equal(aggregateDays(rows,'16685',1,'2026-10-18')[0].count,2);
});
import {aggregateDays} from '../public/radar54-logic.mjs';
test('sequence-only realtime platform changes are displayed on the departure board',()=>{
 const date=new Date('2026-10-18T16:00:00Z');const db={meta:{ready:true,days:['2026-10-18']},routes:{r:['REG','Rail',2]},trips:{t:['r','Trento','','16773','s',true,'0']}};
 const det={stops:{s:['Bozen',46,11,'2'],p:['Bozen',46,11,'4']},times:{t:[['s',67000,67000,5]]}};
 const u={fetchedAt:date.getTime(),stops:[{stop_sequence:5,departure:{delay:0},stop_time_properties:{assigned_stop_id:'p'}}]};
 const rows=buildDepartureRows([{source:'sta',stopId:'s',name:'Bozen'}],{sta:db},{sta:det},new Map([['sta:t',u]]),{sta_updates:'ok'},{now:date}).rows;
 assert.equal(rows[0].platform.current,'4');
});
