/* Südtirol Radar 5.0 Final — testbare Datenauswertung, keine erfundenen GPS-/Historienwerte */
export const FRESH_SECONDS = 300;
export const HISTORY_KEY = 'sr50_final_network_samples_v1';
const DAY_MS = 86400000;
export const listOf = input => input instanceof Map ? [...input.values()] : Array.isArray(input) ? input : [];
export const tidy = text => String(text ?? '').trim().replace(/\s+/g, ' ');
export const canonical = value => tidy(value).toLocaleLowerCase('de');
export const delayOf = update => {
  if (!update || update.delay === null || update.delay === undefined || update.delay === '') return null;
  const value = Number(update.delay);
  return Number.isFinite(value) ? Math.round(value / 60) : null;
};
export function vehicleAgeSeconds(v, nowMs = Date.now()) {
  const ts = Number(v?.timestamp);
  if (!Number.isFinite(ts) || ts < 1e9 || ts * 1000 > nowMs + 30000) return null;
  return Math.max(0, Math.round((nowMs - ts * 1000) / 1000));
}
export function vehicleFresh(v, statuses = {}, nowMs = Date.now()) {
  const age = vehicleAgeSeconds(v, nowMs);
  return !v?.stale && statuses[v?.source] === 'ok' && age !== null && age <= FRESH_SECONDS;
}
export function calculateNetworkStats(vehicles = [], statuses = {}, indexes = {}, nowMs = Date.now()) {
  const list = listOf(vehicles);
  let trains=0,buses=0,current=0,stale=0,unknown=0,simulated=0;
  for (const v of list) {
    if(v?.kind === 'train') trains++;
    if(v?.kind === 'bus') buses++;
    if(v?.positionType && /simuliert|geschätzt|interpoliert/i.test(v.positionType)) simulated++;
    const age = vehicleAgeSeconds(v, nowMs);
    if (vehicleFresh(v, statuses, nowMs)) current++;
    else if (v?.stale || (age !== null && age > FRESH_SECONDS) || (v?.source && statuses[v.source] && statuses[v.source] !== 'ok')) stale++;
    else unknown++;
  }
  const sources = Object.entries(statuses).map(([source, status]) => ({source,status}));
  return {total:list.length,trains,buses,current,stale,unknown,simulated,
    realtimePercent:list.length ? Math.round(current*100/list.length):null,
    activeFeeds:sources.filter(s=>s.status==='ok').length,
    totalFeeds:sources.length,sources};
}
const trainNumber = v => {
  const name = tidy(v?.name);
  const m = name.match(/^(?:(?:REG|RE|RV|R|RJX|RJ|EC|IC|FR|FA|EN|S\d{1,2})\s+|Zug\s+)(\d{2,6})[A-Z]?$/i);
  return m?.[1] || '';
};
export function searchTrainStats(queryNum, vehicles = [], indexes = {}, updates = new Map(), statuses = {}, nowMs=Date.now()) {
  const target=tidy(queryNum);
  if(!/^\d{2,6}$/.test(target))return {query:target,live:[],planned:[],valid:false};
  const live=listOf(vehicles).filter(v=>v.kind==='train' && trainNumber(v)===target).map(v=>{
    const upd=updates?.get?.(v.source+':'+v.tripId);
    const validUpdate=upd && statuses[v.source+'_updates']==='ok' && Number.isFinite(Number(upd.fetchedAt)) && nowMs-Number(upd.fetchedAt)>=0 && nowMs-Number(upd.fetchedAt)<120000 && (!v.tripStartDate || !upd.tripStartDate || String(v.tripStartDate).replaceAll('-','')===String(upd.tripStartDate).replaceAll('-',''));
    return {key:v.key,source:v.source,name:v.name,headsign:v.headsign||'Ziel unbekannt',tripId:v.tripId,
      age:vehicleAgeSeconds(v,nowMs),fresh:vehicleFresh(v,statuses,nowMs),estimated:/simuliert|geschätzt|interpoliert/i.test(v.positionType||''),
      delayMin:validUpdate?delayOf(upd):null,positionType:v.positionType||'Feedposition'};
  });
  const planned=[];
  for(const [source,db] of Object.entries(indexes||{})) {
    if(!db?.meta?.ready || !Array.isArray(db.meta.days) || !db.meta.days.includes(romeDay(nowMs)))continue;
    for(const [tripId,trip] of Object.entries(db.trips||{})) {
      if(!Array.isArray(trip)||String(trip[3]??'')!==target||trip[5]===false)continue;
      const routeType=Number(db.routes?.[trip[0]]?.[2]);
      const rail=[1,2].includes(routeType)||(routeType>=100&&routeType<200)||(routeType>=300&&routeType<700);
      if(!rail || live.some(v=>v.tripId===tripId&&v.source===source))continue;
      if(planned.length>=12)break;
      planned.push({source,tripId,headsign:tidy(trip[1])||'Ziel unbekannt'});
    }
    if(planned.length>=12)break;
  }
  return {query:target,valid:true,live,planned};
}
export function searchBusLineStats(lineNum, vehicles = [], statuses = {}, nowMs=Date.now()) {
  const target=canonical(lineNum);
  if(!target)return {query:'',vehicles:[],activeCount:0,current:0,stale:0,destinations:[]};
  const matched=listOf(vehicles).filter(v => v?.kind==='bus' && v.lineVerified === true && canonical(v.name)===target);
  const destinations=[...new Set(matched.map(v=>tidy(v.headsign)).filter(v=>v&&v!=='Fahrtziel unbekannt'))].sort((a,b)=>a.localeCompare(b,'de'));
  return {query:tidy(lineNum),vehicles:matched,activeCount:matched.length,
    current:matched.filter(v=>vehicleFresh(v,statuses,nowMs)).length,
    stale:matched.filter(v=>v.stale).length,destinations};
}
export function romeDay(ms=Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
  const kv = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${kv.year}-${kv.month}-${kv.day}`;
}
export class HistoricalStorage {
  constructor(store = undefined, clock=()=>Date.now()) {
    if(store===undefined){try{store=localStorage}catch{store=null}}
    this.store=store;this.clock=clock;this.key=HISTORY_KEY;
  }
  loadSnapshots(){
    try {
      const own=JSON.parse(this.store?.getItem(this.key)||'[]');
      if(Array.isArray(own) && own.length)return own.filter(s=>Number.isFinite(s.ts)&&Number.isFinite(s.total));
      const beta3=JSON.parse(this.store?.getItem('sr50b3_network_samples_v1')||'[]');
      if(Array.isArray(beta3) && beta3.length)return beta3.filter(s=>Number.isFinite(s.ts)&&Number.isFinite(s.total));
      const beta4=JSON.parse(this.store?.getItem('sr50_history_snapshots_v1')||'[]');
      if(Array.isArray(beta4) && beta4.length)return beta4.filter(s=>Number.isFinite(s.ts)&&Number.isFinite(s.total)).map(s=>({...s,feedStamp:null}));
      return [];
    } catch {return []}
  }
  saveSnapshot(stats,feedStamp){
    if(!this.store || !stats || !Number.isFinite(Number(feedStamp)) || feedStamp<=0)return false;
    try {
      const now=this.clock(),list=this.loadSnapshots();
      const last=list.at(-1);
      // Erst bei einem neuen Feed UND frühestens alle fünf Minuten eine Messung.
      if(last && (last.feedStamp===feedStamp || now-last.ts < 300000))return false;
      const sample={ts:now,feedStamp,total:stats.total,trains:stats.trains,buses:stats.buses,current:stats.current,stale:stats.stale};
      const next=[...list.filter(s=>s.ts>=now-30*DAY_MS),sample].slice(-2000);
      this.store.setItem(this.key,JSON.stringify(next));return true;
    } catch {return false}
  }
  getAggregation(rangeDays=1){
    const end=this.clock(),items=this.loadSnapshots().filter(s=>s.ts>=end-rangeDays*DAY_MS && s.ts<=end).sort((a,b)=>a.ts-b.ts);
    if(!items.length)return null;
    return {sampleCount:items.length,avgVehicles:Math.round(items.reduce((sum,s)=>sum+s.total,0)/items.length),
      maxVehicles:Math.max(...items.map(s=>s.total)),avgFresh:Math.round(items.reduce((sum,s)=>sum+s.current,0)/items.length),
      first:items[0].ts,last:items.at(-1).ts,samples:items};
  }
  clear(){try{this.store?.removeItem(this.key);return true}catch{return false}}
}
