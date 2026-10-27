/* Failure-only recovery for the primary live/radar map. */
(function(){
'use strict';
var timer=null,fallback=null,group=null,mode='primary',observer=null;
var element=null,status=null,notice=null;

function primaryMapReady(){
 var primary=window.SuedtirolRadar37&&window.SuedtirolRadar37.state&&window.SuedtirolRadar37.state.map;
 element=document.getElementById('map');
 if(!primary||!element||!element.isConnected||typeof primary.getContainer!=='function')return false;
 try{return primary.getContainer()===element&&!!element.querySelector('.leaflet-pane')}catch(e){return false}
}
function showStatus(message){if(status)status.textContent=message}
function stopObserver(){if(observer){observer.disconnect();observer=null}}
function fail(message){
 if(mode!=='primary')return;
 if(primaryMapReady()){mode='primary-ready';stopObserver();return}
 if(!window.L||!element)return;
 mode='recovering';
 showStatus('Kartenfehler · starte Notfallkarte …');
 try{
  var primary=window.SuedtirolRadar37&&window.SuedtirolRadar37.state&&window.SuedtirolRadar37.state.map;
  if(primary&&typeof primary.remove==='function')try{primary.remove()}catch(ignore){}
  if(element.querySelector('.leaflet-pane')){
   /* A partial primary instance may still own Leaflet handlers; do not stack maps. */
   if(element._leaflet_id){mode='failed';showStatus('Kartenfehler · bitte Seite neu öffnen');return}
   element.replaceChildren();
  }
  fallback=window.L.map(element,{zoomControl:false,attributionControl:true}).setView([46.64,11.35],9);
  window.__radarRecoveryMap=fallback;
  document.documentElement.dataset.radarBoot='recovery-map';
  element.setAttribute('data-map-mode','classic-fallback');
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(fallback);
  group=window.L.layerGroup().addTo(fallback);
  mode='fallback';
  showStatus('KLASSISCHE KARTE · NOTFALL');
  fallback.invalidateSize();
  fetchVehicles();
  timer=window.setInterval(fetchVehicles,30000);
 }catch(error){
  mode='failed';
  if(timer!==null){window.clearInterval(timer);timer=null}
  console.error('Radar recovery map error',error);
  showStatus('Kartenfehler · Notfallkarte nicht verfügbar');
 }
}
async function fetchVehicles(){
 if(mode!=='fallback'||!fallback||!group)return;
 try{
  var core=await import('/core.js?v=9.9.0');
  var names=['sta','trentino','trains','sta_direct'];
  var results=await Promise.allSettled(names.map(function(name){
   return fetch('/api/'+name,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json()});
  }));
  var count=0,trains=0,buses=0;
  group.clearLayers();
  results.forEach(function(result,i){
   if(result.status!=='fulfilled')return;
   var parsed=core.parseVehicles(result.value,names[i],{});
   (parsed&&Array.isArray(parsed.vehicles)?parsed.vehicles:[]).forEach(function(v){
    if(!Number.isFinite(Number(v.lat))||!Number.isFinite(Number(v.lon)))return;
    if(v.timestamp&&Date.now()/1000-v.timestamp>720)return;
    var train=v.kind==='train',color=train?'#6aa5ff':'#ffbd68';
    var marker=window.L.circleMarker([v.lat,v.lon],{radius:train?6:5,color:'#0a1220',weight:2,fillColor:color,fillOpacity:.95});
    marker.bindPopup((train?'Zug':'Bus')+' · '+String(v.name||'Position').replace(/[&<>]/g,'')+'<br>'+String(v.headsign||'').replace(/[&<>]/g,''));
    marker.addTo(group);count++;if(train)trains++;else buses++;
   });
  });
  showStatus(count?'NOTFALLKARTE · LIVE '+count:'NOTFALLKARTE · KEINE DATEN');
  var summary=document.querySelector('.stats');if(summary)summary.title='Recovery: '+trains+' Züge, '+buses+' Busse';
 }catch(error){console.error('Radar recovery feed error',error);showStatus('NOTFALLKARTE · FEEDS OFFLINE')}
}
function detectFailure(){
 if(mode!=='primary')return;
 if(primaryMapReady()){mode='primary-ready';stopObserver();return}
 var statusText=(status&&status.textContent||'').trim();
 var noticeText=(notice&&notice.textContent||'').trim();
 var explicitFailure=/fehler beim start|startup error|startup-error|kartenfehler|map error/i.test(statusText+' '+noticeText);
 if(explicitFailure)fail('primary startup reported failure');
}
function onScriptError(event){
 if(mode!=='primary'||primaryMapReady())return;
 var filename=String(event&&event.filename||'');
 if(/(?:^|\/)app\.js(?:\?|$)/.test(filename))fail('primary app module failed to load');
}
function init(){
 element=document.getElementById('map');status=document.getElementById('statusText');notice=document.getElementById('notice');
 document.addEventListener('sr37:ready',function(){if(primaryMapReady()){mode='primary-ready';stopObserver()}}, {once:true});
 window.addEventListener('error',onScriptError,true);
 if(window.MutationObserver&&status&&notice){observer=new MutationObserver(detectFailure);observer.observe(status,{subtree:true,childList:true,characterData:true});observer.observe(notice,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']})}
 detectFailure();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
