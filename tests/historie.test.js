import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDelayStats,
  hasEnoughData,
  analyzeCatchUpBuildup,
  compareLinesByStop,
  generateAISummary,
  assessDataQuality,
  MIN_SAMPLES_FOR_RELIABLE_STATS
} from '../public/historie-logic.mjs?v=9.9.5';

test('computeDelayStats: leere Ereignisliste liefert Null-Werte', () => {
  const stats = computeDelayStats([]);
  assert.strictEqual(stats.sampleCount, 0);
  assert.strictEqual(stats.averageMinutes, null);
  assert.strictEqual(stats.medianMinutes, null);
  assert.strictEqual(stats.latePercent, null);
  assert.strictEqual(stats.uniqueForecasts, 0);
});

test('computeDelayStats: berechnet Durchschnitt, Median und Verspätungsquote', () => {
  const events = [
    { delay_seconds: 60 },   // 1 Min
    { delay_seconds: 120 },  // 2 Min
    { delay_seconds: 180 },  // 3 Min
    { delay_seconds: 300 },  // 5 Min
    { delay_seconds: null },
    { delay_seconds: undefined }
  ];
  const stats = computeDelayStats(events);
  assert.strictEqual(stats.sampleCount, 4);
  assert.strictEqual(stats.averageMinutes, 2.8);  // (60+120+180+300)/4 = 165s = 2.75min → 2.8
  assert.strictEqual(stats.medianMinutes, 2.5);   // (120+180)/2 = 150s = 2.5min
  assert.strictEqual(stats.latePercent, 75);      // 1 von 4 > 60s = 25%
});

test('computeDelayStats: ignoriert nicht-numerische und leere Werte', () => {
  const stats = computeDelayStats([
    { delay_seconds: 'abc' },
    { delay_seconds: null },
    { delay_seconds: undefined }
  ]);
  assert.strictEqual(stats.sampleCount, 0);
  assert.strictEqual(stats.averageMinutes, null);
});

test('computeDelayStats: leerer String wird als 0 Sekunden behandelt', () => {
  const stats = computeDelayStats([{ delay_seconds: '' }]);
  assert.strictEqual(stats.sampleCount, 1);
});

test('hasEnoughData: true ab 5 Messungen', () => {
  assert.strictEqual(hasEnoughData({ sampleCount: 5, averageMinutes: 2 }), true);
  assert.strictEqual(hasEnoughData({ sampleCount: 4, averageMinutes: 2 }), false);
  assert.strictEqual(hasEnoughData({ sampleCount: 10, averageMinutes: null }), false);
});

test('analyzeCatchUpBuildup: leere Ereignisse liefern insufficient', () => {
  const result = analyzeCatchUpBuildup([]);
  assert.strictEqual(result.trend, 'insufficient');
  assert.strictEqual(result.tripsAnalyzed, 0);
});

test('analyzeCatchUpBuildup: erkennt Aufholen von Verspätung', () => {
  const events = [
    { source: 'sta', trip_id: 'T1', trip_start_date: '20261019', stop_sequence: 1, event_type: 'arrival', delay_seconds: 600 },
    { source: 'sta', trip_id: 'T1', trip_start_date: '20261019', stop_sequence: 1, event_type: 'departure', delay_seconds: 120 },
    { source: 'sta', trip_id: 'T2', trip_start_date: '20261019', stop_sequence: 1, event_type: 'arrival', delay_seconds: 600 },
    { source: 'sta', trip_id: 'T2', trip_start_date: '20261019', stop_sequence: 1, event_type: 'departure', delay_seconds: 300 },
    { source: 'sta', trip_id: 'T3', trip_start_date: '20261019', stop_sequence: 1, event_type: 'arrival', delay_seconds: 300 },
    { source: 'sta', trip_id: 'T3', trip_start_date: '20261019', stop_sequence: 1, event_type: 'departure', delay_seconds: 180 },
  ];
  const result = analyzeCatchUpBuildup(events);
  assert.strictEqual(result.tripsAnalyzed, 3);
  assert.strictEqual(result.trend, 'catching_up');
  assert.ok(result.catchUpMinutes > 0);
});

test('analyzeCatchUpBuildup: erkennt Aufbauen von Verspätung', () => {
  const events = [
    { source: 'sta', trip_id: 'T1', trip_start_date: '20261019', stop_sequence: 1, event_type: 'arrival', delay_seconds: 120 },
    { source: 'sta', trip_id: 'T1', trip_start_date: '20261019', stop_sequence: 1, event_type: 'departure', delay_seconds: 600 },
    { source: 'sta', trip_id: 'T2', trip_start_date: '20261019', stop_sequence: 1, event_type: 'arrival', delay_seconds: 120 },
    { source: 'sta', trip_id: 'T2', trip_start_date: '20261019', stop_sequence: 1, event_type: 'departure', delay_seconds: 480 },
    { source: 'sta', trip_id: 'T3', trip_start_date: '20261019', stop_sequence: 1, event_type: 'arrival', delay_seconds: 120 },
    { source: 'sta', trip_id: 'T3', trip_start_date: '20261019', stop_sequence: 1, event_type: 'departure', delay_seconds: 300 },
  ];
  const result = analyzeCatchUpBuildup(events);
  assert.strictEqual(result.tripsAnalyzed, 3);
  assert.strictEqual(result.trend, 'building_up');
  assert.ok(result.buildUpMinutes > 0);
});

