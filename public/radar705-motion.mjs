/* Radar 7.0.5: conservative bounded playback between actual train feed fixes. */
export function trainReplayDuration(v,previousTimestamp,meters,now=Date.now(),reduced=false){
 const stamp=Number(v?.timestamp),prev=Number(previousTimestamp),age=now/1000-stamp;
 if(reduced||v?.stale||v?.kind!=='train'||!Number.isFinite(stamp)||stamp<1e9||
  !Number.isFinite(prev)||prev<1e9||stamp<=prev||age< -30||age>120)return 0;
 const interval=stamp-prev;
 if(interval<7||interval>90||!Number.isFinite(meters)||meters<3||meters>3000||meters/interval>85)return 0;
 return Math.max(5500,Math.min(24000,Math.round(interval*1000*.82)));
}
