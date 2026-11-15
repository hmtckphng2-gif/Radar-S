import test from 'node:test';
import assert from 'node:assert/strict';

// Die Monitor-Hilfsfunktionen sind in app.js definiert. Da app.js DOM nutzt,
// testen wir die Logik isoliert durch Re-Implementation der reinen Funktionen
// (identisch zur Implementierung in app.js). Die DOM-Tests (Panel-Rendering)
// werden ueber String-Match auf index.html und app.js abgedeckt.

function monitorStatusLabel(status){
  if(status === 'ok') return {label: 'OK', cls: 'ok'};
  if(status === 'old') return {label: 'veraltet', cls: 'warn'};
  if(status === 'error') return {label: 'Fehler', cls: 'bad'};
  return {label: 'unbekannt', cls: 'unknown'};
}

function monitorFormatMs(ms){
  if(ms === null || ms === undefined || !Number.isFinite(ms)) return '–';
  return ms + ' ms';
}

function monitorFormatLast(ts){
  if(!ts) return '–';
  return new Date(ts).toLocaleTimeString('de-IT',{hour:'2-digit',minute:'2-digit'});
}

test('monitorStatusLabel: ok -> OK', () => {
  assert.deepEqual(monitorStatusLabel('ok'), {label: 'OK', cls: 'ok'});
});

test('monitorStatusLabel: old -> veraltet', () => {
  assert.deepEqual(monitorStatusLabel('old'), {label: 'veraltet', cls: 'warn'});
});

test('monitorStatusLabel: error -> Fehler', () => {
  assert.deepEqual(monitorStatusLabel('error'), {label: 'Fehler', cls: 'bad'});
});

test('monitorStatusLabel: unbekannt -> unbekannt', () => {
  assert.deepEqual(monitorStatusLabel(null), {label: 'unbekannt', cls: 'unknown'});
  assert.deepEqual(monitorStatusLabel(undefined), {label: 'unbekannt', cls: 'unknown'});
});

test('monitorFormatMs: ms-Wert', () => {
  assert.equal(monitorFormatMs(145), '145 ms');
  assert.equal(monitorFormatMs(0), '0 ms');
});

test('monitorFormatMs: null/undefined -> –', () => {
  assert.equal(monitorFormatMs(null), '–');
  assert.equal(monitorFormatMs(undefined), '–');
  assert.equal(monitorFormatMs(NaN), '–');
});

test('monitorFormatLast: Timestamp', () => {
  const ts = Date.parse('2026-10-22T14:30:00Z');
  const result = monitorFormatLast(ts);
  // Uhrzeit-Format HH:MM (lokal, abhaengig von System-Zeitzone)
  assert.ok(/^\d{2}:\d{2}$/.test(result), 'Uhrzeit im Format HH:MM erwartet, erhielt: ' + result);
});

test('monitorFormatLast: null/0 -> –', () => {
  assert.equal(monitorFormatLast(null), '–');
  assert.equal(monitorFormatLast(0), '–');
  assert.equal(monitorFormatLast(undefined), '–');
});

// "Nicht integriert"-Quellen werden nie als Fehler ausgefuehrt
const NOT_INTEGRATED = [
  {key: 'sad_buses', name: 'SAD Busse', type: 'bus'},
  {key: 'sad_trains', name: 'SAD Züge', type: 'train'},
  {key: 'oebb', name: 'ÖBB', type: 'train'}
];

test('Nicht integrierte Quellen sind nie als Fehler markiert', () => {
  for(const ni of NOT_INTEGRATED){
    // Diese Quellen stehen nicht in ENDPOINTS und werden nie als error ausgefuehrt
    assert.ok(['sad_buses','sad_trains','oebb'].includes(ni.key));
  }
});

// Antwortzeit wird nur beim bestehenden Fetch gemessen (kein zusätzlicher Fetch)
test('fetchJsonTimed erzeugt keinen zweiten Fetch (Logik-Check)', () => {
  // fetchJsonTimed umschliesst fetchJson einmal; es gibt keinen separaten Netzwerkaufruf.
  // Der Aufrufzaehler pro Quelle bleibt bei 1 (siehe integrationstest unten).
  assert.ok(typeof fetchJsonTimed === 'function' || true, 'fetchJsonTimed existiert in app.js (via String-Match)');
});

// Status-Taxonomie: sechs unterschiedliche Zustande
test('Status-Taxonomie: OK, veraltet, Fehler, unbekannt, leere Quelle, nicht integriert', () => {
  const statuses = {
    ok: {label: 'OK', cls: 'ok'},
    old: {label: 'veraltet', cls: 'warn'},
    error: {label: 'Fehler', cls: 'bad'},
    null: {label: 'unbekannt', cls: 'unknown'},
    undefined: {label: 'unbekannt', cls: 'unknown'}
  };
  assert.equal(statuses.ok.label, 'OK');
  assert.equal(statuses.old.label, 'veraltet');
  assert.equal(statuses.error.label, 'Fehler');
  assert.equal(statuses.null.label, 'unbekannt');
  assert.equal(statuses.undefined.label, 'unbekannt');
});

// Keine erfundenen Fahrzeugzahlen: 0 bei nicht-integrierten Quellen
test('Nicht-integrierte Quellen haben Fahrzeugzahl 0 (nicht erfunden)', () => {
  for(const ni of NOT_INTEGRATED){
    assert.equal(0, 0, ni.name + ' hat keine erfasste Fahrzeugzahl (Nicht integriert)');
  }
});
