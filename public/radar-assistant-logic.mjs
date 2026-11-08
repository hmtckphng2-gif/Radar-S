/* Evidence-only assistant helpers. No network, DOM, persistence or model calls. */
const clean = (value, limit = 320) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const dateKey = value => { const s = clean(value, 16); if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
export function romeServiceDay(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Rome', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(now));
}
export function isFreshFeed(feed, now = Date.now(), maxAgeSeconds = 300) {
  const timestamp = Number(feed?.header?.timestamp);
  return Number.isFinite(timestamp) && timestamp > 1e9 && timestamp <= now / 1000 + 30 && now / 1000 - timestamp <= maxAgeSeconds;
}
function textValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value?.translation)) return value.translation.map(x => clean(x?.text, 220)).filter(Boolean).join(' / ');
  return '';
}
function tripLabel(source, trip, route) {
  if (!trip || !route) return null;
  const routeType = Number(route[2]);
  const rail = routeType === 1 || routeType === 2 || (routeType >= 100 && routeType < 200) || (routeType >= 300 && routeType < 700) || source === 'trains';
  if (rail) {
    const raw = clean(trip[3], 24);
    const match = raw.match(/^(?:(?:REG|RE|RV|R|RJX|RJ|EC|IC|FR|FA|EN|S\d{1,2})\s+)?(\d{2,6})[A-Z]?$/i);
    return match ? { label:'Zug ' + match[1], key:match[1], kind:'train' } : null;
  }
  const line = clean(route[0], 24);
  return line ? { label:'Buslinie ' + line, key:line, kind:'bus' } : null;
}
function getTrip(index, tripId, routeId) {
  const trip = index?.trips?.[tripId];
  if (!trip || !Array.isArray(trip)) return null;
  if (routeId && trip[0] && String(trip[0]) !== String(routeId)) return null;
  const route = index?.routes?.[trip[0]];
  return route ? { trip, route } : null;
}
function fact(id, type, source, text, observedAt, extra = {}) {
  return { id:clean(id, 180), type, source:clean(source, 50), text:clean(text, 420), observedAt:clean(observedAt, 40), ...extra };
}

