import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getStopDepartures,
  getStopLines,
  getVehiclesAtStop,
  getVehiclesNearStop,
  getStopAlerts,
  getFavorites,
  isFavorite,
  toggleFavorite,
  formatTime,
  getStopName
} from '../public/haltestelle-logic.mjs?v=9.9.5';

const staticData = {
  sta: {
    routes: {
      '1-110-26a-1': ['110', 'Bronzolo – Bozen', 3],
      '1-111-26a-2': ['111', 'Bozen – Meran', 3]
    },
    trips: {
      'trip-1': ['1-110-26a-1', 'Bronzolo Raif', 'shape1', '', 'T2#17', true, '0'],
      'trip-2': ['1-111-26a-2', 'Meran', 'shape2', '', 'T2#17', true, '0']
    },
    stops: {
      'stop-a': ['Haltestelle A', 46.5, 11.3, '', ''],
      'stop-b': ['Haltestelle B', 46.51, 11.31, '', '']
    },
    times: {
      'trip-1': [
        ['stop-a', 25200, 25200, 1],
        ['stop-b', 25500, 25500, 2]
      ],
      'trip-2': [
        ['stop-a', 26000, 26000, 1],
        ['stop-b', 26300, 26300, 2]
      ]
    }
  }
};

test('getStopDepartures: liefert planmäßige Abfahrten einer Haltestelle', () => {
  const deps = getStopDepartures('stop-a', staticData, 'sta');
  assert.strictEqual(deps.length, 2);
  assert.strictEqual(deps[0].tripId, 'trip-1');
  assert.strictEqual(deps[0].departure, 25200);
  assert.strictEqual(deps[0].line, '110');
  assert.strictEqual(deps[1].tripId, 'trip-2');
  assert.strictEqual(deps[1].departure, 26000);
  assert.strictEqual(deps[1].line, '111');
});

test('getStopDepartures: sortiert nach Abfahrtszeit', () => {
  const deps = getStopDepartures('stop-a', staticData, 'sta');
  assert.ok(deps[0].departure <= deps[1].departure);
});

test('getStopDepartures: gibt leeres Array bei unbekannter Haltestelle', () => {
  const deps = getStopDepartures('stop-x', staticData, 'sta');
  assert.strictEqual(deps.length, 0);
});

test('getStopLines: liefert alle Linien einer Haltestelle (dedupliziert)', () => {
  const lines = getStopLines('stop-a', staticData, 'sta');
  assert.strictEqual(lines.length, 2);
  assert.ok(lines.some(l => l.line === '110'));
  assert.ok(lines.some(l => l.line === '111'));
});

test('getStopLines: zählt Fahrten pro Linie', () => {
  const lines = getStopLines('stop-a', staticData, 'sta');
  const l110 = lines.find(l => l.line === '110');
  assert.strictEqual(l110.tripCount, 1);
});

test('getVehiclesAtStop: filtert Fahrzeuge an Haltestelle', () => {
  const vehicles = [
    { currentStopId: 'stop-a', lat: 46.5, lon: 11.3, tripId: 't1' },
    { currentStopId: 'stop-b', lat: 46.51, lon: 11.31, tripId: 't2' },
    { currentStopId: 'stop-a', lat: 46.5, lon: 11.3, tripId: 't3' }
  ];
  const atStop = getVehiclesAtStop(vehicles, 'stop-a');
  assert.strictEqual(atStop.length, 2);
});

test('getVehiclesNearStop: liefert Fahrzeuge innerhalb Radius', () => {
  const vehicles = [
    { lat: 46.5005, lon: 11.3005, tripId: 'near' },  // sehr nah
    { lat: 46.6, lon: 11.4, tripId: 'far' }           // weit weg
  ];
  const near = getVehiclesNearStop(vehicles, 46.5, 11.3);
  assert.strictEqual(near.length, 1);
  assert.strictEqual(near[0].tripId, 'near');
  assert.ok(near[0].distanceMeters >= 0);
});

test('getVehiclesNearStop: ignoriert ungültige Koordinaten', () => {
  const vehicles = [
    { lat: 999, lon: 999, tripId: 'invalid' },
    { lat: 46.5005, lon: 11.3005, tripId: 'valid' }
  ];
  const near = getVehiclesNearStop(vehicles, 46.5, 11.3);
  assert.strictEqual(near.length, 1);
  assert.strictEqual(near[0].tripId, 'valid');
});

test('getStopAlerts: filtert Alerts nach Haltestelle', () => {
  const alerts = [
    { id: '1', header: 'Störung A', informed_entity: [{ stop_id: 'stop-a' }] },
    { id: '2', header: 'Störung B', informed_entity: [{ stop_id: 'stop-b' }] },
    { id: '3', header: 'Störung C', informed_entity: [{ stop_id: 'stop-a' }, { stop_id: 'stop-b' }] }
  ];
  const stopAAlerts = getStopAlerts('stop-a', alerts);
  assert.strictEqual(stopAAlerts.length, 2);
  assert.ok(stopAAlerts.some(a => a.id === '1'));
  assert.ok(stopAAlerts.some(a => a.id === '3'));
});

test('getStopAlerts: gibt leeres Array ohne Treffer', () => {
  const alerts = [{ id: '1', header: 'Störung', informed_entity: [{ stop_id: 'stop-x' }] }];
  assert.strictEqual(getStopAlerts('stop-a', alerts).length, 0);
});

test('formatTime: konvertiert Sekunden in HH:MM', () => {
  assert.strictEqual(formatTime(25200), '07:00');
  assert.strictEqual(formatTime(25500), '07:05');
  assert.strictEqual(formatTime(null), '–');
});

test('getStopName: liefert Haltestellenname', () => {
  assert.strictEqual(getStopName('stop-a', staticData, 'sta'), 'Haltestelle A');
  assert.strictEqual(getStopName('unbekannt', staticData, 'sta'), 'Haltestelle unbekannt');
});

// Favoriten-Tests (lokalStorage wird im Test nicht gemockt, daher nur Logik prüfen)
test('toggleFavorite: funktioniert ohne localStorage (graceful fallback)', () => {
  // In Node.js ohne localStorage sollte false zurückgegeben werden
  const result = toggleFavorite('stop-a');
  assert.strictEqual(result, false);
});

test('isFavorite: gibt false ohne localStorage zurück', () => {
  assert.strictEqual(isFavorite('stop-a'), false);
});

test('getFavorites: gibt leeres Array ohne localStorage zurück', () => {
  assert.deepStrictEqual(getFavorites(), []);
});
