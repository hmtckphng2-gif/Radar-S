import test from 'node:test';
import assert from 'node:assert/strict';
import {timetablePositionTiming,timeDifferenceLabel} from '../public/radar74-time.mjs';
const base={observedMeters:750,plannedMeters:1000,segmentStartMeters:0,segmentEndMeters:2000,segmentStartSeconds:36000,segmentEndSeconds:37200};
test('a position 250 m behind across 2 km / 20 min is ~2.5 minutes modeled, not reported delay',()=>{
 const x=timetablePositionTiming(base,{positionType:'Feedposition'});
 assert.equal(x.minutes,2.5);assert.match(timeDifferenceLabel(x),/Modelliert/);
});
test('ahead of schedule yields negative model deviation',()=>{const x=timetablePositionTiming({...base,observedMeters:1300});assert.equal(x.minutes,-3)});
test('refuse comparisons beyond current timetable segment',()=>{const x=timetablePositionTiming({...base,observedMeters:3100});assert.equal(x.status,'outside');assert.equal(x.minutes,null)});
test('do not invent time from invalid or too-short segments',()=>{assert.equal(timetablePositionTiming({...base,segmentEndMeters:20}),null);assert.equal(timetablePositionTiming({...base,segmentEndSeconds:36100,segmentStartSeconds:36200}),null)});
test('simulated train positions are marked low confidence',()=>{const x=timetablePositionTiming(base,{positionType:'Simulierte Position'});assert.equal(x.confidence,'niedrig');assert.equal(x.simulated,true)});
test('without a calculable segment no time claim is shown',()=>{assert.match(timeDifferenceLabel(null),/nicht berechenbar/)});
