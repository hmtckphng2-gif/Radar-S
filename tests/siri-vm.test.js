import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSiriVehicleMonitoring} from '../public/siri-vm.mjs';
const payload={ServiceDelivery:{ResponseTimestamp:'2026-11-15T08:57:48.398513Z',VehicleMonitoringDelivery:[{VehicleActivity:[
 {RecordedAtTime:'2026-11-15T08:57:09Z',MonitoredVehicleJourney:{LineRef:'278',DirectionName:'Matsch Mazia',OperatorRef:'SIMOB',VehicleRef:'3203',VehicleLocation:{Longitude:10.5797,Latitude:46.6776},Delay:'PT1M52S'}},
 {MonitoredVehicleJourney:{LineRef:'225',OperatorRef:'SASA',VehicleRef:'2250',VehicleLocation:{Longitude:11.35,Latitude:46.5},Delay:'-PT1M17S'}},
 {MonitoredVehicleJourney:{LineRef:'bad',VehicleLocation:{Longitude:20,Latitude:50}}}
]}]}};
test('parses SIRI-VM positions, line, direction, operator and positive delay',()=>{
 const result=parseSiriVehicleMonitoring(payload,1794733020000);
 assert.equal(result.statistics.received,3); assert.equal(result.statistics.accepted,2); assert.equal(result.statistics.invalidPositions,1);
 assert.equal(result.vehicles[0].lineRef,'278'); assert.equal(result.vehicles[0].direction,'Matsch Mazia');
 assert.equal(result.vehicles[0].operatorRef,'SIMOB'); assert.equal(result.vehicles[0].delaySeconds,112); assert.equal(result.vehicles[0].delayState,'late');
});
test('keeps negative SIRI delay as early and does not classify vehicle type',()=>{
 const result=parseSiriVehicleMonitoring(payload,1794733020000);
 assert.equal(result.vehicles[1].delaySeconds,-77); assert.equal(result.vehicles[1].delayState,'early');
 assert.equal(result.vehicles[1].vehicleType,'unclassified');
});
test('rejects an unexpected SIRI payload shape',()=>assert.throws(()=>parseSiriVehicleMonitoring({foo:[]}),/Unsupported SIRI/));
