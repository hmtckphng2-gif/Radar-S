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
