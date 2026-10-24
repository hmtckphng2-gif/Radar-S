import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the scheduled position stays separate from the reported delay', () => {
  // 9.0: Die Soll-Position ist eine Ortsangabe, die Verspaetung eine Zeitangabe.
  // Beide duerfen nie ineinander gerechnet werden.
  const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(src, /detail\(t\('detail\.label\.planDeviation'\)/);
  assert.match(src, /detail\(t\('detail\.label\.delay'\)/);
  assert.match(src, /trainScheduledPosition\(v,state\.indexes,state\.details,state\.shapes\)/);
  // Beide Übersetzungs-Keys muessen existieren
  const tr = readFileSync(new URL('../public/translations.mjs', import.meta.url), 'utf8');
  assert.match(tr, /detail\.label\.planDeviation/);
  assert.match(tr, /detail\.label\.delay/);
});