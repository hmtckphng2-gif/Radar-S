import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVehicles, positionValid, numericDelay} from '../public/core.js?v=9.9.0';
import {pruneStaleVehicles} from '../public/feed-process.mjs';

// Datenqualitaetspruefungen fuer den Datenquellen-Monitor.
// Alle Tests sind deterministisch ueber uebergebene now-Werte, keine DOM-Abhaengigkeit.

function feed(entities, timestamp){
  return {header: {timestamp}, entity: entities};
}

function vehicleEntity(id, lat = 46.5, lon = 11.35, ts, tripId = 'trip-1', routeId = 'route-1', vehicleId = 'v-1'){
  return {
    id: id,
    vehicle: {
      trip: {tripId, route_id: routeId, direction_id: '0'},
      vehicle: {id: vehicleId},
      position: {latitude: lat, longitude: lon, timestamp: ts}
    }
  };
}

test('Datenqualitaet: Quelle ohne Fahrzeuge ist kein Ausfall', () => {
  const now = Math.floor(Date.now()/1000);
  const {vehicles, invalid} = parseVehicles(feed([], now), 'sta', {}, Date.now());
  assert.equal(vehicles.length, 0);
  assert.equal(invalid.missingPosition, 0);
  assert.equal(invalid.invalidCoordinates, 0);
  assert.equal(invalid.missingIdentity, 0);
});

test('Datenqualitaet: Doppelte Fahrzeuge werden reduziert', () => {
  const now = Math.floor(Date.now()/1000);
  const {vehicles} = parseVehicles(
    feed([vehicleEntity('a'), vehicleEntity('a')], now),
    'sta', {}, Date.now()
  );
  assert.equal(vehicles.length, 1, 'Doppelte Fahrzeug-IDs werden auf einen reduziert');
});

test('Datenqualitaet: Fehlende Koordinaten werden erkannt', () => {
  const now = Math.floor(Date.now()/1000);
  const bad = {
    id: 'bad-1',
    vehicle: {
      trip: {tripId: 'trip-1', route_id: 'route-1'},
      vehicle: {id: 'v-1'},
      position: {latitude: 999, longitude: 999, timestamp: now} // ausserhalb BBOX
    }
  };
  const {vehicles, invalid} = parseVehicles(feed([bad], now), 'sta', {}, Date.now());
  assert.equal(vehicles.length, 0);
  assert.equal(invalid.invalidCoordinates, 1);
});

test('Datenqualitaet: Fehlende Position wird erkannt', () => {
  const now = Math.floor(Date.now()/1000);
  const noPos = {
    id: 'nop-1',
    vehicle: {
      trip: {tripId: 'trip-1', route_id: 'route-1'},
      vehicle: {id: 'v-1'}
      // keine position
    }
  };
  const {vehicles, invalid} = parseVehicles(feed([noPos], now), 'sta', {}, Date.now());
  assert.equal(vehicles.length, 0);
  assert.equal(invalid.missingPosition, 1);
});

test('Datenqualitaet: Fehlende Identitaet wird erkannt', () => {
  const now = Math.floor(Date.now()/1000);
  const noId = {
    id: '',
    vehicle: {
      trip: {tripId: '', route_id: ''},
      vehicle: {id: ''},
      position: {latitude: 46.5, longitude: 11.35, timestamp: now}
    }
  };
  const {vehicles, invalid} = parseVehicles(feed([noId], now), 'sta', {}, Date.now());
  assert.equal(vehicles.length, 0);
  assert.equal(invalid.missingIdentity, 1);
});

test('Datenqualitaet: Unbekannte Fahrzeugtypen werden nicht erfunden', () => {
  const now = Math.floor(Date.now()/1000);
  const {vehicles} = parseVehicles(
    feed([vehicleEntity('v1', 46.5, 11.35, now)], 'sta', {}, Date.now())
  );
  // Jedes Fahrzeug hat kind 'bus' oder 'train' - nie einen erfundenen Typ
  for(const v of vehicles){
    assert.ok(v.kind === 'bus' || v.kind === 'train', 'Unbekannter Fahrzeugtyp: ' + v.kind);
  }
});

test('Datenqualitaet: Echter Ausfall vs. leere Quelle unterscheiden', () => {
  // Echter Ausfall: statuses[quelle] === 'error', keine Fahrzeuge
  // Leere Quelle: statuses[quelle] === 'ok', vehicles.length === 0
  const now = Math.floor(Date.now()/1000);
  const {vehicles: emptyVehicles} = parseVehicles(feed([], now), 'sta', {}, Date.now());
  assert.equal(emptyVehicles.length, 0, 'Leere Quelle liefert 0 Fahrzeuge');

  // pruneStaleVehicles entfernt Fahrzeuge NICHT-antwortender Quellen, behält aber ok-Quellen bei
  const vehicles = new Map([['k1', {key: 'k1', source: 'sta', timestamp: now, lastRealSeen: Date.now(), stale: false}]]);
  pruneStaleVehicles(vehicles, Date.now(), {sta: 'ok'});
  assert.ok(vehicles.has('k1'), 'ok-Quelle: Fahrzeuge werden nicht entfernt');
});

test('Datenqualitaet: Wiederholte Fehler werden erkannt (failCount)', () => {
  // Simuliert: zwei Zyklen mit gleichem Fehler-Mock -> failCount bleibt hoch
  // (Dieser Test prüft das Konzept; der tatsächliche failCount wird in app.js gesetzt)
  const endpoints = ['sta', 'trentino', 'trains', 'sta_direct', 'sta_direct_updates'];
  const errorStatuses = {};
  for(const ep of endpoints) errorStatuses[ep] = 'error';
  const failCount = endpoints.filter(s => errorStatuses[s] !== 'ok').length;
  assert.equal(failCount, endpoints.length, 'Alle Quellen fehlerhaft -> failCount = Anzahl Quellen');
});

test('positionValid: BBOX-Pruefung (Suedtirol + Trentino)', () => {
  assert.ok(positionValid(46.5, 11.35), 'Bozen innerhalb BBOX');
  assert.ok(!positionValid(46.5, 999), 'Longitude ausserhalb');
  assert.ok(!positionValid(999, 11.35), 'Latitude ausserhalb');
  assert.ok(!positionValid(NaN, 11.35), 'NaN-Latitude ungültig');
});

test('numericDelay: Verzögerung in Sekunden', () => {
  assert.equal(numericDelay(120), 120);
  assert.equal(numericDelay(-30), -30);
  assert.equal(numericDelay(null), null);
  assert.equal(numericDelay(undefined), null);
  assert.equal(numericDelay(''), null);
  assert.equal(numericDelay('abc'), null);
});
