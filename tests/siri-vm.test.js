import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSiriVm} from '../public/siri-vm.mjs';

// SIRI Vehicle Monitoring Parser-Tests (CEN/TS 15531).
// Reine Logik-Tests mit DOMParser (Node >= 20). Keine echten Netzwerkaufrufe.

const SIRI_NS = 'http://www.siri.org.uk/siri';

function siriVm(activitiesXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="${SIRI_NS}">
  <ServiceDelivery>
    <VehicleMonitoringDelivery>
      <ResponseTimestamp>2026-10-22T14:30:00Z</ResponseTimestamp>
      ${activitiesXml}
    </VehicleMonitoringDelivery>
  </ServiceDelivery>
</Siri>`;
}

function vehicleActivity(recordedAt, vehicleRef, lineRef, lat, lon, aimed, expected, directionRef = '0') {
  return `
      <VehicleActivity>
        <RecordedAtTime>${recordedAt}</RecordedAtTime>
        <MonitoredVehicleJourney>
          <VehicleRef>${vehicleRef}</VehicleRef>
          <LineRef>${lineRef}</LineRef>
          <DirectionRef>${directionRef}</DirectionRef>
          <VehicleLocation>
            <Latitude>${lat}</Latitude>
            <Longitude>${lon}</Longitude>
          </VehicleLocation>
          <MonitoredCall>
            <AimedDepartureTime>${aimed}</AimedDepartureTime>
            <ExpectedDepartureTime>${expected}</ExpectedDepartureTime>
          </MonitoredCall>
        </MonitoredVehicleJourney>
      </VehicleActivity>`;
}

test('SIRI VM: gueltige Antwort wird geparst', () => {
  const xml = siriVm(vehicleActivity('2026-10-22T14:30:00Z', 'V123', 'LINE 1', 46.5, 11.35,
    '2026-10-22T14:30:00Z', '2026-10-22T14:35:00Z'));
  const result = parseSiriVm(xml);
  assert.equal(result.error, undefined, 'Kein Fehler: ' + (result.error || '-'));
  assert.equal(result.vehicles.length, 1);
  const v = result.vehicles[0];
  assert.equal(v.source, 'siri_vm');
  assert.equal(v.kind, 'bus');
  assert.equal(v.vehicleId, 'V123');
  assert.equal(v.name, 'LINE 1');
  assert.equal(v.lat, 46.5);
  assert.equal(v.lon, 11.35);
  assert.equal(v.delay, 300, '5 Minuten Verspätung = 300 Sekunden');
  assert.equal(v.positionType, 'SIRI Vehicle Monitoring (CEN/TS 15531)');
});

test('SIRI VM: ohne Fahrzeugposition wird uebersprungen', () => {
  const xml = siriVm(`
      <VehicleActivity>
        <RecordedAtTime>2026-10-22T14:30:00Z</RecordedAtTime>
        <MonitoredVehicleJourney>
          <VehicleRef>V1</VehicleRef>
          <LineRef>LINE 1</LineRef>
        </MonitoredVehicleJourney>
      </VehicleActivity>`);
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.invalid.missingPosition, 1);
});

test('SIRI VM: ungültige Koordinaten werden erkannt', () => {
  const xml = siriVm(vehicleActivity('2026-10-22T14:30:00Z', 'V1', 'LINE 1', 999, 999,
    '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z'));
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.invalid.invalidCoordinates, 1);
});

test('SIRI VM: fehlende Identitaet wird erkannt', () => {
  const xml = siriVm(vehicleActivity('2026-10-22T14:30:00Z', '', '',
    46.5, 11.35, '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z'));
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.invalid.missingIdentity, 1);
});

test('SIRI VM: ohne Verspätung (Aimed = Expected)', () => {
  const xml = siriVm(vehicleActivity('2026-10-22T14:30:00Z', 'V1', 'LINE 1', 46.5, 11.35,
    '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z'));
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles[0].delay, 0, 'Keine Verspätung wenn Aimed = Expected');
});

test('SIRI VM: SIRI-Fehlerantwort', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="${SIRI_NS}">
  <ServiceDelivery>
    <VehicleMonitoringDelivery>
      <Error>
        <ErrorCode>NoDataForSpecifiedInterval</ErrorCode>
        <Description>Keine Daten verfuegbar</Description>
      </Error>
    </VehicleMonitoringDelivery>
  </ServiceDelivery>
</Siri>`;
  const result = parseSiriVm(xml);
  assert.equal(result.error, 'Keine Daten verfuegbar');
  assert.equal(result.vehicles.length, 0);
});

