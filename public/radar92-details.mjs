/* Shared German labels and conservative display formatting for train details. */
export function formatStationName(value){
 let raw=String(value??'').trim().replace(/[’'](?=-)|[’']$/gu,'');
 if(!raw)return 'Unbekannt';
 const letters=raw.replace(/[^\p{L}]/gu,'');
 if(!letters||letters!==letters.toLocaleUpperCase('it-IT'))return raw;
 return raw.split(/([\s-]+)/u).map(part=>{
  if(/^[\s-]+$/u.test(part))return part;
  const token=part.replace(/[’']+$/gu,'');
  if(/^[A-Z0-9]{1,3}$/u.test(token))return token;
  const lower=token.toLocaleLowerCase('it-IT');
  return lower.charAt(0).toLocaleUpperCase('it-IT')+lower.slice(1);
 }).join('');
}
export function sameStationName(a,b){
 const clean=v=>formatStationName(v).toLocaleLowerCase('it-IT').replace(/[^\p{L}\p{N}]/gu,'');
 return Boolean(a&&b&&clean(a)===clean(b));
}
export function sourceLabel(source){
 const key=String(source??'').trim().toLowerCase();
 if(key==='trains'||key==='train')return 'Zugdaten';
 if(key==='sta')return 'STA';
 if(key==='sta_direct')return 'STA direkt';
 if(key==='trentino')return 'Trentino Trasporti';
 if(key==='rfi')return 'RFI';
 if(key==='gtfs')return 'Fahrplandaten';
 if(key==='gtfs-rt')return 'Echtzeitdaten';
 return key?key.charAt(0).toUpperCase()+key.slice(1):'Unbekannt';
}
export function formatRelativeAge(seconds){
 if(seconds===null||seconds===undefined||seconds==='')return 'Unbekannt';
 const age=Number(seconds);
 if(!Number.isFinite(age)||age<0)return 'Unbekannt';
 if(age<1)return 'gerade eben';
 if(age<60)return 'vor weniger als 1 Min.';
 return 'vor '+Math.floor(age/60)+' Min.';
}
function clock(seconds){
 const total=Math.floor(Number(seconds)/60),day=Math.floor(total/1440),minute=((total%1440)+1440)%1440;
 return String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0')+(day>0?' +'+day:'');
}
export function expectedStopTime(plannedSeconds,event){
 const raw=event?.time;
 let timestamp=Number(raw);
 if(!Number.isFinite(timestamp)&&typeof raw==='string')timestamp=Date.parse(raw)/1000;
 if(Number.isFinite(timestamp)&&timestamp>1e9){
  const ms=timestamp>1e12?timestamp:timestamp*1000;
  try{return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms))}catch{}
 }
 const rawDelay=event?.delay,delay=Number(rawDelay),planned=Number(plannedSeconds);
 if(rawDelay!==null&&rawDelay!==undefined&&rawDelay!==''&&Number.isFinite(delay)&&Number.isFinite(planned))return clock(planned+delay);
 return null;
}

export function hasKnownPlatform(value){const text=String(value??'').trim();return Boolean(text&&!/^(?:[-–—]+|unbekannt|unknown|n\/?a|null|undefined)$/i.test(text));}
