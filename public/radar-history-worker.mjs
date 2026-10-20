/* Two logical services: scheduled feed collector and read-only history API. */
import {buildSnapshot} from './radar66-api.mjs';
import {observationRows,stopDelayRows} from './radar-history-logic.mjs';
import {remainingBudget,changedStopEvents,delayTrend,simulateDailyWrites,PER_RUN_VEHICLES,PER_RUN_STOP_EVENTS,DAILY_WRITE_BUDGET} from './radar75-history-logic.mjs';
const noStore={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:noStore});
const FEEDS={sta:'https://proxy.busone.app/sta/gtfs-rt/vehicle-positions.json',trentino:'https://proxy.busone.app/trentino/gtfs-rt/vehicle-positions.json',trains:'https://proxy.busone.app/trenitalia/gtfs-rt/vehicle-positions.json',sta_direct:'https://gtfs.api.opendatahub.com/v1/realtime/sta-time-tables/vehicle-positions'};
const UPDATES={sta:'https://proxy.busone.app/sta/gtfs-rt/trip-updates.json',trentino:'https://proxy.busone.app/trentino/gtfs-rt/trip-updates.json',trains:'https://proxy.busone.app/trenitalia/gtfs-rt/trip-updates.json'};
async function load(url,client){const res=await fetch(url,{headers:{accept:'application/json',...(url.includes('proxy.busone.app')?{'X-BusOne-Client':client,'X-BusOne-Use':'personal'}:{})},signal:AbortSignal.timeout(8500)});if(!res.ok||!(res.headers.get('content-type')||'').includes('json'))throw Error('feed unavailable');return res.json()}
export async function collectHistory(env,now=Date.now()){
 if(!env?.HISTORY_DB)return {ok:false,reason:'HISTORY_DB binding missing'};
 // Fail closed if the history collector is not explicitly enabled after verification.
 if(env.HISTORY_COLLECTOR_ENABLED!=='true')return {ok:false,reason:'collector disabled until write budget verified'};
 const utcDay=Math.floor(now/86400000)*86400;
 const [vCount,sCount]=await Promise.all([
  env.HISTORY_DB.prepare('SELECT COUNT(*) AS n FROM vehicle_observations WHERE collected_at>=?').bind(utcDay).first(),
  env.HISTORY_DB.prepare('SELECT COUNT(*) AS n FROM stop_delay_events WHERE collected_at>=?').bind(utcDay).first()]);
 const remaining=remainingBudget(Number(vCount?.n||0)+Number(sCount?.n||0));
 if(!remaining)return {ok:false,reason:'daily conservative write budget exhausted'};
 const client=String(env.BUSONE_CLIENT||'Suedtirol Radar history collector; https://github.com/hmtckphng2-gif/Radar-S').slice(0,180);
 const [positions,updates]=await Promise.all([
  Promise.allSettled(Object.entries(FEEDS).map(async ([source,url])=>[source,await load(url,client)])),
  Promise.allSettled(Object.entries(UPDATES).map(async ([source,url])=>[source,await load(url,client)]))
 ]);
 const feedMap={};for(let i=0;i<positions.length;i++)if(positions[i].status==='fulfilled'){const [key,data]=positions[i].value;feedMap[key]={data}}
 const snapshot=await buildSnapshot(async source=>({data:feedMap[source]?.data}),now);
 const vehicles=observationRows(snapshot,now).slice(0,Math.min(PER_RUN_VEHICLES,remaining));
 const stops=[];for(const x of updates)if(x.status==='fulfilled'){const [source,data]=x.value;stops.push(...stopDelayRows(data,source,now))}
 // Dedupe against recent snapshots and the last forecast for each trip/stop.
 const recent=await env.HISTORY_DB.prepare('SELECT source,vehicle_key,observed_at FROM vehicle_observations WHERE collected_at>=? ORDER BY collected_at DESC LIMIT 3000').bind(Math.floor(now/1000)-7200).all();
 const existing=new Set((recent.results||[]).map(v=>[v.source,v.vehicle_key,v.observed_at].join('|')));
 const uniqueVehicles=vehicles.filter(v=>!existing.has([v.source,v.key,v.observedAt].join('|')));
 const prev=await env.HISTORY_DB.prepare('SELECT source,trip_id,trip_start_date,stop_id,stop_sequence,event_type,delay_seconds,predicted_at FROM stop_delay_events WHERE collected_at>=? ORDER BY collected_at DESC LIMIT 6000').bind(Math.floor(now/1000)-86400).all();
 const last=new Map();for(const v of prev.results||[]){const k=[v.source,v.trip_id,v.trip_start_date,v.stop_id,v.stop_sequence,v.event_type].join('|');if(!last.has(k))last.set(k,{delaySeconds:v.delay_seconds,predictedAt:v.predicted_at})}
 const safeStops=changedStopEvents(stops,last,Math.min(PER_RUN_STOP_EVENTS,Math.max(0,remaining-uniqueVehicles.length)));
 let vehicleSaved=0,stopSaved=0;
 // Bound D1 batches to avoid exceeding statement and Worker limits.
 for(let i=0;i<uniqueVehicles.length;i+=80){const batch=uniqueVehicles.slice(i,i+80).map(v=>env.HISTORY_DB.prepare('INSERT OR IGNORE INTO vehicle_observations (source,vehicle_key,observed_at,collected_at,kind,route_id,trip_id,trip_start_date,vehicle_id,latitude,longitude,quality,position_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(v.source,v.key,v.observedAt,v.collectedAt,v.kind,v.routeId,v.tripId,v.tripStartDate,v.vehicleId,v.lat,v.lon,v.quality,v.positionType));await env.HISTORY_DB.batch(batch);vehicleSaved+=batch.length}
 for(let i=0;i<safeStops.length;i+=80){const batch=safeStops.slice(i,i+80).map(v=>env.HISTORY_DB.prepare('INSERT OR IGNORE INTO stop_delay_events (source,trip_id,trip_start_date,stop_id,stop_sequence,event_type,feed_observed_at,collected_at,delay_seconds,scheduled_at,predicted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(v.source,v.tripId,v.tripStartDate,v.stopId,v.stopSequence,v.eventType,v.feedObservedAt,v.collectedAt,v.delaySeconds,v.scheduledAt,v.predictedAt));await env.HISTORY_DB.batch(batch);stopSaved+=batch.length}
 return {ok:true,vehicleRecordsProcessed:vehicleSaved,stopUpdateRecordsProcessed:stopSaved,writeBudget:DAILY_WRITE_BUDGET,positionSources:Object.keys(feedMap),note:'Stop updates are predictions/notifications, not confirmed arrivals.'};
}
export async function historyApi(request,env){
 if(!env?.HISTORY_DB)return response({enabled:false,reason:'D1 history storage not configured'},503);
 const url=new URL(request.url),kind=url.pathname.slice('/api/history/'.length);
 if(kind==='status'){
  try{const [vehicles,stops]=await Promise.all([env.HISTORY_DB.prepare('SELECT COUNT(*) AS total,MAX(collected_at) AS latest FROM vehicle_observations').first(),env.HISTORY_DB.prepare('SELECT COUNT(*) AS total,MAX(collected_at) AS latest FROM stop_delay_events').first()]);return response({enabled:true,vehicleObservations:vehicles,stopUpdates:stops,dailyWriteBudget:DAILY_WRITE_BUDGET,projectedMaxWritesPerDay:simulateDailyWrites(),collectorEnabled:env.HISTORY_COLLECTOR_ENABLED==='true',note:'Stop updates are not verified arrivals.'})}
  catch{return response({enabled:false,reason:'History tables not initialized'},503)}
 }
 if(kind==='analytics'){
  const stopId=url.searchParams.get('stop');const tripId=url.searchParams.get('trip');
  if(!stopId&&!tripId)return response({error:'stop or trip parameter required'},400);
  if(stopId&&stopId.length>120||tripId&&tripId.length>120)return response({error:'Invalid identifier'},400);
  const hours=Math.min(168,Math.max(1,Number(url.searchParams.get('hours'))||48));
  const since=Math.floor(Date.now()/1000-hours*3600);
  const sql=stopId?'SELECT source,trip_id,trip_start_date,stop_id,stop_sequence,event_type,collected_at,delay_seconds FROM stop_delay_events WHERE stop_id=? AND collected_at>=? AND delay_seconds IS NOT NULL ORDER BY collected_at DESC LIMIT 1000':'SELECT source,trip_id,trip_start_date,stop_id,stop_sequence,event_type,collected_at,delay_seconds FROM stop_delay_events WHERE trip_id=? AND collected_at>=? AND delay_seconds IS NOT NULL ORDER BY collected_at DESC LIMIT 1000';
  const result=await env.HISTORY_DB.prepare(sql).bind(stopId||tripId,since).all();
  return response({scope:stopId?'stop':'trip',id:stopId||tripId,hours,...delayTrend(result.results||[]),warning:'One latest feed forecast per trip/stop/event, not independently verified arrivals. Trend days reflect collection time, not travel time.'});
 }
 if(kind==='vehicle'){
  const key=url.searchParams.get('id');if(!key||key.length>160)return response({error:'Valid vehicle id required'},400);
  const hours=Math.min(168,Math.max(1,Number(url.searchParams.get('hours'))||24));
  const rows=await env.HISTORY_DB.prepare('SELECT source,vehicle_key,observed_at,kind,route_id,trip_id,latitude,longitude,quality,position_type FROM vehicle_observations WHERE vehicle_key=? AND observed_at>=? ORDER BY observed_at DESC LIMIT 300').bind(key,Math.floor(Date.now()/1000-hours*3600)).all();
  return response({id:key,observations:rows.results||[],note:'Received positions only; no interpolated points.'});
 }
 if(kind==='stop'){
  const id=url.searchParams.get('id');if(!id||id.length>120)return response({error:'Valid stop id required'},400);
  const rows=await env.HISTORY_DB.prepare('SELECT source,trip_id,trip_start_date,stop_sequence,event_type,feed_observed_at,delay_seconds,scheduled_at,predicted_at FROM stop_delay_events WHERE stop_id=? ORDER BY collected_at DESC LIMIT 200').bind(id).all();
  return response({stopId:id,updates:rows.results||[],note:'Forecast updates only; not confirmed arrival/departure events.'});
 }
 return response({error:'Unknown history endpoint'},404);
}
