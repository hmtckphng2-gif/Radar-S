import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterActiveAlerts,
  mergeDuplicateAlerts,
  resolveAlertDetails,
  groupBySeverity,
  formatAlertAge,
  severityClass,
  severityLabel
} from '../public/störungen-logic.mjs?v=9.9.5';

const now = Date.now();
const nowSec = Math.floor(now / 1000);

const makeAlert = (id, header, cause, effect, startSec, endSec, fetchedAtSec, entities = []) => ({
  id,
  header,
  cause,
  effect,
  active_period: startSec != null ? [{ start: startSec, end: endSec != null ? Infinity }] : [],
  informed_entity: entities,
  fetchedAt: (fetchedAtSec != null ? fetchedAtSec : nowSec) * 1000
});

test('filterActiveAlerts: ohne active_period gilt als immer aktiv', () => {
  const alerts = [makeAlert('a1', 'Störung A', 8, 8, null, null, nowSec)];
  const active = filterActiveAlerts(alerts, now);
  assert.strictEqual(active.length, 1);
});

test('filterActiveAlerts: innerhalb des Zeitraums ist aktiv', () => {
  const alerts = [makeAlert('a1', 'Störung A', 3, 4, nowSec - 3600, nowSec + 3600, nowSec)];
  const active = filterActiveAlerts(alerts, now);
  assert.strictEqual(active.length, 1);
});

test('filterActiveAlerts: abgelaufene Alerts werden entfernt', () => {
  const alerts = [makeAlert('a1', 'Alt', 3, 4, nowSec - 7200, nowSec - 3600, nowSec)];
  const active = filterActiveAlerts(alerts, now);
  assert.strictEqual(active.length, 0);
});

test('filterActiveAlerts: zukünftige Alerts werden entfernt', () => {
  const alerts = [makeAlert('a1', 'Zukunft', 3, 4, nowSec + 3600, nowSec + 7200, nowSec)];
  const active = filterActiveAlerts(alerts, now);
  assert.strictEqual(active.length, 0);
});

test('mergeDuplicateAlerts: gleiche Header + gleiche Entitäten werden vereint', () => {
  const alerts = [
    makeAlert('a1', 'Ausfall Linie 110', 3, 4, nowSec - 3600, nowSec + 3600, nowSec, [{ route_id: '1-110-26a-1', stop_id: 'stop:A' }]),
    makeAlert('a2', 'Ausfall Linie 110', 3, 4, nowSec - 3600, nowSec + 3600, nowSec, [{ route_id: '1-110-26a-1', stop_id: 'stop:A' }])
  ];
  const merged = mergeDuplicateAlerts(alerts);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].informed_entity.length, 1);
});

test('mergeDuplicateAlerts: verschiedene Haltestellen bleiben getrennte Meldungen', () => {
  const alerts = [
    makeAlert('a1', 'Ausfall Linie 110', 3, 4, nowSec - 3600, nowSec + 3600, nowSec, [{ route_id: '1-110-26a-1', stop_id: 'stop:A' }]),
    makeAlert('a2', 'Ausfall Linie 110', 3, 4, nowSec - 3600, nowSec + 3600, nowSec, [{ route_id: '1-110-26a-1', stop_id: 'stop:B' }])
  ];
  const merged = mergeDuplicateAlerts(alerts);
  assert.strictEqual(merged.length, 2);
});

test('mergeDuplicateAlerts: unterschiedliche Header bleiben getrennt', () => {
  const alerts = [
    makeAlert('a1', 'Ausfall Linie 110', 3, 4, nowSec - 3600, nowSec + 3600, nowSec),
    makeAlert('a2', 'Verspätung Linie 110', 1, 1, nowSec - 3600, nowSec + 3600, nowSec)
  ];
  const merged = mergeDuplicateAlerts(alerts);
  assert.strictEqual(merged.length, 2);
});