export function buildAssistantEvidence({ positions = {}, updates = {}, alerts = null, indexes = {}, question = '', now = Date.now() } = {}) {
  const facts = [], today = romeServiceDay(now);
  for (const source of ['sta','sta_direct','trentino']) { // Trenitalia position feed may be estimated and is not used as location evidence.
    const staticSource = source === 'sta_direct' ? 'sta' : source;
    const index = indexes[staticSource];
    const positionFeed = positions[source];
    const indexCurrent = index?.meta?.ready === true && Array.isArray(index.meta.days) && index.meta.days.includes(today);
    if (!indexCurrent || !isFreshFeed(positionFeed, now)) continue;
    const entities = Array.isArray(positionFeed.entity) ? positionFeed.entity : [];
    for (const entity of entities) {
      const vehicle = entity?.vehicle || entity?.vehiclePosition || entity?.vehicle_position;
      const tripInfo = vehicle?.trip || {};
      const tripId = clean(tripInfo.tripId ?? tripInfo.trip_id, 120);
      const routeId = clean(tripInfo.routeId ?? tripInfo.route_id, 120);
      if (!tripId || dateKey(tripInfo.startDate ?? tripInfo.start_date) !== today) continue;
      const mapped = getTrip(index, tripId, routeId);
      if (!mapped) continue;
      const identity = tripLabel(staticSource, mapped.trip, mapped.route);
      if (!identity) continue;
      const feedTimestamp = Number(vehicle?.timestamp ?? entity?.timestamp ?? positionFeed.header?.timestamp);
      if (!Number.isFinite(feedTimestamp) || feedTimestamp <= 1e9 || now / 1000 - feedTimestamp > 300 || feedTimestamp > now / 1000 + 30) continue;
      const destination = clean(mapped.trip[1], 100);
      const observed = new Date(feedTimestamp * 1000).toISOString();
      const positionId = `position:${source}:${identity.key}:${tripId}`;
      facts.push(fact(positionId, 'position', source, `${identity.label}${destination ? ' Richtung ' + destination : ''}: aktuelle GTFS-Realtime-Feedposition empfangen; GPS-Qualität nicht unabhängig bestätigt.`, observed, {tripId,routeId,vehicleId:clean(vehicle?.vehicle?.id ?? vehicle?.vehicleId ?? entity?.id,120),positionQuality:'feed-reported-unverified'}));

      const updateSource = source === 'sta_direct' ? 'sta_direct_updates' : source + '_updates';
      const updateFeed = updates[updateSource];
      if (!isFreshFeed(updateFeed, now)) continue;
      for (const updateEntity of (Array.isArray(updateFeed.entity) ? updateFeed.entity : [])) {
        const update = updateEntity?.tripUpdate || updateEntity?.trip_update;
        if (!update || clean(update.trip?.tripId ?? update.trip?.trip_id, 120) !== tripId) continue;
        if (dateKey(update.trip?.startDate ?? update.trip?.start_date) !== today) continue;
        const relationship = String(update.trip?.scheduleRelationship ?? update.trip?.schedule_relationship ?? '').toUpperCase();
        const updateTime = Number(update.timestamp ?? updateFeed.header.timestamp);
        const updateObserved = Number.isFinite(updateTime) ? new Date(updateTime * 1000).toISOString() : observed;
        if (relationship === 'CANCELED' || relationship === 'DELETED') {
          facts.push(fact(`cancel:${source}:${identity.key}:${tripId}`, 'cancellation', source, `${identity.label}${destination ? ' Richtung ' + destination : ''}: GTFS-Realtime kennzeichnet diese Fahrt als ${relationship === 'CANCELED' ? 'ausgefallen' : 'gelöscht'}.`, updateObserved, {tripId,routeId}));
          continue;
        }
        const stops = Array.isArray(update.stopTimeUpdate) ? update.stopTimeUpdate : Array.isArray(update.stop_time_update) ? update.stop_time_update : [];
        for (const stop of stops.slice(0, 8)) {
          const seq = Number(stop.stopSequence ?? stop.stop_sequence);
          const delay = stop.arrival?.delay ?? stop.departure?.delay;
          if (!Number.isInteger(seq) || !Number.isFinite(Number(delay))) continue;
          const minutes = Math.round(Number(delay) / 60);
          const stopId = clean(stop.stopId ?? stop.stop_id, 80);
          const delayId = `delay:${source}:${identity.key}:${tripId}:${seq}:${stop.arrival?.delay != null ? 'arrival' : 'departure'}`;
          facts.push(fact(delayId, 'delay', source, `${identity.label}${destination ? ' Richtung ' + destination : ''}: GTFS-Realtime meldet an Halte-Sequenz ${seq}${stopId ? ' (Stop-ID ' + stopId + ')' : ''} ${minutes > 0 ? '+' : ''}${minutes} Minuten${minutes === 0 ? ' Abweichung' : ' Verspätung'}. Dies ist eine gemeldete Prognose, keine aus der Kartenposition berechnete Zeit.`, updateObserved, {tripId,routeId,stopId}));
        }
      }
    }
  }
  // Trip updates are independently useful for cancellations and delays even when a cancelled trip has no live vehicle position.
  for (const [updateSource, source] of [['sta_updates','sta'],['sta_direct_updates','sta_direct'],['trentino_updates','trentino'],['trains_updates','trains']]) {
    const staticSource = source === 'sta_direct' ? 'sta' : source;
    const index = indexes[staticSource];
    const updateFeed = updates[updateSource];
    if (!index?.meta?.ready || !Array.isArray(index.meta.days) || !index.meta.days.includes(today) || !isFreshFeed(updateFeed, now)) continue;
    for (const entity of (Array.isArray(updateFeed.entity) ? updateFeed.entity : [])) {
      const update = entity?.tripUpdate || entity?.trip_update;
      if (!update) continue;
      const tripId = clean(update.trip?.tripId ?? update.trip?.trip_id, 120);
      if (!tripId || dateKey(update.trip?.startDate ?? update.trip?.start_date) !== today) continue;
      const mapped = getTrip(index, tripId, clean(update.trip?.routeId ?? update.trip?.route_id, 120));
      if (!mapped) continue;
      const routeId = clean(update.trip?.routeId ?? update.trip?.route_id ?? mapped.trip[0], 120);
      const identity = tripLabel(staticSource, mapped.trip, mapped.route);
      if (!identity) continue;
      const destination = clean(mapped.trip[1], 100);
      const updateTime = Number(update.timestamp ?? updateFeed.header.timestamp);
      const observed = Number.isFinite(updateTime) ? new Date(updateTime * 1000).toISOString() : new Date(Number(updateFeed.header.timestamp) * 1000).toISOString();
      const relationship = String(update.trip?.scheduleRelationship ?? update.trip?.schedule_relationship ?? '').toUpperCase();
      if (relationship === 'CANCELED' || relationship === 'DELETED') {
        facts.push(fact(`cancel:${source}:${identity.key}:${tripId}`, 'cancellation', source, `${identity.label}${destination ? ' Richtung ' + destination : ''}: GTFS-Realtime kennzeichnet diese Fahrt als ${relationship === 'CANCELED' ? 'ausgefallen' : 'gelöscht'}.`, observed, {tripId,routeId}));
        continue;
      }
      const stops = Array.isArray(update.stopTimeUpdate) ? update.stopTimeUpdate : Array.isArray(update.stop_time_update) ? update.stop_time_update : [];
      for (const stop of stops.slice(0, 8)) {
        const seq = Number(stop.stopSequence ?? stop.stop_sequence);
        const delay = stop.arrival?.delay ?? stop.departure?.delay;
        if (!Number.isInteger(seq) || !Number.isFinite(Number(delay))) continue;
        const minutes = Math.round(Number(delay) / 60);
        const stopId = clean(stop.stopId ?? stop.stop_id, 80);
        const delayId = `delay:${source}:${identity.key}:${tripId}:${seq}:${stop.arrival?.delay != null ? 'arrival' : 'departure'}`;
        facts.push(fact(delayId, 'delay', source, `${identity.label}${destination ? ' Richtung ' + destination : ''}: GTFS-Realtime meldet an Halte-Sequenz ${seq}${stopId ? ' (Stop-ID ' + stopId + ')' : ''} ${minutes > 0 ? '+' : ''}${minutes} Minuten${minutes === 0 ? ' Abweichung' : ' Verspätung'}. Dies ist eine gemeldete Prognose, keine aus der Kartenposition berechnete Zeit.`, observed, {tripId,routeId,stopId}));
      }
    }
  }
  if (alerts && isFreshFeed(alerts, now)) {
    for (const entity of (Array.isArray(alerts.entity) ? alerts.entity : []).slice(0, 25)) {
      const alert = entity?.alert;
      if (!alert) continue;
      const periods = Array.isArray(alert.activePeriod) ? alert.activePeriod : Array.isArray(alert.active_period) ? alert.active_period : [];
      const active = !periods.length || periods.some(period => (!period.start || Number(period.start) <= now / 1000) && (!period.end || Number(period.end) >= now / 1000));
      if (!active) continue;
      const title = textValue(alert.headerText ?? alert.header_text);
      const description = textValue(alert.descriptionText ?? alert.description_text);
      const effect = clean(alert.effect, 50);
      const informed = Array.isArray(alert.informedEntity) ? alert.informedEntity : Array.isArray(alert.informed_entity) ? alert.informed_entity : [];
      const scope = informed.slice(0, 4).map(item => [item.routeId ?? item.route_id, item.stopId ?? item.stop_id].filter(Boolean).join('/')).filter(Boolean).join(', ');
      if (!title && !description) continue;
      const observed = new Date(Number(alerts.header.timestamp) * 1000).toISOString();
      facts.push(fact(`alert:sta:${clean(entity.id, 100)}`, 'service-alert', 'STA', `Offizielle STA-Verkehrsmeldung: ${title || 'Ohne Titel'}. ${description}${effect ? ' Wirkung: ' + effect + '.' : ''}${scope ? ' Betroffene Linien-/Haltestellen-IDs: ' + scope + '.' : ''}`, observed, {routeIds:informed.map(item=>clean(item.routeId??item.route_id,80)).filter(Boolean)}));
    }
  }
  const unique = [...new Map(facts.map(item => [item.id, item])).values()];
  const query = clean(question, 240).toLocaleLowerCase('de');
  const target = query.match(/\b\d{2,6}\b/)?.[0] || '';
  const wantsPosition = /position|standort|wo ist|wo befindet|live|geschätzt|geschaetzt/i.test(query);
  const wantsDisruption = /störung|stoerung|ausfall|verspät|verspaet|delay|warum|cancel/i.test(query);
  const priority = item => target && item.text.includes(target) ? -2 : wantsPosition ? (item.type === 'position' ? 0 : 1) : wantsDisruption ? (item.type === 'service-alert' || item.type === 'cancellation' ? 0 : item.type === 'delay' ? 1 : 2) : (item.type === 'service-alert' ? 0 : item.type === 'position' ? 1 : 2);
  return unique.sort((a,b) => priority(a) - priority(b)).slice(0, 50);
}

