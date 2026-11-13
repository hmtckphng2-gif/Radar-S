/* Radar 5.3 — testable cross-feed deduplication; conservative matching only.
 * Never combine different confirmed train numbers or distinct journeys from one source.
 */
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const trainNum=v=>{const n=String(v?.number||'').trim();return /^\d{2,6}$/.test(n)?n:null};
const delayValid=v=>v?.delaySec!==null&&v?.delaySec!==undefined&&Number.isFinite(Number(v.delaySec));
function canMerge(a,b){
 if(!a||!b)return false;
 if(!Number.isFinite(a.sec)||!Number.isFinite(b.sec)||a.sec!==b.sec)return false;
 if(!a.serviceDay||a.serviceDay!==b.serviceDay)return false;
 if(a.directionId&&b.directionId&&a.directionId!==b.directionId)return false;
 if(a.stationKey&&b.stationKey&&a.stationKey!==b.stationKey)return false;
 const an=trainNum(a),bn=trainNum(b);
 if(an&&bn&&an!==bn)return false;
 if(a.source===b.source)return Boolean(a.tripId&&a.tripId===b.tripId);
 // Cross-feed match needs an official number at both ends. Generic REG + same time is insufficient.
 if(a.kind==='bus'||b.kind==='bus'||!an||!bn||an!==bn)return false;
 if(!a.stationKey||a.stationKey!==b.stationKey||!a.directionId||a.directionId!==b.directionId)return false;
 const destA=normalize(a.headsign),destB=normalize(b.headsign);
 return Boolean(destA&&destB&&destA===destB&&destA!=='ziel unbekannt');
}
function quality(row){return (row.cancelled?100:0)+(delayValid(row)?30:0)+(trainNum(row)?8:0)+(row.source==='trains'?3:0)}
export function mergeStationDepartures(rows){
 const groups=[];
 for(const row of rows||[]){
  let group=groups.find(g=>g.every(x=>canMerge(x,row)));
  if(!group){group=[];groups.push(group)}group.push(row);
 }
 return groups.map(g=>{
  const best=[...g].sort((a,b)=>quality(b)-quality(a))[0];
  const numbered=g.find(x=>trainNum(x));
  // Preserve independently confirmed GTFS-RT delay AND a numeric official train number,
  // but never invent them when absent. All matching fields were checked above.
  const platform=g.map(x=>x.platform).find(p=>p?.live&&p.current)||g.map(x=>x.platform).find(p=>p?.current)||best.platform;
  return {...best,platform,number:trainNum(best)?best.number:(numbered?.number||best.number),mergedSources:[...new Set(g.map(x=>x.source))]};
 }).sort((a,b)=>(a.forecast??a.sec)-(b.forecast??b.sec));
}
export function displayDelay(vehicle, state, now=Date.now()){
 if(!vehicle?.tripId||!state?.updates||state.statuses?.[vehicle.source+'_updates']!=='ok')return null;
 const update=state.updates.get(vehicle.source+':'+vehicle.tripId);
 if(!update||!Number.isFinite(Number(update.fetchedAt))||now-Number(update.fetchedAt)>120000||now<Number(update.fetchedAt)-30000)return null;
 const a=String(update.tripStartDate||'').replaceAll('-',''),b=String(vehicle.tripStartDate||'').replaceAll('-','');
 if(a&&b&&a!==b)return null;
 // The bridge knows how to interpret stop-based delays safely for this vehicle.
 const info=window.SuedtirolRadar37?.vehicleDelay?.(vehicle);
 if(info===null||info===undefined)return null;
 const seconds=typeof info==='number'?info:Number(info.delay);
 return Number.isFinite(seconds)?Math.round(seconds/60):null;
}
export const delayPill=n=>n===null?'Keine Echtzeitverspätung':n>0?`+${n} Min.`:n<0?`${n} Min.`:'Pünktlich';
