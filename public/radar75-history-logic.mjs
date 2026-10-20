/* Radar 7.5: conservative D1 write budgets, dedupe and factual delay analytics. */
export const DAILY_WRITE_BUDGET=15000;
export const PER_RUN_VEHICLES=180;
export const PER_RUN_STOP_EVENTS=100;
export function remainingBudget(rowsToday,budget=DAILY_WRITE_BUDGET){return Math.max(0,Math.min(budget,budget-Math.max(0,Number(rowsToday)||0)))}
export function changedStopEvents(candidates,previous,limit=PER_RUN_STOP_EVENTS){
 const seen=new Set();const out=[];
 for(const row of candidates){
  const key=[row.source,row.tripId,row.tripStartDate,row.stopId,row.stopSequence,row.eventType].join('|');
  if(seen.has(key))continue;seen.add(key);
  const old=previous.get(key);
  if(old&&old.delaySeconds===row.delaySeconds&&old.predictedAt===row.predictedAt)continue;
  out.push(row);if(out.length>=limit)break;
 }
 return out;
}
export function summarizeDelays(rows){
 const values=rows.map(x=>Number(x.delay_seconds)).filter(Number.isFinite);
 if(!values.length)return {sampleCount:0,averageMinutes:null,medianMinutes:null,latePercent:null};
 const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
 return {sampleCount:values.length,averageMinutes:Math.round(values.reduce((a,b)=>a+b,0)/values.length/6)/10,medianMinutes:Math.round((sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2)/6)/10,latePercent:Math.round(values.filter(x=>x>60).length/values.length*100),kind:'feed_forecasts_not_confirmed_arrivals'};
}
