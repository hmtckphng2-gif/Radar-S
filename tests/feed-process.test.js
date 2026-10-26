import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFeedStatus, freshness, processPositionFeed, mergePositionVehicles, pruneStaleVehicles, processUpdates, STALE_MAX_AGE_SEC} from '../public/feed-process.mjs';

function feed(timestamp){
  return {header: {timestamp}};
}

test('buildFeedStatus: erkennt ok, old und error Feeds', () => {
  const nowSec = Math.floor(Date.now()/1000);
  const results = [
    {status: 'fulfilled', value: feed(nowSec - 60)},
    {status: 'fulfilled', value: feed(nowSec - 200000)},
    {status: 'rejected', reason: new Error('timeout')}
  ];
  const {ok, oldFeeds, statuses} = buildFeedStatus(results, ['sta','trentino','trains']);
  assert.equal(statuses.sta, 'ok');
  assert.equal(statuses.trentino, 'old');
  assert.equal(statuses.trains, 'error');
  assert.ok(ok.sta);
  assert.ok(oldFeeds.trentino);
  assert.ok(!ok.trains);
});

test('freshness: aktueller Feed ist ok', () => {
  const nowSec = Math.floor(Date.now()/1000);
  assert.equal(freshness(feed(nowSec - 60), nowSec), 'ok');
});

test('freshness: alter Feed ist old', () => {
  const nowSec = Math.floor(Date.now()/1000);
  assert.equal(freshness(feed(nowSec - 200000), nowSec), 'old');
});

test('freshness: ohne Timestamp ist ok (nicht erfinden)', () => {
  const nowSec = Math.floor(Date.now()/1000);
  assert.equal(freshness({header: {}}, nowSec), 'ok');
});

test('processPositionFeed: parst Fahrzeuge und berechnet Bus-Kandidaten', () => {
  const indexes = {sta: {}, trentino: {}, trains: {}};
  const now = Date.now();
  const feed = {
    entity: [{
      vehicle: {
        trip: {tripId: 'trip-1', route_id: 'route-1', direction_id: '0'},
        vehicle: {id: 'v1'},
        position: {latitude: 46.5, longitude: 11.35, timestamp: Math.floor(now/1000)}
      }
    }]
  };
  const today = '2026-10-22';
  const {parsed, latest} = processPositionFeed('sta', feed, now, indexes, today);
  assert.equal(parsed.vehicles.length, 1);
  assert.equal(parsed.vehicles[0].key, 'sta:v1');
  assert.ok(latest.has('sta:v1'));
});

test('mergePositionVehicles: behält neueste Beobachtung', () => {
  const vehicles = new Map();
  const latest = new Map([['k1', {key: 'k1', source: 'sta', timestamp: Math.floor(Date.now()/1000), kind: 'bus', name: 'Zug'} ]]);
  mergePositionVehicles(vehicles, latest, 'sta', Date.now(), false);
  assert.ok(vehicles.has('k1'));
  assert.equal(vehicles.get('k1').name, 'Zug');
});

test('pruneStaleVehicles: entfernt Fahrzeuge von nicht antwortenden Sources', () => {
  const vehicles = new Map([['k1', {key: 'k1', source: 'sta', lastRealSeen: Date.now() - 10000, stale: false}]]);
  pruneStaleVehicles(vehicles, Date.now(), {sta: 'error'});
  assert.ok(!vehicles.has('k1'));
});


test('mergePositionVehicles: transient dash placeholders do not erase known vehicle details', () => {
  const vehicles = new Map([['sta:v1', {key:'sta:v1', source:'sta', timestamp:1000, kind:'bus', name:'Linie 5', headsign:'Bozen Zentrum', vehicleId:'BUS-17', routeId:'R5', tripId:'T5'}]]);
  const latest = new Map([['sta:v1', {key:'sta:v1', source:'sta', timestamp:1001, kind:'bus', name:'-', headsign:'–', vehicleId:'—', routeId:'-', tripId:'T5'}]]);
  mergePositionVehicles(vehicles, latest, 'sta', Date.now(), false);
  const v = vehicles.get('sta:v1');
  assert.equal(v.name, 'Linie 5');
  assert.equal(v.headsign, 'Bozen Zentrum');
  assert.equal(v.vehicleId, 'BUS-17');
  assert.equal(v.routeId, 'R5');
});
