/* Südtirol Radar 4.0 – progressive enhancement; no fabricated GPS or RT data. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 let bridge, map, trailLayer, started=false, lastKey='', lastDataTime=0;
 const history=new Map(); // Observed locations only; session memory, NOT extrapolations.
 const SETTINGS_KEY='sr40-settings';
 const defaults={arrows:true,trails:true,delays:true,compact:false,onlyLate:false};
 let settings={...defaults};
 try {const v=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');for(const k of Object.keys(defaults))if(typeof v[k]==='boolean')settings[k]=v[k];}catch{}
 const save=()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}};
 function mk(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
 function updateFor(v){if(!v?.tripId)return null;const u=bridge.state.updates.get(v.source+':'+v.tripId);
  if(!u||Date.now()-u.fetchedAt>120000)return null;
  if(/^(CANCELED|CANCELLED|3)$/i.test(String(u.scheduleRelationship||'')))return {kind:'cancel',text:'Entfällt'};
  const d=u.delay;if(d==null||!Number.isFinite(Number(d)))return null;
  const n=Math.round(Number(d)/60);return {kind:n>=10?'high':n>=5?'medium':n>=1?'low':'on-time',text:(n>0?'+':'')+n+' Min.',minutes:n};
 }
 function fresh(v){return !!v&&!v.stale&&!!v.timestamp&&Date.now()/1000-v.timestamp<=300&&Date.now()/1000-v.timestamp>=-30;}
 function updatePositions(){if(!bridge)return;const s=bridge.state, now=Date.now();
  // Once per new completed feed refresh, not every render or animation frame.
  if(s.fetchedAt&&s.fetchedAt!==lastDataTime){lastDataTime=s.fetchedAt;
   for(const [key,v] of s.vehicles){if(!fresh(v))continue;
    const points=history.get(key)||[];const last=points.at(-1);
    // A stationary vehicle is not a new track point.
    if(!last||Math.hypot((v.lat-last.lat)*111000,(v.lon-last.lon)*75000)>8){points.push({lat:v.lat,lon:v.lon,time:now});}
    history.set(key,points.slice(-70));
   }
   for(const [key,points] of history)if(!s.vehicles.has(key)&&now-(points.at(-1)?.time||0)>3600000)history.delete(key);
  }
  // Annotate existing markers without changing Leaflet marker keys or touch handling.
  for(const [key,entry] of s.markers){const v=s.vehicles.get(key);if(!v)continue;
   const node=entry.marker.getElement();if(!node)continue;
   node.classList.toggle('sr40-unfresh',!fresh(v));
   const wrap=node.querySelector('.marker-wrap');if(!wrap)continue;
   let bearing=wrap.querySelector('.sr40-heading');
   if(!bearing){bearing=mk('span','sr40-heading','➤');bearing.setAttribute('aria-hidden','true');wrap.append(bearing);}
   const dir=v.bearing == null ? NaN : Number(v.bearing);bearing.hidden=!settings.arrows||!fresh(v)||!Number.isFinite(dir);
   if(!bearing.hidden)bearing.style.transform='translateX(-50%) rotate('+(dir-90)+'deg)';
   let pill=wrap.querySelector('.sr40-delay');if(!pill){pill=mk('span','sr40-delay');wrap.append(pill);}
   const d=updateFor(v);pill.hidden=!settings.delays||!d||!fresh(v);
   pill.className='sr40-delay '+(d?.kind||'unknown');pill.textContent=d?.text||'';
   const hide=settings.onlyLate&&(!d||!['low','medium','high'].includes(d.kind));
   node.style.display=hide?'none':'';
  }
  renderTrail();renderDelayDetail();updateStatus();
 }
 function renderTrail(){if(!trailLayer||!bridge)return;const s=bridge.state;const key=s.selectedKey;
  if(key===lastKey&&trailLayer.getLayers().length&&!settings.trails)return;
  lastKey=key;trailLayer.clearLayers();if(!settings.trails||!key)return;
  const pts=history.get(key)||[];if(pts.length<2)return;
  L.polyline(pts.map(p=>[p.lat,p.lon]),{color:'#fbbf24',weight:4,opacity:.9,dashArray:'5 7',interactive:false}).addTo(trailLayer);
 }
 function renderDelayDetail(){const card=$('radar40Delay');if(!card||!bridge)return;
  const v=bridge.state.vehicles.get(bridge.state.selectedKey);
  if(!v||!$('sheet')?.classList.contains('open')){card.hidden=true;return;}
  const delay=updateFor(v);card.hidden=false;card.className='sr40-detail '+(delay?.kind||'unknown');
  card.textContent=delay?'Verspätung: '+delay.text:'Verspätung: Keine bestätigten Echtzeitdaten';
  if(!fresh(v))card.textContent+=' · Position nicht aktuell';
 }
 function updateStatus(){const el=$('radar40FeedNote');if(!el||!bridge)return;
  const s=bridge.state;const failed=['sta','trentino','trains'].filter(k=>s.statuses[k]!=='ok');
  el.hidden=!failed.length;
  el.textContent=failed.length?'Kein aktueller Positionsfeed: '+failed.join(', ')+' · Keine Live-Position erfinden.':'';
 }
 function settingsUI(){const parent=mk('div','sr40-settings');parent.id='radar40Settings';parent.hidden=true;
  const header=mk('div','sr40-settings-head');header.append(mk('strong','','Radar 4.0 · Einstellungen'));
  const close=mk('button','sr40-close','×');close.setAttribute('aria-label','Einstellungen schließen');close.onclick=()=>parent.hidden=true;header.append(close);parent.append(header);
  const labels={arrows:'Fahrtrichtung anzeigen',trails:'Empfangene Fahrspur anzeigen',delays:'Verspätungsfarben auf Markern',compact:'Kompakte Karte',onlyLate:'Nur verspätete Fahrzeuge'};
  for(const [key,label] of Object.entries(labels)){
   const row=mk('label','sr40-setting-row');const span=mk('span','',label);const check=document.createElement('input');check.type='checkbox';check.checked=settings[key];
   check.onchange=()=>{settings[key]=check.checked;save();document.documentElement.classList.toggle('sr40-compact',settings.compact);updatePositions();};row.append(span,check);parent.append(row);
  }
  parent.append(mk('p','sr40-muted','Gelbe gestrichelte Fahrspur = nur in dieser Sitzung empfangene Positionen. Keine historischen GPS-Daten. Ohne bestätigte Echtzeitmeldung bleibt die Verspätung neutral.'));
  document.body.append(parent);
  const button=mk('button','sr40-launch','⚙');button.id='radar40Open';button.title='Radar 4.0 Einstellungen';button.setAttribute('aria-label','Radar-Einstellungen');button.onclick=()=>parent.hidden=!parent.hidden;document.body.append(button);
 }
 function start(){if(started)return;bridge=window.SuedtirolRadar37;map=bridge?.state?.map;
  if(!map||!window.L)return;started=true;
  const pane=map.createPane('sr40-history');pane.style.zIndex='445';pane.style.pointerEvents='none';
  trailLayer=L.layerGroup().addTo(map);
  const scroller=$('sheet')?.querySelector('.sheet-scroll');if(scroller){const badge=mk('div','sr40-detail unknown');badge.id='radar40Delay';badge.hidden=true;scroller.prepend(badge);}
  const note=mk('div','sr40-feednote');note.id='radar40FeedNote';note.hidden=true;document.body.append(note);
  settingsUI();document.documentElement.classList.toggle('sr40-compact',settings.compact);
  document.addEventListener('sr40:feeds',updatePositions);
  document.addEventListener('sr40:selection',()=>{lastKey='';setTimeout(updatePositions,0);});
  document.addEventListener('sr37:selection',()=>{lastKey='';setTimeout(updatePositions,0);});
  document.addEventListener('sr37:sheet-closed',updatePositions);
  const brand=document.querySelector('.brand-title em');if(brand)brand.textContent='4.0';document.title='Südtirol Radar 4.0 · Züge & Busse';
  setInterval(()=>{if(!document.hidden)updatePositions();},4000);
  updatePositions();
 }
 document.addEventListener('sr37:ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
