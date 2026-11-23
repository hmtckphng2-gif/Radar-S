import test from 'node:test';
import assert from 'node:assert/strict';
import {actualArrivalRows,trainCandidates} from '../public/actual-arrivals-logic.mjs';

test('stores only explicit official actual arrival timestamps',()=>{
 const now=Date.parse('2026-11-23T12:10:00Z');
 const candidate={number:'758',day:'2026-11-23',tripId:'0083_340083_0_v_34-758-91AC-0083',tripStartDate:'20261123'};
 const rows=actualArrivalRows({stops:[
  {id:'S0685',name:'Bolzano',actualArrivalAt:Date.parse('2026-11-23T12:05:00Z'),arrival:Date.parse('2026-11-23T12:00:00Z')},
  {id:'S0686',name:'Trento',actualArrivalAt:null,arrival:Date.parse('2026-11-23T12:30:00Z')},
  {id:'S0687',name:'Rovereto',actualArrivalAt:'17:06'}
 ]},candidate,now);
 assert.equal(rows.length,1);
 assert.equal(rows[0].source,'viaggiatreno');
 assert.equal(rows[0].actualArrivalAt,Math.floor(Date.parse('2026-11-23T12:05:00Z')/1000));
 assert.equal(rows[0].scheduledArrivalAt,Math.floor(Date.parse('2026-11-23T12:00:00Z')/1000));
 assert.equal(rows[0].stopId,'S0685');
});

test('rejects future, stale, malformed and forecast-only timestamps',()=>{
 const now=Date.parse('2026-11-23T12:10:00Z');
 const rows=actualArrivalRows({stops:[
  {id:'A',actualArrivalAt:now+600000},
  {id:'B',actualArrivalAt:now-3*86400000},
  {id:'C',actualArrivalAt:'17:06'},
  {id:'D',arrival:now-1000}
 ]},{number:'758',tripId:'trip',tripStartDate:'20261123'},now);
 assert.deepEqual(rows,[]);
});

test('extracts distinct active train trips and rotates the small sample',()=>{
 const ids=['758','759','760','761'].map((n,i)=>`0083_340083_0_v_34-${n}-91AC-0083`);
 const feed={entity:ids.map((tripId,i)=>({tripUpdate:{trip:{tripId,startDate:'20261123'},stopTimeUpdate:[{stopSequence:1}]}}))};
 const first=trainCandidates(feed,Date.parse('2026-11-23T12:00:00Z'),2);
 const next=trainCandidates(feed,Date.parse('2026-11-23T12:05:00Z'),2);
 assert.equal(first.length,2);assert.equal(next.length,2);
 assert.notDeepEqual(first.map(x=>x.tripId),next.map(x=>x.tripId));
 assert.equal(first[0].day,'2026-11-23');
});
