/* Südtirol Radar 4.3.1 — conservative stop time validation.
 * Stops and delays are always taken from existing GTFS/GTFS-RT data.
 * This helper only suppresses a stale-looking 'next stop' claim.
 */
(function (root) {
  'use strict';
  const SECONDS_PER_DAY = 86400;
  const GRACE_SECONDS = 7 * 60;
  const MAX_LOOKAHEAD_SECONDS = 6 * 3600;
  function italyNow(nowMs) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(new Date(nowMs));
    const x = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const day = Date.UTC(Number(x.year),Number(x.month)-1,Number(x.day));
    return {day,seconds:Number(x.hour)*3600+Number(x.minute)*60+Number(x.second)};
  }
  function serviceDateUTC(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).replaceAll('-', '');
    if (!/^\d{8}$/.test(s)) return NaN;
    const year=Number(s.slice(0,4)),month=Number(s.slice(4,6)),day=Number(s.slice(6,8));
    const utc=Date.UTC(year,month-1,day);
    const iso=new Date(utc).toISOString().slice(0,10).replaceAll('-','');
    return iso===s ? utc : NaN;
  }
  function isStopCredible({scheduledSeconds,serviceDate='',delaySeconds=null,nowMs=Date.now()}={}) {
    // GTFS times may exceed 24h on a previous operating day.
    if (scheduledSeconds==null || !Number.isFinite(Number(scheduledSeconds)) ||
        Number(scheduledSeconds)<0 || !Number.isFinite(Number(nowMs))) return false;
    const now = italyNow(nowMs);
    let elapsedOnServiceDay=now.seconds;
    const startDay=serviceDateUTC(serviceDate);
    if(Number.isNaN(startDay))return false;
    if(startDay!==null){
      const days=Math.round((now.day-startDay)/86400000);
      if(days<0||days>1)return false;
      elapsedOnServiceDay+=days*SECONDS_PER_DAY;
    }else if(now.seconds<5*3600 && Number(scheduledSeconds)>=18*3600 && Number(scheduledSeconds)<SECONDS_PER_DAY){
      // Only the immediately preceding evening, not any arbitrary earlier day.
      elapsedOnServiceDay+=SECONDS_PER_DAY;
    }
    const rt=(delaySeconds!==null && delaySeconds!==undefined && Number.isFinite(Number(delaySeconds)))
      ? Number(delaySeconds) : 0;
    const prediction=Number(scheduledSeconds)+rt;
    return prediction>=elapsedOnServiceDay-GRACE_SECONDS &&
           prediction<=elapsedOnServiceDay+MAX_LOOKAHEAD_SECONDS;
  }
  root.SuedtirolRadar431Guard=Object.freeze({isStopCredible});
})(typeof window==='undefined' ? globalThis : window);
