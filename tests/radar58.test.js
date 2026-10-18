import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrafficIssues,summarizeNetwork,feedDiagnostics,matchesFavorite,vehicleModelEvidence} from '../public/radar58-logic.mjs';
import {romeDay} from '../public/radar51-logic.mjs';
const now=Date.parse('2026-10-18T15:30:00Z');const day=romeDay(new Date(now));
function fixture(){
 return {
  indexes:{sta:{meta:{ready:true,days:[day]},trips:{tripBus:['busRoute','Leifers',null,'110',null,true],tripTrain:['trainRoute','Meran',null,'16884',null,true]},routes:{busRoute:['110','Bozen - Leifers',3],trainRoute:['RE','Bozen - Meran',2]}}},
  details:{sta:{times:{tripBus:[['bozen',63000,63060,1],['leifers',64100,64200,2]],tripTrain:[['bozen',63000,63060,1],['meran',64700,64800,2]]}}},
  updates:new Map([
   ['sta:tripBus',{fetchedAt:now,tripStartDate:day.replaceAll('-',''),stops:[{stopId:'bozen',departure:{delay:840}}]}],
   ['sta:tripTrain',{fetchedAt:now,tripStartDate:day.replaceAll('-',''),scheduleRelationship:'CANCELED',stops:[]}]
  ]),
  statuses:{sta_updates:'ok',sta:'ok'}
 };
}
test('warns of bus delay and train cancellation, preserving line identity',()=>{
 const issues=collectTrafficIssues(fixture(),now);
 assert.equal(issues.length,2);
 assert.equal(issues[0].severity,'danger');assert.equal(issues[0].kind,'train');assert.equal(issues[0].line,'16884');
 assert.equal(issues[1].line,'110');assert.equal(issues[1].minutes,14);assert.match(issues[1].detail,/Haltgenaue/);
});
test('stale and unavailable realtime feeds never create traffic alarms',()=>{
 const state=fixture();state.statuses.sta_updates='error';assert.deepEqual(collectTrafficIssues(state,now),[]);
 state.statuses.sta_updates='ok';state.updates.get('sta:tripBus').fetchedAt=now-200000;
 assert.equal(collectTrafficIssues(state,now).length,1);
 state.updates.get('sta:tripTrain').fetchedAt=now-200000;assert.deepEqual(collectTrafficIssues(state,now),[]);
});
test('network aggregation and feed health remain separate',()=>{
 const state=fixture();const issues=collectTrafficIssues(state,now);const groups=summarizeNetwork(issues);
 assert.equal(groups.length,2);assert.equal(groups[0].cancelled,1);
 const health=feedDiagnostics({sta_updates:'error',sta:'ok'});assert.equal(health[0].ok,false);
});
test('alert favorites match only explicit identifiers',()=>{
 const issue=collectTrafficIssues(fixture(),now).find(x=>x.kind==='bus');
 assert.equal(matchesFavorite(issue,[{type:'line',value:'110'}]),true);
 assert.equal(matchesFavorite(issue,[{type:'line',value:'111'}]),false);
 assert.equal(matchesFavorite(issue,[{type:'station',value:'bozen',source:'sta'}]),true);
 assert.equal(matchesFavorite(issue,[{type:'station',value:'bozen',source:'trentino'}]),false);
});
test('vehicle model not inferred from train number or ID',()=>{
 assert.equal(vehicleModelEvidence({kind:'train',name:'REG 16884',vehicleId:'1001'}).model,null);
 assert.equal(vehicleModelEvidence({kind:'train',vehicleModel:'Stadler FLIRT'}).model,'Stadler FLIRT');
 assert.equal(vehicleModelEvidence({kind:'train',vehicleModel:'Stadler FLIRT',stale:true}).model,null);
});
