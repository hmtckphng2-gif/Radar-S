/* Radar 8.4 - the single authority for the version shown in the app.
 *
 * Why this module exists: five legacy modules (radar76, radar77, radar78,
 * radar79 and radar80) used to write the brand badge, the document title and
 * the live-version status, each with its own hardcoded number. Their
 * asynchronous version checks raced each other, so the app could display
 * "7.6", "7.8" or "8.3.2" depending on which network response arrived last.
 *
 * Rules for this release:
 * 1. The deployed Worker is the single source of truth. /api/version is kept
 *    in sync with package.json by the deploy workflow, so the server value is
 *    what the user is actually talking to.
 * 2. BUILD is only the marker of the loaded UI bundle. It is compared against
 *    the server value to detect a stale cached asset and is never presented
 *    as the app version.
 * 3. The brand badge, the document title and the live-version status are owned
 *    here and restored if a legacy module writes them.
 */
(()=>{'use strict';
 const BUILD='9.6.0';
 const TITLE_PREFIX='Südtirol Radar ';
 const $=id=>document.getElementById(id);
 let serverVersion=null,serverChecked=false;
 const shown=()=>serverVersion||BUILD;
 const statusText=()=>{
  if(!serverChecked)return BUILD+' · prüfe Live-Version';
  if(!serverVersion)return BUILD+' · Live nicht verifiziert';
  if(serverVersion===BUILD)return BUILD+' · Live bestätigt';
  return BUILD+' → Server '+serverVersion+' · lokaler Stand veraltet';
 };
 const paint=()=>{
  const badge=document.querySelector('.brand-title em');
  if(badge&&badge.textContent!==shown())badge.textContent=shown();
  const status=$('sr76LiveVersion');
  if(status&&status.textContent!==statusText())status.textContent=statusText();
  // The stations monitor shows a second version label. It is owned here too.
  const monitor=document.querySelector('.sr57-version');
  if(monitor&&monitor.textContent!==shown())monitor.textContent=shown();
 };
 const ensureStatus=()=>{
  const existing=$('sr76LiveVersion');
  if(existing)return existing;
  const brand=document.querySelector('.brand-title')||document.querySelector('header');
  if(!brand)return null;
  const status=document.createElement('span');
  status.id='sr76LiveVersion';
  status.setAttribute('aria-live','polite');
  brand.append(status);
  return status;
 };
 const protect=node=>{
  if(!node)return;
  new MutationObserver(paint).observe(node,{childList:true,characterData:true,subtree:true});
 };
 // The single place that knows the version. Other modules ask instead of
 // writing their own number into the badge.
 window.SuedtirolRadar80={version:()=>shown()};
 function init(){
  ensureStatus();
  document.title=TITLE_PREFIX+shown();
  paint();
  protect(document.querySelector('.brand-title em'));
  protect($('sr76LiveVersion'));
  // A legacy module may still set document.title. Changing the <title> element
  // is a DOM mutation, so the canonical title is restored right afterwards.
  const title=document.querySelector('title');
  if(title)new MutationObserver(()=>{
   const want=TITLE_PREFIX+shown();
   if(document.title!==want)document.title=want;
  }).observe(title,{childList:true,characterData:true,subtree:true});
  fetch('/api/version?build='+encodeURIComponent(BUILD),{cache:'no-store',headers:{accept:'application/json'}})
   .then(r=>{if(!r.ok)throw Error('version unavailable');return r.json()})
   .then(data=>{
    serverChecked=true;
    if(typeof data?.version==='string'&&data.version)serverVersion=data.version;
    document.documentElement.dataset.sr76VersionMatch=!serverVersion?'unknown':serverVersion===BUILD?'yes':'no';
    document.title=TITLE_PREFIX+shown();
    paint();
   })
   .catch(()=>{
    serverChecked=true;
    document.documentElement.dataset.sr76VersionMatch='unknown';
    paint();
   });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