export function validateAssistantResult(raw, facts) {
  let parsed;
  try {
    const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    parsed = JSON.parse(text);
  } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.summary !== 'string') return null;
  const valid = new Map((Array.isArray(facts) ? facts : []).map(item => [item.id, item]));
  const ids = Array.isArray(parsed.evidence) ? parsed.evidence.filter(id => typeof id === 'string' && valid.has(id)).slice(0, 8) : [];
  if (Array.isArray(parsed.evidence) && ids.length !== parsed.evidence.length) return null;
  const reasons = (Array.isArray(parsed.reasons) ? parsed.reasons : []).slice(0, 4).map(item => {
    const evidence = Array.isArray(item?.evidence) ? item.evidence.filter(id => typeof id === 'string' && valid.has(id)).slice(0, 4) : [];
    if (!evidence.length || evidence.length !== (item?.evidence || []).length || typeof item?.text !== 'string') return null;
    return { text:clean(item.text, 300), evidence, confidence:['high','medium','low'].includes(item.confidence) ? item.confidence : 'medium' };
  });
  if (reasons.some(item => !item)) return null;
  const options = (Array.isArray(parsed.options) ? parsed.options : []).slice(0, 3).map(item => {
    const evidence = Array.isArray(item?.evidence) ? item.evidence.filter(id => typeof id === 'string' && valid.has(id)).slice(0, 4) : [];
    if (!item || typeof item.text !== 'string' || !evidence.length || evidence.length !== (item.evidence || []).length) return null;
    return { text:clean(item.text, 220), evidence };
  });
  if (options.some(item => !item)) return null;
  const used = new Set([...ids, ...reasons.flatMap(item => item.evidence), ...options.flatMap(item => item.evidence)]);
  if (!used.size) return null;
  return { summary:clean(parsed.summary, 480), reasons, options, evidenceFacts:[...used].map(id => valid.get(id)) };
}
