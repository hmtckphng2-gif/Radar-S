import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrafficIssues,feedDiagnostics,summarizeNetwork,matchesFavoriteIssue,resolveRollingStock} from '../radar58-logic.mjs';
const now=Date.parse('2026-10-18T12:00:00Z');
const day='2026-10-18';
const db={meta:{ready:true,days:[day]},trips:{bus:['busroute','Leifers',null,'110',null,true],train:['trainroute','Meran',null,'REG 16884',null,true]},routes:{busroute:['110','Bozen – Leifers',3],trainroute:['REG','Bozen – Meran',2]}};
const times={bus:[['a',50500,50500,1],['b',51000,51000,2]],train:[['a',50500,50500,1],['b',52000,52000,2]]};
const make=(update,source='sta',tripId='bus')=>({indexes:{sta:structuredClone(db)},details:{sta:{times}},updates:new Map([[source+':'+tripId,update]]),statuses:{sta_updates:'ok'}});
const update={fetchedAt:now-3000,tripStartDate:'2026-10-18'};
test('a fresh official bus cancellation becomes a red issue',()=>{
 const r=collectTrafficIssues(make({...update,scheduleRelationship:'CANCELED'}),now);
 assert.equal(r.length,1);assert.equal(r[0].kind,'bus');assert.equal(r[0].line,'110');assert.equal(r[0].severity,'danger')
});
test('a fresh upcoming stop-specific bus delay becomes a warning',()=>{
 const r=collectTrafficIssues(make({...update,stops:[{stopId:'a',departure:{delay:840}}]}),now);
 assert.equal(r.length,1);assert.equal(r[0].severity,'delay');assert.equal(r[0].minutes,14);
 assert.match(r[0].detail,/nächsten gemeldeten Halt/);
});
test('stale feeds and nonvalidated schedule never imply cancellation',()=>{
 assert.deepEqual(collectTrafficIssues(make({...update,fetchedAt:now-200000,scheduleRelationship:'CANCELED'}),now),[]);
 const s=make({...update,scheduleRelationship:'CANCELED'});s.statuses.sta_updates='error';
 assert.deepEqual(collectTrafficIssues(s,now),[]);
 const t=make({...update,scheduleRelationship:'CANCELED'});t.indexes.sta.meta.days=['2026-10-17'];
 assert.deepEqual(collectTrafficIssues(t,now),[]);
});
test('train rail types and line number are read from GTFS',()=>{
 const r=collectTrafficIssues(make({...update,scheduleRelationship:'3'},'sta','train'),now);
 assert.equal(r[0].kind,'train');assert.equal(r[0].line,'REG 16884');
});
test('missing delays and only feed errors generate no red banner',()=>{
 assert.deepEqual(collectTrafficIssues(make({...update,stops:[{stopId:'a',departure:{time:123}}]}),now),[]);
 assert.deepEqual(feedDiagnostics({sta:'error',sta_updates:'ok'}).map(x=>x.ok),[false,true]);
});
test('network summaries group repeated trip-level observations by line',()=>{
 const rows=summarizeNetwork([{kind:'bus',line:'110',severity:'delay',minutes:13},{kind:'bus',line:'110',severity:'danger'},{kind:'train',line:'REG 16884',severity:'delay',minutes:18}]);
 assert.equal(rows.length,2);
 const bus=rows.find(x=>x.line==='110');assert.equal(bus.cancelled,1);assert.equal(bus.delayed,1);
});
test('favorite matching has strict source and line checks',()=>{
 const x={source:'sta',line:'110',tripId:'foo'};
 assert.equal(matchesFavoriteIssue(x,[{type:'line',value:'110',source:'sta'}]),true);
 assert.equal(matchesFavoriteIssue(x,[{type:'line',value:'110',source:'trentino'}]),false);
 assert.equal(matchesFavoriteIssue(x,[{type:'line',value:'11',source:'sta'}]),false);
});
test('unknown rolling stock is never inferred from train number',()=>{
 assert.deepEqual(resolveRollingStock({kind:'train',name:'REG 16884',vehicleId:'123'}),{name:'Unbekannt',evidence:'Modell im aktuellen Live-Feed nicht bestätigt'});
 assert.equal(resolveRollingStock({kind:'train',vehicleModel:'Stadler FLIRT'}).name,'Stadler FLIRT');
});
