/* Radar 8.3.1: authoritative displayed version, never confuse an old UI release
 * with the deployed Worker version. Earlier 7.x scripts can finish fetching later.
 */
(()=>{'use strict';
 const RELEASE='8.3.1';
 const TEXT='8.3.1';
 function init(){
  document.title='Südtirol Radar 8.3.1';
  const badge=document.querySelector('.brand-title em');
  const status=document.getElementById('sr76LiveVersion');
  let message='8.3.1 · prüfe Live-Version';
  const paint=()=>{
   if(badge&&badge.textContent!==TEXT)badge.textContent=TEXT;
   if(status&&status.textContent!==message)status.textContent=message;
  };
  paint();
  if(badge)new MutationObserver(paint).observe(badge,{childList:true,characterData:true,subtree:true});
  if(status)new MutationObserver(paint).observe(status,{childList:true,characterData:true,subtree:true});
  fetch('/api/version?release='+RELEASE,{cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('server unavailable');return r.json()})
   .then(d=>{message=d.version===RELEASE?'8.3.1 · Live bestätigt':'8.3.1 · Server '+String(d.version||'unbekannt');paint()})
   .catch(()=>{message='8.3.1 · Server nicht verifiziert';paint()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
