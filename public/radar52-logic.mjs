/* Radar 5.2 – pure helpers: GTFS geometry and confirmed GTFS-RT only. */
export function sameLine(a,b){
 return Boolean(a?.kind==='bus' && b?.kind==='bus' && a.lineVerified===true && b.lineVerified===true &&
   String(a.name||'').trim().toLocaleLowerCase('de')===String(b.name||'').trim().toLocaleLowerCase('de'));
}
export function shapeSections(path,along){
 if(!Array.isArray(path)||path.length<2||!Number.isFinite(along)||along<0)return null;
 const length=(a,b)=>Math.hypot((b[0]-a[0])*111195,(b[1]-a[1])*111195*Math.cos((a[0]+b[0])*Math.PI/360));
 const total=path.slice(1).reduce((sum,p,i)=>sum+length(path[i],p),0);
 if(total<20||along>total+150)return null;
 const past=[path[0]],future=[];let d=0,split=false;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],len=length(a,b);
  if(!split && d+len>=along){
   const f=len?Math.min(1,Math.max(0,(along-d)/len)):0;
   const point=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
   past.push(point);future.push(point,b);split=true;
  }else if(!split)past.push(b);
  else future.push(b);
  d+=len;
 }
 if(!split)return {past:path,future:[],total};
 return {past,future,total};
}
export function delayMinutes(update,now=Date.now()){
 if(!update || !Number.isFinite(Number(update.fetchedAt)) || now-Number(update.fetchedAt)>120000 ||
    now<Number(update.fetchedAt)-30000)return null;
 const d=update.delay;
 if(d===null||d===undefined||d==='')return null;
 const n=Number(d);return Number.isFinite(n)?Math.round(n/60):null;
}
export function addDelaySample(samples,update,now=Date.now()){
 const min=delayMinutes(update,now);
 if(min===null)return samples;
 const time=Number(update.fetchedAt);
 if(samples.some(s=>s.t===time))return samples;
 return [...samples,{t:time,min}].sort((a,b)=>a.t-b.t).slice(-24);
}
export function localTime(sec){
 if(!Number.isFinite(sec))return '–';
 return `${String(Math.floor(sec/3600)%24).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}${sec>=86400?' +1':''}`;
}
// Delay severity for the colour scale and the alert filters.
// A strong red is reserved for 15 minutes and more. Cancellations and
// outages are their own states and are never expressed through minutes.
// The rule lives here only, so it can be tested and reused.
export const DELAY_SEVERITY=Object.freeze({none:0,minor:1,moderate:2,severe:3});
export const SEVERE_DELAY_MINUTES=15;
export function delaySeverity(minutes){
  if(minutes===null||minutes===undefined||minutes==='')return DELAY_SEVERITY.none;
  const value=Math.abs(Number(minutes));
  if(!Number.isFinite(value))return DELAY_SEVERITY.none;
  if(value>=SEVERE_DELAY_MINUTES)return DELAY_SEVERITY.severe;
  if(value>=5)return DELAY_SEVERITY.moderate;
  if(value>0)return DELAY_SEVERITY.minor;
  return DELAY_SEVERITY.none;
}
export function isSevereDelay(minutes){return delaySeverity(minutes)===DELAY_SEVERITY.severe}