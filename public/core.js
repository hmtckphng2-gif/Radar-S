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
    const directionId = txt(trip.directionId ?? trip.direction_id);
    const tripStartDate = txt(trip.startDate ?? trip.start_date);
    const serviceDay = /^\d{8}$/.test(tripStartDate)
      ? tripStartDate.slice(0,4)+'-'+tripStartDate.slice(4,6)+'-'+tripStartDate.slice(6,8) : ''; 
    const vehicleId = txt(v.vehicle?.id ?? v.vehicle?.vehicleId ?? v.vehicle?.vehicle_id);
    const label = txt(v.vehicle?.label);
    const entityId = txt(item.id);
    const identity = vehicleId || tripId || entityId;
    if (!identity) { invalid.missingIdentity++; continue; }
    const mapped = tripLookup(staticData, source, tripId, routeId);
    const routeType=mapped.route?.[2];
    const isTrain = routeType!==null && routeType!==undefined && routeType!=='' ? isRailRoute(routeType) : source === 'trains';
    const name = isTrain ? gtfsNumber(label, mapped.tripShortName) : mapped.line || 'Linie unbekannt';
    // A route-direction can have an official UNIQUE shape even if the realtime
    // feed omitted trip_id. Do not attribute the route's destination or timetable.
    const routeShapeId = !isTrain && !mapped.shapeId && directionId !== ''
      ? txt(staticData[source]?.uniqueBusShapesByDay?.[serviceDay]?.[mapped.routeId]?.[directionId]) : '';
    const headsign = mapped.headsign || txt(trip.headsign ?? trip.headSign) || 'Fahrtziel unbekannt';
    const speedValue = p.speed === undefined || p.speed === null ? null : Number(p.speed);
    const speed = speedValue !== null && Number.isFinite(speedValue) && speedValue >= 0 ? Math.round(speedValue * 3.6) : null;
    const rawTs = v.timestamp ?? item.timestamp ?? feed.header?.timestamp;
    const ts = Number(rawTs);
    const timestamp = Number.isFinite(ts) && ts > 1000000000 && ts < nowMs / 1000 + 300 ? ts : null;
    // Vehicle ID may be fleet number, and must never become route/line name.
    out.push({ key:source + ':' + identity, source, kind:isTrain ? 'train' : 'bus',
      lat, lon, rawLat:lat, rawLon:lon, tripId, routeId:mapped.routeId, vehicleId:vehicleId || label || entityId || 'Nicht verfügbar',
      name, headsign, shapeId:mapped.shapeId, routeShapeId, directionId, routeLongName:mapped.route?.[1] || '',
      lineVerified:!isTrain && Boolean(mapped.line), nameVerified:isTrain && name !== 'Zugnummer unbekannt',
      modelKey:isTrain && name !== 'Zugnummer unbekannt' ? name : '',
      bearing:Number.isFinite(Number(p.bearing)) ? Number(p.bearing) : null,
      timestamp, currentStopSequence: Number(v.currentStopSequence ?? v.current_stop_sequence) || null,
      currentStopId:txt(v.stopId ?? v.stop_id), currentStatus:txt(v.currentStatus ?? v.current_status),
      tripStartDate,
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
    // In GTFS-RT a trip-wide delay is optional. Do not substitute a random
    // stop's delay: it can have the opposite sign to the upcoming stop.
    const tripDelay = numericDelay(update.delay);
    out.set(source + ':' + tripId, {
      tripStartDate:txt(update.trip?.startDate ?? update.trip?.start_date),
      timestamp:Number(update.timestamp??feed.header?.timestamp)||null,
      delay:tripDelay,
      stops:rawStops, scheduleRelationship:txt(update.trip?.scheduleRelationship ?? update.trip?.schedule_relationship), fetchedAt:nowMs
    });
  }
  return out;
}
export function numericDelay(v) { if (v === null || v === undefined || v === '') return null; const n=Number(v); return Number.isFinite(n) ? n : null; }
// Radar 4.2: one shared, conservative delay decision for map and detail views.
// Positive = late, negative = early. Both stop_id and stop_sequence must agree.
export function normalizeStopId(value) {return txt(value).toLowerCase();}
export function tripUpdateMatches(vehicle,update) {
  const a=txt(vehicle?.tripStartDate).replaceAll('-', '');
  const b=txt(update?.tripStartDate).replaceAll('-', '');
  return !a || !b || a===b;
}
export function vehicleDelayInfo(update, vehicle={}) {
  if (!update || !tripUpdateMatches(vehicle,update)) return null;
  const currentId=normalizeStopId(vehicle.currentStopId);
  const seq=Number(vehicle.currentStopSequence);
  const hasSeq=Number.isFinite(seq)&&seq>0;
  const stops=Array.isArray(update.stops)?update.stops:[];
  const stopId=s=>normalizeStopId(s.stopId??s.stop_id);
  const stopSeq=s=>Number(s.stopSequence??s.stop_sequence);
  const byId=currentId?stops.findIndex(s=>stopId(s)===currentId):-1;
  const bySeq=hasSeq?stops.findIndex(s=>stopSeq(s)===seq):-1;
  // A different stop ID is not permission to use a misleading nearby sequence.
  if(currentId && stops.length && byId<0)return null;
  if(byId>=0 && bySeq>=0 && byId!==bySeq)return null;
  let row=stops[byId>=0?byId:bySeq];
  if(!row && hasSeq)row=stops.filter(s=>Number.isFinite(stopSeq(s))&&stopSeq(s)>=seq)
    .sort((a,b)=>stopSeq(a)-stopSeq(b))[0];
  function delayFromStop(s){
    const atStop=/^(STOPPED_AT|1)$/i.test(txt(vehicle.currentStatus));
    return numericDelay(atStop
      ? s.departure?.delay??s.arrival?.delay
      : s.arrival?.delay??s.departure?.delay);
  }
  if(row){
    const val=delayFromStop(row);
    if(val!==null)return {delay:val,basis:'halt',stopId:stopId(row)};
  }
  // A trip-wide figure can differ from the next-stop prediction; identify it.
  const trip=numericDelay(update.delay);
  return trip===null?null:{delay:trip,basis:'fahrt',stopId:''};
}
export function delayForVehicle(update, vehicle){
  return vehicleDelayInfo(update,vehicle)?.delay??null;
}
// Playback is intentionally delayed: interpolate BETWEEN received fixes only.
// Never extrapolate beyond the newest actual vehicle position.
export function bufferedAlong(samples, when){
  if(!Array.isArray(samples)||!samples.length)return null;
  const ordered=samples.filter(s=>Number.isFinite(s?.time)&&Number.isFinite(s?.along))
    .sort((a,b)=>a.time-b.time);
  if(!ordered.length)return null;
  if(when<=ordered[0].time)return ordered[0].along;
  for(let i=1;i<ordered.length;i++){
    const a=ordered[i-1], b=ordered[i];
    if(when<=b.time){const dt=b.time-a.time;
      if(dt<=0)return b.along;
      const f=Math.max(0,Math.min(1,(when-a.time)/dt));
      return a.along+(b.along-a.along)*f;
    }
  }
  return ordered.at(-1).along;
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

// Strict route-only map matching: a unique published GTFS shape is not enough.
// Require a recent reported position near that route AND a direction consistent
// with the local shape tangent. Never use this to invent a trip or stop.
export function routeOnlySnap(path, lat, lon, bearing) {
  if(bearing===null || bearing===undefined || bearing==='') return null;
  const heading=Number(bearing);
  if(!Number.isFinite(heading) || heading<0 || heading>=360) return null;
  const snapped=shapeProject(path,lat,lon);
  if(!snapped || !Number.isFinite(snapped.along) || snapped.distance>35) return null;
  const before=pointAtDistance(path,Math.max(0,snapped.along-18),lat);
  const after=pointAtDistance(path,snapped.along+18,lat);
  if(!before || !after) return null;
  const cos=Math.cos(lat*Math.PI/180);
  const dx=(after.lon-before.lon)*cos, dy=after.lat-before.lat;
  if(Math.hypot(dx,dy)<1e-9) return null;
  const shapeHeading=(Math.atan2(dx,dy)*180/Math.PI+360)%360;
  const difference=Math.abs(((shapeHeading-heading+540)%360)-180);
  if(difference>65) return null;
  return {...snapped,path};
}
