/** Read-only parser for the official STA SIRI-Lite Vehicle Monitoring JSON. */
export const SIRI_VM_URL = 'https://efa.sta.bz.it/siri-lite/vehicle-monitoring';
const BBOX = { south:45.25, north:47.35, west:9.85, east:12.95 };
function field(object, ...names) {
  if (!object || typeof object !== 'object') return undefined;
  const wanted = new Set(names.map(name => name.toLowerCase()));
  const key = Object.keys(object).find(name => wanted.has(name.toLowerCase()));
  return key === undefined ? undefined : object[key];
}
function list(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function scalar(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(field(value, 'value', '#text', 'text') ?? '');
  return String(value);
}
function durationSeconds(value) {
  const raw = scalar(value).trim();
  if (!raw) return null;
  const sign = raw.startsWith('-') ? -1 : 1;
  const iso = raw.replace(/^[+-]/, '');
  const match = iso.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) return null;
  const [, days='0', hours='0', minutes='0', seconds='0'] = match;
  return sign * (Number(days)*86400 + Number(hours)*3600 + Number(minutes)*60 + Number(seconds));
}
function validPosition(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= BBOX.south && lat <= BBOX.north && lon >= BBOX.west && lon <= BBOX.east;
}
export function parseSiriVehicleMonitoring(payload, nowMs = Date.now()) {
  const service = field(payload, 'ServiceDelivery') ?? payload;
  const deliveries = list(field(service, 'VehicleMonitoringDelivery'));
  if (!deliveries.length) throw new Error('Unsupported SIRI VehicleMonitoringDelivery format');
  const activities = deliveries.flatMap(delivery => list(field(delivery, 'VehicleActivity')));
  const responseTimestamp = scalar(field(service, 'ResponseTimestamp')) || null;
  const vehicles = [];
  let invalidPositions = 0;
  for (const activity of activities) {
    const journey = field(activity, 'MonitoredVehicleJourney') ?? activity;
    const location = field(journey, 'VehicleLocation') ?? {};
    const lat = Number(field(location, 'Latitude'));
    const lon = Number(field(location, 'Longitude'));
    if (!validPosition(lat, lon)) { invalidPositions++; continue; }
    const operatorRef = scalar(field(journey, 'OperatorRef')) || null;
    const vehicleRef = scalar(field(journey, 'VehicleRef')) || null;
    const journeyRef = scalar(field(journey, 'DatedVehicleJourneyRef', 'VehicleJourneyRef')) || null;
    const id = [operatorRef, vehicleRef || journeyRef].filter(Boolean).join(':') || `siri-${vehicles.length+1}`;
    const delayRaw = field(journey, 'Delay');
    const delaySeconds = durationSeconds(delayRaw);
    const monitoredCall = field(journey, 'MonitoredCall') ?? {};
    const recordedAt = scalar(field(activity, 'RecordedAtTime', 'ValidUntilTime')) || null;
    vehicles.push({
      id, operatorRef, vehicleRef, journeyRef,
      lineRef: scalar(field(journey, 'LineRef')) || null,
      direction: scalar(field(journey, 'DirectionName')) || null,
      latitude: lat, longitude: lon,
      recordedAt, delayRaw: scalar(delayRaw) || null, delaySeconds,
      delayState: delaySeconds === null ? 'unknown' : delaySeconds > 0 ? 'late' : delaySeconds < 0 ? 'early' : 'on-time',
      vehicleAtStop: field(journey, 'VehicleAtStop') ?? null,
      stopPointRef: scalar(field(monitoredCall, 'StopPointRef')) || null,
      stopName: scalar(field(monitoredCall, 'StopPointName')) || null,
      vehicleType: 'unclassified'
    });
  }
  return {
    schema: 'radar.siri-vm.v1', source: 'sta-siri-vm',
    responseTimestamp, collectedAt: new Date(nowMs).toISOString(),
    statistics: { received: activities.length, accepted: vehicles.length, invalidPositions },
    note: 'SIRI-Fahrzeugtyp ist hier noch nicht klassifiziert; keine automatische Bus-/Zug-Zuordnung.',
    vehicles
  };
}
