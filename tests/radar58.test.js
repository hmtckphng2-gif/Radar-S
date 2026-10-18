import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrafficIssues,summarizeNetwork,feedDiagnostics,matchingFavorite,rollingStockEvidence} from '../public/radar58-logic.mjs';
const now=Date.parse('2026-10-18T12:00:00Z'),day='2026-10-18';
function fixture(type=3){
 return {statuses:{sta_updates:'ok',sta:'ok'},
  indexes:{sta:{meta:{ready:true,days:[day]},trips:{t1:['r1','Leifers',null,'16884',null,true]},routes:{r1:[type===3?'110':'REG','',type]}}},
  details:{sta:{times:{t1:[['bolzano',51000,51020,1],['leifers',52000,52030,2]]},stops:{bolzano:['Bolzano'],leifers:['Leifers']}}},
  updates:new Map([['sta:t1',{fetchedAt:now,tripStartDate:'20261018',delay:840,stops:[]}]])};
}
test('fresh official trip-wide delay is included for bus',()=>{
 const rows=collectTrafficIssues(fixture(),now);
 assert.equal(rows.length,1);assert.equal(rows[0].kind,'bus');assert.equal(rows[0].line,'110');assert.equal(rows[0].minutes,14);
});
test('rail type reports specific train number',()=>{
 const rows=collectTrafficIssues(fixture(2),now);
 assert.equal(rows[0].kind,'train');assert.equal(rows[0].line,'16884');
});
test('stale or invalid GTFS must never produce red alerts',()=>{
 const a=fixture();a.updates.get('sta:t1').fetchedAt=now-180000;
 assert.equal(collectTrafficIssues(a,now).length,0);
 a.updates.get('sta:t1').fetchedAt=now;a.statuses.sta_updates='error';
 assert.equal(collectTrafficIssues(a,now).length,0);
 a.statuses.sta_updates='ok';a.indexes.sta.meta.days=['2026-10-17'];
 assert.equal(collectTrafficIssues(a,now).length,0);
});
test('GTFS-RT cancellation is a danger alert, without invented delay',()=>{
 const a=fixture();a.updates.get('sta:t1').delay=null;
 a.updates.get('sta:t1').scheduleRelationship='CANCELED';
 const rows=collectTrafficIssues(a,now);
 assert.equal(rows.length,1);assert.equal(rows[0].severity,'danger');assert.equal(rows[0].minutes,null);
});
test('stop-specific delay is labeled as such, without claiming entire line',()=>{
 const a=fixture();const u=a.updates.get('sta:t1');u.delay=null;
 u.stops=[{stopId:'bolzano',stopSequence:1,departure:{delay:960}}];
 const rows=collectTrafficIssues(a,now);
 assert.equal(rows.length,1);assert.match(rows[0].detail,/für Halt Bolzano/);assert.equal(rows[0].minutes,16);
});
test('missing stop or zero delay does not invent problems',()=>{
 const a=fixture();const u=a.updates.get('sta:t1');u.delay=null;
 u.stops=[{stopId:'unrelated',departure:{delay:1800}}];
 assert.equal(collectTrafficIssues(a,now).length,0);
 u.stops=[{stopId:'bolzano',departure:{delay:0}}];
 assert.equal(collectTrafficIssues(a,now).length,0);
});
test('favorite matching respects source and actual route',()=>{
 const a=fixture(),issue=collectTrafficIssues(a,now)[0];
 assert.equal(matchingFavorite(issue,[{type:'line',value:'110',source:'sta'}],a),true);
 assert.equal(matchingFavorite(issue,[{type:'line',value:'150',source:'sta'}],a),false);
 assert.equal(matchingFavorite(issue,[{type:'station',value:'bolzano',source:'sta'}],a),true);
 assert.equal(matchingFavorite(issue,[{type:'station',value:'bolzano',source:'trentino'}],a),false);
});
test('network groups correctly and feed errors never become disruption flags',()=>{
 const issues=collectTrafficIssues(fixture(),now),network=summarizeNetwork(issues);
 assert.equal(network[0].delayed,1);assert.equal(network[0].cancelled,0);
 assert.equal(feedDiagnostics({sta_updates:'error',sta:'ok'})[0].ok,false);
});
test('unverified rolling stock models remain unknown',()=>{
 assert.equal(rollingStockEvidence({kind:'train',vehicleId:'12345'}).name,'Unbekannt');
 assert.equal(rollingStockEvidence({kind:'train',vehicleModel:'Stadler FLIRT'}).name,'Stadler FLIRT');
});
