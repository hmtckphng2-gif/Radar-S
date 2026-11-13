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
 const response=await Promise.allSettled(SOURCES.map(async source=>{
  const started=Date.now();
  try{
   const result=await fetchFeed(source);
   return {source,data:result?.data,diagnostic:{name:source,requestStatus:'ok',httpStatus:Number.isFinite(result?.httpStatus)?result.httpStatus:null,elapsedMs:Math.max(0,Date.now()-started),fetchedAt:new Date().toISOString(),contentType:result?.contentType||null,reason:null}};
  }catch(error){
   const reason=error?.name==='TimeoutError'?'timeout':error?.name==='AbortError'?'aborted':String(error?.message||'').includes('HTTP ')?'upstream-http':String(error?.message||'').includes('JSON')?'invalid-json':'network';
   return {source,error,diagnostic:{name:source,requestStatus:'error',httpStatus:Number.isFinite(error?.httpStatus)?error.httpStatus:null,elapsedMs:Math.max(0,Date.now()-started),fetchedAt:null,contentType:error?.contentType||null,reason}};
  }
 }));
 const feeds={},details=[];
 for(let i=0;i<SOURCES.length;i++){
  const source=SOURCES[i],entry=response[i];
  if(entry.status==='fulfilled'){
   const value=entry.value;feeds[source]=value.error?{status:'error'}:{data:value.data};details.push(value.diagnostic);
  }else{feeds[source]={status:'error'};details.push({name:source,requestStatus:'error',httpStatus:null,elapsedMs:null,fetchedAt:null,contentType:null,reason:'network'});}
 }
 const snapshot=normalizeSnapshot(feeds,now);
 snapshot.diagnostics.sources=snapshot.diagnostics.sources.map(source=>({...source,...(details.find(item=>item.name===source.name)||{})}));
 return snapshot;
}
