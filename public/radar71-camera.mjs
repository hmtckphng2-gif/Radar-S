import {Radar83Cinematic} from './radar83-map.mjs';
/* Radar 7.1 – Cinematic Vehicle Focus.
 * A single cancellation-aware camera, separate from feed data and marker movement.
 * On standard Leaflet (no setBearing), turn only the heading HUD; do not rotate
 * map panes with CSS and corrupt touch coordinates or marker hit testing.
 */
import {focusDuration,focusZoom,focusDistanceKm,focusHeading,validFocusPoint,shortestRotation} from './radar71-camera-logic.mjs';
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let bridge=null,map=null,initialized=false,token=0,timer=0,rotationFrame=0,active=false;
 let hud=null,previousBearing=null,visibleKey=null,animatingTurn=false,model3d=null,cinema3d=null,emergencyFallback=null;
 const mapVisible=()=>!$('sr50MapTab')?.classList.contains('sr50-map-inactive') && !document.hidden && location.hash!=='#home' && location.hash!=='#journey' && location.hash!=='#more';
 function setupHud(){
  if(hud)return;
  hud=document.createElement('div');hud.id='sr71Cinematic';hud.className='sr71-cinematic';hud.setAttribute('aria-hidden','true');
  hud.innerHTML='<div class="sr71-focus-ring"><div class="sr71-focus-reticle"></div></div><div class="sr71-focus-caption"><span id="sr71FocusTitle"></span><span id="sr71FocusQuality"></span></div><span class="sr71-heading-arrow" id="sr71HeadingArrow" hidden>➤</span>';
  $('map')?.append(hud);
 }
 function turnTo(target,duration,sequence){
  if(typeof map?.setBearing!=='function'||!Number.isFinite(target)||motion.matches)return;
  const from=typeof map.getBearing==='function'?Number(map.getBearing()):0;
  if(!Number.isFinite(from))return;
  if(previousBearing===null)previousBearing=from;
  const delta=shortestRotation(from,target),start=performance.now();
  animatingTurn=true;
  function frame(now){
   if(sequence!==token){animatingTurn=false;return}
   const t=Math.min(1,(now-start)/Math.max(1,duration)),smooth=t*t*(3-2*t);
   try{map.setBearing(from+delta*smooth)}catch{animatingTurn=false;return}
   if(t<1)rotationFrame=requestAnimationFrame(frame);else animatingTurn=false;
  }
  rotationFrame=requestAnimationFrame(frame);
 }
 function reveal(sequence){
  if(sequence!==token)return;
  clearTimeout(timer);active=false;document.body.classList.remove('sr71-focusing');
  document.body.classList.add('sr71-focused');
  const sheet=$('sheet');
  if(sheet?.classList.contains('open'))window.SuedtirolRadar42?.setVehicleSnap?.('peek');
  hud?.classList.remove('sr71-is-running');
  hud?.classList.add('sr71-is-done');
  timer=setTimeout(()=>{if(sequence===token)hud?.classList.remove('sr71-is-done')},1050);
 }
 function cancel({restore=false}={}){
  const interrupted=active;
  token++;clearTimeout(timer);cancelAnimationFrame(rotationFrame);active=false;animatingTurn=false;
  if(interrupted)try{map?.stop?.()}catch{}
  document.body.classList.remove('sr71-focusing','sr71-focused');
  hud?.classList.remove('sr71-is-running','sr71-is-done');
  if(restore&&previousBearing!==null&&typeof map?.setBearing==='function'){
   try{map.setBearing(previousBearing)}catch{}
  }
  if(restore){previousBearing=null;visibleKey=null}
  cinema3d?.close();
  model3d?.hide();document.body.classList.remove('sr82-3d-active');
 }
 function onSelection(){
  const key=bridge?.state?.selectedKey,vehicle=bridge?.state?.vehicles?.get(key);
  const marker=bridge?.state?.markers?.get(key)?.marker;
  const pos=validFocusPoint(vehicle,marker?.getLatLng?.());
  if(!vehicle||!pos||!mapVisible()){
   cancel();document.body.classList.remove('sr71-focusing');return;
  }
  const seq=++token;clearTimeout(timer);cancelAnimationFrame(rotationFrame);
  active=true;visibleKey=key;document.body.classList.add('sr71-focusing');
  document.body.classList.remove('sr71-focused');
  setupHud();
  if(hud){hud.classList.remove('sr71-is-done');hud.classList.add('sr71-is-running');}
  const title=$('sr71FocusTitle'),quality=$('sr71FocusQuality');
  if(title)title.textContent=String(vehicle.name||'Fahrzeug').slice(0,28);
  if(quality)quality.textContent=vehicle.stale?'LETZTE BEKANNTE POSITION':('FEEDPOSITION · '+String(vehicle.positionType||'KEIN GPS-NACHWEIS').slice(0,28).toUpperCase());
  const heading=focusHeading(vehicle),arrow=$('sr71HeadingArrow');
  if(arrow){arrow.hidden=heading===null;arrow.style.setProperty('--sr71-direction',((heading??0)-45)+'deg')}
  const toZoom=focusZoom(map.getZoom(),map.getMaxZoom(),vehicle.kind);
  const duration=focusDuration(motion.matches,map.getZoom(),toZoom,focusDistanceKm(map.getCenter(),pos));
  const classic=()=>{
   if(seq!==token)return;
   try{
    map.stop();
    if(motion.matches)map.setView([pos.lat,pos.lng],toZoom,{animate:false});
    else map.flyTo([pos.lat,pos.lng],toZoom,{animate:true,duration:duration/1000,easeLinearity:.22});
    if(heading!==null)turnTo(heading,duration,seq);
   }catch(error){console.info('Radar 8.2 camera fallback',error);try{map.setView([pos.lat,pos.lng],toZoom,{animate:false})}catch{}}
   timer=setTimeout(()=>{
    if(seq!==token)return;
    const nextVehicle=bridge.state.vehicles.get(key);
    const nextPos=validFocusPoint(nextVehicle,bridge.state.markers.get(key)?.marker?.getLatLng?.());
    if(nextPos)model3d?.updatePoint(nextPos,focusHeading(nextVehicle));
    if(nextPos && bridge.state.selectedKey===key)try{map.panTo([nextPos.lat,nextPos.lng],{animate:false})}catch{}
    reveal(seq);
   },duration+95);
  };
  emergencyFallback=classic;
  if(cinema3d?.enabled){
   cinema3d.open(vehicle,pos,heading,duration,toZoom).then(ok=>{
    if(seq!==token){if(ok)cinema3d?.close({sync:false});return}
    if(!ok){classic();return}
    model3d?.hide();document.body.classList.remove('sr82-3d-active');
    hud?.classList.remove('sr71-is-running');
    // The 3D camera runs in MapLibre; do NOT also fly or rotate the 2D Leaflet map.
    timer=setTimeout(()=>{if(seq===token)reveal(seq)},duration+95);
   }).catch(error=>{console.info('Radar 8.3 initialization fallback',error);classic()});
  }else classic();
 }
 function manualInterrupt(){
  if(!active)return;
  cancel();
  // Respect the user's map gesture; immediately reveal the existing panel.
  window.SuedtirolRadar42?.setVehicleSnap?.('peek');
 }
 function init(){
  if(initialized)return;
  bridge=window.SuedtirolRadar37;map=bridge?.state?.map;
  if(!map||!$('map')||!$('sheet'))return;
  initialized=true;model3d=null;
  cinema3d=new Radar83Cinematic(map,{
   onExit:()=>{
    token++;clearTimeout(timer);active=false;
    document.body.classList.remove('sr71-focusing','sr71-focused');
    hud?.classList.remove('sr71-is-running','sr71-is-done');
    window.SuedtirolRadar42?.setVehicleSnap?.('peek');
   },
   onManual:()=>{if(active)reveal(token)},
   onFailure:()=>{if(active&&emergencyFallback){clearTimeout(timer);emergencyFallback()}}
  });
  window.SuedtirolRadar71={enabled:true,cancel:()=>cancel({restore:true}),isFocusing:()=>active};
  const badge=document.querySelector('.brand-title em');if(badge)badge.textContent='7.1';
  document.title='Südtirol Radar 7.1 · Cinematic Vehicle Focus';
  setupHud();
  // Load MapLibre and Three.js only when a vehicle is selected; don't slow down the main live map.
  document.addEventListener('sr37:selection',onSelection);
  document.addEventListener('sr37:feeds',()=>{
   if(!visibleKey)return;
   const v=bridge?.state?.vehicles?.get(visibleKey);
   const m=bridge?.state?.markers?.get(visibleKey)?.marker;
   const p=validFocusPoint(v,m?.getLatLng?.());
   if(!p)return;
   if(model3d?.visible)model3d.updatePoint(p,focusHeading(v));
   if(cinema3d?.ready)cinema3d.update(v,p,focusHeading(v));
  });
  document.addEventListener('sr37:sheet-closed',()=>cancel({restore:true}));
  map.on('dragstart',manualInterrupt);
  map.getContainer().addEventListener('wheel',()=>{if(!cinema3d?.ready)manualInterrupt()},{passive:true});
  map.getContainer().addEventListener('touchstart',()=>{if(active&&!cinema3d?.ready)manualInterrupt()},{passive:true});
  // Direct manipulation: no artificial gesture delay. Keep Leaflet's native inertia.
  map.options.inertia=true;map.options.inertiaDeceleration=3400;map.options.inertiaMaxSpeed=2200;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel({restore:true})});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')cancel({restore:true})});
  window.addEventListener('hashchange',()=>{if(!mapVisible())cancel({restore:true})});
 }
 document.addEventListener('sr37:ready',init);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
