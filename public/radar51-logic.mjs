import {platformInfo} from './radar54-logic.mjs?v=9.7.0';
/* Südtirol Radar 5.1 — pure, independently testable transit logic. No GPS is invented. */
import {shapeProject,pointAtDistance,vehicleDelayInfo,isRailRoute} from './core.js?v=9.7.0';

export const normalizeStation = text => String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').replace(/\b(bahnhof|stazione|station|fermata|halte|bhf|staz)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const aliasGroups = [
 ['bozen','bolzano'],['salurn','salorno'],['brixen','bressanone'],['meran','merano'],
 ['bruneck','brunico'],['sterzing','vipiteno'],['leifers','laives'],
 ['kaltern','caldaro'],['trient','trento'],['neustift','novacella'],
 ['klausen','chiusa'],['innichen','san candido'],['toblach','dobbiaco'],
 ['branzoll','bronzolo'],['neumarkt','egna'],['auer','ora'],
 ['franzensfeste','fortezza'],['welsberg','monguelfo'],['schlanders','silandro'],
 ['kardaun','cardano'],['algund','lagundo'],['lana','lana'],
 ['nals','nalles'],['gargazon','gargazzone'],['terlan','terlano']
 ];
const aliasSet = token => aliasGroups.find(a=>a.includes(token)) || [token];
export function stationTokens(text){
 const n=normalizeStation(text);
 const parts=n.split(' ').filter(Boolean),tokens=new Set(parts);
 for(const p of parts)for(const a of aliasSet(p))tokens.add(a);
 return [...tokens];
}
export function stationMatchScore(query,name){
 const q=normalizeStation(query),n=normalizeStation(name);
 if(!q)return 1;
 if(!n)return 0;
 if(q===n)return 150;
 if(n.startsWith(q+' ')||n.startsWith(q+'-'))return 130;
 if(n.includes(q))return 80;
 const qs=q.split(' ').filter(Boolean),ns=n.split(' ').filter(Boolean);
 const good=qs.every(p=>ns.includes(p)||ns.some(x=>aliasSet(p).includes(x)));
 if(good)return 100;
 if(q.length>=3 && stationTokens(q).some(t=>t.length>=3&&n.includes(t)))return 55;
 return 0;
}
export function findStations(list,query,limit=40){
 return (Array.isArray(list)?list:[]).map(st=>({st,score:stationMatchScore(query,st?.name)}))
  .filter(x=>x.st && (!query.trim()||x.score>0))
  .sort((a,b)=>b.score-a.score || String(a.st?.name||'').localeCompare(String(b.st?.name||''),'de'))
  .slice(0,limit).map(x=>x.st);
}
export function romeSeconds(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Number(p.hour)*3600+Number(p.minute)*60+Number(p.second);
}
export function romeDay(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
}
export function dateGTFSValid(db,date=new Date()){
 return Boolean(db?.meta?.ready && Array.isArray(db.meta.days) && db.meta.days.includes(romeDay(date)));
}
export function nearbyStationGroup(stations,selected){
 const lat=Number(selected?.lat),lon=Number(selected?.lon),base=normalizeStation(selected?.name);
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return [selected];
 const result=(stations||[]).filter(s=>{
  const slat=Number(s.lat),slon=Number(s.lon);
  if(!Number.isFinite(slat)||!Number.isFinite(slon))return false;
  const meters=Math.hypot((slat-lat)*111195,(slon-lon)*111195*Math.cos(lat*Math.PI/180));
  // Nearby stations only if name variants are equivalent, to avoid unrelated stops.
  return meters<140 && (base===normalizeStation(s.name)||stationMatchScore(base,s.name)>=100 || stationMatchScore(s.name,selected.name)>=100);
 });
 return result.length?result:[selected];
}
function getRT(update,stopId,seq,source,vehicle,nowMs,status){
 if(!update||status!=='ok'||!Number.isFinite(Number(update.fetchedAt))||nowMs-update.fetchedAt>120000||nowMs<update.fetchedAt-30000)return null;
 if(vehicle && !vehicleDelayInfo(update,vehicle))return null;
 const rows=Array.isArray(update.stops)?update.stops:[];
 const row=rows.find(x=>String(x.stopId??x.stop_id??'')===String(stopId)) || rows.find(x=>Number(x.stopSequence??x.stop_sequence)===Number(seq) && seq>0);
 const evt=row?.departure||row?.arrival;
 const delay=evt?.delay??null;
 const n=delay===null?Number(update.delay):Number(delay);
 if(delay===null&&(update.delay===null||update.delay===undefined))return null;
 return Number.isFinite(n)?n:null;
}
export function buildDepartureRows(stations,indexes,details,updates,statuses,opts={}){
 const now=opts.now || new Date(),nowSec=romeSeconds(now),days=opts.allDay?86400:4*3600;
 const group=Array.isArray(stations)?stations:[stations],out=[],reasons=[];
 for(const st of group){
  const source=st?.source,db=indexes?.[source],det=details?.[source];
  if(!dateGTFSValid(db,now)){reasons.push(source+': GTFS für heute nicht gültig');continue}
  if(!det?.times){reasons.push(source+': Haltezeiten fehlen');continue}
  for(const [tripId,times] of Object.entries(det.times)){
   const trip=db.trips?.[tripId];if(!trip||trip[5]===false)continue;
   for(const item of times||[]){
    const [stopId,arr,dep,seq]=item;if(String(stopId)!==String(st.stopId))continue;
    const sec=Number(dep??arr);
    if(!Number.isFinite(sec) || sec<0 || (opts.allDay ? sec>=86400 : sec<nowSec-180||sec>nowSec+days))continue;
    const route=db.routes?.[trip[0]];
    const kind=isRailRoute(route?.[2])?'train':'bus';
    if(opts.kind&&opts.kind!=='all'&&opts.kind!==kind)continue;
    const number=kind==='train' ? String(trip[3]||route?.[0]||'Zug'):String(route?.[0]||'Bus');
    const upd=updates?.get?.(source+':'+tripId);
    const update=upd?.tripStartDate && String(upd.tripStartDate).replaceAll('-','')!==romeDay(now).replaceAll('-','')?null:upd;
    const rtDelay=getRT(update,stopId,seq,source,null,now.getTime(),statuses?.[source+'_updates']);
    const cancellation=String(update?.scheduleRelationship||'').toUpperCase();
    const validUpdate=update&&statuses?.[source+'_updates']==='ok'&&Number.isFinite(Number(update.fetchedAt))&&now.getTime()>=Number(update.fetchedAt)-30000&&now.getTime()-Number(update.fetchedAt)<=120000;
    const rtStop=validUpdate?(update.stops||[]).find(x=>String(x.stopId??x.stop_id)===String(stopId)||(!(x.stopId??x.stop_id)&&Number(x.stopSequence??x.stop_sequence)===Number(seq))):null;
    out.push({source,tripId,stopId,sec,number,kind,serviceDay:romeDay(now),directionId:String(trip[6]??''),
      stationKey:normalizeStation(group[0]?.name||''),platform:platformInfo(det.stops?.[stopId],rtStop,det.stops),headsign:String(trip[1]||'Ziel unbekannt'),
      delaySec:rtDelay,forecast:rtDelay===null?null:sec+rtDelay,
      cancelled:Boolean(validUpdate && /^(CANCELED|CANCELLED|3)$/.test(cancellation)),
      key:source+':'+tripId+':'+stopId+':'+sec});
   }
  }
 }
 out.sort((a,b)=>(a.forecast??a.sec)-(b.forecast??b.sec));
 return {rows:[...new Map(out.map(v=>[v.key,v])).values()].slice(0,opts.allDay?160:65),reasons};
}
export function busDelayLabel(vehicle,updates,statuses,nowMs=Date.now()){
 if(vehicle?.kind!=='bus' || !vehicle.tripId || statuses?.[vehicle.source+'_updates']!=='ok')return null;
 const u=updates?.get?.(vehicle.source+':'+vehicle.tripId);
 if(!u || nowMs-Number(u.fetchedAt)>120000 || nowMs<Number(u.fetchedAt)-30000)return null;
 if(vehicle.tripStartDate&&u.tripStartDate&&String(vehicle.tripStartDate).replaceAll('-','')!==String(u.tripStartDate).replaceAll('-',''))return null;
 const info=vehicleDelayInfo(u,vehicle);if(!info||!Number.isFinite(Number(info.delay)))return null;
 const minutes=Math.round(info.delay/60);
 return {minutes,label:minutes>0?`+${minutes}′`:minutes<0?`${minutes}′`:'0′',basis:info.basis};
}
export function trainScheduledPosition(vehicle, indexes,details,shapes,now=new Date()){
 if(vehicle?.kind!=='train'||!vehicle.tripId||!vehicle.shapeId)return null;
 const db=indexes?.[vehicle.source],d=details?.[vehicle.source],shape=shapes?.[vehicle.source]?.shapes?.[vehicle.shapeId];
 if(!dateGTFSValid(db,now)||!Array.isArray(shape)||shape.length<2 || !d?.stops||!Array.isArray(d?.times?.[vehicle.tripId]))return null;
 const trip=db.trips?.[vehicle.tripId];if(!trip||trip[5]===false || String(trip[2])!==String(vehicle.shapeId))return null;
 const serviceDay=romeDay(now).replaceAll('-','');
 if(vehicle.tripStartDate&&String(vehicle.tripStartDate).replaceAll('-','')!==serviceDay)return null;
 const lat=Number(vehicle.rawLat??vehicle.lat),lon=Number(vehicle.rawLon??vehicle.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const observed=shapeProject(shape,lat,lon);
 if(!observed||observed.distance>180)return null;
 const stops=[];
 for(const [stopId,arr,dep] of d.times[vehicle.tripId]){
  const st=d.stops?.[stopId];if(!st)continue;
  const a=Number(st[1]),b=Number(st[2]);if(!Number.isFinite(a)||!Number.isFinite(b))continue;
  const projection=shapeProject(shape,a,b);
  if(!projection || projection.distance>200)continue;
  const arrive=arr===null||arr===undefined?null:Number(arr),depart=dep===null||dep===undefined?null:Number(dep);
  if(arrive!==null&&!Number.isFinite(arrive) || depart!==null&&!Number.isFinite(depart))continue;
  stops.push({stopId,name:String(st[0]),along:projection.along,arrive,depart});
 }
 if(stops.length<2)return null;
 for(let i=1;i<stops.length;i++)if(stops[i].along+50<stops[i-1].along)return null;
 const seconds=romeSeconds(now);
 let segment=null;
 for(let i=1;i<stops.length;i++){
  const a=stops[i-1],b=stops[i],start=a.depart??a.arrive,end=b.arrive??b.depart;
  if(start===null||end===null||end<=start||end-start>7200||b.along-a.along<50)continue;
  if(seconds>=start && seconds<=end){segment={a,b,start,end};break}
 }
 if(!segment)return null;
 const fraction=(seconds-segment.start)/(segment.end-segment.start);
 const scheduledAlong=segment.a.along+fraction*(segment.b.along-segment.a.along);
 const scheduled=pointAtDistance(shape,scheduledAlong,lat);
 if(!scheduled)return null;
 return {scheduled,observed:{lat,lon},plannedMeters:scheduledAlong,observedMeters:observed.along,
  differenceKm:Math.round(Math.abs(scheduledAlong-observed.along)/100)/10,
  segmentStartMeters:segment.a.along,segmentEndMeters:segment.b.along,
  segmentStartSeconds:segment.start,segmentEndSeconds:segment.end,
  relative:observed.along>=scheduledAlong?'vor dem Soll-Punkt':'hinter dem Soll-Punkt',
  from:segment.a.name,to:segment.b.name,
  // The schedule interpolation is an illustration, NOT GPS or an exact punctuality measurement.
  note:'Soll-Position: linear zwischen planmäßigen Haltezeiten auf bestätigter GTFS-Strecke; kein tatsächlicher Zugort.'};
}
