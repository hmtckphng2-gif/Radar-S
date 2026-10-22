/* Pure, conservative Radar Intelligence calculations. No fabricated predictions. */
import {aggregateDays} from './radar54-logic.mjs?v=9.7.0';

export function trainHistory(samples,number,today,days=30){
 const clean=Array.isArray(samples)?samples.filter(x=>x&&String(x.number)===String(number)&&typeof x.day==='string'&&Number.isFinite(x.minutes)&&Number.isFinite(x.t)):[];
 const points=aggregateDays(clean,String(number),days,today);
 const observed=points.filter(x=>x.count>0);
 const count=observed.reduce((n,x)=>n+x.count,0);
 const mean=count?observed.reduce((n,x)=>n+x.minutes*x.count,0)/count:null;
 return {points,count,dayCount:observed.length,mean,sufficient:count>=8&&observed.length>=3};
}
function numericDelay(stop){
 const departure=stop?.departure?.delay,arrival=stop?.arrival?.delay;
 const n=departure===null||departure===undefined?arrival:departure;
 return n===null||n===undefined||!Number.isFinite(Number(n))?null:Number(n);
}
export function supportedRecovery(row,update,statuses,now=Date.now(),day=null){
 if(!row||row.cancelled||row.kind!=='train'||row.delaySec===null||row.delaySec===undefined||!Number.isFinite(Number(row.delaySec)))return null;
 if(!update||statuses?.[row.source+'_updates']!=='ok')return null;
 const age=now-Number(update.fetchedAt);
 if(!Number.isFinite(age)||age>120000||age< -30000)return null;
 if(day&&update.tripStartDate&&String(update.tripStartDate).replaceAll('-','')!==String(day).replaceAll('-',''))return null;
 const stops=Array.isArray(update.stops)?update.stops:[];
 const idx=stops.findIndex(x=>String(x?.stopId??x?.stop_id??'')===String(row.stopId));
 if(idx<1)return null;
 const target=numericDelay(stops[idx]);
 if(target===null||Math.abs(target-Number(row.delaySec))>60)return null;
 // Take the nearest earlier stop with a stop-specific official estimate.
 for(let i=idx-1;i>=0;i--){
  const earlier=numericDelay(stops[i]);
  if(earlier===null)continue;
  const gained=Math.round((earlier-target)/60);
  if(gained<2||gained>60)return null;
  return {gained,upstreamMinutes:Math.round(earlier/60),targetMinutes:Math.round(target/60),source:'GTFS-RT',upstreamStopId:stops[i].stopId??stops[i].stop_id??null};
 }
 return null;
}
