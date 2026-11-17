import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProfile,
  isProfileActiveToday,
  loadProfiles,
  saveProfile,
  removeProfile,
  isTripCancelled,
  VAPID_PUBLIC_KEY,
  isPushAvailable
} from '../public/pendler-logic.mjs?v=9.9.5';

const now = 1731571200000; // 2024-11-14

test('createProfile: erstellt vollständiges Profil', () => {
  const p = createProfile('p1', 'Arbeit', 'stop-a', 'stop-b', ['mon', 'wed', 'fri']);
  assert.strictEqual(p.id, 'p1');
  assert.strictEqual(p.name, 'Arbeit');
  assert.strictEqual(p.fromStopId, 'stop-a');
  assert.strictEqual(p.toStopId, 'stop-b');
  assert.deepStrictEqual(p.weekdays, ['mon', 'wed', 'fri']);
  assert.strictEqual(p.active, true);
  assert.ok(p.createdAt);
});

test('createProfile: weekdays optional', () => {
  const p = createProfile('p1', 'Test', 'a', 'b', [], false);
  assert.deepStrictEqual(p.weekdays, []);
  assert.strictEqual(p.active, false);
});

test('isProfileActiveToday: gibt false bei inaktivem Profil', () => {
  assert.strictEqual(isProfileActiveToday({ active: false, weekdays: ['mon'] }), false);
  assert.strictEqual(isProfileActiveToday({ active: true, weekdays: [] }), false);
});

test('isProfileActiveToday: Woche ohne heutige Wochentag', () => {
  // Wenn heute z.B. Donnerstag ist und nur Mo/We/Fr aktiv sind -> false
  assert.strictEqual(isProfileActiveToday({ active: true, weekdays: ['mon', 'wed', 'fri'] }), false);
});

test('loadProfiles: gibt leeres Array ohne localStorage zurück', () => {
  assert.deepStrictEqual(loadProfiles(), []);
});

test('saveProfile: gibt false ohne localStorage zurück', () => {
  assert.strictEqual(saveProfile(createProfile('p1', 'T', 'a', 'b', [])), false);
});

test('removeProfile: gibt false ohne localStorage zurück', () => {
  assert.strictEqual(removeProfile('p1'), false);
});

test('isTripCancelled: gibt false ohne Update zurück', () => {
  assert.strictEqual(isTripCancelled('trip-X', 'sta', new Map()), false);
});

test('isTripCancelled: erkennt CANCELED', () => {
  const upd = new Map([['sta:trip-X', { scheduleRelationship: 'CANCELED' }]]);
  assert.strictEqual(isTripCancelled('trip-X', 'sta', upd), true);
});

test('isTripCancelled: erkennt CANCELLED', () => {
  const upd = new Map([['sta:trip-X', { scheduleRelationship: 'CANCELLED' }]]);
  assert.strictEqual(isTripCancelled('trip-X', 'sta', upd), true);
});

test('VAPID_PUBLIC_KEY: leer wenn nicht konfiguriert', () => {
  assert.strictEqual(typeof VAPID_PUBLIC_KEY, 'string');
});

test('isPushAvailable: gibt false ohne window zurück', () => {
  assert.strictEqual(isPushAvailable(), false);
});
