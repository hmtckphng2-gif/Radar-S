/* History data validation. Never invent arrivals or claim predicted stops were reached. */
const bounded=(v,n)=>typeof v==='string'?v.slice(0,n):null;
export function observationRows(snapshot,collectedAt=Date.now()){
 if(!Array.isArray(snapshot?.vehicles))return [];
 const rows=[];
 for(const v of snapshot.vehicles.slice(0,6000)){
  const observed=Date.parse(v?.observedAt),lat=Number(v?.lat),lon=Number(v?.lon);
  if(!v?.id||!v?.source||!['train','bus'].includes(v?.kind)||!Number.isFinite(observed)||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||Math.abs(observed-collectedAt)>300000)continue;
  rows.push({source:bounded(v.source,40),key:bounded(v.id,160),observedAt:Math.floor(observed/1000),collectedAt:Math.floor(collectedAt/1000),kind:v.kind,routeId:bounded(v.routeId,120),tripId:bounded(v.tripId,120),tripStartDate:bounded(v.tripStartDate,20),vehicleId:bounded(v.vehicleId,120),lat,lon,quality:bounded(v.quality,40),positionType:bounded(v.positionType,120)});
 }
 return rows;
}
export function stopDelayRows(feed,source,collectedAt=Date.now()){
 const entities=Array.isArray(feed?.entity)?feed.entity:[];
 const rows=[];
 for(const entity of entities.slice(0,12000)){
  const update=entity?.tripUpdate??entity?.trip_update;
  const trip=update?.trip;
  if(!(trip?.tripId??trip?.trip_id)||!(trip?.startDate??trip?.start_date))continue;
  const observed=Number(update?.timestamp||feed?.header?.timestamp);
  if(!Number.isFinite(observed)||Math.abs(observed*1000-collectedAt)>300000)continue;
  for(const stop of (update.stopTimeUpdate||update.stop_time_update||[]).slice(0,160)){
   const id=bounded(stop?.stopId??stop?.stop_id,120),sequence=Number(stop?.stopSequence??stop?.stop_sequence);
   if(!id||!Number.isInteger(sequence)||sequence<0)continue;
   for(const type of ['arrival','departure']){
    const event=stop?.[type];if(!event)continue;
    const delay=event.delay===null||event.delay===undefined?null:Number(event.delay);
    const predicted=event.time===null||event.time===undefined?null:Number(event.time);
    if(delay===null&&predicted===null)continue;
    if(delay!==null&&(!Number.isFinite(delay)||Math.abs(delay)>86400))continue;
    if(predicted!==null&&!Number.isFinite(predicted))continue;
    rows.push({source:bounded(source,40),tripId:bounded(trip.tripId??trip.trip_id,120),tripStartDate:bounded(trip.startDate??trip.start_date,20),stopId:id,stopSequence:sequence,eventType:type,feedObservedAt:Math.floor(observed),collectedAt:Math.floor(collectedAt/1000),delaySeconds:delay,predictedAt:predicted,scheduledAt:predicted!==null&&delay!==null?predicted-delay:null});
   }
  }
 }
 return rows.slice(0,12000);
}
