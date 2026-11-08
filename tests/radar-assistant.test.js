import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAssistantEvidence,validateAssistantResult,romeServiceDay} from '../public/radar-assistant-logic.mjs';

const now=Date.parse('2026-11-08T12:00:00Z'),stamp=Math.floor(now/1000),day=romeServiceDay(now);
const index={meta:{ready:true,days:[day]},routes:{R1:['REG','Regionale','2']},trips:{T16685:['R1','Meran','shape','16685','service',true]}};
const positions={trains:{header:{timestamp:stamp},entity:[{id:'vehicle-1',vehicle:{trip:{tripId:'T16685',routeId:'R1',startDate:day.replaceAll('-','')},vehicle:{id:'v1',label:'REG 16685'},timestamp:stamp,position:{latitude:46.5,longitude:11.35}}}]}};
const updates={trains_updates:{header:{timestamp:stamp},entity:[{tripUpdate:{trip:{tripId:'T16685',startDate:day.replaceAll('-','')},timestamp:stamp,stopTimeUpdate:[{stopId:'S1',stopSequence:5,arrival:{delay:480}}]}}]}};

test('assistant evidence requires a fresh feed and a current-day exact GTFS trip match',()=>{
 const facts=buildAssistantEvidence({positions,updates,indexes:{trains:index},now});
 assert.equal(facts.length,2);assert.ok(facts.some(x=>x.id==='position:trains:16685:T16685'));assert.ok(facts.some(x=>x.id==='delay:trains:16685:T16685:5:arrival'));
 assert.doesNotMatch(JSON.stringify(facts),/46\.5|11\.35/);
 const stale=buildAssistantEvidence({positions:{trains:{header:{timestamp:stamp-600},entity:positions.trains.entity}},updates,indexes:{trains:index},now});assert.equal(stale.length,1);assert.equal(stale[0].type,'delay');
 const oldIndex={...index,meta:{ready:true,days:['2026-11-07']}};assert.equal(buildAssistantEvidence({positions,updates,indexes:{trains:oldIndex},now}).length,0);
});

test('assistant evidence refuses a conflicting route ID or service date',()=>{
 const wrongRouteUpdates={trains_updates:{header:{timestamp:stamp},entity:[{tripUpdate:{trip:{tripId:'T16685',routeId:'OTHER',startDate:day.replaceAll('-','')},timestamp:stamp,stopTimeUpdate:[{stopSequence:5,arrival:{delay:480}}]}}]}};
 assert.equal(buildAssistantEvidence({positions:{},updates:wrongRouteUpdates,indexes:{trains:index},now}).length,0);
 const wrongDayUpdates={trains_updates:{header:{timestamp:stamp},entity:[{tripUpdate:{trip:{tripId:'T16685',routeId:'R1',startDate:'20261107'},timestamp:stamp,stopTimeUpdate:[{stopSequence:5,arrival:{delay:480}}]}}]}};
 assert.equal(buildAssistantEvidence({positions:{},updates:wrongDayUpdates,indexes:{trains:index},now}).length,0);
});

test('assistant rejects fabricated or unsupported model evidence IDs',()=>{
 const facts=buildAssistantEvidence({positions,updates,indexes:{trains:index},now});
 const valid={summary:'Zug 16685 ist sichtbar.',evidence:['position:trains:16685:T16685'],reasons:[{text:'GTFS-RT meldet acht Minuten.',evidence:['delay:trains:16685:T16685:5:arrival'],confidence:'high'}],options:[]};
 assert.equal(validateAssistantResult(JSON.stringify(valid),facts).evidenceFacts.length,2);
 assert.equal(validateAssistantResult(JSON.stringify({...valid,evidence:['invented']}),facts),null);
 assert.equal(validateAssistantResult(JSON.stringify({...valid,options:[{text:'Alternative',evidence:['invented']}]}),facts),null);
 assert.equal(validateAssistantResult('not json',facts),null);
});


test('assistant recognizes a current-day cancellation even when no vehicle position exists',()=>{
 const cancelled={trains_updates:{header:{timestamp:stamp},entity:[{tripUpdate:{trip:{tripId:'T16685',routeId:'R1',startDate:day.replaceAll('-',''),scheduleRelationship:'CANCELED'},timestamp:stamp}}]}};
 const facts=buildAssistantEvidence({positions:{},updates:cancelled,indexes:{trains:index},now});
 assert.equal(facts.length,1);assert.equal(facts[0].type,'cancellation');assert.match(facts[0].text,/ausgefallen/);
});
