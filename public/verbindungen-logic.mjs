// Alternativverbindungen: Verbindungs­suche mit GTFS Static + GTFS-RT Echtzeit.
// Reine Logik ohne DOM-Abhängigkeit, unit-tested.
import { stopRows, normalizeStopId, numericDelay, isLiveUpdate } from './core.js?v=9.9.6&rev=verbindungen-1';

// Baut einen umgekehrten Index: stopId -> Array von Trip-IDs, die diese Haltestelle bedienen.
// Einmalig aus den statischen GTFS-Zeitdaten aufgebaut.
export function buildStopTripIndex(staticData, source = 'sta') {
  const db = staticData[source] || {};
  const index = new Map();
  for (const [tripId, times] of Object.entries(db.times || {})) {
    if (!Array.isArray(times)) continue;
    for (const row of times) {
      const stopId = row[0];
      if (!stopId) continue;
      let list = index.get(stopId);
      if (!list) { list = []; index.set(stopId, list); }
      if (!list.includes(tripId)) list.push(tripId);
    }
  }
  return index;
}

// Prüft ob eine Fahrt über GTFS-RT als ausgefallen markiert ist.
export function isTripCancelled(tripId, source, updates = new Map()) {
  const key = source + ':' + tripId;
  const upd = updates.get(key);
  if (!upd) return false;
  return upd.scheduleRelationship === 'CANCELED' || upd.scheduleRelationship === 'CANCELLED';
}

// Liefert die geplante Abfahrtszeit einer Fahrt an einer Haltestelle (Sekunden ab Mitternacht).
export function getStopDeparture(tripId, stopId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const times = db.times?.[tripId];
  if (!Array.isArray(times)) return null;
  const id = normalizeStopId(stopId);
  const row = times.find(r => normalizeStopId(r[0]) === id);
  return row ? Number(row[2]) : null; // departure
}

// Liefert die geplante Ankunftszeit einer Fahrt an einer Haltestelle (Sekunden ab Mitternacht).
export function getStopArrival(tripId, stopId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const times = db.times?.[tripId];
  if (!Array.isArray(times)) return null;
  const id = normalizeStopId(stopId);
  const row = times.find(r => normalizeStopId(r[0]) === id);
  return row ? Number(row[1]) : null; // arrival
}

// Liefert den Namen einer Haltestelle.
export function getStopName(stopId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const stop = db.stops?.[stopId];
  return stop ? stop[0] : 'Haltestelle ' + stopId;
}

// Liefert Linienname und Ziel einer Fahrt.
export function getTripInfo(tripId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const t = db.trips?.[tripId];
  if (!t) return { line: '', headsign: '', routeId: '' };
  const mappedRouteId = t[0] || '';
  const r = db.routes?.[mappedRouteId];
  return {
    line: r ? r[0] : '',
    headsign: t[1] || '',
    routeId: mappedRouteId
  };
}

