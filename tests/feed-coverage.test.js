import test from 'node:test';
import assert from 'node:assert/strict';
import {feedCoverage} from '../public/radar66-api.mjs';

test('feedCoverage reports per-provider GTFS-RT vehicle and trip counts',()=>{
 const result=feedCoverage({sta:{data:{header:{timestamp:1794690000},entity:[{vehicle:{position:{latitude:46,longitude:11},trip:{tripId:'A'}}},{vehicle:{position:{latitude:47,longitude:12},trip:{tripId:'B'}}}] }},trains:{data:{entity:[{vehicle:{position:{latitude:46,longitude:11},trip:{tripId:'RE1826'}}}]}}},{sta:'ok',trentino:'error',trains:'ok'});
 assert.equal(result.sources.sta.vehiclePositions,2);
 assert.equal(result.sources.sta.tripIdCount,2);
 assert.deepEqual(result.sources.trains.tripIds,['RE1826']);
 assert.equal(result.sources.trentino.status,'error');
});

test('feedCoverage explicitly reports missing ÖBB realtime integration',()=>{
 const result=feedCoverage({});
 assert.ok(result.notConfigured.some(item=>item.operator==='ÖBB'));
 assert.ok(result.sources.obb===undefined);
});
