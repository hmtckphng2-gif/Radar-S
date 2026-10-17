const FEEDS={
  sta:'https://proxy.busone.app/sta/gtfs-rt/vehicle-positions.json',
  trentino:'https://proxy.busone.app/trentino/gtfs-rt/vehicle-positions.json',
  sta_updates:'https://proxy.busone.app/sta/gtfs-rt/trip-updates.json',
  trentino_updates:'https://proxy.busone.app/trentino/gtfs-rt/trip-updates.json',
  trains:'https://proxy.busone.app/trenitalia/gtfs-rt/vehicle-positions.json',
  trains_status:'https://proxy.busone.app/trenitalia/status',
  sta_status:'https://proxy.busone.app/sta/status',
  trentino_status:'https://proxy.busone.app/trentino/status'
};
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=20','access-control-allow-origin':'*'};
export default {async fetch(req,env){const url=new URL(req.url);if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
 const name=url.pathname.slice(5);if(name==='health')return Response.json({ok:true,service:'Südtirol Radar API',sources:Object.keys(FEEDS)}, {headers});
 if(!Object.hasOwn(FEEDS,name))return Response.json({error:'Unbekannte Datenquelle'}, {status:404,headers});
 try{const res=await fetch(FEEDS[name],{headers:{accept:'application/json','user-agent':'SuedtirolRadar/2.0 (noncommercial transit viewer)'},signal:AbortSignal.timeout(9500),cf:{cacheEverything:true,cacheTtl:20}});
 const raw=await res.text();if(!res.ok)return Response.json({error:`Quelle HTTP ${res.status}`,source:name,detail:raw.slice(0,180)}, {status:502,headers});
 let data;try{data=JSON.parse(raw)}catch{return Response.json({error:'Quelle lieferte kein JSON',source:name,detail:raw.slice(0,180)},{status:502,headers})}
 return Response.json(data,{headers});}catch(e){return Response.json({error:'Quelle nicht erreichbar',source:name,detail:String(e.message||e)},{status:502,headers})}
 }};
