import test from 'node:test';
import assert from 'node:assert/strict';

import {
  vehicleToTripEntry,
  groupVehiclesByTrip,
  sortTripEntries,
  getTripStops,
  getStopDelay,
  isUpdateFresh
} from '../public/fahrtverfolgung-logic.mjs?v=9.9.5';

const now = 1731571200000; // 2024-11-14T12:00:00Z

// Minimal static data: sta index with routes, trips, stops, times
const staticData = {
  sta: {
    routes: {
      '1-110-26a-1': ['110', 'Bronzolo – Bozen', 3]
    },
    trips: {
      '1.T0.1-110-26a-1.7.H': ['1-110-26a-1', 'Bronzolo Raif', 'shape1', '', 'T2#17', true, '0']
    },
    stops: {
      'it:22021:100:0:1': ['Haltestelle A', 46.5, 11.3, '', ''],
      'it:22021:200:0:2': ['Haltestelle B', 46.51, 11.31, '', ''],
      'it:22021:300:0:3': ['Haltestelle C', 46.52, 11.32, '', '']
    },
    times: {
      '1.T0.1-110-26a-1.7.H': [
        ['it:22021:100:0:1', 25200, 25200, 1],
        ['it:22021:200:0:2', 25500, 25500, 2],
        ['it:22021:300:0:3', 25800, 25800, 3]
      ]
    }
  }
};

const baseVehicle = {
  key: 'sta:veh123',
  source: 'sta',
  kind: 'bus',
  tripId: '1.T0.1-110-26a-1.7.H',
  routeId: '1-110-26a-1',
  vehicleId: 'BUS-123',
  lat: 46.505,
  lon: 11.305,
  timestamp: 1731571100,
  currentStopId: 'it:22021:100:0:1',
  currentStopSequence: 1,
  currentStatus: 'IN_TRANSIT_TO',
  name: '110',
  headsign: 'Bronzolo Raif',
  bearing: 90,
  speed: 25,
  positionType: 'Feedposition (GPS nicht garantiert)',
  lineVerified: true,
  nameVerified: false
};

const emptyUpdates = new Map();

test('vehicleToTripEntry: erstellt vollständigen Eintrag aus Fahrzeugdaten', () => {
  const entry = vehicleToTripEntry(baseVehicle, staticData, emptyUpdates);
  assert.ok(entry, 'Eintrag darf nicht null sein');
  assert.strictEqual(entry.key, 'sta:veh123');
  assert.strictEqual(entry.tripId, '1.T0.1-110-26a-1.7.H');
  assert.strictEqual(entry.line, '110');
  assert.strictEqual(entry.headsign, 'Bronzolo Raif');
  assert.strictEqual(entry.vehicleId, 'BUS-123');
  assert.strictEqual(entry.lat, 46.505);
  assert.strictEqual(entry.lon, 11.305);
  assert.strictEqual(entry.kind, 'bus');
  assert.ok(entry.ageLabel, 'Datenalter sollte gesetzt sein');
});

test('vehicleToTripEntry: gibt null bei fehlender tripId zurück', () => {
  const entry = vehicleToTripEntry({ ...baseVehicle, tripId: '' }, staticData, emptyUpdates);
  assert.strictEqual(entry, null);
});

test('vehicleToTripEntry: gibt null bei ungültigen Koordinaten zurück', () => {
  const entry = vehicleToTripEntry({ ...baseVehicle, lat: 999, lon: 999 }, staticData, emptyUpdates);
  assert.strictEqual(entry, null);
});

test('vehicleToTripEntry: zeigt fehlende Linien-Daten ehrlich an wenn kein Static-Index', () => {
  const entry = vehicleToTripEntry({ ...baseVehicle, name: '', headsign: '' }, {}, emptyUpdates);
  assert.strictEqual(entry.line, 'Linie unbekannt');
  assert.strictEqual(entry.headsign, 'Fahrtziel unbekannt');
});

test('vehicleToTripEntry: zeigt Fahrzeug-ID als nicht verfügbar wenn leer', () => {
  const entry = vehicleToTripEntry({ ...baseVehicle, vehicleId: '' }, staticData, emptyUpdates);
  assert.strictEqual(entry.vehicleId, 'Nicht verfügbar');
});

test('groupVehiclesByTrip: gruppiert Fahrzeuge nach tripId', () => {
  const vehicles = [
    { ...baseVehicle, key: 'sta:v1', tripId: 'trip-A', timestamp: 100 },
    { ...baseVehicle, key: 'sta:v2', tripId: 'trip-B', timestamp: 200 },
    { ...baseVehicle, key: 'sta:v3', tripId: 'trip-A', timestamp: 300 }
  ];
  const grouped = groupVehiclesByTrip(vehicles);
  assert.strictEqual(grouped.size, 2);
  assert.strictEqual(grouped.get('trip-A').length, 2);
  assert.strictEqual(grouped.get('trip-B').length, 1);
});

test('groupVehiclesByTrip: ignoriert Fahrzeuge ohne tripId', () => {
  const vehicles = [
    { ...baseVehicle, key: 'sta:v1', tripId: 'trip-A' },
    { ...baseVehicle, key: 'sta:v2', tripId: '' }
  ];
  const grouped = groupVehiclesByTrip(vehicles);
  assert.strictEqual(grouped.size, 1);
  assert.ok(grouped.has('trip-A'));
});

test('sortTripEntries: sortiert nach Linie dann Fahrtziel', () => {
  const entries = [
    { line: '200', headsign: 'Ziel B', key: 'k2' },
    { line: '110', headsign: 'Ziel A', key: 'k1' },
    { line: '110', headsign: 'Ziel B', key: 'k3' }
  ];
  const sorted = sortTripEntries(entries);
  assert.strictEqual(sorted[0].key, 'k1');
  assert.strictEqual(sorted[1].key, 'k3');
  assert.strictEqual(sorted[2].key, 'k2');
});

test('getTripStops: liefert Haltestellen mit Zeiten', () => {
  const stops = getTripStops('1.T0.1-110-26a-1.7.H', staticData, 'sta');
  assert.strictEqual(stops.length, 3);
  assert.strictEqual(stops[0].name, 'Haltestelle A');
  assert.strictEqual(stops[0].stopId, 'it:22021:100:0:1');
  assert.strictEqual(stops[0].seq, 1);
});

test('getTripStops: gibt leeres Array bei unbekannter Fahrt zurück', () => {
  const stops = getTripStops('unbekannte-fahrt', staticData, 'sta');
  assert.strictEqual(stops.length, 0);
});

test('getStopDelay: liefert null ohne Update', () => {
  const delay = getStopDelay('trip-X', 'stop-1', staticData, 'sta', emptyUpdates);
  assert.strictEqual(delay, null);
});

test('isUpdateFresh: erkennt frische Updates', () => {
  const fresh = { fetchedAt: now - 10000 };
  assert.strictEqual(isUpdateFresh(fresh, now), true);
});

test('isUpdateFresh: erkennt alte Updates', () => {
  const old = { fetchedAt: now - 200000 };
  assert.strictEqual(isUpdateFresh(old, now), false);
});

test('isUpdateFresh: gibt false bei fehlendem Update zurück', () => {
  assert.strictEqual(isUpdateFresh(null, now), false);
  assert.strictEqual(isUpdateFresh(undefined, now), false);
});
