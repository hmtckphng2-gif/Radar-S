/* Radar 7.2: prevent Leaflet zoom vector blow-up and nested iOS scroll capture.
   Never change vehicle coordinates or live-feed status. */
(()=>{'use strict';
 let map,zoomTimer;
 function init(){
  map=window.SuedtirolRadar37?.state?.map;
  if(!map){setTimeout(init,450);return}
  const body=document.body;
  map.on('zoomstart',()=>{body.classList.add('sr72-map-zooming');clearTimeout(zoomTimer)});
  const end=()=>{clearTimeout(zoomTimer);zoomTimer=setTimeout(()=>body.classList.remove('sr72-map-zooming'),180)};
  map.on('zoomend',end);map.on('moveend',end);
  for(const id of ['sheet','stationSheet']){
   const sheet=document.getElementById(id);
   if(!sheet)continue;
   const scroll=sheet.querySelector('.sheet-scroll');
   if(!scroll)continue;
   // Let vertical gestures within content scroll the list, not the map.
   scroll.addEventListener('touchmove',e=>{e.stopPropagation()},{passive:true});
   scroll.addEventListener('wheel',e=>{e.stopPropagation()},{passive:true});
   scroll.addEventListener('touchstart',e=>{e.stopPropagation()},{passive:true});
   scroll.addEventListener('pointerdown',e=>{e.stopPropagation()},{passive:true});
  }
  const badge=document.querySelector('.brand-title em');if(badge)badge.textContent='7.2';
  document.title='Südtirol Radar 7.2';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
