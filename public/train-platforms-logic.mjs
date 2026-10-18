/* Official ViaggiaTreno display fields. Never infer a track from a stop ID. */
const rome=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function romeTime(ms){
 if(!Number.isFinite(Number(ms))||Number(ms)<1e12)return null;
 const p=Object.fromEntries(rome.formatToParts(new Date(Number(ms))).map(x=>[x.type,x.value]));
 return {day:`${p.year}-${p.month}-${p.day}`,sec:Number(p.hour)*3600+Number(p.minute)*60+Number(p.second)};
}
export function resolveTrain(text,number,day){
 const found=new Map();
 for(const line of String(text).split('\n')){
  const m=line.trim().match(/\|(\d{1,6})-(S\d{5})-(\d{13})$/);
  if(m&&m[1]===number&&romeTime(Number(m[3]))?.day===day)found.set(m[0],{number,origin:m[2],start:m[3]});
 }
 return found.size===1?[...found.values()][0]:null;
}
const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
const equivalentTrack=s=>roman.includes(s)?String(roman.indexOf(s)+1):String(s).toUpperCase();
const track=value=>{
 const s=String(value??'').trim();return /^(?:\d{1,3}[A-Za-z]?|[A-Za-z])$/.test(s)||roman.includes(s)?s:null;
};
export function normalizeTrain(raw,number,day,now=Date.now()){
 if(String(raw?.numeroTreno)!==number||!Array.isArray(raw.fermate))return null;
 return {number,day,fetchedAt:now,source:'Trenitalia · ViaggiaTreno',stops:raw.fermate.slice(0,150).map(s=>({
  id:String(s.id||''),name:String(s.stazione||''),arrival:s.arrivo_teorico,departure:s.partenza_teorica,
  plannedArrival:track(s.binarioProgrammatoArrivoDescrizione),actualArrival:track(s.binarioEffettivoArrivoDescrizione),
  plannedDeparture:track(s.binarioProgrammatoPartenzaDescrizione),actualDeparture:track(s.binarioEffettivoPartenzaDescrizione)
 }))};
}
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const aliases=[['ponte d adige','ponte adige','sigmundskron'],['bolzano','bozen'],['brennero','brenner'],['merano','meran'],['salorno','salurn'],['bressanone','brixen'],['fortezza','franzensfeste'],['chiusa','klausen'],['trento','trient'],['vipiteno','vipiteno val di vizze','sterzing'],['ponte gardena','ponte gardena laion','waidbruck lajen'],['merano maia bassa','merano maia','meran untermais'],['magre cortaccia','margreid kurtatsch']];
const canonical=s=>{const n=normalize(s);return aliases.find(a=>a.includes(n))?.[0]||n};
function stationNames(name){
 const station=String(name||'').split(',').at(-1);
 const parts=station.split(/\s*\/\s*/).map(s=>s.trim().replace(/^stazione di\s+/i,''));
 return parts.map(canonical).filter(Boolean);
}
export function matchPlatform(data,c,now=Date.now()){
 if(!data||data.number!==c.number||data.day!==c.serviceDay||!Number.isFinite(data.fetchedAt)||now-data.fetchedAt>120000||now<data.fetchedAt-30000)return null;
 const departure=c.departure!==null&&c.departure!==undefined&&Number.isFinite(Number(c.departure));
 const seconds=Number(departure?c.departure:c.arrival);if(!Number.isFinite(seconds)||seconds<0||seconds>172800)return null;
 const expected=Date.parse(c.serviceDay+'T00:00:00Z')/1000+seconds;
 const names=stationNames(c.stopName);
 const candidates=data.stops.filter(s=>{
  const id=String(c.stopId||'');
  const station=c.source==='trains'&&/^S?\d{5}$/.test(id)?s.id==='S'+id.replace(/^S/,''):stationNames(s.name).some(n=>names.includes(n));
  if(!station)return false;
  const terminal=s.departure===null||s.departure===undefined;
  const time=romeTime(departure&&!terminal?s.departure:s.arrival);if(!time)return false;
  if(terminal&&departure&&c.arrival!==null&&c.arrival!==undefined&&Math.abs(Number(c.arrival)-seconds)>90)return false;
  return Math.abs(Date.parse(time.day+'T00:00:00Z')/1000+time.sec-expected)<=90;
 });
 if(candidates.length!==1)return null;
 const s=candidates[0],useDeparture=departure&&s.departure!==null&&s.departure!==undefined;
 const planned=useDeparture?s.plannedDeparture:s.plannedArrival,current=useDeparture?s.actualDeparture:s.actualArrival;
 if(!current&&!planned)return null;
 return {planned,current:current||planned,changed:Boolean(current&&planned&&equivalentTrack(current)!==equivalentTrack(planned)),live:Boolean(current),source:data.source};
}
