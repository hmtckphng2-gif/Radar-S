// Live-Fahrtverfolgung: Verarbeitet GTFS-RT Fahrzeugpositionen und Trip Updates.
// Reine Logik ohne DOM-AbhÃ¤ngigkeit, unit-tested.
import { parseVehicles, parseUpdates, delayForVehicle, nextStopFromRows, stopRows, delayPresentation, formatClock, feedAgeSeconds, tripLookup, positionValid } from './core.js?v=9.9.5&rev=fahrverfolgung-1';

export const UPDATE_SOURCES = ['sta', 'trentino', 'trains'];

// Hilfsfeld: leerer String wird wie "nicht verfÃ¼gbar" behandelt.
function useful(value, fallback) {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s === '' ? fallback : s;
}

// Nimmt ein rohes Vehikel-Objekt (aus /api/v1/vehicles) und liefert eine
// auswahlbare Fahrt mit allen fÃ¼r die Detailsanshit nÃ¶tigen Feldern.
// Gibt null zurÃ¼ck, wenn das Vehikel keine eindeutig identifizierbare Fahrt ist.
export function vehicleToTripEntry(vehicle, staticData = {}, updates = new Map()) {
  if (!vehicle || !vehicle.tripId) return null;
  if (!vehicle.lat || !vehicle.lon || !positionValid(vehicle.lat, vehicle.lon)) return null;

  const source = vehicle.source || 'sta';
  const db = staticData[source] || {};
  const mapped = tripLookup(staticData, source, vehicle.tripId, vehicle.routeId);

  // Trip-Update fÃ¼r VerzÃ¶gerung und Haltestellen
  const updateKey = source + ':' + vehicle.tripId;
  const update = updates.get(updateKey);
  const delaySec = update ? delayForVehicle(update, vehicle) : null;
  const delay = delayPresentation(delaySec);

  // NÃ¤chste Haltestelle aus den statischen Fahrplandaten + GTFS-RT Status
  let nextStop = null;
  let allStops = [];
  const stops = db.stops || {};
  const timesKey = vehicle.tripId;
  if (db.times && Array.isArray(db.times[timesKey])) {
    allStops = stopRows({ times: { [timesKey]: db.times[timesKey] }, stops }, timesKey);
    nextStop = nextStopFromRows(allStops, vehicle);
  }

  const ageSec = feedAgeSeconds(vehicle);
  const ageLabel = ageSec === null ? 'Nicht verfÃ¼gbar'
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
    vehicleId: useful(vehicle.vehicleId, 'Nicht verfÃ¼gbar'),
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
    positionType: useful(vehicle.positionType, 'Position nicht verfÃ¼gbar'),
    receivedAt: vehicle.receivedAt ?? Date.now(),
    lineVerified: vehicle.lineVerified ?? false,
    nameVerified: vehicle.nameVerified ?? false
  };
}

// Gruppiert alle Fahrzeuge nach Trip ID fÃ¼r die Auswahlansicht.
// Sammelt alle Fahrzeuge pro Trip (das aktuellste wird spÃ¤ter vom Aufrufer ausgewÃ¤hlt).
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

// Sortiert Fahrten nach Linienname und Ziel fÃ¼r die Anzeige.
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
  if (!db.times ||$'&’æ—4'&’†F"çF–ÖW5·G&—–EÒ’’&WGW&âµÓ°¢&WGW&â7F÷&÷w2‡²F–ÖW3¢²·G&—–EÓ¢F"çF–ÖW5·G&—–EÒÒÂ7F÷2ÒÂG&—–B“°§Ð ¢òòÆ–VfW'BF–RfW'¬;fvW'Værl;Ç"V–æR&W7F–Ö×FR†ÇFW7FVÆÆRV–æW"f‡'Bà¦W‡÷'BgVæ7F–öâvWE7F÷FVÆ’‡G&—–BÂ7F÷–BÂ7FF–4FFÂ6÷W&6RÒw7FrÂWFFW2ÒæWrÖ‚’’°¢6öç7BWFFT¶W’Ò6÷W&6R²s¢r²G&—–C°¢6öç7BWFFRÒWFFW2ævWB‡WFFT¶W’“°¢–b‚WFFRÇÂ'&’æ—4'&’‡WFFRç7F÷2’’&WGW&âçVÆÃ°¢6öç7B–BÒ7G&–ær‡7F÷–B’çFôÆ÷vW$66R‚“°¢6öç7B&÷rÒWFFRç7F÷2æf–æB‡2Óâ7G&–ær‡2ç7F÷–Bóò2ç7F÷ö–Bóòrr’çFôÆ÷vW$66R‚’ÓÓÒ–B“°¢–b‚&÷r’&WGW&âçVÆÃ°¢6öç7B7V6–f–2Ò&÷ræFW'GW&SòæFVÆ’óò&÷ræ'&—fÃòæFVÆ“°¢–b‡7V6–f–2ÓÒçVÆÂbb7V6–f–2ÓÒVæFVf–æVB’&WGW&âçVÖ&W"‡7V6–f–2“°¢&WGW&âçVÖ&W"‡WFFRæFVÆ’’ÇÂçVÆÃ°§Ð ¢òò,;ÆgBö"V–âWFFRg&—66‚vVçVr—7B†Ö‚"Ö–çWFVâ’à¦W‡÷'BgVæ7F–öâ—5WFFTg&W6‚‡WFFRÂæ÷rÒFFRææ÷r‚’’°¢–b‚WFFRÇÂçVÖ&W"æ—4f–æ—FR„çVÖ&W"‡WFFRæfWF6†VDB’’’&WGW&âfÇ6S°¢6öç7BvRÒæ÷rÒçVÖ&W"‡WFFRæfWF6†VDB“°¢&WGW&âvRãÒÓ3bbvRÃÒ#°§Ð