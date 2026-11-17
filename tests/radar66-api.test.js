import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshot} from '../public/radar66-api.mjs';

const feeds=(trains)=>({trains,sta:{status:'error'},sta_direct:{status:'error'},trentino:{status:'error'}});
test('normalizeSnapshot: legacy simulated Trenitalia VehiclePositions are never published',()=>{
 const now=Date.now(),stamp=Math.floor(now/1000);
 const legacy={data:{header:{timestamp:stamp},entity:[{id:'sim-1',vehicle:{trip:{tripId:'trip-1'},vehicle:{id:'t1'},position:{latitude:46.5,longitude:11.35},timestamp:stamp}}]}};
 const snapshot=normalizeSnapshot(feeds(legacy),now);
 assert.equal(snapshot.vehicles.length,0);
 assert.equal(snapshot.sources.trains,'old');
});
test('normalizeSnapshot: operator-reported SIRI actual stop becomes a train marker',()=>{
 const now=Date.now(),actual=new Date(now-60000).toISOString(),response=new Date(now).toISOString();
 const xml=`<Siri><ServiceDelivery><ResponseTimestamp>${response}</ResponseTimestamp><EstimatedVehicleJourney><LineRef>10083_test</LineRef><FramedVehicleJourneyRef><DatedVehicleJourneyRef>0083_10083_0_v_1-16713-2F15-0083_test</DatedVehicleJourneyRef></FramedVehicleJourneyRef><RecordedCalls><RecordedCall><StopPointRef>02026</StopPointRef><StopPointName>BOLZANO</StopPointName><ActualDepartureTime>${actual}</ActualDepartureTime></RecordedCall></RecordedCalls></EstimatedVehicleJourney></ServiceDelivery></Siri>`;
 const snapshot=normalizeSnapshot(feeds({data:xml}),now);
 assert.equal(snapshot.sources.trains,'ok');
 assert.equal(snapshot.vehicles.length,1);
 assert.equal(snapshot.vehicles[0].kind,'train');
 assert.equal(snapshot.vehicles[0].trainNumber,'16713');
 assert.equal(snapshot.vehicles[0].name,'Zug 16713');
 assert.equal(snapshot.vehicles[0].lastObservedStop,'BOLZANO');
});
