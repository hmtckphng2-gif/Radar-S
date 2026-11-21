/* Radar 7.5: conservative D1 write budgets, dedupe and factual delay analytics. */
export const DAILY_WRITE_BUDGET=15000;
export const PER_RUN_VEHICLES=18;
export const PER_RUN_STOP_EVENTS=30;
export function remainingBudget(rowsToday,budget=DAILY_WRITE_BUDGET){return Math.max(0,Math.min(budget,budget-Math.max(0,Number(rowsToday)||0)))}
export function changedStopEvents(candidates,previous,limit=PER_RUN_STOP_EVENTS,rotationSeed=0){
 const seen=new Set(),bySource=new Map();
 for(const row of candidates||[]){
  const key=[row.source,row.tripId,row.tripStartDate,row.stopId,row.stopSequence,row.eventType].join('|');
  if(seen.has(key))continue;seen.add(key);
  const old=previous.get(key);
  if(old&&old.delaySeconds===row.delaySeconds&&old.predictedAt===row.predictedAt)continue;
  const source=String(row.source||'unknown');
  if(!bySource.has(source))bySource.set(source,new Map());
  const tripKey=[row.tripId,row.tripStartDate].join('|');
  const trips=bySource.get(source);
  if(!trips.has(tripKey))trips.set(tripKey,[]);
  trips.get(tripKey).push(row);
 }
 const seed=Math.abs(Math.trunc(Number(rotationSeed)||0));
 const sources=[...bySource.entries()].map(([source,trips])=>{
  const queues=[...trips.values()];
  return {source,queues,cursor:queues.length?seed%queues.length:0};
 }).filter(group=>group.queues.length);
 if(!sources.length||limit<=0)return [];
 const out=[];let sourceStart=seed%sources.length,progress=true;
 // One event per source per round, and one event per trip before returning to a trip.
 // Rotate both cursors between five-minute runs so later feed entities are not starved.
 while(out.length<limit&&progress){
  progress=false;
  for(let offset=0;offset<sources.length&&out.length<limit;offset++){
   const group=sources[(sourceStart+offset)%sources.length];
   for(let step=0;step<group.queues.length;step++){
    const index=(group.cursor+step)%group.queues.length,queue=group.queues[index];
    if(!queue.length)continue;
    out.push(queue.shift());group.cursor=(index+1)%group.queues.length;progress=true;break;
   }
  }
  sourceStart=(sourceStart+1)%sources.length;
 }
 return out;
}
export function summarizeDelays(rows){
 const values=rows.filter(x=>x.delay_seconds!==null&&x.delay_seconds!==undefined).map(x=>Number(x.delay_seconds)).filter(Number.isFinite);
 if(!values.length)return {sampleCount:0,averageMinutes:null,medianMinutes:null,latePercent:null};
 const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
 return {sampleCount:values.length,averageMinutes:Math.round(values.reduce((a,b)=>a+b,0)/values.length/6)/10,medianMinutes:Math.round((sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2)/6)/10,latePercent:Math.round(values.filter(x=>x>60).length/values.length*100),kind:'feed_forecasts_not_confirmed_arrivals'};
}

/* One latest forecast per source/trip/date/stop/event, not repeated polling samples. */
export function uniqueForecasts(rows){
 const seen=new Set(),result=[];
 for(const row of rows){const key=[row.source,row.trip_id,row.trip_start_date,row.stop_id,row.stop_sequence,row.event_type].join('|');if(seen.has(key))continue;seen.add(key);result.push(row)}
 return result;
}

/* GTFS-Realtime trip_id carries the static GTFS trip_short_name. This pattern
   was checked against every trip in the generated Trenitalia GTFS index. */
export function gtfsTripShortName(tripId){
 const match=String(tripId||'').match(/_[vp]_\d+-([A-Za-z0-9]+)-[A-Fa-f0-9]+-/);
 return match?match[1]:null;
}

/* Compare consecutive arrival forecasts within one trip; never infer arrivals. */
export function routeProgress(rows){
 const groups=new Map();
 for(const row of uniqueForecasts(rows||[])){
  if(row.event_type!=='arrival'||row.delay_seconds===null||row.delay_seconds===undefined||!Number.isFinite(Number(row.delay_seconds)))continue;
  const key=[row.source,row.trip_id,row.trip_start_date].join('|');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 }
 const result=[];
 for(const [key,items] of groups){
  items.sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence));
  for(let i=1;i<items.length;i++){
   const from=items[i-1],to=items[i];
   if(Number(to.stop_sequence)<=Number(from.stop_sequence)||from.stop_id===to.stop_id)continue;
   const change=Number(to.delay_seconds)-Number(from.delay_seconds);
   result.push({tripId:to.trip_id,tripStartDate:to.trip_start_date,fromStopId:from.stop_id,toStopId:to.stop_id,fromSequence:Number(from.stop_sequence),toSequence:Number(to.stop_sequence),fromDelayMinutes:Math.round(Number(from.delay_seconds)/6)/10,toDelayMinutes:Math.round(Number(to.delay_seconds)/6)/10,changeMinutes:Math.round(change/6)/10,status:change < -30?'recovered':change > 30?'lost':'stable'});
  }
 }
 return result;
}

export function delayTrend(rows){
 const latest=uniqueForecasts(rows);
 const stats=summarizeDelays(latest);
 const dayBuckets=new Map();
 for(const row of latest){if(row.delay_seconds===null||row.delay_seconds===undefined||!Number.isFinite(Number(row.delay_seconds)))continue;
  const date=new Date(Number(row.collected_at)*1000).toISOString().slice(0,10);
  const bucket=dayBuckets.get(date)||[];bucket.push(Number(row.delay_seconds));dayBuckets.set(date,bucket);
 }
 return {...stats,uniqueForecasts:latest.length,trend:[...dayBuckets].sort(([a],[b])=>a.localeCompare(b)).map(([date,seconds])=>({date,count:seconds.length,averageMinutes:Math.round(seconds.reduce((a,b)=>a+b,0)/seconds.length/6)/10}))};
}
export function simulateDailyWrites(perRun=PER_RUN_VEHICLES+PER_RUN_STOP_EVENTS,intervalMinutes=5){return Math.ceil(1440/intervalMinutes)*perRun}
