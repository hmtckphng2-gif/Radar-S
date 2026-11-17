// Intelligente Haltestellen: Detailansicht für eine einzelne Haltestelle.
// Reine Logik ohne DOM-Abhängigkeit, unit-tested.
import { stopRows, normalizeStopId, numericDelay, feedAgeSeconds, positionValid } from './core.js?v=9.9.6&rev=haltestelle-1';

export const FAVORITES_KEY = 'sueRtirol-radar-favorites';

// Liefert alle planmäßigen Abfahrten einer Haltestelle aus den statischen GTFS-Daten.
// Gibt Array von {tripId, stopId, arrival, departure, seq, line, headsign} zurück.
export function getStopDepartures(stopId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const departures = [];
  const id = normalizeStopId(stopId);

  for (const [tripId, times] of Object.entries(db.times || {})) {
    if (!Array.isArray(times)) continue;
    for (const row of times) {
      if (normalizeStopId(row[0]) !== id) continue;
      const info = getTripInfo(tripId, staticData, source);
      departures.push({
        tripId,
        stopId: row[0],
        arrival: Number(row[1]),
        departure: Number(row[2]),
        seq: Number(row[3]),
        line: info.line,
        headsign: info.headsign
      });
    }
  }

  // Sortiere nach Abfahrtszeit
  departures.sort((a, b) => a.departure - b.departure);
  return departures;
}

// Liefert alle Linien, die eine Haltestelle bedienen (dedupliziert).
export function getStopLines(stopId, staticData, source = 'sta') {
  const deps = getStopDepartures(stopId, staticData, source);
  const lines = new Map();
  for (const d of deps) {
    if (!d.line) continue;
    if (!lines.has(d.line)) lines.set(d.line, { line: d.line, headsign: d.headsign, tripCount: 0 });
    lines.get(d.line).tripCount++;
  }
  return [...lines.values()];
}

// Prüft ob ein Fahrzeug an einer bestimmten Haltestelle ist (currentStopId match).
export function getVehiclesAtStop(vehicles, stopId) {
  const id = normalizeStopId(stopId);
  return vehicles.filter(v => normalizeStopId(v.currentStopId || '') === id);
}

// Liefert Fahrzeuge in der Nähe einer Haltestelle (innerhalb 500m).
export function getVehiclesNearStop(vehicles, stopLat, stopLon, maxMeters = 500) {
  const result = [];
  for (const v of vehicles) {
    if (!positionValid(v.lat, v.lon)) continue;
    const dist = Math.hypot((v.lat - stopLat) * 111195, (v.lon - stopLon) * 111195 * Math.cos(stopLat * Math.PI / 180));
    if (dist <= maxMeters) {
      result.push({ ...v, distanceMeters: Math.round(dist) });
    }
  }
  result.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return result;
}

// Liefert aktive Alerts, die eine bestimmte Haltestelle betreffen.
export function getStopAlerts(stopId, alerts, indexes = null, source = 'sta') {
  const id = normalizeStopId(stopId);
  const result = [];

  for (const a of alerts) {
    for (const ent of (a.informed_entity || [])) {
      if (normalizeStopId(ent.stop_id || '') === id) {
        result.push({ ...a, matchedEntity: ent });
        break;
      }
    }
  }

  return result;
}

// Favoriten: lokale Speicherung im localStorage
export function getFavorites() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function isFavorite(stopId) {
  return getFavorites().includes(stopId);
}

export function toggleFavorite(stopId) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const favs = getFavorites();
    if (favs.includes(stopId)) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.filter(id => id !== stopId)));
      return false;
    } else {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs, stopId]));
      return true;
    }
  } catch { return false; }
}

// Hilfsfunktion: Linieninfo für eine Fahrt
function getTripInfo(tripId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const t = db.trips?.[tripId];
  if (!t) return { line: '', headsign: '' };
  const mappedRouteId = t[0] || '';
  const r = db.routes?.[mappedRouteId];
  return { line: r ? r[0] : '', headsign: t[1] || '' };
}

// Konvertiert Sekunden ab Mitternacht in HH:MM
export function formatTime(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–';
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Liefert den Namen einer Haltestelle
export function getStopName(stopId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const stop = db.stops?.[stopId];
  return stop ? stop[0] : 'Haltestelle ' + stopId;
}
