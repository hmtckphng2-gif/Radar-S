/* Radar 7.6 – compare deployed Worker version with local UI without claiming a deployment. */
(()=>{'use strict';const RELEASE='7.6.0';
 function init(){
  const brand=document.querySelector('.brand-title')||document.querySelector('header');
  if(brand&&!document.getElementById('sr76LiveVersion')){const n=document.createElement('span');n.id='sr76LiveVersion';n.setAttribute('aria-live','polite');n.textContent='7.6 · prüfe Live-Version';brand.append(n)}
  const status=document.getElementById('sr76LiveVersion');
  fetch('/api/version?check='+encodeURIComponent(RELEASE),{cache:'no-store',headers:{accept:'application/json'}})
   .then(async r=>{if(!r.ok)throw Error('version unavailable');return r.json()})
   .then(v=>{if(status)status.textContent=v.version===RELEASE?'7.6 · Live bestätigt':'7.6 · Server '+String(v.version||'unbekannt');document.documentElement.dataset.sr76VersionMatch=v.version===RELEASE?'yes':'no'})
   .catch(()=>{if(status)status.textContent='7.6 · Live nicht verifiziert'});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
