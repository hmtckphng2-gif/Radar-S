/* Radar 6.0 — proximity and feed transparency. Never infer live ETA from distance. */
(()=>{'use strict';
const $=id=>document.getElementById(id),E=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
const btn=(name,fn)=>{const b=E('button',name,'sr60-option');b.type='button';b.addEventListener('click',fn);return b};
const km=(a,b,c,d)=>{const r=Math.PI/180,dl=(c-a)*r,do_=(d-b)*r,h=Math.sin(dl/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(do_/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)))};
const coord=o=>{if(!o)return null;const lat=Number(o.lat??o.latitude??o.stopLat??o.stop_lat),lon=Number(o.lon??o.lng??o.longitude??o.stopLon??o.stop_lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&lat!==0&&lon!==0?[lat,lon]:null};
let popup,body,stations=[],active=null,lastSource=0,alertsCache=null,alertsAt=0;
function setup(){if($('sr60Intelligence'))return;popup=E('section',undefined,'sr60-pop');popup.id='sr60Intelligence';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','true');popup.setAttribute('aria-label','Stationsintelligenz');const panel=E('div',undefined,'sr60-pane');const close=E('button','✕','sr60-close');close.addEventListener('click',()=>popup.hidden=true);panel.append(close,E('div','6.5 · LIVE STATIONS 2.0','sr60-version'),E('h2','Bahnhofs-Radar'));body=E('div');panel.append(body);popup.append(panel);popup.addEventListener('click',e=>{if(e.target===popup)popup.hidden=true});document.body.append(popup)}
function status(){const s=window.SuedtirolRadar37?.state;return s||null}
function clear(){body.replaceChildren()}
function stationPicker(){const inp=E('input');inp.type='search';inp.placeholder='Bahnhof suchen, z. B. Salurn';inp.className='sr60-input';body.append(inp);const results=E('div');body.append(results);const draw=()=>{results.replaceChildren();const q=inp.value.toLocaleLowerCase('de').trim();if(!q)return;const seen=new Set();for(const st of stations){const name=String(st.name||'');if(!name.toLocaleLowerCase('de').includes(q))continue;const id=st.source+':'+st.stopId;if(seen.has(id))continue;seen.add(id);results.append(btn(name+(st.source?' · '+st.source:''),()=>{active=st;render()}));if(seen.size>=12)break}if(!results.children.length)results.append(E('p','Keine passende Station geladen.','sr60-info'))};inp.addEventListener('input',draw);if(stations.length===0)body.append(E('p','Die Fahrplandaten werden noch geladen.','sr60-info'))}
function render(){if(!popup)return;clear();if(!active){body.append(E('p','Wähle einen Bahnhof. Die Zugnähe ist eine Luftlinienentfernung zur zuletzt gemeldeten Position — keine Ankunftsprognose.','sr60-info'));stationPicker();return}
body.append(E('h3',active.name||'Bahnhof'));body.append(btn('← Anderen Bahnhof wählen',()=>{active=null;render()}));body.append(btn('▤ Abfahrtsmonitor öffnen',()=>{popup.hidden=true;window.SuedtirolRadar50?.switchTab?.('departures');window.SuedtirolRadar57?.openStation?.(active)}));
const position=coord(active);
const summary=E('div',undefined,'sr63-station-summary');
summary.append(E('strong','Bahnhofsinformationen','sr63-summary-title'));
summary.append(E('p',position?'Standort aus dem vorhandenen Haltestellen-Feed.':'Keine verlässlichen Koordinaten vorhanden.','sr60-info'));
summary.append(E('p','Gleis-/Steigangaben erscheinen nur, wenn sie im Abfahrtsmonitor durch Daten belegt sind.','sr60-info'));
summary.append(E('p','Ankünfte und Umstiege: Noch keine vollständig verifizierte Live-Prognose für diese Station verfügbar.','sr60-info'));
body.append(summary);
// Official STA service alerts: match station stop ID; never imply a GPS arrival.
if(active?.source==='sta'||active?.source==='sta_direct'){
 const alertBox=E('div',undefined,'sr65-station-alerts');alertBox.append(E('strong','Offizielle STA-Meldungen','sr65-section-title'));alertBox.append(E('p','Lade Service Alerts …','sr60-info'));body.append(alertBox);
 const requested=active;
 Promise.resolve().then(async()=>{
  if(!alertsCache||Date.now()-alertsAt>60000){const response=await fetch('/api/sta_alerts',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Feed nicht verfügbar');const data=await response.json();alertsCache=Array.isArray(data.entity)?data.entity:[];alertsAt=Date.now()}
  if(active!==requested||!alertBox.isConnected)return;
  const stationId=String(requested.stopId||'');const matching=alertsCache.filter(e=>(e.alert?.informed_entity||[]).some(x=>String(x.stop_id||x.stopId||'')===stationId));
  alertBox.replaceChildren(E('strong','Offizielle STA-Meldungen','sr65-section-title'));
  if(!matching.length){alertBox.append(E('p','Keine stationsbezogenen Meldungen im derzeitigen STA-Feed.','sr60-info'));return}
  for(const event of matching.slice(0,4)){const translations=event.alert?.header_text?.translation||[];const msg=translations.find(t=>t.language==='de')||translations.find(t=>t.language==='it')||translations[0];alertBox.append(E('p',String(msg?.text||event.alert?.effect||'Meldung ohne Kurztext'),'sr65-alert-item'))}
 }).catch(()=>{if(alertBox.isConnected){alertBox.replaceChildren(E('strong','STA-Meldungen derzeit nicht verfügbar','sr65-section-title'))}})
}
if(position)body.append(btn('⌖ Bahnhof auf der Karte anzeigen',()=>{popup.hidden=true;window.SuedtirolRadar60?.switchTab?.('map');const m=status()?.map;if(m?.flyTo)m.flyTo(position,Math.max(m.getZoom?.()||11,14),{duration:.65});}));

const st=coord(active);const s=status(),now=Date.now();const header=E('h3','Züge in der Nähe');body.append(header);
if(!st){body.append(E('p','Keine zuverlässigen Bahnhof-Koordinaten im aktuellen Feed. Eine Entfernung wird deshalb nicht berechnet.','sr60-info'));return}
const vehicles=[...(s?.vehicles?.values?.()||[])].filter(v=>v.kind==='train'&&!v.stale&&coord(v)&&Number.isFinite(Number(v.timestamp))&&now-Number(v.timestamp)*1000>=-60000&&now-Number(v.timestamp)*1000<180000).map(v=>({v,dist:km(...st,...coord(v))})).filter(x=>x.dist<=35).sort((a,b)=>a.dist-b.dist).slice(0,16);
if(!vehicles.length){body.append(E('p','Keine aktuell gemeldeten Züge im Umkreis von 35 km. Keine Aussage über geplante Zugfahrten.','sr60-info'));return}
for(const {v,dist} of vehicles){const label=String(v.name||v.tripId||'Zug');const a=btn('🚆 '+label+' · '+dist.toFixed(1)+' km',()=>{popup.hidden=true;window.SuedtirolRadar50?.switchTab?.('map');if(Number.isFinite(Number(v.lat))&&Number.isFinite(Number(v.lon)))s?.map?.flyTo?.([v.lat,v.lon],Math.max(s.map.getZoom(),12),{duration:.7})});a.append(E('small','Quelle: '+String(v.source||'Feed')+' · letzte Meldung vor '+Math.max(0,Math.floor((now-Number(v.timestamp)*1000)/1000))+' s · keine geprüfte Fahrtrichtung'));body.append(a)}
}
async function open(){setup();popup.hidden=false;if(!stations.length){try{const a=await window.SuedtirolRadar37?.getStationList?.();stations=Array.isArray(a)?a:[]}catch{stations=[]}}render()}
function diagnostics(){const s=status(),now=Date.now();const count=[...(s?.vehicles?.values?.()||[])].filter(v=>!v.stale).length;const stamp=Number(s?.fetchedAt||0);return {vehicles:count,age:stamp?Math.floor((now-stamp)/1000):null,feedStatus:s?.statuses||{}}}
function init(){setup();window.SuedtirolRadar60Intelligence={open,diagnostics};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
