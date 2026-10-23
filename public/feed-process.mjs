// Reine Feed-Verarbeitungs-Logik ohne DOM-Abhängigkeit.
// Wird von app.js.refreshFeeds aufgerufen. Alle Zeitwerte werden als
// Parameter übergeben, damit die Funktionen deterministisch testbar sind.
import {parseVehicles} from './core.js?v=9.9.0';
import {deriveCandidates} from './radar451-logic.mjs?v=9.9.0';
import {parseUpdates} from './core.js?v=9.9.0';

export const STALE_MAX_AGE_SEC = 60 * 60;
export const MARKER_MAX_AGE_SEC = 12 * 60;
export const VEHICLE_KEEP_MS = 30 * 60 * 1000;
export const DETAIL_MAX_AGE = 120000;
export const POSITION_SOURCES = ['sta', 'trentino', 'trains'];

// Wertet alle Feed-Antworten aus und trennt aktuelle von alten Daten.
export function buildFeedStatus(results, endpointNames){
  const ok = {};
  const oldFeeds = {};
  const statuses = {};
  for(let i = 0; i < results.length; i++){
    const name = endpointNames[i];
    const result = results[i];
    const fresh = result.status === 'fulfilled' ? freshness(result.value, Date.now() / 1000) : 'error';
    statuses[name] = fresh;
    if(fresh === 'ok'){
      ok[name] = result.value;
    }
    if(fresh === 'old' && result.status === 'fulfilled'){
      oldFeeds[name] = result.value;
    }
  }
  return {ok, oldFeeds, statuses};
}

// Prüft Frische eines Feeds anhand des GTFS-RT Timestamps (nowSec in Sekunden).
export function freshness(feed, nowSec){
  const stamp = Number(feed?.header?.timestamp ?? feed?.header?.timeStamp);
  if(!Number.isFinite(stamp) || stamp < 1000000000) return 'ok';
  return nowSec - stamp > STALE_MAX_AGE_SEC ? 'old' : 'ok';
}

// Parst einen Positions-Feed und berechnet Bus-Strecken-Kandidaten.
// Gibt {parsed, latest} zurück. today als YYYY-MM-DD String.
export function processPositionFeed(source, feed, now, indexes, today){
  const nowSec = now / 1000;
  const parsed = parseVehicles(feed, source, indexes, now);
  if(source === 'sta_direct'){
    for(const v of parsed.vehicles) v.positionType = 'STA Open Data Hub · offizielle Feedposition (GPS nicht garantiert)';
  }
  for(const v of parsed.vehicles){
    if(v.kind !== 'bus' || v.shapeId || v.routeShapeId || !v.tripStartDate) continue;
    const day = /^\d{8}$/.test(v.tripStartDate)
      ? v.tripStartDate.slice(0,4) + '-' + v.tripStartDate.slice(4,6) + '-' + v.tripStartDate.slice(6,8) : '';
    v.routeShapeCandidates = deriveCandidates(indexes[source], day, today, v.routeId, v.directionId);
  }
  const latest = new Map(parsed.vehicles.filter(v =>
    (!v.timestamp || nowSec - v.timestamp < MARKER_MAX_AGE_SEC)
  ).map(v => [v.key, v]));
  return {parsed, latest};
}

// Mergt gelesene Fahrzeuge in den State und entfernt veraltete des gleichen Sources.
export function mergePositionVehicles(vehicles, latest, source, now, staleFeed){
  for(const [key, old] of vehicles){
    if(old.source !== source) continue;
    if(latest.has(key)) continue;
    if(now - (old.lastRealSeen || 0) < VEHICLE_KEEP_MS){
      vehicles.set(key, {...old, stale: true});
    } else {
      vehicles.delete(key);
    }
  }
  for(const [key, v] of latest){
    const old = vehicles.get(key);
    if(old?.timestamp && v.timestamp && old.timestamp > v.timestamp) continue;
    const stale = staleFeed || (v.timestamp && now / 1000 - v.timestamp > 300);
    vehicles.set(key, {...v, lastRealSeen: now, stale: Boolean(stale)});
  }
}

// Entfernt Fahrzeuge von Sources, deren Feed nicht mehr antwortet.
export function pruneStaleVehicles(vehicles, now, statuses){
  for(const [key, v] of vehicles){
    if(statuses[v.source] !== 'ok'){
      const age = v.timestamp ? now / 1000 - v.timestamp : Infinity;
      if(now - (v.lastRealSeen || 0) > VEHICLE_KEEP_MS || age > STALE_MAX_AGE_SEC){
        vehicles.delete(key);
      } else {
        vehicles.set(key, {...v, stale: true});
      }
    }
  }
}

// Verarbeitet GTFS-RT Trip-Updates und entfernt veraltete.
export function processUpdates(ok, state, now){
  for(const source of POSITION_SOURCES){
    const name = source + '_updates';
    if(!ok[name]) continue;
    for(const key of [...state.updates.keys()]) if(key.startsWith(source + ':')) state.updates.delete(key);
    for(const [key, upd] of parseUpdates(ok[name], source, now)) state.updates.set(key, upd);
  }
  for(const [key, upd] of state.updates) if(now - upd.fetchedAt > DETAIL_MAX_AGE) state.updates.delete(key);
}

// Extrahiert aktive Alerts aus einem GTFS-RT Feed.
// Gibt Array von {id, cause, effect, header, description, active_period, informed_entity, url, source, fetchedAt}.
export function parseAlerts(feed, source, now){
  const alerts=[];
  const nowSec=Math.floor(now/1000);
  for(const entity of (feed?.entity||[])){
    const a=entity?.alert;
    if(!a)continue;
    // Aktualität prüfen
    let active=false;
    if(a.active_period&&a.active_period.length){
      for(const p of a.active_period){
        const start=Number(p.start)||0;
        const end=Number(p.end)||Infinity;
        if(nowSec>=start&&nowSec<=end){active=true;break;}
      }
    }else{
      active=true; // Keine Zeitraum-Angabe = immer aktiv
    }
    if(!active)continue;
    const getText=(obj)=>{
      if(!obj||!obj.translation)return '';
      const de=obj.translation.find(t=>t.language==='de'||t.language==='DE');
      return de?de.text:(obj.translation[0]?obj.translation[0].text:'');
    };
    alerts.push({
      id: entity.id||'',
      cause: Number(a.cause)||null,
      effect: Number(a.effect)||null,
      header: getText(a.header_text)||'Störung',
      description: getText(a.description_text)||'',
      active_period: a.active_period||[],
      informed_entity: a.informed_entity||[],
      url: getText(a.url)||'',
      source,
      fetchedAt: now
    });
  }
  return alerts;
}
