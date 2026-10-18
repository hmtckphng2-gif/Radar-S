import {resolveTrain,normalizeTrain,romeTime} from './public/train-platforms-logic.mjs';
import {rfiStation,parseMonitor} from './public/rfi-platforms-logic.mjs';
/** Read-only transit proxies, with fixed upstream hosts and bounded caching. */
const FEEDS = Object.freeze({
  sta: 'https://proxy.busone.app/sta/gtfs-rt/vehicle-positions.json',
  trentino: 'https://proxy.busone.app/trentino/gtfs-rt/vehicle-positions.json',
  trains: 'https://proxy.busone.app/trenitalia/gtfs-rt/vehicle-positions.json',
  sta_updates: 'https://proxy.busone.app/sta/gtfs-rt/trip-updates.json',
  trentino_updates: 'https://proxy.busone.app/trentino/gtfs-rt/trip-updates.json',
  trains_updates: 'https://proxy.busone.app/trenitalia/gtfs-rt/trip-updates.json'
});
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=15, stale-while-revalidate=15',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,HEAD,OPTIONS',
  'x-content-type-options': 'nosniff'
};
const respond = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { ...JSON_HEADERS, ...extra }
});
async function trainPlatforms(request,url,name){
  const number=name.slice('train-platforms/'.length),day=url.searchParams.get('day');
  if(!/^\d{2,6}$/.test(number)||day!==romeTime(Date.now()).day)return respond({error:'Invalid train or service day'},400,{'cache-control':'no-store'});
  const base='https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/';
  const get=path=>fetch(base+path,{headers:{accept:'application/json, text/plain'},signal:AbortSignal.timeout(9000),cf:{cacheEverything:true,cacheTtl:30}});
  const started=Date.now();
  const diagnostic={version:'5.4.3',stage:'lookup',upstreamStatus:null,contentType:null};
  const failed=(reason,status=502,message=null)=>respond({error:'Official platform data temporarily unavailable',diagnostic:{...diagnostic,reason,message,elapsedMs:Date.now()-started}},status,{'cache-control':'no-store'});
  try{
    const lookup=await get('cercaNumeroTrenoTrenoAutocomplete/'+number);
    diagnostic.upstreamStatus=lookup.status;diagnostic.contentType=lookup.headers.get('content-type');
    if(!lookup.ok)return failed('upstream-http');
    const trip=resolveTrain(await lookup.text(),number,day);
    if(!trip)return failed('no-unique-journey',404);
    diagnostic.stage='journey';diagnostic.upstreamStatus=null;diagnostic.contentType=null;
    const result=await get(`andamentoTreno/${trip.origin}/${number}/${trip.start}`);
    diagnostic.upstreamStatus=result.status;diagnostic.contentType=result.headers.get('content-type');
    if(!result.ok)return failed('upstream-http');
    diagnostic.stage='parse';
    const data=normalizeTrain(await result.json(),number,day);
    if(!data)return failed('unexpected-journey');
    return new Response(request.method==='HEAD'?null:JSON.stringify({...data,diagnostic:{version:'5.4.3',stage:'complete',elapsedMs:Date.now()-started}}),{headers:{...JSON_HEADERS,'cache-control':'public, max-age=30','x-radar-platform-source':'ViaggiaTreno'}});
  }catch(error){return failed(error?.name==='TimeoutError'?'timeout':diagnostic.stage==='parse'?'invalid-json':'network',502,String(error?.message||'Request failed').replace(/[\r\n]+/g,' ').slice(0,180))}
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (!env.ASSETS?.fetch) return new Response('Static assets not configured', { status: 503 });
      return env.ASSETS.fetch(request);
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (request.method !== 'GET' && request.method !== 'HEAD') return respond({ error: 'Method not allowed' }, 405);
    const name = url.pathname.substring(5);
    if(name.startsWith('station-platforms/')){
      const id=name.slice('station-platforms/'.length),arrivals=url.searchParams.get('arrivals')||'0';
      if(!rfiStation(id)||!['0','1'].includes(arrivals))return respond({error:'Invalid RFI station or board'},400,{'cache-control':'no-store'});
      const diagnostic={version:'5.4.4',source:'RFI',stationId:id,upstreamStatus:null};
      try{
        const upstream=await fetch(`https://iechub.rfi.it/ArriviPartenze/arrivalsdepartures/monitor?arrivals=${arrivals==='1'?'true':'false'}&placeid=${id}&search=`,{headers:{accept:'text/html'},signal:AbortSignal.timeout(9000),cf:{cacheEverything:true,cacheTtl:30}});
        diagnostic.upstreamStatus=upstream.status;
        if(!upstream.ok)return respond({error:'RFI monitor unavailable',diagnostic},502,{'cache-control':'no-store'});
        const board=parseMonitor(await upstream.text(),id,arrivals==='1');
        if(!board)return respond({error:'Unexpected RFI board format',diagnostic},502,{'cache-control':'no-store'});
        return respond({...board,diagnostic},200,{'cache-control':'public, max-age=30'});
      }catch(error){return respond({error:'RFI monitor request failed',diagnostic:{...diagnostic,reason:error?.name==='TimeoutError'?'timeout':'network'}},502,{'cache-control':'no-store'})}
    }
    if(name.startsWith('train-platforms/'))return trainPlatforms(request,url,name);
    if (name === 'health') return respond({ ok: true, version:'5.4.3', status: 'Proxy bereit (kein Live-Feed-Test)', feeds: Object.keys(FEEDS), time: new Date().toISOString() }, 200, { 'cache-control': 'no-store' });
    if (!Object.hasOwn(FEEDS, name)) return respond({ error: 'Unknown feed' }, 404);
    const client = String(env.BUSONE_CLIENT || 'Suedtirol Radar / personal transit viewer; https://github.com/hmtckphng2-gif/Radar-S').slice(0, 180);
    try {
      const upstream = await fetch(FEEDS[name], {
        headers: { 'accept': 'application/json', 'X-BusOne-Client': client, 'X-BusOne-Use': 'personal' },
        signal: AbortSignal.timeout(9000),
        cf: { cacheEverything: true, cacheTtl: 15 }
      });
      if (!upstream.ok) return respond({ error: 'Feed temporarily unavailable', feed: name, upstreamStatus: upstream.status }, 502, { 'cache-control': 'no-store' });
      const type = upstream.headers.get('content-type') || '';
      if (!type.includes('json')) return respond({ error: 'Unexpected upstream format', feed: name }, 502, { 'cache-control': 'no-store' });
      // Avoid fetching/parsing on Cloudflare again: relay the provider JSON as-is.
      return new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: 200,
        headers: { ...JSON_HEADERS, 'x-radar-feed': name, 'x-radar-fetched-at': new Date().toISOString() }
      });
    } catch (error) {
      return respond({ error: 'Feed request failed', feed: name }, 502, { 'cache-control': 'no-store' });
    }
  }
};

