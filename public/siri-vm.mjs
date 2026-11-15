// SIRI Vehicle Monitoring (CEN/TS 15531) — reiner Parser ohne DOM-Abhängigkeit ausser DOMParser (Node >= 20).
// Überführt SIRI VM-XML-Antworten in das interne Fahrzeugformat.
// SIRI wird strikt von GTFS-RT unterschieden: eigene Quelle, eigenes Schema, eigene Timestamp-Logik.
import {BBOX, positionValid, txt} from './core.js?v=9.9.0';

export const SIRI_SOURCE = 'siri_vm';
export const SIRI_KIND = 'bus'; // SIRI Vehicle Monitoring erfasst primär Busse

// Extrahiert den Inhalt des ersten Vorkommens eines XML-Tags (case-insensitiv).
function extractTag(xml, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)</' + tagName + '>', 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// Extrahiert alle Vorkommen eines XML-Tags (case-insensitiv).
function extractAllTags(xml, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)</' + tagName + '>', 'gi');
  const out = [];
  let m;
  while ((m = regex.exec(xml)) !== null) out.push(m[1]);
  return out;
}

// Extrahiert den Textinhalt eines XML-Tags (ohne untergeordnete Tags).
function extractText(xml, tagName) {
  const inner = extractTag(xml, tagName);
  if (!inner) return '';
  // Untergeordnete XML-Tags entfernen, nur reiner Text bleibt
  return txt(inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

// Parst eine SIRI VM-XML-Antwort (VehicleMonitoringDelivery).
// Gibt {vehicles, invalid, totalEntities, error} zurück.
// vehicles enthalten source='siri_vm', kind='bus', delay (Sekunden aus Aimed/Expected DepartureTime),
// positionType='SIRI Vehicle Monitoring'.
export function parseSiriVm(xmlString, source = SIRI_SOURCE) {
  const vehicles = [];
  const invalid = {missingPosition: 0, invalidCoordinates: 0, missingIdentity: 0};
  let totalEntities = 0;

  if (!xmlString || typeof xmlString !== 'string') {
    return {vehicles, invalid, totalEntities: 0, error: 'Keine SIRI-XML-Antwort übermittelt'};
  }

  // SIRI-Fehlerantwort erkennen
  const errorXml = extractTag(xmlString, 'Error');
  if (errorXml) {
    const description = extractText(errorXml, 'Description');
    return {vehicles, invalid, totalEntities: 0, error: description || 'SIRI-Fehlerantwort'};
  }

  // Delivery-Pruefung: muss VehicleMonitoringDelivery enthalten
  const deliveryXml = extractTag(xmlString, 'VehicleMonitoringDelivery');
  if (!deliveryXml) {
    return {vehicles, invalid, totalEntities: 0, error: 'Keine VehicleMonitoringDelivery in SIRI-Antwort'};
  }

  const activityXmls = extractAllTags(deliveryXml, 'VehicleActivity');
  totalEntities = activityXmls.length;

  for (const activityXml of activityXmls) {
    const mvjXml = extractTag(activityXml, 'MonitoredVehicleJourney');
    if (!mvjXml) continue;

    const vehicleId = extractText(mvjXml, 'VehicleRef');
    const lineName = extractText(mvjXml, 'LineRef');
    const direction = extractText(mvjXml, 'DirectionRef');

    const locXml = extractTag(mvjXml, 'VehicleLocation');
    const lat = locXml ? Number(extractText(locXml, 'Latitude')) : NaN;
    const lon = locXml ? Number(extractText(locXml, 'Longitude')) : NaN;

    if (!positionValid(lat, lon)) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) invalid.missingPosition++;
      else invalid.invalidCoordinates++;
      continue;
    }

    const identity = vehicleId || lineName || '';
    if (!identity) {
      invalid.missingIdentity++;
      continue;
    }

    // Verspätung aus AimedDepartureTime / ExpectedDepartureTime (MonitoredCall)
    let delaySeconds = null;
    const callXml = extractTag(mvjXml, 'MonitoredCall');
    if (callXml) {
      const aimedStr = extractText(callXml, 'AimedDepartureTime');
      const expectedStr = extractText(callXml, 'ExpectedDepartureTime');
      if (aimedStr && expectedStr) {
        const aimedTs = new Date(aimedStr).getTime();
        const expectedTs = new Date(expectedStr).getTime();
        if (Number.isFinite(aimedTs) && Number.isFinite(expectedTs)) {
          delaySeconds = (expectedTs - aimedTs) / 1000;
        }
      }
    }

    const recordedAtStr = extractText(activityXml, 'RecordedAtTime');
    const ts = recordedAtStr ? new Date(recordedAtStr).getTime() : Date.now();

    vehicles.push({
      key: source + ':' + identity,
      source,
      kind: SIRI_KIND,
      lat,
      lon,
      vehicleId: vehicleId || 'Nicht verfügbar',
      name: lineName || 'Linie unbekannt',
      direction,
      delay: delaySeconds,
      timestamp: Math.floor(ts / 1000),
      receivedAt: Date.now(),
      positionType: 'SIRI Vehicle Monitoring (CEN/TS 15531)',
      verifiedLine: Boolean(lineName),
      nameVerified: Boolean(lineName)
    });
  }

  return {vehicles, invalid, totalEntities};
}

// Liefert eine lesbare Quellenbezeichnung für SIRI VM.
export function siriSourceLabel() {
  return 'SIRI Vehicle Monitoring';
}
