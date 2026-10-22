import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the scheduled position stays separate from the reported delay', () => {
  // 9.0: Die Soll-Position ist eine Ortsangabe, die Verspaetung eine Zeitangabe.
  // Beide duerfen nie ineinander gerechnet werden.
  const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(src, /detail\('Abweichung Fahrplan'/);
  assert.match(src, /detail\('Verspätung \(GTFS-RT\)'/);
  assert.match(src, /trainScheduledPosition\(v,state\.indexes,state\.details,state\.shapes\)/);
});