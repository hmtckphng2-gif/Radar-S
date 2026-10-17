// Pure GTFS / GTFS-Realtime utilities. No DOM or Leaflet dependency; unit-tested.
export const SOURCES = ['sta', 'trentino', 'trains'];
export const UPDATE_SOURCES = SOURCES.map(s => s + '_updates');
export const BBOX = { south:45.25, north:47.35, west:9.85, east:12.95 };
export const txt = value => value == null ? '' : String(value).trim();
export const entities = feed => Array.isArray(feed) ? feed : Array.isArray(feed?.entity) ? feed.entity : Array.isArray(feed?.entities) ? feed.entities : [];
export const positionValid = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= BBOX.south && lat <= BBOX.north && lon >= BBOX.west && lon <= BBOX.east;
export function gtfsNumber(label, shortName) {
  // Preserve explicit service classes such as REG 16709 before bare GTFS short names.
  for (const raw of [label, shortName]) {
    const s = txt(raw).replace(/\s+/g, ' ');
    if (/^(?:REG|RE|RV|R|RJX|RJ|EC|IC|FR|FA|EN|S\d{1,2})\s*[- ]?\s*\d{1,6}[A-Z]?$/i.test(s))
      return s.replace(/^(REG|RE|RV|R|RJX|RJ|EC|IC|FR|FA|EN|S\d{1,2})\s*[- ]?\s*(\d)/i, (_, p, d) => p.toUpperCase() + ' ' + d);
  }
  // Bare numeric labels can be fleet IDs; only GTFS trip_short_name is trustworthy.
  const officialShortName = txt(shortName);
  if (/^\d{2,6}$/.test(officialShortName)) return 'Zug ' + officialShortName;
  return 'Zugnummer unbekannt';
}
export function tripLookup(staticData, source, tripId, routeId) {
  const db = staticData[source] || {};
  const t = db.trips?.[tripId];
  // Indexed as [routeId, headsign, shapeId, tripShortName, serviceId].
  const mappedRouteId = t?.[0] || routeId;
  const r = db.routes?.[mappedRouteId]; // [shortName, longName, routeType]
  return { trip:t || null, route:r || null, routeId:mappedRouteId,
    line:r?.[0] || '', headsign:t?.[1] || '', shapeId:t?.[2] || '', tripShortName:t?.[3] || '' };
}
export function isRailRoute(routeType){
  const type=Number(routeType);
  return Number.isFinite(type) && (type===1 || type===2 || (type>=100 && type<200) || (type>=300 && type<700));
}
export function parseVehicles(feed, source, staticData = {}, nowMs = Date.now()) {
  const out = [], invalid={missingPosition:0, invalidCoordinates:0, missingIdentity:0};
  for (const [i, item] of entities(feed).entries()) {
    const v = item?.vehicle || item?.vehiclePosition || item?.vehicle_position || item;
    const p = v?.position;
    if (!p) { invalid.missingPosition++; continue; }
    const lat = Number(p.latitude ?? p.lat), lon = Number(p.longitude ?? p.lon ?? p.lng);
    if (!positionValid(lat, lon)) { invalid.invalidCoordinates++; continue; }
    const trip = v.trip || {};
    const tripId = txt(trip.tripId ?? trip.trip_id);
    const routeId = txt(trip.routeId ?? trip.route_id);
    const vehicleId = txt(v.vehicle?.id ?? v.vehicle?.vehicleId ?? v.vehicle?.vehicle_id);
    const label = txt(v.vehicle?.label);
    const entityId = txt(item.id);
    const identity = vehicleId || tripId || entityId;
    if (!identity) { invalid.missingIdentity++; continue; }
    const mapped = tripLookup(staticData, source, tripId, routeId);
    const isTrain = source === 'trains' || isRailRoute(mapped.route?.[2]);
    const name = isTrain ? gtfsNumber(label, mapped.tripShortName) : mapped.line || 'Linie unbekannt';
    const headsign = mapped.headsign || txt(trip.headsign ?? trip.headSign) || 'Fahrtziel unbekannt';
    const speedValue = p.speed === undefined || p.speed === null ? null : Number(p.speed);
    const speed = speedValue !== null && Number.isFinite(speedValue) && speedValue >= 0 ? Math.round(speedValue * 3.6) : null;
    const rawTs = v.timestamp ?? item.timestamp ?? feed.header?.timestamp;
    const ts = Number(rawTs);
    const timestamp = Number.isFinite(ts) && ts > 1000000000 && ts < nowMs / 1000 + 300 ? ts : null;
    // Vehicle ID may be fleet number, and must never become route/line name.
    out.push({ key:source + ':' + identity, source, kind:isTrain ? 'train' : 'bus',
      lat, lon, rawLat:lat, rawLon:lon, tripId, routeId:mapped.routeId, vehicleId:vehicleId || label || entityId || 'Nicht verfügbar',
      name, headsign, shapeId:mapped.shapeId, routeLongName:mapped.route?.[1] || '',
      lineVerified:!isTrain && Boolean(mapped.line), nameVerified:isTrain && name !== 'Zugnummer unbekannt',
      modelKey:isTrain && name !== 'Zugnummer unbekannt' ? name : '',
      bearing:Number.isFinite(Number(p.bearing)) ? Number(p.bearing) : null,
      timestamp, currentStopSequence: Number(v.currentStopSequence ?? v.current_stop_sequence) || null,
      currentStopId:txt(v.stopId ?? v.stop_id), currentStatus:txt(v.currentStatus ?? v.current_status),
      tripStartDate:txt(trip.startDate ?? trip.start_date),
      receivedAt:nowMs, speed, positionType:source === 'sta' ? 'Feedposition (GPS nicht garantiert)' : 'Simulierte Position',
      rawLabel:label, fetchedAt:nowMs });
  }
  // Multiple feed entities could share IDs: preserve most recent valid timestamp.
  const uniq = new Map();
  for (const v of out) {
    const old = uniq.get(v.key);
    if (!old || (v.timestamp || 0) >= (old.timestamp || 0)) uniq.set(v.key, v);
  }
  return { vehicles:[...uniq.values()], invalid, totalEntities:entities(feed).length };
}
export function parseUpdates(feed, source, nowMs = Date.now()) {
  const out = new Map();
  for (const item of entities(feed)) {
    const update=item?.tripUpdate || item?.trip_update;
    if (!update) continue;
    const tripId=txt(update.trip?.tripId ?? update.trip?.trip_id);
    if (!tripId) continue;
    const rawStops = update.stopTimeUpdate || update.stop_time_update || [];
    let delay = numericDelay(update.delay);
    let bestStop = null;
    for (const stop of rawStops) {
      const d = numericDelay(stop.departure?.delay ?? stop.arrival?.delay);
      if (d !== null && delay === null) delay = d;
      if (d !== null) bestStop = { ...stop, delay:d };
    }
    out.set(source + ':' + tripId, {
      delay:delay !== null ? delay : bestStop?.delay ?? null,
      stops:rawStops, scheduleRelationship:txt(update.trip?.scheduleRelationship ?? update.trip?.schedule_relationship), fetchedAt:nowMs
    });
  }
  return out;
}
export function numericDelay(v) { if (v === null || v === undefined || v === '') return null; const n=Number(v); return Number.isFinite(n) ? n : null; }
export function delayForVehicle(update, vehicle) {
  if(!update)return null;
  const seq=Number(vehicle?.currentStopSequence);
  if(seq>0 && Array.isArray(update.stops)){
    const rows=update.stops
      .map(s=>({seq:Number(s.stopSequence??s.stop_sequence),delay:numericDelay(s.departure?.delay??s.arrival?.delay)}))
      .filter(s=>Number.isFinite(s.seq)&&s.seq>=seq&&s.delay!==null)
      .sort((a,b)=>a.seq-b.seq);
    if(rows.length)return rows[0].delay;
  }
  return update.delay ?? null;
}
export function formatDelay(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'Keine Verspätungsdaten';
  const min = Math.round(seconds / 60); return min > 0 ? '+' + min + ' Min.' : min < 0 ? min + ' Min.' : '0 Min. (laut Feed)';
}
export function formatClock(time) {
  if (time === null || time === undefined) return '–';
  if (typeof time === 'number') { if (!Number.isFinite(time)) return '–'; const minutes=Math.floor(time/60); return String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')+(minutes>=1440?' +1':''); }
  const s=txt(time); const m=s.match(/^(\d{1,2}):(\d\d)/); if(!m)return '–';return String(Number(m[1])%24).padStart(2,'0')+':'+m[2]+(Number(m[1])>=24?' +1':'');
}
export function feedAgeSeconds(vehicle, nowMs=Date.now()) {
  if(!vehicle.timestamp) return null; return Math.max(0, Math.floor(nowMs/1000-vehicle.timestamp));
}
export function stopRows(details, tripId, maxRows=120) {
  const entries=details?.times?.[tripId];
  if(!Array.isArray(entries))return [];
  return entries.slice(0,maxRows).map(([stopId, arr, dep, seq])=>({stopId, name:details.stops?.[stopId]?.[0] || 'Haltestelle '+stopId,
    arrival:formatClock(arr), departure:formatClock(dep), seq}));
}
// Project a GPS/estimated point onto its own GTFS trip shape; no nearest arbitrary railway.
export function shapeProject(path, lat, lon) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const mid = lat*Math.PI/180, cos=Math.cos(mid);
  const px=lon*cos,py=lat;
  let best=null,along=0;
  for(let i=1;i<path.length;i++){
    const [alat,alon]=path[i-1], [blat,blon]=path[i];
    const ax=alon*cos,ay=alat,bx=blon*cos,by=blat;
    const dx=bx-ax,dy=by-ay, lenSq=dx*dx+dy*dy;
    if(lenSq<1e-17)continue;
    const f=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/lenSq));
    const x=ax+f*dx,y=ay+f*dy;
    const distance=Math.hypot(px-x,py-y)*111195;
    const segLen=Math.sqrt(lenSq)*111195;
    if(!best||distance<best.distance) best={lat:alat+(blat-alat)*f,lon:alon+(blon-alon)*f,distance,along:along+f*segLen};
    along+=segLen;
  }
  return best;
}
export function pointAtDistance(path, meters, referenceLat) {
  if(!Array.isArray(path)||path.length===0)return null;
  if(path.length===1)return {lat:path[0][0],lon:path[0][1]};
  let rem=Math.max(0,meters);
  const cos=Math.cos((referenceLat||path[0][0])*Math.PI/180);
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    const seg=Math.hypot((b[1]-a[1])*cos,b[0]-a[0])*111195;
    if(rem<=seg && seg>0){const f=rem/seg;return {lat:a[0]+(b[0]-a[0])*f,lon:a[1]+(b[1]-a[1])*f};}
    rem-=seg;
  }
  return {lat:path.at(-1)[0],lon:path.at(-1)[1]};
}
