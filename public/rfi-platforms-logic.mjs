/* Official station monitors: match one actual board entry, never infer a platform. */
import {RFI_STATIONS} from './rfi-stations.mjs?v=9.6.0';
import {displayTrack,stationNames,romeTime} from './train-platforms-logic.mjs?v=9.6.0';
export const rfiStation=id=>RFI_STATIONS.find(s=>s.placeId===String(id))||null;
export function resolveStation(context){
 if(context.source==='trains'){const s=RFI_STATIONS.find(s=>s.stopId===String(context.stopId).replace(/^S/,''));if(s)return s}
 const names=stationNames(context.stopName);
 const found=RFI_STATIONS.filter(s=>[s.name,...s.aliases].some(n=>stationNames(n).some(n=>names.includes(n))));
 const unique=new Map(found.map(s=>[s.placeId,s]));return unique.size===1?[...unique.values()][0]:null;
}
const text=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):''}).replace(/&(nbsp|amp|apos|quot|lt|gt);/gi,(_,n)=>({nbsp:' ',amp:'&',apos:"'",quot:'"',lt:'<',gt:'>'})[n.toLowerCase()]).replace(/\s+/g,' ').trim();
export function parseMonitor(html,stationId,arrivals,now=Date.now()){
 const station=rfiStation(stationId);if(!station||typeof html!=='string'||html.length>2000000)return null;
 const heading=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
 if(!stationNames(station.name).some(n=>stationNames(heading).includes(n)))return null;
 const stamp=text(html.match(/<div\b[^>]*id=["']lastUpdateId["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]);
 const time=stamp.match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2}):(\d{2}):(\d{2})/);if(!time)return null;
 const updatedLocal=`${time[3]}-${time[2]}-${time[1]}T${time[4]}:${time[5]}:${time[6]}`;
 const rows=[];
 for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cell=id=>text(m[1].match(new RegExp('<td\\b[^>]*\\bid=["\\\']'+id+'["\\\'][^>]*>([\\s\\S]*?)<\\/td>','i'))?.[1]);
  const number=cell('RTreno'),clock=cell('ROrario'),platform=displayTrack(cell('RBinario'));
  if(/^\d{2,6}$/.test(number)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)&&platform)rows.push({number,clock,platform});
 }
 return {stationId:station.placeId,stationName:station.name,arrivals:Boolean(arrivals),updatedLocal,fetchedAt:now,source:'RFI',rows};
}
const localOrdinal=(day,sec)=>Date.parse(day+'T00:00:00Z')/1000+sec;
export function freshMonitor(data,now=Date.now()){
 const t=romeTime(now),updated=Date.parse(data?.updatedLocal+'Z')/1000;
 if(!t||!Number.isFinite(updated)||!Number.isFinite(data?.fetchedAt))return false;
 const age=localOrdinal(t.day,t.sec)-updated;
 return age>=-30&&age<=120&&now-data.fetchedAt<=120000&&now>=data.fetchedAt-30000;
}
export function matchRFI(data,c,now=Date.now()){
 const station=resolveStation(c);if(!station||data?.stationId!==station.placeId||!freshMonitor(data,now)||Boolean(data.arrivals)!==Boolean(c.terminal))return null;
 const raw=c.terminal?c.arrival:c.departure;if(raw===null||raw===undefined)return null;const sec=Number(raw);if(!Number.isFinite(sec)||sec<0||sec>172800||!/^\d{4}-\d{2}-\d{2}$/.test(c.serviceDay))return null;
 const expected=localOrdinal(c.serviceDay,sec),time=romeTime(now),current=localOrdinal(time.day,time.sec);
 if(expected<current-21600||expected>current+21600)return null;
 const today=data.updatedLocal.slice(0,10),base=localOrdinal(today,0);
 const rows=data.rows.filter(r=>r.number===c.number&&[-86400,0,86400].some(offset=>Math.abs(base+offset+Number(r.clock.slice(0,2))*3600+Number(r.clock.slice(3))*60-expected)<=60));
 if(rows.length!==1)return null;
 return {planned:null,current:rows[0].platform,changed:false,live:true,source:'RFI'};
}
