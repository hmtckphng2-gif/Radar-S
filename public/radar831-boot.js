/* Radar 8.3.2 startup watchdog: distinguish missing module, slow feeds and
 * missing map tiles. Does not invent vehicle positions or replace app logic.
 */
(function(){
 'use strict';
 var errors=[],started=Date.now(),box=null;
 var stage='warten-auf-module';
 function record(message){
  if(!message||errors.length>=3)return;
  errors.push(String(message).slice(0,140));
 }
 window.addEventListener('error',function(event){
  var t=event.target;
  if(t&&t!==window&&(t.src||t.href)){
   record('Ressource: '+String(t.src||t.href).split('/').pop().split('?')[0]);
  }else if(event.message)record('JavaScript: '+event.message);
 },true);
 window.addEventListener('unhandledrejection',function(event){
  var err=event.reason;
  record('Modul: '+(err?.message||'Startvorgang fehlgeschlagen'));
 });
 function diagnostic(){
  var state=window.SuedtirolRadar37?.state;
  var map=document.getElementById('map');
  var leaflets=map?.querySelectorAll('.leaflet-tile-loaded').length||0;
  var vehicles=state?.vehicles?.size||0;
  var markers=state?.markers?.size||0;
  var waited=Math.round((Date.now()-started)/1000);
  stage=state?.bootPhase||(!window.L?'kartenbibliothek-fehlt':state?'vor-kartenstart':'hauptmodul-fehlt');
  var realFetch=Number(state?.fetchedAt)||0;
  var good=Object.values(state?.statuses||{}).filter(function(v){return v==='ok'}).length;
  var tab=document.getElementById('sr50MapTab');
  var mapVisible=!!tab&&!tab.classList.contains('sr50-map-inactive');
  // Distinguish broken tiles from missing realtime feeds. Both can make the
  // screenshot look empty. Never claim missing buses merely due to no service.
  if(realFetch>0 && waited>=11 && mapVisible && leaflets===0){
   return {ok:false,detail:'Keine Kartenkacheln geladen · '+markers+' Marker · '+good+' Datenquellen erreichbar',waited:waited};
  }
  if(realFetch>0 && waited>=11 && !good && !vehicles){
   return {ok:false,detail:'Alle Echtzeitfeeds unerreichbar · '+stage,waited:waited};
  }
  if(realFetch>0){
   return {ok:true,detail:'Daten geprüft · '+vehicles+' Fahrzeuge · '+markers+' Kartenmarker · '+leaflets+' Kartenkacheln'};
  }
  return {ok:false,detail:'Phase '+stage+' · '+waited+'s · '+markers+' Marker · '+leaflets+' Kacheln',waited:waited};
 }
 function remove(){
  if(box){box.remove();box=null}
 }
 function show(detail){
  var map=document.getElementById('map');
  if(!map||box)return;
  box=document.createElement('aside');
  box.id='sr831BootError';box.setAttribute('role','status');
  box.style.cssText='position:fixed;z-index:2147483640;left:14px;right:14px;top:37%;padding:16px;border:1px solid #6b88a1;border-radius:16px;background:#121d2aef;color:#eef4fc;font:500 13px/1.5 system-ui;text-align:center;box-shadow:0 12px 36px #000b';
  var title=document.createElement('strong');
  title.textContent='Radar wartet beim Start';title.style.fontSize='15px';box.append(title);
  var info=document.createElement('p');info.id='sr831BootInfo';info.style.cssText='color:#bdcddd;overflow-wrap:anywhere';info.textContent=detail;box.append(info);
  var note=document.createElement('p');note.style.fontSize='11px';note.id='sr831BootCauses';
  note.textContent=errors.join(' · ')||'Noch keine Browser-Fehlermeldung erfasst';box.append(note);
  var debug=document.createElement('div');debug.style.cssText='font-size:11px;color:#9db6d0;overflow-wrap:anywhere';
  debug.textContent='Diagnose: '+(document.documentElement.dataset.radarBoot||'kein Modulstart')+' · Leaflet '+(window.L?'geladen':'fehlt')+' · '+location.pathname;
  box.append(debug);
  var btn=document.createElement('button');btn.type='button';btn.textContent='Erneut versuchen';
  btn.style.cssText='border:1px solid #638db3;border-radius:10px;background:#234666;color:white;padding:9px 16px;font:600 13px system-ui';
  btn.addEventListener('click',function(){location.reload()});box.append(btn);
  map.append(box);
 }
 function tick(){
  var d=diagnostic();
  if(d.ok){remove();return true}
  if(d.waited>=8){
   var node=document.getElementById('sr831BootInfo');
   if(node)node.textContent=d.detail;
   var causes=document.getElementById('sr831BootCauses');
   if(causes)causes.textContent=errors.join(' · ')||'Noch keine Browser-Fehlermeldung erfasst';
   if(!box)show(d.detail);
  }
  return false;
 }
 function start(){
  var attempts=0;
  var timer=setInterval(function(){
   if(tick()||++attempts>=30)clearInterval(timer);
  },1000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
