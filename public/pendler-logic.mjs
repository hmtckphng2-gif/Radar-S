// Pendler-Assistent: Verwaltung von Fahrten, Überwachung und Benachrichtigungs-Architektur.
// Reine Logik ohne DOM-Abhängigkeit, unit-tested.

import { findConnections } from './verbindungen-logic.mjs?v=9.9.5';
import { getStopAlerts } from './haltestelle-logic.mjs?v=9.9.5';

export const PROFILES_KEY = 'sueRtirol-radar-pendler-profiles';
export const DELAY_THRESHOLD_SEC = 300; // 5 Min = erhebliche Verspätung

// Eine Pendler-Fahrt: { id, name, fromStopId, toStopId, weekdays: [...], active, createdAt }
export function createProfile(id, name, fromStopId, toStopId, weekdays, active = true) {
  return {
    id,
    name,
    fromStopId,
    toStopId,
    weekdays: Array.isArray(weekdays) ? weekdays : [],
    active: Boolean(active),
    createdAt: Date.now(),
    lastChecked: null,
    lastNotification: null
  };
}

// Prüft ob heute ein Wochentag im Profil ist.
export function isProfileActiveToday(profile) {
  if (!profile.active || !profile.weekdays.length) return false;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Europe/Rome' }).toLowerCase();
  const dayMap = { sun: 'sun', mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat' };
  const todayKey = dayMap[today] || today;
  return profile.weekdays.includes(todayKey);
}

// Liefert alle gespeicherten Pendler-Profile.
export function loadProfiles() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Speichert ein Profil (neu oder aktualisiert).
export function saveProfile(profile) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const profiles = loadProfiles();
    const existing = profiles.findIndex(p => p.id === profile.id);
    if (existing >= 0) {
      profiles[existing] = { ...profiles[existing], ...profile };
    } else {
      profiles.push(profile);
    }
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return true;
  } catch { return false; }
}

// Entfernt ein Profil.
export function removeProfile(id) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const profiles = loadProfiles().filter(p => p.id !== id);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return true;
  } catch { return false; }
}

// Prüft ein Profil auf Änderungen, Ausfälle, Verspätungen.
// Gibt Array von {type, message, severity, tripId} zurück.
export async function checkProfile(profile, staticData, vehicles, updates, alerts, now = Date.now()) {
  const issues = [];
  if (!profile.active || !isProfileActiveToday(profile)) return issues;

  const source = 'sta';

  // Verbindungen für dieses Profil suchen
  const connections = await findConnections(profile.fromStopId, profile.toStopId, staticData, source, { [source]: updates }, now);

  if (connections.length === 0) {
    issues.push({
      type: 'cancellation',
      message: 'Keine Verbindungen verfügbar für ' + profile.name,
      severity: 'high',
      tripId: ''
    });
    return issues;
  }

  // Beste Verbindung auf Verzögerung prüfen
  const bestConn = connections[0];
  if (bestConn.type === 'direct') {
    const delay = getConnectionDelay(bestConn, updates, source);
    if (delay !== null && delay >= DELAY_THRESHOLD_SEC) {
      issues.push({
        type: 'delay',
        message: profile.name + ': ' + Math.round(delay / 60) + ' Min Verspätung bei ' + (bestConn.line || 'Linie'),
        severity: delay >= 900 ? 'high' : 'medium',
        tripId: bestConn.tripId
      });
    }
  } else if (bestConn.type === 'transfer') {
    // Beide Beine auf Ausfall prüfen
    for (const legKey of ['tripA', 'tripB']) {
      const tripId = bestConn[legKey];
      if (isTripCancelled(tripId, source, updates)) {
        issues.push({
          type: 'cancellation',
          message: profile.name + ': Fahrt ' + tripId + ' ausgefallen',
          severity: 'high',
          tripId
        });
      }
    }
  }

  // Störungen die die Haltestellen betreffen
  for (const stopId of [profile.fromStopId, profile.toStopId]) {
    const stopAlerts = getStopAlerts(stopId, alerts);
    for (const alert of stopAlerts) {
      if (alert.cause === 3 || alert.cause === 4 || alert.effect === 2 || alert.effect === 4) {
        issues.push({
          type: 'change',
          message: profile.name + ': Störung an Haltestelle: ' + (alert.header || 'Störung'),
          severity: 'high',
          tripId: ''
        });
      }
    }
  }

  return issues;
}

// Liefert die Verzögerung einer direkten Verbindung aus den Trip Updates.
function getConnectionDelay(conn, updates, source = 'sta') {
  if (conn.type !== 'direct') return null;
  const updateKey = source + ':' + conn.tripId;
  const update = updates.get(updateKey);
  if (!update || !Array.isArray(update.stops)) return null;
  const stopRow = update.stops.find(s => String(s.stopId ?? s.stop_id) === conn.fromStopId);
  if (!stopRow) return null;
  const delay = stopRow.departure?.delay ?? stopRow.arrival?.delay;
  return delay !== null ? Number(delay) : null;
}

// Prüft ob eine Fahrt über GTFS-RT als ausgefallen markiert ist.
export function isTripCancelled(tripId, source, updates = new Map()) {
  const key = source + ':' + tripId;
  const upd = updates.get(key);
  if (!upd) return false;
  return upd.scheduleRelationship === 'CANCELED' || upd.scheduleRelationship === 'CANCELLED';
}

// Web-Push: VAPID-Keys (müssen in Produktion konfiguriert werden)
export const VAPID_PUBLIC_KEY = ''; // leer = Push nicht konfiguriert

// Prüft ob Web-Push im Browser verfügbar ist.
export function isPushAvailable() {
  if (typeof window === 'undefined') return false;
  return !!(window.PushManager && window.ServiceWorkerRegistration);
}

// Registriert Service Worker und abonniert Push-Benachrichtigungen.
export async function subscribePush() {
  if (!isPushAvailable()) return { success: false, error: 'Push nicht verfügbar' };
  if (!VAPID_PUBLIC_KEY) return { success: false, error: 'VAPID-Key nicht konfiguriert' };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    return { success: true, subscription: JSON.stringify(subscription) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Konvertiert Base64-String zu Uint8Array für VAPID.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
