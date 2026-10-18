import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrafficIssues,summarizeNetwork,feedDiagnostics,matchingFavorite,rollingStockEvidence} from '../public/radar58-logic.mjs';

const now=Date.parse('2026-10-18T10:00:00Z');
function fixture(){
 const day='2026-10-18';
 return {
  indexes:{sta:{meta:{ready:true,days:[day]},routes:{bus:['110','Bolzano-Leifers',3],train:['R','Regionalzug',2]},
    trips:{b1:['bus','Leifers',null,'',null,true],t1:['train','Meran',null,'16884',null,true]}}},
  details:{sta:{stops:{S1:['Bolzano',0,0,'1'],S2:['Meran',0,0,'2']},
    times:{b1:[['S1',43200,43200,1]],t1:[['S1',43200,43200,1],['S2',43260,43260,2]]}}},
  statuses:{sta_updates:'ok'},
  updates:new Map([['sta:b1',{fetchedAt:now,tripStartDate:'20261018',
   stops:[{stopId:'S1',stopSequence:1,departure:{delay:900}}]}]])
 };
}
test('GTFS-RT confirms the affected bus line and stop-specific delay',()=>{
 const r=collectTrafficIssues(fixture(),now);
 assert.equal(r.length,1);assert.equal(r[0].line,'110');assert.equal(r[0].minutes,15);
 assert.equal(r[0].kind,'bus');assert.equal(r[0].severity,'delay');assert.match(r[0].detail,/Halt/);
});
test('missing vehicle positions or broken realtime feed cannot create a cancellation',()=>{
 const s=fixture();s.statuses.sta_updates='old';
 assert.deepEqual(collectTrafficIssues(s,now),[]);
 s.statuses.sta_updates='ok';s.updates.clear();
 assert.deepEqual(collectTrafficIssues(s,now),[]);
});
test('cancelled trip and skipped stop are different severe messages',()=>{
 const s=fixture();s.updates.set('sta:t1',{fetchedAt:now,tripStartDate:'20261018',scheduleRelationship:'CANCELED'});
 s.updates.set('sta:b1',{fetchedAt:now,tripStartDate:'20261018',
   stops:[{stopId:'S1',stopSequence:1,scheduleRelationship:'SKIPPED'}]});
 const r=collectTrafficIssues(s,now);
 assert.ok(r.some(x=>x.title.includes('16884 · Ausfall')));
 assert.ok(r.some(x=>x.title.includes('110 · Halt entfällt')));
 assert.ok(!r.some(x=>x.title.includes('110 · Ausfall')));
});
test('a verified platform reassignment is informational, not a train cancellation',()=>{
 const s=fixture();s.updates.set('sta:t1',{fetchedAt:now,tripStartDate:'20261018',
   stops:[{stopId:'S2',stopSequence:2,stopTimeProperties:{platformCode:'4'}}]});
 const r=collectTrafficIssues(s,now);
 const item=r.find(x=>x.severity==='info');
 assert.ok(item);assert.match(item.title,/Gleiswechsel/);assert.match(item.detail,/2 → 4/);
 assert.ok(!r.some(x=>x.severity==='danger'));
 assert.equal(summarizeNetwork(r).find(x=>x.line==='16884').changed,1);
});
test('an update for yesterday or stale data never creates a new active alert',()=>{
 const s=fixture();s.updates.get('sta:b1').fetchedAt=now-200000;
 assert.deepEqual(collectTrafficIssues(s,now),[]);
 s.updates.get('sta:b1').fetchedAt=now;s.updates.get('sta:b1').tripStartDate='20261017';
 assert.deepEqual(collectTrafficIssues(s,now),[]);
});
test('favorites match real line, stop and source',()=>{
 const s=fixture(),r=collectTrafficIssues(s,now)[0];
 assert.equal(matchingFavorite(r,[{type:'line',value:'110',source:'sta'}],s),true);
 assert.equal(matchingFavorite(r,[{type:'station',value:'S1',source:'sta'}],s),true);
 assert.equal(matchingFavorite(r,[{type:'line',value:'110',source:'trentino'}],s),false);
 assert.equal(matchingFavorite(r,[{type:'line',value:'150',source:'sta'}],s),false);
});
test('broken feed shown separately and train type not guessed from ID',()=>{
 assert.equal(feedDiagnostics({sta_updates:'ok',trentino_updates:'error'})[0].source,'trentino_updates');
 assert.equal(rollingStockEvidence({kind:'train',name:'REG 16884',vehicleId:'ETR 170'}).name,'Unbekannt');
 assert.equal(rollingStockEvidence({kind:'train',vehicleModel:'FLIRT'}).name,'FLIRT');
});

test('a later upcoming stop delay is detected after an on-time stop',()=>{
 const a=fixture();a.updates.set('sta:t1',{fetchedAt:now,tripStartDate:'20261018',stops:[{stopId:'S1',departure:{delay:0}},{stopId:'S2',departure:{delay:780}}]});
 const rows=collectTrafficIssues(a,now).filter(x=>x.tripId==='t1');
 assert.equal(rows.length,1);assert.equal(rows[0].minutes,13);assert.match(rows[0].detail,/Meran/);
});
test('skipped stop generates a stop-specific confirmed warning',()=>{
 const a=fixture();a.updates.set('sta:t1',{fetchedAt:now,tripStartDate:'20261018',stops:[{stopId:'S2',scheduleRelationship:'SKIPPED'}]});
 const rows=collectTrafficIssues(a,now).filter(x=>x.tripId==='t1');assert.equal(rows.length,1);assert.equal(rows[0].severity,'danger');assert.match(rows[0].detail,/Meran/);
});
test('cancelled whole journey does not also list its skipped stop',()=>{
 const a=fixture();a.updates.set('sta:t1',{fetchedAt:now,tripStartDate:'20261018',scheduleRelationship:'CANCELED',stops:[{stopId:'S2',scheduleRelationship:'SKIPPED'}]});
 const rows=collectTrafficIssues(a,now).filter(x=>x.tripId==='t1');assert.equal(rows.length,1);assert.equal(rows[0].severity,'danger');
});
