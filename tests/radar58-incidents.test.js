import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrafficIssues,summarizeNetwork,matchesFavoriteIssue} from '../public/radar58-logic.mjs';
const now=Date.parse('2026-10-18T10:00:00Z');
function fixture(){
 return {
 indexes:{sta:{meta:{ready:true,days:['2026-10-18']},routes:{rail:['R','Regional',2],bus:['110','Bus',3]},
 trips:{t1:['rail','Meran',null,'16884',null,true],b1:['bus','Leifers',null,'',null,true]}}},
 details:{sta:{stops:{S1:['Bozen',0,0,'1'],S2:['Meran',0,0,'2']},
 times:{t1:[['S1',43200,43200,1],['S2',43260,43260,2]],b1:[['S1',43200,43200,1]]}}},
 statuses:{sta_updates:'ok'},
 updates:new Map([['sta:t1',{fetchedAt:now,tripStartDate:'20261018',stops:[{stopId:'S2',stopSequence:2,stopTimeProperties:{platformCode:'4'}}]}],
 ['sta:b1',{fetchedAt:now,tripStartDate:'20261018',stops:[{stopId:'S1',scheduleRelationship:'SKIPPED'}]}]])
 };
}
test('confirmed skipped bus stop does not imply full trip cancellation',()=>{
 const r=collectTrafficIssues(fixture(),now);
 assert.ok(r.some(x=>x.kind==='bus'&&x.severity==='danger'&&x.title.includes('Halt entfällt')));
 assert.ok(!r.some(x=>x.kind==='bus'&&x.title.includes('· Ausfall')));
});
test('verified train platform change is informational, not a false cancellation',()=>{
 const r=collectTrafficIssues(fixture(),now),x=r.find(x=>x.severity==='info');
 assert.ok(x);assert.match(x.title,/Gleiswechsel/);assert.match(x.detail,/2 → 4/);
 assert.equal(summarizeNetwork(r).find(x=>x.line==='16884').changed,1);
});
test('station favorites match only trips that actually serve the stop',()=>{
 const r=collectTrafficIssues(fixture(),now);
 const bus=r.find(x=>x.kind==='bus');
 assert.equal(matchesFavoriteIssue(bus,[{type:'station',source:'sta',value:'S1'}]),true);
 assert.equal(matchesFavoriteIssue(bus,[{type:'station',source:'sta',value:'S2'}]),false);
});
test('missing live feed does not manufacture incidents',()=>{
 const s=fixture();s.statuses.sta_updates='error';
 assert.deepEqual(collectTrafficIssues(s,now),[]);
});
