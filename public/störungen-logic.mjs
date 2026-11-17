// Störungszentrale: Verarbeitet GTFS-RT Service Alerts für die Störungsanzeige.
// Reine Logik ohne DOM-Abhängigkeit, unit-tested.
import { parseAlerts } from './feed-process.mjs?v=9.9.6&rev=feed-timestamp-truth-1';
import { txt, normalizeStopId } from './core.js?v=9.9.6&rev=next-stop-details-1';

export const CAUSE_LABELS = {
  1: 'Verspätung', 2: 'Verspätung', 3: 'Ausfall', 4: 'Ausfall',
  5: 'Verspätung', 6: 'Verspätung', 7: 'Verspätung',
  8: 'Störung', 9: 'Störung'
};

export const EFFECT_LABELS = {
  1: 'Verspätung', 2: 'Ausfall', 3: 'Verspätung', 4: 'Ausfall',
  5: 'Verspätung', 6: 'Verspätung'
};

export function severityClass(cause, effect) {
  if (cause === 3 || cause === 4 || effect === 2 || effect === 4) return 'störung-sev-high';
  if (cause === 1 || cause === 2 || cause === 5 || effect === 1 || effect === 5) return 'störung-sev-low';
  return 'störung-sev-medium';
}

export function severityLabel(cause, effect) {
  return CAUSE_LABELS[cause] || EFFECT_LABELS[effect] || 'Störung';
}

// Filtert nur aktive Alerts (laut active_period oder ohne Zeitangabe = immer aktiv).
export function filterActiveAlerts(alerts, now = Date.now()) {
  const nowSec = Math.floor(now / 1000);
  return alerts.filter(a => {
    if (!a.active_period || a.active_period.length === 0) return true;
    for (const p of a.active_period) {
      const start = Number(p.start) || 0;
      const end = Number(p.end) || Infinity;
      if (nowSec >= start && nowSec <= end) return true;
    }
    return false;
  });
}

// Führt doppelte Meldungen zusammen: gleicher Header + gleiche betroffene Entitäten.
export function mergeDuplicateAlerts(alerts) {
  const merged = new Map();
  for (const a of alerts) {
    const entKey = (a.informed_entity || [])
      .map(e => (e.route_id || '') + '|' + (e.stop_id || '') + '|' + (e.trip_id || ''))
      .sort()
      .join(';');
    const key = txt(a.header) + '||' + entKey;
    if (merged.has(key)) {
      const existing = merged.get(key);
      if (a.fetchedAt > existing.fetchedAt) existing.fetchedAt = a.fetchedAt;
      const known = new Set((existing.informed_entity || []).map(e => JSON.stringify(e)));
      for (const e of (a.informed_entity || [])) {
        const id = JSON.stringify(e);
        if (!known.has(id)) {
          existing.informed_entity.push(e);
          known.add(id);
        }
      }
    } else {
      merged.set(key, { ...a, informed_entity: [...(a.informed_entity || [])] });
    }
  }
  return [...merged.values()];
}

// Löst betroffene Haltestellen, Linien und Fahrten über statische GTFS-Indizes auf.
export function resolveAlertDetails(alert, indexes) {
  const affectedStops = [];
  const affectedLines = [];
  const affectedTrips = [];

  const staticData = indexes && indexes['sta'] ? indexes['sta'] : {};
  const stops = staticData.stops || {};
  const routes = staticData.routes || {};
  const trips = staticData.trips || {};

  for (const ent of (alert.informed_entity || [])) {
    if (ent.stop_id) {
      const s = stops[ent.stop_id];
      affectedStops.push({
        id: ent.stop_id,
        name: s ? s[0] : 'Haltestelle ' + ent.stop_id,
        lat: s ? s[1] : null,
        lon: s ? s[2] : null
      });
    }
    if (ent.route_id) {
      const r = routes[ent.route_id];
      affectedLines.push({
        id: ent.route_id,
        shortName: r ? r[0] : '',
        longName: r ? r[1] : '',
        display: r ? (r[0] || 'Linie ' + ent.route_id) : 'Linie ' + ent.route_id
      });
    }
    if (ent.trip_id) {
      const t = trips[ent.trip_id];
      affectedTrips.push({
        id: ent.trip_id,
        routeId: t ? t[0] : '',
        headsign: t ? t[1] : '',
        display: t ? (t[1] || 'Fahrt ' + ent.trip_id) : 'Fahrt ' + ent.trip_id
      });
    }
  }

  return { affectedStops, affectedLines, affectedTrips };
}

// Gruppiert Alerts nach Schweregrad.
export function groupBySeverity(alerts) {
  const groups = { high: [], medium: [], low: [] };
  for (const a of alerts) {
    const cls = severityClass(a.cause, a.effect);
    if (cls === 'störung-sev-high') groups.high.push(a);
    else if (cls === 'störung-sev-low') groups.low.push(a);
    else groups.medium.push(a);
  }
  return groups;
}

// Gibt das Alter einer Meldung als lesbaren String zurück.
export function formatAlertAge(fetchedAt, now = Date.now()) {
  if (!fetchedAt) return '-';
  const ageSec = Math.max(0, Math.floor(now / 1000 - fetchedAt / 1000));
  if (ageSec < 60) return 'gerade';
  if (ageSec < 3600) return Math.floor(ageSec / 60) + ' Min.';
  return Math.floor(ageSec / 3600) + ' Std.';
}

// Entfernt abgelaufene Alerts (außerhalb des active_period).
export function removeExpiredAlerts(alerts, now = Date.now()) {
  return filterActiveAlerts(alerts, now);
}
