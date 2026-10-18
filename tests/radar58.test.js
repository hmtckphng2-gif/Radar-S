import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrafficIssues,summarizeNetwork,feedDiagnostics,matchesFavorite,rollingStockEvidence} from '../public/radar58-logic.mjs';
const now=Date.parse('2026-10-18T10:00:00Z');
function state(overrides={}){
 const trip=['R','Leifers',0,'110',0,true],route=['110','Bozen-Leifers',3];
 return {
  updates:new Map([['sta:trip110',{fetchedAt:now,tripStartDate:'20261018',delay:720,stops:[{stopId:'S1',departure:{delay:720}}]}]]),
  indexes:{sta:{meta:{ready:true,days:['2026-10-18']},trips:{trip110:trip},routes:{R:route}}},
  details:{sta:{times:{trip110:[['S1',43200,43200,1]]},stops:{S1:['Bozen']}}},
  statuses:{sta_updates:'ok'},...overrides
 };
}
test('fresh and valid bus problem has source and exact line',()=>{
 const issues=collectTrafficIssues(state(),now);
 assert.equal(issues.length,1);assert.equal(issues[0].line,'110');assert.equal(issues[0].kind,'bus');
 assert.equal(issues[0].minutes,12);assert.equal(issues[0].source,'sta');
});
test('stale feed, broken source and wrong date never trigger red alerts',()=>{
 const base=state(),u=base.updates.get('sta:trip110');
 assert.deepEqual(collectTrafficIssues(state({statuses:{sta_updates:'error'}}),now),[]);
 assert.deepEqual(collectTrafficIssues(state({updates:new Map([['sta:trip110',{...u,fetchedAt:now-200000}]])}),now),[]);
 assert.deepEqual(collectTrafficIssues(state({updates:new Map([['sta:trip110',{...u,tripStartDate:'20261017'}]])}),now),[]);
});
test('a confirmed cancellation is severe; unrelated missing positions are not cancellations',()=>{
 const base=state(),u=base.updates.get('sta:trip110');
 const records=collectTrafficIssues(state({updates:new Map([['sta:trip110',{...u,delay:null,scheduleRelationship:'CANCELED'}]])}),now);
 assert.equal(records.length,1);assert.equal(records[0].severity,'danger');
 assert.equal(collectTrafficIssues(state({updates:new Map()}),now).length,0);
});
test('line grouping, favorites matching and source health stay honest',()=>{
 const issues=collectTrafficIssues(state(),now);
 assert.equal(summarizeNetwork(issues)[0].delayed,1);
 assert.equal(matchesFavorite(issues[0],[{type:'line',source:'sta',value:'110'}]),true);
 assert.equal(matchesFavorite(issues[0],[{type:'line',source:'sta',value:'150'}]),false);
 assert.equal(feedDiagnostics({sta:'error',sta_updates:'ok'})[0].ok,false);
});
test('vehicle model not inferred from vehicle ID or train number',()=>{
 const v={kind:'train',name:'REG 16884',vehicleId:'ETR-170'};
 assert.equal(rollingStockEvidence(v).name,'Unbekannt');
 assert.equal(rollingStockEvidence({...v,vehicleModel:'FLIRT'}).name,'FLIRT');
});
