import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSiriTrainPositions,fuseTrainPositionSources} from '../public/train-live-logic.mjs';

const now=Date.parse('2026-11-17T20:45:00Z');
const siri=(actual='2026-11-17T21:43:00+01:00',stop='02026')=>`<Siri><ServiceDelivery><ResponseTimestamp>2026-11-17T21:45:00+01:00</ResponseTimestamp><EstimatedVehicleJourney><LineRef>10083_test</LineRef><FramedVehicleJourneyRef><DatedVehicleJourneyRef>0083_10083_0_v_1-16713-2F15-0083_test</DatedVehicleJourneyRef></FramedVehicleJourneyRef><RecordedCalls><RecordedCall><StopPointRef>${stop}</StopPointRef><StopPointName>BOLZANO</StopPointName><ActualDepartureTime>${actual}</ActualDepartureTime></RecordedCall></RecordedCalls></EstimatedVehicleJourney></ServiceDelivery></Siri>`;

test('SIRI: maps an operator-reported actual train stop to its South Tyrol station coordinates',()=>{
 const result=parseSiriTrainPositions(siri(),now);
 assert.equal(result.vehicles.length,1);
 assert.equal(result.vehicles[0].vehicleId,'16713');
 assert.equal(result.vehicles[0].lastObservedStop,'BOLZANO');
 assert.equal(result.vehicles[0].lat,46.496324);
 assert.equal(result.vehicles[0].lon,11.358568);
 assert.equal(result.vehicles[0].positionType,'Letzter bestätigter Halt · Trenitalia');
});
test('SIRI: never creates a position from planned-only or unknown station calls',()=>{
 const planned=siri().replace('<ActualDepartureTime>2026-11-17T21:43:00+01:00</ActualDepartureTime>','<AimedDepartureTime>2026-11-17T21:43:00+01:00</AimedDepartureTime>');
 assert.equal(parseSiriTrainPositions(planned,now).vehicles.length,0);
 assert.equal(parseSiriTrainPositions(siri('2026-11-17T21:43:00+01:00','UNKNOWN'),now).vehicles.length,0);
});

test('source fusion: newer estimated position stays on the map and receives the confirmed last stop',()=>{
 const estimate={key:'trains:17153',kind:'train',vehicleId:'17153',timestamp:1000,lat:46.598045,lon:11.530851,positionEstimated:true};
 const stop={key:'trains:observed:17153',kind:'train',vehicleId:'17153',timestamp:990,lat:46.601167,lon:11.53252,lastObservedStop:'PONTE GARDENA',positionType:'Letzter bestätigter Halt · Trenitalia'};
 const result=fuseTrainPositionSources([estimate],[stop]);
 assert.equal(result.estimated.length,1);
 assert.equal(result.observed.length,0);
 assert.equal(result.estimated[0].lastObservedStop,'PONTE GARDENA');
});

test('source fusion: a newer confirmed SIRI stop replaces the older estimated marker',()=>{
 const estimate={key:'trains:17168',kind:'train',vehicleId:'17168',timestamp:1000,lat:46.5285,lon:11.2484,positionEstimated:true};
 const stop={key:'trains:observed:17168',kind:'train',vehicleId:'17168',timestamp:1010,lat:46.528502,lon:11.248399,lastObservedStop:'TERLANO-ANDRIANO',positionType:'Letzter bestätigter Halt · Trenitalia'};
 const result=fuseTrainPositionSources([estimate],[stop]);
 assert.equal(result.estimated.length,0);
 assert.equal(result.observed.length,1);
 assert.equal(result.observed[0].lastObservedStop,'TERLANO-ANDRIANO');
});

test('source fusion: same train number alone is not enough when time or distance differs',()=>{
 const estimate={key:'trains:17153',kind:'train',vehicleId:'17153',timestamp:1000,lat:46.598045,lon:11.530851,positionEstimated:true};
 const farStop={key:'trains:observed:17153',kind:'train',vehicleId:'17153',timestamp:4000,lat:46.601167,lon:11.53252,lastObservedStop:'PONTE GARDENA'};
 const result=fuseTrainPositionSources([estimate],[farStop]);
 assert.equal(result.estimated.length,1);
 assert.equal(result.observed.length,1);
});
