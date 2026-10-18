import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrafficIssues,summarizeNetwork,feedDiagnostics,matchesFavorite,resolveRollingStock} from '../public/radar58-logic.mjs';
const now=Date.parse('2026-10-18T12:00:00Z'),day='2026-10-18';
const base=()=>({
 statuses:{sta_updates:'ok',sta:'ok',trentino:'error'},
 indexes:{sta:{meta:{ready:true,days:[day]},routes:{
  bus:['110','Bozen → Leifers',3],train:['REG','Bozen → Meran',2]
 },trips:{
  b1:['bus','Leifers',null,'110',null,true],
  t1:['train','Meran',null,'REG 16884',null,true],
  b2:['bus','Bozen',null,'110',null,true]
 }}},
 details:{sta:{times:{
  b1:[['s1',52000,52020,1]],t1:[['s1',52100,52120,1]],b2:[['s2',52200,52220,1]]
 }}},
 updates:new Map([
  ['sta:b1',{fetchedAt:now-1200,tripStartDate:'20261018',delay:null,stops:[{stopId:'s1',departure:{delay:900}}]}],
  ['sta:t1',{fetchedAt:now-1200,tripStartDate:'20261018',scheduleRelationship:'CANCELED',stops:[]}],
  ['sta:b2',{fetchedAt:now-121000,tripStartDate:'20261018',delay:1800,stops:[]}]
 ])
});
test('only today valid fresh official updates trigger issues',()=>{
 const events=collectTrafficIssues(base(),now);
 assert.equal(events.length,2);
 assert.equal(events.find(x=>x.kind==='bus').line,'110');
 assert.equal(events.find(x=>x.kind==='bus').minutes,15);
 assert.equal(events.find(x=>x.kind==='train').severity,'danger');
 assert.ok(!events.find(x=>x.tripId==='b2'));
});
test('wrong service day, failed update feeds, invalid static data must not alert',()=>{
 const state=base();state.statuses.sta_updates='error';
 assert.equal(collectTrafficIssues(state,now).length,0);
 state.statuses.sta_updates='ok';state.indexes.sta.meta.days=['2026-10-17'];
 assert.equal(collectTrafficIssues(state,now).length,0);
});
test('favorites matching is scoped to exact line or train and optional source',()=>{
 const issue=collectTrafficIssues(base(),now).find(x=>x.kind==='bus');
 assert.equal(matchesFavorite(issue,[{type:'line',value:'110',source:'sta'}]),true);
 assert.equal(matchesFavorite(issue,[{type:'line',value:'11',source:'sta'}]),false);
 assert.equal(matchesFavorite(issue,[{type:'line',value:'110',source:'trentino'}]),false);
 assert.equal(matchesFavorite(issue,[{type:'station',value:'s1'}]),true);
});
test('network and health remain source-aware',()=>{
 const events=collectTrafficIssues(base(),now);
 assert.equal(summarizeNetwork(events).length,2);
 assert.equal(feedDiagnostics(base().statuses)[0].source,'trentino');
});
test('vehicle IDs never become invented rolling-stock models',()=>{
 assert.equal(resolveRollingStock({kind:'train',vehicleId:'A-123'}).name,'Unbekannt');
 assert.equal(resolveRollingStock({kind:'train',vehicleModel:'FLIRT',stale:false}).name,'FLIRT');
 assert.equal(resolveRollingStock({kind:'train',vehicleModel:'FLIRT',stale:true}).name,'Unbekannt');
});
