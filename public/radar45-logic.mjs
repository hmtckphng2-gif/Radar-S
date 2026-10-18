/* Südtirol Radar 4.5: pure safeguards for map and vehicle presentation. */
export const styleUrl=()=> 'https://tiles.openfreemap.org/styles/dark';
export function shouldTryDarkMap({mode='radar',online=true,supported=true}={}){
 return mode==='radar' && online && supported;
}
// Display ONE SEGMENT BEHIND actual received observations. Do not predict locations.
// Lag adapts to the actual refresh cadence, with enough margin to avoid stop-go
// for regularly arriving 20-30s updates. A long outage still freezes honestly.
export function playbackLag(samples){
 if(!Array.isArray(samples)||samples.length<2)return 38000;
 const intervals=[];
 for(let i=Math.max(1,samples.length-4);i<samples.length;i++){
  const dt=Number(samples[i].time)-Number(samples[i-1].time);
  if(Number.isFinite(dt)&&dt>1000)intervals.push(dt);
 }
 if(!intervals.length)return 38000;
 const span=intervals.slice().sort((a,b)=>a-b);
 const median=span[Math.floor(span.length/2)];
 return Math.round(Math.min(65000,Math.max(32000,median*1.2)));
}
export function motionState({stale=false,route=false,observations=0}={}){
 if(stale)return 'stale';
 if(!route)return 'feed-only';
 return observations>=2?'buffered':'waiting';
}