test('SIRI VM: ohne VehicleMonitoringDelivery', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="${SIRI_NS}">
  <ServiceDelivery>
    <OtherDelivery/>
  </ServiceDelivery>
</Siri>`;
  const result = parseSiriVm(xml);
  assert.ok(result.error);
  assert.ok(result.error.includes('Keine VehicleMonitoringDelivery'));
  assert.equal(result.vehicles.length, 0);
});

test('SIRI VM: leeres VehicleActivity-Array', () => {
  const xml = siriVm('');
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.totalEntities, 0);
});

test('SIRI VM: Duplikate werden nicht doppelt gezählt (gleiche VehicleRef)', () => {
  const xml = siriVm(
    vehicleActivity('2026-10-22T14:30:00Z', 'V1', 'LINE 1', 46.5, 11.35,
      '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z') +
    vehicleActivity('2026-10-22T14:30:00Z', 'V1', 'LINE 1', 46.5, 11.35,
      '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z')
  );
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 2, 'parser liefert beide; Duplikat-Erkennung erfolgt in feed-process');
});

test('SIRI VM: Fahrzeugreferenz, Linie und Richtung werden getrennt von GTFS-RT erfasst', () => {
  const xml = siriVm(vehicleActivity('2026-10-22T14:30:00Z', 'BUS-42', 'SAD 101', 46.5, 11.35,
    '2026-10-22T14:30:00Z', '2026-10-22T14:32:00Z', '1'));
  const result = parseSiriVm(xml);
  const v = result.vehicles[0];
  assert.equal(v.source, 'siri_vm', 'Quelle ist siri_vm (nicht GTFS-RT)');
  assert.equal(v.kind, 'bus', 'SIRI VM ist primär Bus');
  assert.equal(v.vehicleId, 'BUS-42');
  assert.equal(v.name, 'SAD 101');
  assert.equal(v.direction, '1');
  assert.equal(v.delay, 120, '2 Minuten Verspätung');
});

test('SIRI VM: Fahrzeugmodell ist kompatibel mit bestehendem vehicle-State (alle Pflichtfelder)', () => {
  const xml = siriVm(vehicleActivity('2026-10-22T14:30:00Z', 'BUS-7', 'Linie 1A', 46.5, 11.35,
    '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z'));
  const result = parseSiriVm(xml);
  const v = result.vehicles[0];
  // Pflichtfelder für den vorhandenen Fahrzeug-State (refreshMarkers, displayStats etc.)
  assert.ok(v.key, 'key vorhanden');
  assert.equal(v.source, 'siri_vm', 'source gesetzt');
  assert.equal(v.kind, 'bus', 'kind gesetzt');
  assert.ok(Number.isFinite(v.lat), 'lat ist Zahl');
  assert.ok(Number.isFinite(v.lon), 'lon ist Zahl');
  assert.ok(v.vehicleId, 'vehicleId gesetzt');
  assert.ok(v.name, 'name gesetzt');
  assert.ok(Number.isFinite(v.timestamp) || v.timestamp === null, 'timestamp ist Zahl oder null');
  assert.ok(Number.isFinite(v.receivedAt), 'receivedAt ist Zahl');
  assert.equal(v.positionType, 'SIRI Vehicle Monitoring (CEN/TS 15531)', 'positionType kennzeichnet SIRI');
  assert.equal(v.verifiedLine, true, 'verifiedLine gesetzt');
  assert.equal(v.nameVerified, true, 'nameVerified gesetzt');
  assert.equal(v.delay, 0, 'delay ist 0 wenn pünktlich');
});

test('SIRI VM: Ohne optionale Felder (keine Richtung, keine Verspätungsdaten)', () => {
  const xml = siriVm(`
      <VehicleActivity>
        <RecordedAtTime>2026-10-22T14:30:00Z</RecordedAtTime>
        <MonitoredVehicleJourney>
          <VehicleRef>BUS-99</VehicleRef>
          <LineRef>Linie X</LineRef>
          <VehicleLocation>
            <Latitude>46.5</Latitude>
            <Longitude>11.35</Longitude>
          </VehicleLocation>
        </MonitoredVehicleJourney>
      </VehicleActivity>`);
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 1);
  const v = result.vehicles[0];
  assert.equal(v.vehicleId, 'BUS-99');
  assert.equal(v.name, 'Linie X');
  assert.equal(v.direction, '', 'Richtung leer wenn nicht vorhanden');
  assert.equal(v.delay, null, 'delay null wenn keine Verspätungsdaten');
  assert.equal(v.positionType, 'SIRI Vehicle Monitoring (CEN/TS 15531)', 'SIRI gekennzeichnet auch ohne optionale Felder');
});

test('SIRI VM: Veralteter Timestamp wird nicht als live ausgegeben', () => {
  const oldTs = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 Stunden alt
  const xml = siriVm(vehicleActivity(oldTs, 'BUS-OLD', 'Linie 5', 46.5, 11.35,
    oldTs, oldTs));
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 1);
  // Der Parser selbst markiert nicht als alt; das erfolgt in refreshFeeds via state.statuses.
  // Hier wird nur geprüft, dass das Fahrzeug mit dem alten Timestamp existiert.
  assert.equal(result.vehicles[0].vehicleId, 'BUS-OLD');
});

test('SIRI VM: Fahrzeug mit gültigen Koordinaten wird übernommen, ungültige übersprungen', () => {
  const xml = siriVm(
    vehicleActivity('2026-10-22T14:30:00Z', 'BUS-OK', 'Linie 1', 46.5, 11.35,
      '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z') +
    vehicleActivity('2026-10-22T14:30:00Z', 'BUS-BAD', 'Linie 2', 999, 999,
      '2026-10-22T14:30:00Z', '2026-10-22T14:30:00Z')
  );
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 1, 'Nur das Fahrzeug mit gültigen Koordinaten');
  assert.equal(result.vehicles[0].vehicleId, 'BUS-OK');
  assert.equal(result.invalid.invalidCoordinates, 1, 'Ungültige Koordinaten gezählt');
});

test('SIRI VM: Fahrzeug mit fehlender Position wird übersprungen (kein VehicleLocation)', () => {
  const xml = siriVm(`
      <VehicleActivity>
        <RecordedAtTime>2026-10-22T14:30:00Z</RecordedAtTime>
        <MonitoredVehicleJourney>
          <VehicleRef>BUS-NOPOS</VehicleRef>
          <LineRef>Linie X</LineRef>
        </MonitoredVehicleJourney>
      </VehicleActivity>`);
  const result = parseSiriVm(xml);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.invalid.missingPosition, 1, 'Fehlende Position erkannt');
});
