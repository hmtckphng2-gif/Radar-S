import {resolveTrain,normalizeTrain,romeTime} from './public/train-platforms-logic.mjs';
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
  try{
    const lookup=await get('cercaNumeroTrenoTrenoAutocomplete/'+number);
    if(!lookup.ok)throw new Error('Lookup unavailable');
    const trip=resolveTrain(await lookup.text(),number,day);
    if(!trip)return respond({error:'No unique official journey for today'},404,{'cache-control':'public, max-age=30'});
    const result=await get(`andamentoTreno/${trip.origin}/${number}/${trip.start}`);
    if(!result.ok)throw new Error('Journey unavailable');
    const data=normalizeTrain(await result.json(),number,day);
    if(!data)throw new Error('Unexpected official journey');
    return new Response(request.method==='HEAD'?null:JSON.stringify(data),{headers:{...JSON_HEADERS,'cache-control':'public, max-age=30','x-radar-platform-source':'ViaggiaTreno'}});
  }catch{return respond({error:'Official platform data temporarily unavailable'},502,{'cache-control':'no-store'})}
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
    if(name.startsWith('train-platforms/'))return trainPlatforms(request,url,name);
    if (name === 'health') return respond({ ok: true, status: 'Proxy bereit (kein Live-Feed-Test)', feeds: Object.keys(FEEDS), time: new Date().toISOString() }, 200, { 'cache-control': 'no-store' });
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

