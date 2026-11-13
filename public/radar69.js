/* Südtirol Radar 6.9 – Project Horizon Foundation.
 * Additive modules; does not change incoming GTFS data or existing vehicle markers.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const E=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
const label=(v)=>String(v?.name||v?.line||'Unbekannt').slice(0,28);
let bridge=null,open=false,station=null,pending=false;
function snapshot(){
 const values=[...(bridge?.state?.vehicles?.values()||[])];
 const counted=values.filter(v=>!v.stale&&Number.isFinite(+v.lat)&&Number.isFinite(+v.lon));
 const trains=counted.filter(v=>v.kind==='train'),buses=counted.filter(v=>v.kind==='bus');
 const lines=new Map();
 for(const v of counted){const line=label(v),kind=v.kind;const k=kind+':'+line;const old=lines.get(k)||{name:line,kind,count:0};old.count++;lines.set(k,old)}
 return {all:counted.length,trains:trains.length,buses:buses.length,unknown:counted.length-trains.length-buses.length,lines:[...lines.values()].sort((a,b)=>b.count-a.count).slice(0,16)};
}
function network(){
 const p=$('sr69Network');if(!p)return;
 const s=snapshot();p.replaceChildren();
 const title=E('div','sr69-panel-title');title.append(E('strong','','Netzwerkübersicht'),E('small','','Gemeldete Fahrzeugpositionen · keine vollständige Netzabdeckung'));p.append(title);
 const stats=E('div','sr69-counts');
 for(const [name,n] of [['Fahrzeuge',s.all],['Züge',s.trains],['Busse',s.buses]]){const item=E('div','sr69-count');item.append(E('strong','',String(n)),E('span','',name));stats.append(item)}p.append(stats);
 if(s.unknown)p.append(E('p','sr69-note',s.unknown+' Fahrzeuge ohne eindeutig erkannten Typ'));
 const section=E('div','sr69-lines');section.append(E('h3','','Häufig gemeldete Linien'));
 if(!s.lines.length)section.append(E('p','sr69-note','Noch keine verwertbaren Positionsdaten'));
 for(const v of s.lines){const row=E('div','sr69-line');row.append(E('span',v.kind==='train'?'sr69-train':'sr69-bus',v.name),E('small','',v.count+' gemeldete Fahrzeuge'));section.append(row)}
 p.append(section);
 p.append(E('p','sr69-note','Anzahlen beruhen auf vorhandenen Feedpositionen. Sie sind keine garantierte Auslastungs- oder Pünktlichkeitsstatistik.'));
}
function initNetwork(){
 const host=$('sr50StatsView')||document.body;
 if($('sr69Network'))return;
 const wrap=E('section','sr69-network');wrap.id='sr69Network';
 if(host===document.body){wrap.hidden=true;host.append(wrap)}else host.append(wrap);
 network();
}
function initStation(){
 const host=$('stationSheet')?.querySelector('.sheet-scroll');if(!host||$('sr69StationQuick'))return;
 const card=E('section','sr69-station-quick');card.id='sr69StationQuick';
 card.append(E('strong','','Bahnhof · Schnellübersicht'));
 const meta=E('p','sr69-note','Abfahrten und Gleise werden in den bestehenden Stationsdaten angezeigt, sofern vorhanden.');
 card.append(meta);
 host.prepend(card);
}
function pwa(){
 let bar=$('sr69Connection');if(bar)return;
 bar=E('div','sr69-connection');bar.id='sr69Connection';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');document.body.append(bar);
 const refresh=()=>{
  const offline=navigator.onLine===false;const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  bar.textContent=offline?'Offline · letzte verfügbare Daten':standalone?'App-Modus':'';
  bar.hidden=!offline;
  document.body.classList.toggle('sr69-offline',offline);
 };
 window.addEventListener('online',refresh);window.addEventListener('offline',refresh);refresh();
}
function schedule(){
 if(pending||document.hidden)return;pending=true;
 const cb=()=>{pending=false;if(document.visibilityState==='visible'){if(open)network();}};
 if('requestIdleCallback' in window)requestIdleCallback(cb,{timeout:1200});else setTimeout(cb,180);
}
function init(){
 bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.vehicles){setTimeout(init,350);return}
 document.body.classList.add('sr69-ready');
 initNetwork();initStation();pwa();
 const stats=$('sr50StatsView');
 if(stats){const ob=new MutationObserver(()=>{if(stats.classList.contains('active')){open=true;schedule()}else open=false});ob.observe(stats,{attributes:true,attributeFilter:['class']});open=stats.classList.contains('active')}
 document.addEventListener('sr37:feeds',schedule);
 document.addEventListener('visibilitychange',schedule);
 window.SuedtirolRadar69={networkSnapshot:snapshot,refreshNetwork:network};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();