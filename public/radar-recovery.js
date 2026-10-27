/* Minimal independent recovery when the main module cannot initialize. */
(function(){
'use strict';
var timer=null, fallback=null, group=null;

/*
 * The normal live/radar map always has priority. Do not start the classic
 * Leaflet recovery map merely because a global state object exists: the map
 * must still be attached to the visible map element and have rendered panes.
 */
function primaryMapReady(){
 var primary=window.SuedtirolRadar37&&window.SuedtirolRadar37.state&&window.SuedtirolRadar37.state.map;
 var element=document.getElementById('map');
 if(!primary||!element||!element.isConnected)return false;
 try{
  if(typeof primary.getContainer==='function'&&primary.getContainer()!==element)return false;
  return !!element.querySelector('.leaflet-pane');
 }catch(e){return false}
}
function start(){
 if(primaryMapReady() || fallback || !window.L)return;
 var element=document.getElementById('map');
 if(!element)return;
 try{
  /* If the primary renderer left a partial Leaflet instance behind, remove
     it before constructing the classic fallback on the same DOM element. */
  var primary=window.SuedtirolRadar37&&window.SuedtirolRadar37.state&&window.SuedtirolRadar37.state.map;
  if(primary&&typeof primary.remove==='function'){
   try{primary.remove()}catch(ignore){}
  }
  if(element._leaflet_id && window.L.DomUtil && typeof window.L.DomUtil.get==='function'){
   /* Leaflet's own remove() normally clears this; never delete internal IDs
      ourselves, because that can leave handlers attached to the element. */
   if(element.querySelector('.leaflet-pane'))return;
  }
  fallback=L.map(element,{zoomControl:false,attributionControl:true}).setView([46.64,11.35],9);
  window.__radarRecoveryMap=fallback;
  document.documentElement.dataset.radarBoot='recovery-map';
  element.setAttribute('data-map-mode','classic-fallback');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(fallback);
  group=L.layerGroup().addTo(fallback);
  setTimeout(function(){fallback.invalidateSize()},400);
  var badge=document.getElementById('statusText');if(badge)badge.textContent='KLASSISCHE KARTE · NOTFALL';
  fetchVehicles();
  timer=setInterval(fetchVehicles,30000);
 }catch(e){console.error('Radar recovery map error',e)}
}
async function fetchVehicles(){
 if(!fallback||!group)return;
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
   var vehicles=core.parseVehicles(result.value,names[i],{}).vehicles;
   vehicles.forEach(function(v){
    if(v.timestamp&&Date.now()/1000-v.timestamp>720)return;
    var train=v.kind==='train';
    var color=train?'#6aa5ff':'#ffbd68';
    var marker=L.circleMarker([v.lat,v.lon],{radius:train?6:5,color:'#0a1220',weight:2,fillColor:color,fillOpacity:.95});
    marker.bindPopup((train?'Zug':'Bus')+' · '+String(v.name||'Position').replace(/[&<>]/g,'')+'<br>'+String(v.headsign||'').replace(/[&<>]/g,''));
    marker.addTo(group);count++;if(train)trains++;else buses++;
   });
  });
  var status=document.getElementById('statusText');if(status)status.textContent=count?'NOTFALLKARTE · LIVE '+count:'NOTFALLKARTE · KEINE DATEN';
  var summary=document.querySelector('.stats');if(summary)summary.title='Recovery: '+trains+' Züge, '+buses+' Busse';
 }catch(e){console.error('Radar recovery feed error',e);var s=document.getElementById('statusText');if(s)s.textContent='NOTFALLKARTE · FEEDS OFFLINE'}
}
window.addEventListener('load',function(){setTimeout(start,6500)});
})();