test('analyzeCatchUpBuildup: ignoriert Ereignisse ohne Verzögerungswerte', () => {
  const events = [
    { source: 'sta', trip_id: 'T1', trip_start_date: '20261019', stop_sequence: 1, event_type: 'arrival', delay_seconds: null },
    { source: 'sta', trip_id: 'T1', trip_start_date: '20261019', stop_sequence: 1, event_type: 'departure', delay_seconds: 120 }
  ];
  const result = analyzeCatchUpBuildup(events);
  assert.strictEqual(result.tripsAnalyzed, 0);
  assert.strictEqual(result.trend, 'insufficient');
});

test('compareLinesByStop: gruppiert Ereignisse nach Linie', () => {
  const staticData = {
    sta: {
      routes: { 'r-110': ['110', 'Bozen – Meran', 3] },
      trips: {
        'trip-110-1': ['r-110', 'Meran', '', '', 'T2#17', true, '0'],
        'trip-110-2': ['r-110', 'Meran', '', '', 'T2#17', true, '0']
      },
      stops: {}
    }
  };
  const events = [
    { trip_id: 'trip-110-1', delay_seconds: 120 },
    { trip_id: 'trip-110-1', delay_seconds: 60 },
    { trip_id: 'trip-110-2', delay_seconds: 300 },
    { trip_id: 'unbekannt', delay_seconds: 120 }
  ];
  const result = compareLinesByStop(events, staticData, 'sta');
  const l110 = result.find(l => l.line === '110');
  assert.ok(l110);
  assert.strictEqual(l110.sampleCount, 3);
  assert.ok(l110.averageMinutes > 0);
});

test('compareLinesByStop: unbekannte Fahrten landen unter „Unbekannt“', () => {
  const staticData = { sta: { routes: {}, trips: {}, stops: {} } };
  const events = [
    { trip_id: 'trip-x', delay_seconds: 120 },
    { trip_id: 'trip-y', delay_seconds: 60 }
  ];
  const result = compareLinesByStop(events, staticData, 'sta');
  const unknown = result.find(l => l.line === 'Unbekannt');
  assert.ok(unknown);
  assert.strictEqual(unknown.sampleCount, 2);
});

test('generateAISummary: unzureichende Daten liefern Hinweis', () => {
  const lines = generateAISummary({ sampleCount: 2, averageMinutes: null }, { tripsAnalyzed: 0, trend: 'insufficient', catchUpMinutes: 0, buildUpMinutes: 0, unchangedCount: 0 }, []);
  assert.ok(lines.length >= 3);
  assert.ok(lines.some(l => l.includes('nicht genug')) || lines.some(l => l.includes('nicht zuverlässig')));
});

test('generateAISummary: ausreichende Daten liefern 3-4 Zeilen', () => {
  const stats = { sampleCount: 10, averageMinutes: 3.5, medianMinutes: 2, latePercent: 30 };
  const cub = { tripsAnalyzed: 5, trend: 'catching_up', catchUpMinutes: 4, buildUpMinutes: 0, unchangedCount: 1 };
  const lines = [
    { line: '110', sampleCount: 6, averageMinutes: 2, medianMinutes: 1, latePercent: 17 },
    { line: '111', sampleCount: 4, averageMinutes: 6, medianMinutes: 4, latePercent: 50 }
  ];
  const summary = generateAISummary(stats, cub, lines);
  assert.ok(summary.length >= 3 && summary.length <= 4);
  assert.ok(summary.some(l => l.includes('Minuten')));
  assert.ok(summary.some(l => l.includes('aufgeholt')));
  assert.ok(summary.some(l => l.includes('Linie')));
});

test('assessDataQuality: keine Messungen', () => {
  const q = assessDataQuality({ sampleCount: 0 });
  assert.strictEqual(q.level, 'none');
});

test('assessDataQuality: unzureichend unter 5 Messungen', () => {
  const q = assessDataQuality({ sampleCount: 3 });
  assert.strictEqual(q.level, 'insufficient');
  assert.ok(q.message.includes('3'));
});

test('assessDataQuality: ausreichend ab 5 Messungen', () => {
  const q = assessDataQuality({ sampleCount: 5 });
  assert.strictEqual(q.level, 'sufficient');
});

test('MIN_SAMPLES_FOR_RELIABLE_STATS ist 5', () => {
  assert.strictEqual(MIN_SAMPLES_FOR_RELIABLE_STATS, 5);
});
