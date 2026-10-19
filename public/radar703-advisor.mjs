/* Radar 7.0.3: auditable timetable-based journey ranking. Not an AI model. */
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
function factors(j){
 const legs=Array.isArray(j?.legs)?j.legs:[];
 const dep=finite(j?.departure),arr=finite(j?.arrival),duration=dep===null||arr===null?null:Math.max(0,Math.round((arr-dep)/60));
 const changes=Math.max(0,legs.length-1);
 const transfers=Array.isArray(j?.transfers)?j.transfers:[];
 const risky=transfers.filter(t=>t.status==='risk').length;
 const missed=transfers.filter(t=>t.status==='missed').length;
 const walking=transfers.reduce((sum,t)=>sum+(Math.max(0,finite(t.meters)||0)),0);
 const unknown=transfers.filter(t=>!['risk','missed','possible'].includes(t.status)).length;
 return {duration,changes,risky,missed,walking,unknown};
}
export function assessJourneys(journeys=[]){
 const all=(Array.isArray(journeys)?journeys:[]).map((trip,index)=>{
  const f=factors(trip);
  const score=(f.duration??600)*0.65 +f.changes*18 +f.risky*60+f.missed*500+f.unknown*22 +f.walking/55;
  return {trip,index,score,...f};
 });
 return all.sort((a,b)=>a.score-b.score||a.trip.departure-b.trip.departure);
}
export function orderJourneys(journeys=[],mode='recommended'){
 const rows=assessJourneys(journeys);
 if(mode==='departure')return rows.sort((a,b)=>a.trip.departure-b.trip.departure||a.index-b.index);
 if(mode==='fastest')return rows.sort((a,b)=>(a.duration??Infinity)-(b.duration??Infinity)||a.score-b.score);
 if(mode==='fewest')return rows.sort((a,b)=>a.changes-b.changes||a.score-b.score);
 return rows;
}
export function explainRecommendation(entry){
 if(!entry)return 'Für eine Empfehlung fehlen Fahrplandaten.';
 const f=entry;
 if(f.missed)return 'Achtung: Mindestens ein Anschluss ist rechnerisch nicht erreichbar.';
 const parts=[];
 if(!f.changes)parts.push('ohne Umstieg');
 else parts.push(f.changes+' Umstieg'+(f.changes===1?'':'e'));
 if(f.duration!==null)parts.push(f.duration+' Min. Fahrzeit');
 if(f.risky)parts.push('knapper Anschluss laut Fahrplan');
 if(f.walking>60)parts.push('etwa '+Math.round(f.walking)+' m Luftlinie zwischen Halten');
 return parts.join(' · ')+'. Bewertung ausschließlich aus verfügbaren Fahrplandaten.';
}
export function answerLocally(question,journeys=[]){
 const list=Array.isArray(journeys)?journeys:[];
 if(!list.length)return 'Es liegen noch keine Verbindungsergebnisse vor. Suche zuerst eine Verbindung.';
 const q=String(question||'').toLocaleLowerCase('de');
 const mode=/schnell|kurz|dauer/.test(q)?'fastest':/umstieg|wenig|direkt/.test(q)?'fewest':'recommended';
 const best=orderJourneys(list,mode)[0];
 if(!best)return 'Eine belastbare Empfehlung ist gerade nicht möglich.';
 const a=best.trip;
 const time=s=>String(Math.floor(s/3600)%24).padStart(2,'0')+':'+String(Math.floor((s%3600)/60)).padStart(2,'0');
 return 'Fahrplanbasierte Empfehlung: '+time(a.departure)+'–'+time(a.arrival)+'. '+explainRecommendation(best)+' Echtzeit und tatsächliche Fußwege sind nicht garantiert. Dies ist keine Antwort eines KI-Modells.';
}
export function summarizeJourneyOptions(journeys=[]){
 return assessJourneys(journeys).slice(0,8).map((x,i)=>({
  rank:i+1,departure:x.trip.departure,arrival:x.trip.arrival,durationMinutes:x.duration,
  transfers:x.changes,riskyTransfers:x.risky,missedTransfers:x.missed,
  walkMeters:Math.round(x.walking),
  legs:(x.trip.legs||[]).slice(0,4).map(v=>({type:v.type==='train'?'train':'bus',name:String(v.name||'').slice(0,48),from:String(v.fromStop?.name||'').slice(0,60),to:String(v.toStop?.name||'').slice(0,60)}))
 }));
}