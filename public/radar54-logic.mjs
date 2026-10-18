/* Radar 5.4: observations only, never extrapolate motion or fabricate history. */
export function motionDuration(v,previousTimestamp,now=Date.now(),reduced=false){
 const stamp=Number(v?.timestamp),age=now/1000-stamp;
 if(reduced||v?.stale||!Number.isFinite(stamp)||stamp<1e9||age>300||age< -30||
   (Number.isFinite(previousTimestamp)&&stamp<=previousTimestamp))return 0;
 return 650;
}
const clean=v=>v===null||v===undefined||String(v).trim()===''?null:String(v).trim();
export function platformInfo(stop,update,stops={}){
 const planned=clean(Array.isArray(stop)?stop[3]:stop?.platform_code);
 const properties=update?.stopTimeProperties??update?.stop_time_properties;
 const assigned=properties?.assignedStopId??properties?.assigned_stop_id;
 const assignedPlatform=assigned?clean(stops[assigned]?.[3]):null;
 const current=assignedPlatform??clean(properties?.platformCode??properties?.platform_code??update?.platformCode??update?.platform_code);
 return {planned,current:current??planned,changed:Boolean(current&&planned&&current!==planned),live:Boolean(current)};
}
export function trainNumber(v){return String(v?.name??v??'').match(/^(?:(?:REG|RE|RV|R|RJX|RJ|EC|IC|FR|FA|EN|S\d+)\s+|Zug\s+)?(\d{2,6})$/i)?.[1]||null}
export function aggregateDays(samples,number,days,today){
 const result=[];const dayMs=86400000,end=Date.parse(today+'T12:00:00Z');
 for(let i=days-1;i>=0;i--){const day=new Date(end-i*dayMs).toISOString().slice(0,10);
  const values=samples.filter(s=>s.number===number&&s.day===day&&Number.isFinite(s.minutes));
  result.push({day,count:values.reduce((n,s)=>n+(s.count??1),0),minutes:values.length?Math.round(values.reduce((n,s)=>n+(s.total??s.minutes),0)/values.reduce((n,s)=>n+(s.count??1),0)*10)/10:null});
 }return result;
}
export function recordObservation(samples,sample,now=Date.now()){
 if(!/^\d{2,6}$/.test(sample?.number)||!/^\d{4}-\d{2}-\d{2}$/.test(sample?.day)||!Number.isFinite(sample.minutes)||!Number.isFinite(sample.t)||sample.t>now+30000||now-sample.t>120000)return samples;
 const key=s=>[s.number,s.day].join(':');
 const old=samples.findLast(s=>key(s)===key(sample));
 const identity=sample.source+':'+sample.tripId;
 const last=old?.seen?.[identity]??(old?.source===sample.source&&old?.tripId===sample.tripId?old.t:null);
 if(last&&(sample.t<=last||sample.t-last<300000))return samples;
 const count=(old?.count??(old?1:0))+1,total=(old?.total??old?.minutes??0)+sample.minutes;
 const aggregate={...sample,count,total,minutes:total/count,seen:{...(old?.seen||{}),[identity]:sample.t}};
 return [...samples.filter(s=>key(s)!==key(sample)&&s.t>=now-31*86400000),aggregate];
}
