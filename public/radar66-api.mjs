/* 6.6 read-only native-friendly public transit snapshot. Source positions are not verified GPS. */
import {parseVehicles} from './core.js';
import {selectRepresentatives,observationQuality} from './radar64-logic.mjs';
import {feedDiagnostics} from './radar66-logic.mjs';
const SOURCES=['sta','sta_direct','trentino','trains'];
export function normalizeSnapshot(feeds,now=Date.now()){
 const status={},vehicles=[];
 for(const source of SOURCES){const record=feeds[source];if(!record?.data){status[source]=record?.status||'error';continue}
 const timestamp=Number(record.data.header?.timestamp);const age=Number.isFinite(timestamp)&&timestamp>1e9?now/1000-timestamp:null;
 const fresh=age!==null&&age<=300&&age>=-30;
 status[source]=fresh?'ok':'old';
 if(!fresh)continue; // never represent stale feed as a live snapshot
 for(const v of parseVehicles(record.data,source,{},now).vehicles){
  if(!v.timestamp||now/1000-v.timestamp>300||now/1000-v.timestamp< -30)continue;
  if(source==='sta_direct')v.positionType='STA Open Data Hub (GPS nicht unabhängig bestätigt)';
  vehicles.push(v);
 }
 }
 const fusion=selectRepresentatives(vehicles);const visible=vehicles.filter(v=>fusion.keys.has(v.key));const diagnostics=feedDiagnostics(vehicles,status,now,fusion);
 return {schema:'radar.snapshot.v1',version:'6.6',generatedAt:new Date(now).toISOString(),positionDisclaimer:'Nur empfangene Feedpositionen, keine extrapolierten GPS-Positionen. Linienbezeichnungen ohne statischen GTFS-Abgleich nicht verifiziert.',sources:status,diagnostics,vehicles:visible.map(v=>({id:v.key,kind:v.kind,lat:v.lat,lon:v.lon,observedAt:v.timestamp?new Date(v.timestamp*1000).toISOString():null,routeId:v.routeId||null,tripId:v.tripId||null,tripStartDate:v.tripStartDate||null,vehicleId:v.vehicleId||null,source:v.source,sourceCount:fusion.sources.get(v.key)?.length||1,positionType:v.positionType,quality:observationQuality(v,now).status,trainNumber:v.kind==='train'&&v.nameVerified?v.name:null,verifiedLine:null}))};
}
export async function buildSnapshot(fetchFeed,now=Date.now()){
 const response=await Promise.allSettled(SOURCES.map(async source=>({source,data:await fetchFeed(source)})));const feeds={};
 for(let i=0;i<SOURCES.length;i++){const source=SOURCES[i],entry=response[i];feeds[source]=entry.status==='fulfilled'?entry.value.data:{status:'error'}}
 return normalizeSnapshot(feeds,now);
}
