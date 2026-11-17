// Live-Fahrtverfolgung: Verarbeitet GTFS-RT Fahrzeugpositionen und Trip Updates.
// Reine Logik ohne DOM-Abhängigkeit, unit-tested.
import { parseVehicles, parseUpdates, delayForVehicle, nextStopFromRows, stopRows, delayPresentation, formatClock, feedAgeSeconds, tripLookup, positionValid } from './core.js?v=9.9.6&rev=fahrverfolgung-1';

export const UPDATE_SOURCES = ['sta', 'trentino', 'trains'];

// Hilfsfeld: leerer String wird wie "nicht verfügbar" behandelt.
function useful(value, fallback) {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s === '' ? fallback : s;
}

// Nimmt ein rohes Vehikel-Objekt (aus /api/v1/vehicles) und liefert eine
// auswahlbare Fahrt mit allen für die Detailansicht nötigen Feldern.
// Gibt null zurück, wenn das Vehikel keine eindeutig identifizierbare Fahrt ist.
export function vehicleToTripEntry(vehicle, staticData = {}, updates = new Map()) {
  if (!vehicle || !vehicle.tripId) return null;
  if (!vehicle.lat || !vehicle.lon || !positionValid(vehicle.lat, vehicle.lon)) return null;

  const source = vehicle.source || 'sta';
  const db = staticData[source] || {};
  const mapped = tripLookup(staticData, source, vehicle.tripId, vehicle.routeId);

  // Trip-Update für Verzögerung und Haltestellen
  const updateKey = source + ':' + vehicle.tripId;
  const update = updates.get(updateKey);
  const delaySec = update ? delayForVehicle(update, vehicle) : null;
  const delay = delayPresentation(delaySec);

  // Nächste Haltestelle aus den statischen Fahrplandaten + GTFS-RT Status
  let nextStop = null;
  let allStops = [];
  const stops = db.stops || {};
  const timesKey = vehicle.tripId;
  if (db.times && Array.isArray(db.times[timesKey])) {
    allStops = stopRows({ times: { [timesKey]: db.times[timesKey] }, stops }, timesKey);
    nextStop = nextStopFromRows(allStops, vehicle);
  }

  const ageSec = feedAgeSeconds(vehicle);
  const ageLabel = ageSec === null ? 'Nicht verfügbar'
    : ageSec < 60 ? 'gerade'
    : ageSec < 3600 ? Math.floor(ageSec / 60) + ' Min.'
    : Math.floor(ageSec / 3600) + ' Std.';

  const isTrain = vehicle.kind === 'train';
  const lineName = useful(vehicle.name, useful(mapped.line, isTrain ? 'Zugnummer unbekannt' : 'Linie unbekannt'));
  const headsign = useful(vehicle.headsign, useful(mapped.headsign, 'Fahrtziel unbekannt'));

  return {
    key: vehicle.key,
    source,
    kind: vehicle.kind,
    tripId: vehicle.tripId,
    routeId: vehicle.routeId,
    vehicleId: useful(vehicle.vehicleId, 'Nicht verfügbar'),
    line: lineName,
    headsign,
    lat: vehicle.lat,
    lon: vehicle.lon,
    bearing: vehicle.bearing ?? null,
    speed: vehicle.speed,
    delay,
    delaySec,
    nextStop,
    allStops,
    timestamp: vehicle.timestamp,
    ageSec,
    ageLabel,
    currentStopId: vehicle.currentStopId || '',
    currentStopSequence: vehicle.currentStopSequence ?? null,
    currentStatus: vehicle.currentStatus || '',
    positionType: useful(vehicle.positionType, 'Position nicht verfügbar'),
    receivedAt: vehicle.receivedAt ?? Date.now(),
    lineVerified: vehicle.lineVerified ?? false,
    nameVerified: vehicle.nameVerified ?? false
  };
}

// Gruppiert alle Fahrzeuge nach Trip ID für die Auswahlansicht.
// Sammelt alle Fahrzeuge pro Trip (das aktuellste wird später vom Aufrufer ausgewählt).
export function groupVehiclesByTrip(vehicles) {
  const byTrip = new Map();
  for (const v of vehicles) {
    if (!v.tripId) continue;
    const existing = byTrip.get(v.tripId);
    if (!existing) {
      byTrip.set(v.tripId, [v]);
    } else {
      existing.push(v);
    }
  }
  return byTrip;
}

// Sortiert Fahrten nach Linienname und Ziel für die Anzeige.
export function sortTripEntries(entries) {
  return entries.slice().sort((a, b) => {
    const la = (a.line || '').localeCompare(b.line || '');
    if (la !== 0) return la;
    return (a.headsign || '').localeCompare(b.headsign || '');
  });
}

// Extrahiert alle Haltestellen einer Fahrt mit Zeiten aus den statischen Daten.
export function getTripStops(tripId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const stops = db.stops || {};
  if (!db.times || !Array.isArray(db.times[tripId])) return [];
  return stopRows({ times: { [tripId]: db.times[tripId] }, stops }, tripId);
}

// Liefert die Verzögerung für eine bestimmte Haltestelle einer Fahrt.
export function getStopDelay(tripId, stopId, staticData, source = 'sta', updates = new Map()) {
  const updateKey = source + ':' + tripId;
  const update = updates.get(updateKey);
  if (!update || !Array.isArray(update.stops)) return null;
  const id = String(stopId).toLowerCase();
  const row = update.stops.find(s => String(s.stopId ?? s.stop_id ?? '').toLowerCase() === id);
  if (!row) return null;
  const specific = row.departure?.delay ?? row.arrival?.delay;
  if (specific !== null && specific !== undefined) return Number(specific);
  return Number(update.delay) || null;
}

// Prüft ob ein Update frisch genug ist (max 2 Minuten).
export function isUpdateFresh(update, now = Date.now()) {
  if (!update || !Number.isFinite(Number(update.fetchedAt))) return false;
  const age = now - Number(update.fetchedAt);
  return age >= -30000 && age <= 120000;
}