test('resolveAlertDetails: löst Haltestellen und Linien über statische Indizes auf', () => {
  const indexes = {
    sta: {
      stops: { 'stop:A': ['Bozen, Bahnhof', 46.498, 11.354] },
      routes: { '1-110-26a-1': ['110', '', '3'] },
      trips: { 'trip:1': ['1-110-26a-1', 'Meran', 'shape:1'] }
    }
  };
  const alert = makeAlert('a1', 'Test', 3, 4, nowSec - 3600, nowSec + 3600, nowSec, [
    { route_id: '1-110-26a-1', stop_id: 'stop:A', trip_id: 'trip:1' }
  ]);
  const details = resolveAlertDetails(alert, indexes);
  assert.strictEqual(details.affectedStops.length, 1);
  assert.strictEqual(details.affectedStops[0].name, 'Bozen, Bahnhof');
  assert.strictEqual(details.affectedStops[0].lat, 46.498);
  assert.strictEqual(details.affectedLines.length, 1);
  assert.strictEqual(details.affectedLines[0].display, '110');
  assert.strictEqual(details.affectedTrips.length, 1);
  assert.strictEqual(details.affectedTrips[0].headsign, 'Meran');
});

test('resolveAlertDetails: unbekannte IDs werden fallback-behandelt', () => {
  const indexes = { sta: { stops: {}, routes: {}, trips: {} } };
  const alert = makeAlert('a1', 'Test', 3, 4, nowSec - 3600, nowSec + 3600, nowSec, [
    { route_id: 'unknown-route', stop_id: 'unknown-stop', trip_id: 'unknown-trip' }
  ]);
  const details = resolveAlertDetails(alert, indexes);
  assert.strictEqual(details.affectedStops[0].name, 'Haltestelle unknown-stop');
  assert.strictEqual(details.affectedLines[0].display, 'Linie unknown-route');
  assert.strictEqual(details.affectedTrips[0].display, 'Fahrt unknown-trip');
});

test('groupBySeverity: high = Ausfall (cause 3,4 oder effect 2,4)', () => {
  const alerts = [
    makeAlert('a1', 'A', 3, 4, nowSec - 3600, nowSec + 3600, nowSec),
    makeAlert('a2', 'B', 1, 1, nowSec - 3600, nowSec + 3600, nowSec),
    makeAlert('a3', 'C', 8, 8, nowSec - 3600, nowSec + 3600, nowSec)
  ];
  const groups = groupBySeverity(alerts);
  assert.strictEqual(groups.high.length, 1);
  assert.strictEqual(groups.medium.length, 1);
  assert.strictEqual(groups.low.length, 1);
});

test('groupBySeverity: medium = verbleibende (cause 6,7,8,9)', () => {
  const alerts = [
    makeAlert('a1', 'A', 6, 6, nowSec - 3600, nowSec + 3600, nowSec),
    makeAlert('a2', 'B', 8, 8, nowSec - 3600, nowSec + 3600, nowSec)
  ];
  const groups = groupBySeverity(alerts);
  assert.strictEqual(groups.medium.length, 2);
});

test('groupBySeverity: low = cause 1,2,5 oder effect 1,5', () => {
  const alerts = [
    makeAlert('a1', 'A', 1, 1, nowSec - 3600, nowSec + 3600, nowSec),
    makeAlert('a2', 'B', 5, 5, nowSec - 3600, nowSec + 3600, nowSec)
  ];
  const groups = groupBySeverity(alerts);
  assert.strictEqual(groups.low.length, 2);
});

test('formatAlertAge: gerade jetzt', () => {
  assert.strictEqual(formatAlertAge(now, now), 'gerade');
});

test('formatAlertAge: vor 30 Minuten', () => {
  assert.strictEqual(formatAlertAge(now - 30 * 60 * 1000, now), '30 Min.');
});

test('formatAlertAge: vor 2 Stunden', () => {
  assert.strictEqual(formatAlertAge(now - 2 * 3600 * 1000, now), '2 Std.');
});

test('severityClass: high für cause 3 oder 4', () => {
  assert.strictEqual(severityClass(3, 4), 'störung-sev-high');
  assert.strictEqual(severityClass(4, 2), 'störung-sev-high');
});

test('severityClass: low für cause 1,2,5', () => {
  assert.strictEqual(severityClass(1, 1), 'störung-sev-low');
  assert.strictEqual(severityClass(5, 5), 'störung-sev-low');
});

test('severityClass: medium für den Rest', () => {
  assert.strictEqual(severityClass(8, 8), 'störung-sev-medium');
  assert.strictEqual(severityClass(6, 6), 'störung-sev-medium');
});

test('severityLabel: liefert deutsche Bezeichnungen', () => {
  assert.strictEqual(severityLabel(3, 4), 'Ausfall');
  assert.strictEqual(severityLabel(1, 1), 'Verspätung');
  assert.strictEqual(severityLabel(8, 8), 'Störung');
});
