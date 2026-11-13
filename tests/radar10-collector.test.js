import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStaVehicleFeed } from '../public/radar10-collector.mjs';

const now = 1_800_000_000_000;
test('STA collector normalizes reported positions and source timestamps', () => {
  const result = normalizeStaVehicleFeed({
    header: { timestamp: 1_800_000_000 },
    entity: [{ id: 'entity-1', vehicle: { vehicle: { id: 'bus-12' }, trip: { routeId: 'L10', tripId: 'T10' }, position: { latitude: 46.5, longitude: 11.35 }, timestamp: 1_800_000_000 } }]
  }, now);
  assert.equal(result.schema, 'radar.collector.snapshot.v1');
  assert.equal(result.statistics.accepted, 1);
  assert.equal(result.vehicles[0].id, 'bus-12');
  assert.equal(result.vehicles[0].positionType, 'reported-feed-position');
  assert.equal(result.source.persisted, false);
});

test('STA collector rejects invalid coordinates and counts them', () => {
  const result = normalizeStaVehicleFeed({ entity: [
    { id: 'good', vehicle: { position: { latitude: 46.5, longitude: 11.3 } } },
    { id: 'bad', vehicle: { position: { latitude: 200, longitude: 11.3 } } }
  ] }, now);
  assert.equal(result.statistics.received, 2);
  assert.equal(result.statistics.accepted, 1);
  assert.equal(result.statistics.invalidPositions, 1);
});

test('STA collector marks old feed positions stale and does not invent a timestamp', () => {
  const result = normalizeStaVehicleFeed({ vehicles: [
    { id: 'old', position: { lat: 46.5, lon: 11.3 }, timestamp: 1_799_999_000 },
    { id: 'unknown', position: { lat: 46.4, lon: 11.2 } }
  ] }, now);
  assert.equal(result.vehicles[0].stale, true);
  assert.equal(result.vehicles[1].observedAt, null);
  assert.equal(result.statistics.missingTimestamps, 1);
});

test('STA collector refuses an unknown payload format', () => {
  assert.throws(() => normalizeStaVehicleFeed({ hello: 'world' }, now), /Unsupported STA vehicle feed format/);
});
