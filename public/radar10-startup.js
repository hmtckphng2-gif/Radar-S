/* Startup presentation only; it never owns map/feed initialization. */
(function(){
 'use strict';
 var root=document.getElementById('sr10Startup');if(!root)return;
 var loading=document.getElementById('sr10Loading'),kicker=document.getElementById('sr10StartupKicker'),title=document.getElementById('sr10LoadingTitle'),steps=document.getElementById('sr10StartupSteps');
 var start=Date.now(),introMs=3000,minimumMs=6200,timeoutMs=18000,shownLoading=false,finished=false,reduced=false;
 try{reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){}
 if(reduced){introMs=700;minimumMs=1200;}
 root.classList.add('is-intro');
 function state(){return window.SuedtirolRadar37&&window.SuedtirolRadar37.state||null}
 function tileCount(){var map=document.getElementById('map');return map?map.querySelectorAll('.leaflet-tile-loaded').length:0}
 function feedCount(s){var statuses=s&&s.statuses;if(!statuses||typeof statuses!=='object')return 0;return Object.keys(statuses).filter(function(k){return statuses[k]==='ok'}).length}
 function ready(){var s=state();return !!(window.L&&s&&s.map&&tileCount()>0&&(Number(s.fetchedAt)>0||feedCount(s)>0))}
 function updateSteps(){var s=state(),tiles=tileCount(),feeds=feedCount(s);var done=[true,!!(window.L&&s&&s.map&&tiles>0),!!(s&&(Number(s.fetchedAt)>0||feeds>0))];var active=done[2]?-1:done[1]?2:done[0]?1:0;Array.prototype.forEach.call(steps.querySelectorAll('li'),function(li,i){li.classList.toggle('is-done',done[i]);li.classList.toggle('is-active',i===active)})}
 function beginLoading(){if(shownLoading||finished)return;shownLoading=true;root.classList.remove('is-intro');root.classList.add('is-raised');loading.hidden=false;kicker.textContent='LIVE-VERKEHR AUS SÜDTIROL';title.textContent='Live-Karte wird vorbereitet';updateSteps()}
 function close(){if(finished)return;finished=true;root.classList.add('is-leaving');window.setTimeout(function(){if(root.parentNode)root.parentNode.removeChild(root)},reduced?0:500)}
 function tick(){if(finished)return;var elapsed=Date.now()-start;if(elapsed>=introMs)beginLoading();if(shownLoading){updateSteps();if(elapsed>=minimumMs&&ready()){close();return}if(elapsed>=timeoutMs){close();return}}}
 var interval=window.setInterval(function(){tick();if(finished)window.clearInterval(interval)},200);
 // Let the logo resolve, lift the composition, then reveal the moving train and loader.
 window.setTimeout(function(){if(!finished)root.classList.add('is-raised')},1450);
 window.addEventListener('load',function(){window.setTimeout(tick,introMs)},{once:true});tick();
})();
