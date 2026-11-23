/* Verified arrival records only. Forecasts and generic effective times are not accepted here. */
const epochSeconds = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e12) return Math.floor(n / 1000);
  if (n >= 1e9) return Math.floor(n);
  return null;
};
const tripNumber = tripId => {
  const match = String(tripId || '').match(/_[vp]_\d+-([A-Za-z0-9]+)-[A-Fa-f0-9]+-/);
  return match ? match[1] : null;
};
export function trainCandidates(feed, now = Date.now(), limit = 3) {
  const entities = Array.isArray(feed?.entity) ? feed.entity : [];
  const unique = new Map();
  for (const entity of entities.slice(0, 12000)) {
    const update = entity?.tripUpdate ?? entity?.trip_update;
    const trip = update?.trip;
    const tripId = String(trip?.tripId ?? trip?.trip_id ?? '');
    const tripStartDate = String(trip?.startDate ?? trip?.start_date ?? '');
    const number = tripNumber(tripId);
    if (!number || !/^\d{8}$/.test(tripStartDate)) continue;
    const updates = update?.stopTimeUpdate ?? update?.stop_time_update;
    if (!Array.isArray(updates) || !updates.length) continue;
    const key = `${tripId}|${tripStartDate}`;
    if (!unique.has(key)) unique.set(key, { number, day: `${tripStartDate.slice(0,4)}-${tripStartDate.slice(4,6)}-${tripStartDate.slice(6,8)}`, tripId, tripStartDate });
  }
  const candidates = [...unique.values()];
  if (!candidates.length || limit <= 0) return [];
  const offset = Math.floor(now / 300000) % candidates.length;
  return Array.from({length: Math.min(limit, candidates.length)}, (_, i) => candidates[(offset + i) % candidates.length]);
}
export function actualArrivalRows(train, candidate, collectedAt = Date.now()) {
  if (!train || !candidate || !Array.isArray(train.stops)) return [];
  const collected = Math.floor(collectedAt / 1000);
  const rows = [];
  for (let index = 0; index < train.stops.length && index < 150; index++) {
    const stop = train.stops[index];
    const actual = epochSeconds(stop?.actualArrivalAt);
    const stopId = String(stop?.id || '').trim().slice(0, 120);
    if (!stopId || actual === null || actual > collected + 300 || actual < collected - 172800) continue;
    rows.push({
      source: 'viaggiatreno', trainNumber: String(candidate.number).slice(0, 12),
      tripId: String(candidate.tripId).slice(0, 160), tripStartDate: String(candidate.tripStartDate).slice(0, 8),
      stopId, stopName: String(stop?.name || '').slice(0, 160), stopSequence: index + 1,
      actualArrivalAt: actual, scheduledArrivalAt: epochSeconds(stop?.arrival), collectedAt: collected
    });
  }
  return rows;
}
