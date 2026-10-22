/* Radar 6.6: pure, conservative source quality and conflict diagnostics. */
import {distanceMeters,selectRepresentatives,observationQuality} from './radar64-logic.mjs?v=9.7.0';
const fleetId=v=>String(v?.vehicleId||'');
export function sameStaFleet(a,b){const pair=new Set([a?.source,b?.source]);return pair.size===2&&pair.has('sta')&&pair.has('sta_direct')&&a?.kind==='bus'&&b?.kind==='bus'&&/^\d{2,6}$/.test(fleetId(a))&&fleetId(a)===fleetId(b)}
export function sourceConflicts(vehicles,now=Date.now()){
 const all=[...vehicles].filter(v=>v&&!v.stale&&Number.isFinite(Number(v.timestamp))&&now/1000-Number(v.timestamp)<=300&&now/1000-Number(v.timestamp)>=-30);
 const direct=new Map(all.filter(v=>v.source==='sta_direct').map(v=>[fleetId(v),v]));const conflicts=[];
 for(const v of all){if(v.source!=='sta')continue;const match=direct.get(fleetId(v));if(!sameStaFleet(v,match))continue;
  const seconds=Math.abs(Number(v.timestamp)-Number(match.timestamp)),meters=distanceMeters(v,match);
  if(seconds<=90&&meters>200)conflicts.push({sources:['sta','sta_direct'],vehicleId:fleetId(v),differenceMeters:Math.round(meters),secondsApart:Math.round(seconds),reason:'abweichende Positionen'});
 }
 return conflicts.slice(0,100);
}
export function feedDiagnostics(vehicles,statuses={},now=Date.now(),previousFusion=null){
 const arr=[...vehicles],fusion=previousFusion?.keys?previousFusion:selectRepresentatives(arr),selected=arr.filter(v=>fusion.keys.has(v.key));
 const sources=Object.entries(statuses).map(([name,status])=>({name,status}));
 const unknownBuses=selected.filter(v=>v.kind==='bus'&&!v.lineVerified).length;
 const stale=selected.filter(v=>observationQuality(v,now).status==='alt/unklar').length;
 const conflicts=sourceConflicts(arr,now);
 return {count:selected.length,trains:selected.filter(v=>v.kind==='train').length,buses:selected.filter(v=>v.kind==='bus').length,unknownBuses,stale,duplicates:fusion.duplicates,conflicts,conflictCount:conflicts.length,sources};
}
export function boundedMotionDuration(meters,kind){if(!Number.isFinite(meters)||meters<0)return 0;const min=kind==='train'?1200:700,max=kind==='train'?4700:2000;return Math.min(max,Math.max(min,Math.round(meters*3)))}
