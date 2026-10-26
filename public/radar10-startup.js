/* Startup presentation only: it never owns map/feed initialization. */
(function(){
 'use strict';
 var root=document.getElementById('sr10Startup');
 if(!root)return;
 var loading=document.getElementById('sr10Loading');
 var kicker=document.getElementById('sr10StartupKicker');
 var title=document.getElementById('sr10LoadingTitle');
 var steps=document.getElementById('sr10StartupSteps');
 var errorBox=document.getElementById('sr10StartupError');
 var errorTitle=document.getElementById('sr10StartupErrorTitle');
 var errorText=document.getElementById('sr10StartupErrorText');
 var errorCode=document.getElementById('sr10StartupCode');
 var start=Date.now(),introMs=2300,timeoutMs=14000,shownLoading=false,finished=false,failed=false;
 var reduced=false;try{reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){}
 if(reduced)introMs=900;
 function state(){return window.SuedtirolRadar37&&window.SuedtirolRadar37.state||null}
 function tileCount(){var map=document.getElementById('map');return map?map.querySelectorAll('.leaflet-tile-loaded').length:0}
 function feedCount(s){var statuses=s&&s.statuses;if(!statuses||typeof statuses!=='object')return 0;return Object.keys(statuses).filter(function(k){return statuses[k]==='ok'}).length}
 function ready(){var s=state();return !!(window.L&&s&&s.map&&tileCount()>0&&(Number(s.fetchedAt)>0||feedCount(s)>0))}
 function updateSteps(){
  var s=state(),tiles=tileCount(),feeds=feedCount(s);
  var complete=[true,!!(window.L&&s&&s.map&&tiles>0),!!(s&&(Number(s.fetchedAt)>0||feeds>0))];
  var active=complete[2]?-1:complete[1]?2:complete[0]?1:0;
  Array.prototype.forEach.call(steps.querySelectorAll('li'),function(li,i){li.classList.toggle('is-done',complete[i]);li.classList.toggle('is-active',i===active);});
 }
 function beginLoading(){if(shownLoading||finished)return;shownLoading=true;loading.hidden=false;kicker.textContent='SYSTEMSTART · LIVE-STATUS';title.textContent='Live-Karte wird vorbereitet';updateSteps()}
 function showError(){failed=true;errorBox.hidden=false;var s=state(),tiles=tileCount();
  if(!window.L||!s||!s.map){errorTitle.textContent='Karte konnte nicht gestartet werden';errorText.textContent='Das Kartenmodul wurde nicht vollständig initialisiert. Du kannst es erneut versuchen.';errorCode.textContent='SR-MAP-01'}
  else if(!tiles){errorTitle.textContent='Kartenkacheln fehlen';errorText.textContent='Die Karte meldet noch keine geladenen Kacheln. Prüfe die Verbindung oder öffne die Karte trotzdem.';errorCode.textContent='SR-MAP-02'}
  else{errorTitle.textContent='Live-Daten noch nicht bestätigt';errorText.textContent='Die Karte ist verfügbar, aber der Start konnte noch keine erfolgreiche Live-Datenantwort bestätigen. Die App wird nicht weiter blockiert.';errorCode.textContent='SR-LIVE-DATA-01'}
 }
 function close(){if(finished)return;finished=true;root.classList.add('is-leaving');window.setTimeout(function(){if(root.parentNode)root.parentNode.removeChild(root)},reduced?0:500)}
 document.getElementById('sr10Continue').addEventListener('click',close);
 document.getElementById('sr10Retry').addEventListener('click',function(){window.location.reload()});
 function tick(){if(finished)return;var elapsed=Date.now()-start;if(elapsed>=introMs)beginLoading();if(shownLoading){updateSteps();if(ready()){close();return}if(elapsed>=timeoutMs){showError();title.textContent='Start braucht länger als erwartet'}}else if(elapsed>=timeoutMs){beginLoading();showError()} }
 var interval=window.setInterval(function(){tick();if(finished)window.clearInterval(interval)},250);
 // A short intro is intentional; after it, only actual readiness dismisses the screen.
 window.addEventListener('load',function(){window.setTimeout(tick,introMs)},{once:true});
 tick();
})();
