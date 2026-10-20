/* Radar 8.3.1 recovery diagnostics, safe without any ES-module imports.
   Only shows an explanation when the original Leaflet map never starts. */
(function(){
 'use strict';
 var problems=[];
 function note(code){if(code&&problems.length<3)problems.push(String(code).slice(0,120))}
 window.addEventListener('error',function(e){
  var t=e.target;
  if(t&&t!==window&&(t.src||t.href))note('Ressource: '+String(t.src||t.href).split('/').pop().split('?')[0]);
  else if(e.message)note('JavaScript: '+e.message);
 },true);
 window.addEventListener('unhandledrejection',function(e){
  var x=e.reason;note('Modul: '+(x&&x.message?x.message:'Startfehler'));
 });
 function check(){
  var container=document.getElementById('map');
  if(!container||window.SuedtirolRadar37?.state?.map||container.querySelector('.leaflet-map-pane'))return;
  var status=document.getElementById('statusText');
  if(status)status.textContent='KARTENFEHLER';
  var box=document.createElement('aside');
  box.id='sr831BootError';box.setAttribute('role','alert');
  box.style.cssText='position:absolute;z-index:1200;left:12px;right:12px;top:34%;padding:18px;border:1px solid #a65a62;border-radius:16px;background:#141d29f2;color:#f9f0f1;font:500 13px/1.5 system-ui;text-align:center;box-shadow:0 12px 32px #0009';
  var title=document.createElement('strong');title.textContent='Karte konnte nicht gestartet werden';title.style.fontSize='15px';box.append(title);
  var description=document.createElement('p');
  var why=!window.L?'Leaflet-Kartenbibliothek nicht geladen':problems.length?problems.join(' · '):'Karten-Hauptmodul nicht gestartet';
  description.textContent=why;box.append(description);
  var reload=document.createElement('button');reload.type='button';reload.textContent='Neu laden';
  reload.style.cssText='border:1px solid #5e84ac;border-radius:9px;background:#244568;color:white;padding:10px 22px;font:600 13px system-ui';
  reload.addEventListener('click',function(){location.reload()});box.append(reload);
  container.append(box);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(check,14000)},{once:true});
 else setTimeout(check,14000);
})();
