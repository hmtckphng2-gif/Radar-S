/* Horizon 7.0: GTFS-based multi-source routing. No invented predictions. */
const rad=Math.PI/180;
export function distanceMeters(a,b){
 const p=[+a?.lat,+a?.lon,+b?.lat,+b?.lon];if(p.some(x=>!Number.isFinite(x)))return Infinity;
 const d=(p[2]-p[0])*rad,l=(p[3]-p[1])*rad;
 const h=Math.sin(d/2)**2+Math.cos(p[0]*rad)*Math.cos(p[2]*rad)*Math.sin(l/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function walkEstimate(m){return !Number.isFinite(m)||m<0?null:Math.max(60,Math.ceil(m/1.2/30)*30)}
const key=(source,id)=>source+':'+id;
export function buildTimetable(indexes={},details={},day){
 const stops=new Map(),departures=new Map(),trips=[],grid=new Map(),cell=.004,sources=[];
 for(const source of ['trains','sta','trentino']){
  const db=indexes[source],det=details[source];if(!db?.meta?.ready||!db.meta.days?.includes(day)||!det?.times||!det?.stops)continue;sources.push(source);
  for(const [id,raw] of Object.entries(det.stops)){
   const lat=Number(raw[1]),lon=Number(raw[2]);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
   const s={key:key(source,id),source,id,name:String(raw[0]||id),lat,lon,platform:typeof raw[3]==='string'&&raw[3].trim()?raw[3].trim():null};
   stops.set(s.key,s);const slot=Math.floor(lat/cell)+':'+Math.floor(lon/cell);if(!grid.has(slot))grid.set(slot,[]);grid.get(slot).push(s);
  }
  for(const [id,rows] of Object.entries(det.times)){
   const record=db.trips?.[id];if(!record||record[5]===false||!Array.isArray(rows)||rows.length<2)continue;
   const route=db.routes?.[record[0]],calls=[];
   for(const row of rows){const k=key(source,row[0]),a=Number(row[1]),d=Number(row[2]);if(stops.has(k)&&Number.isFinite(a)&&Number.isFinite(d)&&d>=a&&a>=0)calls.push({key:k,arrival:a,departure:d})}
   if(calls.length<2)continue;
   const trip={source,id,name:String((String(route?.[2])==='2'?record[3]:route?.[0])||record[3]||'Linie'),headsign:String(record[1]||''),type:String(route?.[2])==='2'?'train':'bus',calls};
   const idx=trips.push(trip)-1;
   calls.forEach((c,i)=>{if(i===calls.length-1)return;const a=departures.get(c.key)||[];a.push({idx,i,time:c.departure});departures.set(c.key,a)});
  }
 }
 for(const arr of departures.values())arr.sort((a,b)=>a.time-b.time);
 return {stops,departures,trips,grid,cell,sources};
}
export function nearbyStops(net,keyOrStop,range=350,cap=16){
 const s=typeof keyOrStop==='string'?net.stops.get(keyOrStop):keyOrStop;if(!s)return [];
 const x=Math.floor(s.lat/net.cell),y=Math.floor(s.lon/net.cell),near=[];
 for(let a=x-1;a<=x+1;a++)for(let b=y-1;b<=y+1;b++)for(const st of net.grid.get(a+':'+b)||[]){const meters=distanceMeters(s,st);if(meters<=range)near.push({stop:st,meters,seconds:meters<25?0:walkEstimate(meters)})}
 return near.sort((a,b)=>a.meters-b.meters).slice(0,cap);
}
function after(rows,t,max=26){let l=0,h=rows.length;while(l<h){let m=(l+h)>>1;if(rows[m].time<t)l=m+1;else h=m}return rows.slice(l,l+max)}
export function transferAssessment({arrival,departure,walkSeconds=0,liveArrival=null,liveDeparture=null}){
 if(!Number.isFinite(arrival)||!Number.isFinite(departure))return {status:'unknown',label:'Zeitangaben fehlen',margin:null,live:false};
 const live=Number.isFinite(liveArrival)&&Number.isFinite(liveDeparture),margin=(live?liveDeparture:departure)-(live?liveArrival:arrival)-Math.max(0,walkSeconds);
 return {status:margin<0?'missed':margin<120?'risk':'possible',label:live?(margin<0?'Anschluss voraussichtlich verpasst':margin<120?'Anschluss gefährdet':'Nach Prognose erreichbar'):(margin<0?'Laut Fahrplan nicht erreichbar':margin<120?'Fahrplanmäßig knapp':'Laut Fahrplan möglich'),margin,live};
}
function assemble(st,destination){
 const legs=[];let x=st;while(x?.leg){legs.unshift(x.leg);x=x.parent}if(!legs.length)return null;
 const transfers=[];
 for(let i=1;i<legs.length;i++){const a=legs[i-1],b=legs[i],meters=distanceMeters(a.toStop,b.fromStop),t=transferAssessment({arrival:a.arrival,departure:b.departure,walkSeconds:meters<25?0:walkEstimate(meters)||0});transfers.push({from:a.toStop.name,to:b.fromStop.name,meters:Math.round(meters),...t})}
 return {legs,departure:legs[0].departure,arrival:st.at,transfers,walkToDestination:st.walk||0,destination:destination.name};
}
export function searchJourneys(net,origin,destination,now,{maxLegs=3,maxResults=10,types=['train','bus'],horizon=14400}={}){
 const start=net?.stops?.get(key(origin?.source,origin?.stopId)),end=net?.stops?.get(key(destination?.source,destination?.stopId));
 if(!start||!end)return {results:[],reason:'Haltestellen in GTFS nicht vorhanden'};
 if(start.key===end.key)return {results:[],reason:'Start und Ziel identisch'};
 if(!Number.isFinite(now)||!net.trips.length)return {results:[],reason:'Keine gültigen Fahrplandaten'};
 const targets=new Map(nearbyStops(net,end,350,24).map(x=>[x.stop.key,x])),results=[],seen=new Set(),limit=now+horizon;
 let states=[{key:start.key,at:now,parent:null,leg:null,first:now}];
 for(let round=0;round<maxLegs;round++){
  const next=new Map();let boardings=0;
  for(const state of states)for(const nearby of nearbyStops(net,state.key,350,16)){
   const ready=state.at+nearby.seconds+(round?90:0);
   for(const entry of after(net.departures.get(nearby.stop.key)||[],ready)){
    if(entry.time>limit)break;const trip=net.trips[entry.idx];
    if(!types.includes(trip.type)||state.leg&&(state.leg.source===trip.source&&state.leg.tripId===trip.id))continue;
    boardings++;
    for(let i=entry.i+1;i<trip.calls.length;i++){
     const call=trip.calls[i];if(call.arrival<entry.time||call.arrival>limit+7200)continue;
     const leg={source:trip.source,tripId:trip.id,name:trip.name,headsign:trip.headsign,type:trip.type,fromStop:nearby.stop,toStop:net.stops.get(call.key),departure:entry.time,arrival:call.arrival};
     const state2={key:call.key,at:call.arrival,leg,parent:state,first:state.leg?state.first:entry.time};
     const target=targets.get(call.key);
     if(target){state2.at+=target.seconds;state2.walk=target.meters;const result=assemble(state2,end);if(result){const id=result.legs.map(x=>x.source+':'+x.tripId).join('|')+':'+result.departure;if(!seen.has(id)){seen.add(id);results.push(result)}}state2.at=call.arrival;delete state2.walk}
     const prev=next.get(call.key)||[];if(prev.some(s=>s.at<=state2.at&&Math.abs(s.first-state2.first)<240))continue;
     prev.push(state2);prev.sort((a,b)=>a.at-b.at);next.set(call.key,prev.slice(0,2));
    }
   }
  }
  if(!boardings)break;states=[...next.values()].flat();states.sort((a,b)=>(a.at+distanceMeters(net.stops.get(a.key),end)/16)-(b.at+distanceMeters(net.stops.get(b.key),end)/16));states=states.slice(0,300);
 }
 results.sort((a,b)=>a.departure-b.departure||a.arrival-b.arrival||a.legs.length-b.legs.length);
 const distinct=collapseEquivalentJourneys(results);
 return {results:distinct.slice(0,maxResults),reason:distinct.length?'':'Keine Verbindung in den verfügbaren Fahrplänen',sources:net.sources,combinedVariants:results.length-distinct.length};
}
/* Deterministic display deduplication. Never merge different line sequences or
 * meaningful transfer towns. Prefer more robust transfer variants.
 * AI may explain the results, but cannot remove scheduled connections.
 */
const normalizeLine=v=>String(v??'').normalize('NFKC').toLocaleLowerCase('de').trim().replace(/\s+/g,' ');
function visibleKey(j){
 const legs=Array.isArray(j?.legs)?j.legs:[];
 return [Math.round(j.departure/60),Math.round(j.arrival/60),legs.length,
   ...legs.map(x=>(x.type||'')+':'+normalizeLine(x.name))].join('|');
}
function sameInterchange(a,b){
 const x=a.legs||[],y=b.legs||[];
 if(x.length!==y.length)return false;
 for(let n=0;n<x.length-1;n++){
  if(distanceMeters(x[n].toStop,y[n].toStop)>400 ||
     distanceMeters(x[n+1].fromStop,y[n+1].fromStop)>400)return false;
 }
 return true;
}
function variantCost(j){
 return (j.transfers||[]).reduce((sum,t)=>{
  const penalty=t.status==='missed'?100000:t.status==='risk'?20000:0;
  const distance=Number.isFinite(t.meters)?t.meters:1200;
  const buffer=Number.isFinite(t.margin)?Math.min(Math.max(t.margin,0),2400):0;
  return sum+penalty+distance-buffer/30;
 },0);
}
export function collapseEquivalentJourneys(rows=[]){
 const out=[],groups=new Map();
 for(const journey of rows){
  if(!journey||!Array.isArray(journey.legs)||!journey.legs.length)continue;
  const key=visibleKey(journey),indices=groups.get(key)||[];
  const same=indices.find(i=>sameInterchange(out[i],journey));
  if(same===undefined){
   indices.push(out.push({...journey,collapsedVariants:0})-1);
   groups.set(key,indices);
  }else{
   const previous=out[same],combined=(previous.collapsedVariants||0)+1;
   out[same]=variantCost(journey)<variantCost(previous)?
     {...journey,collapsedVariants:combined}:
     {...previous,collapsedVariants:combined};
  }
 }
 return out;
}
