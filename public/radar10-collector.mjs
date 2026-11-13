/**
 * Radar 10.0 on-demand collector adapter for the official STA Open Data Hub feed.
 * Deliberately does not persist data: this preview has no approved storage binding.
 */
export const STA_VEHICLE_POSITIONS_URL = 'https://gtfs.api.opendatahub.com/v1/realtime/sta-time-tables/vehicle-positions';

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function validPosition(lat, lon) {
  return finite(lat) && finite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
function firstValue(...values) { return values.find(value => value !== undefined && value !== null && value !== ''); }

function extractRows(payload) {
  if (Array.isArray(payload?.entity)) {
    return payload.entity.map(entity => ({ entity, vehicle: entity?.vehicle })).filter(row => row.vehicle);
  }
  if (Array.isArray(payload?.vehicles)) return payload.vehicles.map(vehicle => ({ entity: vehicle, vehicle }));
  if (Array.isArray(payload?.data?.vehicles)) return payload.data.vehicles.map(vehicle => ({ entity: vehicle, vehicle }));
  if (Array.isArray(payload?.data) && payload.data.some(row => row?.position || row?.vehicle?.position)) {
    return payload.data.map(row => ({ entity: row, vehicle: row?.vehicle || row }));
  }
  throw new Error('Unsupported STA vehicle feed format');
}

export function normalizeStaVehicleFeed(payload, nowMs = Date.now()) {
  const rows = extractRows(payload);
  const headerTimestamp = Number(payload?.header?.timestamp ?? payload?.header?.timeStamp);
  const feedTimestamp = Number.isFinite(headerTimestamp) && headerTimestamp > 0 ? headerTimestamp : null;
  const vehicles = [];
  let invalidPositions = 0;
  let missingTimestamps = 0;
  for (const row of rows) {
    const v = row.vehicle || {};
    const position = v.position || v.vehicle?.position || row.entity?.position || {};
    const latitude = Number(firstValue(position.latitude, position.lat, v.latitude, v.lat));
    const longitude = Number(firstValue(position.longitude, position.lon, v.longitude, v.lon));
    if (!validPosition(latitude, longitude)) { invalidPositions++; continue; }
    const rawTimestamp = Number(firstValue(v.timestamp, v.observedAt, row.entity?.timestamp, feedTimestamp));
    const observedAt = Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp : null;
    if (observedAt === null) missingTimestamps++;
    const ageSeconds = observedAt === null ? null : Math.max(0, Math.round(nowMs / 1000 - observedAt));
    const trip = v.trip || v.vehicle?.trip || row.entity?.trip || {};
    const descriptor = v.vehicle || {};
    const id = firstValue(descriptor.id, v.vehicleId, v.id, row.entity?.id);
    vehicles.push({
      id: String(id ?? `sta-unknown-${vehicles.length + 1}`),
      routeId: firstValue(trip.routeId, trip.route_id, v.routeId, v.route_id) ?? null,
      tripId: firstValue(trip.tripId, trip.trip_id, v.tripId, v.trip_id) ?? null,
      latitude, longitude, observedAt, ageSeconds,
      stale: ageSeconds !== null && ageSeconds > 300,
      positionType: 'reported-feed-position',
      quality: observedAt === null ? 'timestamp-unknown' : ageSeconds > 300 ? 'stale' : 'current',
      source: 'sta-open-data-hub'
    });
  }
  return {
    schema: 'radar.collector.snapshot.v1',
    source: { id: 'sta-open-data-hub', mode: 'on-demand', persisted: false },
    collectedAt: new Date(nowMs).toISOString(),
    feedTimestamp,
    statistics: { received: rows.length, accepted: vehicles.length, invalidPositions, missingTimestamps },
    vehicles
  };
}
