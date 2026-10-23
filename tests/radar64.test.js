import test from 'node:test';
import assert from 'node:assert/strict';
import {samePhysicalTrip} from '../public/radar64-logic.mjs';

function vehicle(overrides = {}) {
  return {
    key: 'test:' + (overrides.tripId || 'trip-1'),
    source: 'sta',
    kind: 'train',
    name: 'RE 123',
    tripId: overrides.tripId || 'trip-1',
    routeId: 'route-1',
    tripStartDate: '2026-10-22',
    lat: 46.5,
    lon: 11.35,
    timestamp: Date.now() / 1000,
    vehicleId: '',
    nameVerified: true,
    ...overrides
  };
}

test('samePhysicalTrip: two trains with same number but different trip IDs are NOT the same vehicle', () => {
  const a = vehicle({ tripId: 'trip-a', lat: 46.5, lon: 11.35 });
  const b = vehicle({ tripId: 'trip-b', lat: 46.5001, lon: 11.3501 });
  assert.equal(samePhysicalTrip(a, b), false, 'Same train number but different trip IDs must not match');
});

test('samePhysicalTrip: two trains with same number AND same trip ID within 1500m ARE the same vehicle (different sources)', () => {
  const a = vehicle({ tripId: 'trip-shared', lat: 46.5, lon: 11.35, source: 'sta', key: 'sta:trip-shared' });
  const b = vehicle({ tripId: 'trip-shared', lat: 46.5001, lon: 11.3501, source: 'trentino', key: 'trentino:trip-shared' });
  assert.equal(samePhysicalTrip(a, b), true, 'Same trip ID, different sources, within distance must match');
});

test('samePhysicalTrip: two trains more than 1500m apart are NOT the same vehicle', () => {
  const a = vehicle({ tripId: 'trip-c', lat: 46.5, lon: 11.35 });
  const b = vehicle({ tripId: 'trip-c', lat: 46.52, lon: 11.37 });
  assert.equal(samePhysicalTrip(a, b), false, 'Same trip ID but >1500m apart must not match');
});

test('samePhysicalTrip: bus and train are never the same vehicle', () => {
  const a = vehicle({ kind: 'train', tripId: 'trip-a' });
  const b = { ...vehicle({ kind: 'bus', tripId: 'trip-a' }), key: 'test:bus-1' };
  assert.equal(samePhysicalTrip(a, b), false, 'Train and bus must not match');
});

test('samePhysicalTrip: vehicles from same source are never the same', () => {
  const a = vehicle({ key: 'sta:trip-a', source: 'sta', tripId: 'trip-a' });
  const b = vehicle({ key: 'sta:trip-a', source: 'sta', tripId: 'trip-a' });
  assert.equal(samePhysicalTrip(a, b), false, 'Same source must not match (same key)');
});

test('samePhysicalTrip: vehicles without valid timestamps are not matched', () => {
  const a = vehicle({ tripId: 'trip-a', timestamp: null });
  const b = vehicle({ tripId: 'trip-a', timestamp: Date.now() / 1000 });
  assert.equal(samePhysicalTrip(a, b), false, 'Missing timestamp must not match');
});

test('samePhysicalTrip: stale vehicles are not matched', () => {
  const a = vehicle({ tripId: 'trip-a', timestamp: Date.now() / 1000 - 300, stale: true });
  const b = vehicle({ tripId: 'trip-a', timestamp: Date.now() / 1000, stale: false });
  assert.equal(samePhysicalTrip(a, b), false, 'Stale vehicle must not match');
});