// Konvertiert Sekunden ab Mitternacht in HH:MM String.
export function formatTime(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–';
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Berechnet eine Verbindung aus zwei Fahrten (mit Umstieg).
// tripA: Fahrt vom Start zum Umstieg, tripB: Fahrt vom Umstieg zum Ziel.
export function buildTransferConnection(tripA, tripB, transferStopId, staticData, source, updates = {}) {
  const nameA = getStopName(transferStopId, staticData, source);
  const depA = getStopDeparture(tripA, transferStopId, staticData, source);
  const arrB = getStopArrival(tripB, transferStopId, staticData, source);
  if (depA === null || arrB === null) return null;

  // Wartezeit am Umstieg
  const waitSec = Math.max(0, arrB - depA);
  // Mindestens 3 Minuten Umsteigezeit
  if (waitSec < 180) return null;

  const infoA = getTripInfo(tripA, staticData, source);
  const infoB = getTripInfo(tripB, staticData, source);

  // Prüfe ob eine der Fahrten ausgefallen ist
  const cancelledA = isTripCancelled(tripA, source, updates[source] || new Map());
  const cancelledB = isTripCancelled(tripB, source, updates[source] || new Map());
  if (cancelledA || cancelledB) return null;

  return {
    type: 'transfer',
    tripA: tripA,
    tripB: tripB,
    transferStop: nameA,
    transferStopId,
    lineA: infoA.line,
    headsignA: infoA.headsign,
    lineB: infoB.line,
    headsignB: infoB.headsign,
    departure: depA,
    arrival: arrB,
    waitSec,
    cancelled: false
  };
}

// Berechnet eine direkte Verbindung (eine Fahrt bedient Start und Ziel).
export function buildDirectConnection(tripId, fromStopId, toStopId, staticData, source, updates = {}) {
  const dep = getStopDeparture(tripId, fromStopId, staticData, source);
  const arr = getStopArrival(tripId, toStopId, staticData, source);
  if (dep === null || arr === null) return null;
  if (arr <= dep) return null; // Ziel muss nach Start liegen

  const cancelled = isTripCancelled(tripId, source, updates[source] || new Map());
  if (cancelled) return null;

  const info = getTripInfo(tripId, staticData, source);
  const fromName = getStopName(fromStopId, staticData, source);
  const toName = getStopName(toStopId, staticData, source);

  return {
    type: 'direct',
    tripId,
    line: info.line,
    headsign: info.headsign,
    fromStop: fromName,
    fromStopId,
    toStop: toName,
    toStopId,
    departure: dep,
    arrival: arr,
    durationSec: arr - dep,
    cancelled: false
  };
}

// Sucht alle Verbindungen zwischen zwei Haltestellen.
// Berücksichtigt direkte Verbindungen und Verbindungen mit einem Umstieg.
// Filtert ausgefallene Fahrten aus. Sortiert nach Ankunftszeit.
export function findConnections(fromStopId, toStopId, staticData, source = 'sta', updates = {}, now = Date.now()) {
  const index = buildStopTripIndex(staticData, source);
  const fromTrips = index.get(fromStopId) || [];
  const toTrips = index.get(toStopId) || [];
  const connections = [];

  // Direkte Verbindungen: gleiche Fahrt bedient beide Haltestellen
  for (const tripId of fromTrips) {
    if (!toTrips.includes(tripId)) continue;
    const conn = buildDirectConnection(tripId, fromStopId, toStopId, staticData, source, updates);
    if (conn) connections.push(conn);
  }

  // Verbindungen mit einem Umstieg
  // Für jede Fahrt ab Start, finde alle Umstiegshaltestellen und prüfe Verbindungen zum Ziel
  for (const tripA of fromTrips) {
    const cancelledA = isTripCancelled(tripA, source, updates[source] || new Map());
    if (cancelledA) continue;

    const timesA = staticData[source]?.times?.[tripA];
    if (!Array.isArray(timesA)) continue;

    // Finde alle Haltestellen dieser Fahrt nach dem Start
    const fromIdx = timesA.findIndex(r => normalizeStopId(r[0]) === normalizeStopId(fromStopId));
    if (fromIdx < 0) continue;

    for (let i = fromIdx + 1; i < timesA.length; i++) {
      const transferStopId = timesA[i][0];
      if (normalizeStopId(transferStopId) === normalizeStopId(toStopId)) continue; // direkt, schon behandelt

      // Fahrt B muss am Umstieg halten U am Ziel ankommen
      const toTripsFromTransfer = index.get(transferStopId) || [];
      for (const tripB of toTripsFromTransfer) {
        if (tripB === tripA) continue;
        const cancelledB = isTripCancelled(tripB, source, updates[source] || new Map());
        if (cancelledB) continue;

        const conn = buildTransferConnection(tripA, tripB, transferStopId, staticData, source, updates);
        if (conn) connections.push(conn);
      }
    }
  }

  // Sortiere nach Ankunftszeit
  connections.sort((a, b) => a.arrival - b.arrival);
  return connections;
}

// Berechnet die Gesamtreisedauer inklusive Umstieg und Wartezeit.
export function connectionDuration(conn) {
  if (conn.type === 'direct') return conn.durationSec;
  // Bei Umstieg: Abfahrt erste Fahrt bis Ankunft letzte Fahrt
  return conn.arrival - conn.departure;
}

// Prüft ob eine Verbindung noch aktuell ist (Abfahrt in der Zukunft).
export function isConnectionFuture(conn, nowSec = Math.floor(Date.now() / 1000)) {
  return conn.departure >= nowSec - 300; // 5 Min Toleranz
}
