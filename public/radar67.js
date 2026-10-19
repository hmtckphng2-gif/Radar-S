/* Radar 6.7 Horizon Preview: map first, one toolbar, accessible progressive enhancement. */
(()=>{'use strict';let ready=false,panel,actions,trigger,toolsTrigger;
const svg=(paths)=>'<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
const ICON={search:svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),filter:svg('<path d="M4 7h16M7 12h10M10 17h4"/>'),layers:svg('<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>'),close:svg('<path d="M6 6l12 12M18 6 6 18"/>')};
function button(label,icon,fn,id){const b=document.createElement('button');b.type='button';b.className='rh-control';b.id=id;b.setAttribute('aria-label',label);b.title=label;b.innerHTML=icon;b.addEventListener('click',fn);return b}
function toggle(which){const box=which==='search'?panel:actions;const other=which==='search'?actions:panel;other.hidden=true;box.hidden=!box.hidden;trigger?.setAttribute('aria-expanded',String(!panel.hidden));toolsTrigger?.setAttribute('aria-expanded',String(!actions.hidden));if(!panel.hidden)document.getElementById('search')?.focus();}
function close(){if(panel)panel.hidden=true;if(actions)actions.hidden=true;trigger?.setAttribute('aria-expanded','false');toolsTrigger?.setAttribute('aria-expanded','false')}
function init(){if(ready||window.innerWidth>=750||!window.SuedtirolRadar37?.state?.map||!document.body.classList.contains('sr60'))return;const top=document.querySelector('#sr50MapTab .topbar'),filters=top?.querySelector('.controls'),row=top?.querySelector('.toprow'),originalActions=document.querySelector('#sr50MapTab .map-actions');if(!top||!filters||!row||!originalActions)return;ready=true;
// Reparent ORIGINAL controls, preserving filter/search listeners and behavior.
panel=document.createElement('section');panel.className='rh-search-panel';panel.id='rhSearchPanel';panel.hidden=true;panel.setAttribute('aria-label','Fahrzeuge filtern oder suchen');panel.append(filters);top.after(panel);
trigger=button('Suchen und filtern',ICON.search,()=>toggle('search'),'rhSearchTrigger');trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');row.append(trigger);
actions=document.createElement('section');actions.className='rh-tools-panel';actions.id='rhToolsPanel';actions.hidden=true;actions.setAttribute('aria-label','Kartenwerkzeuge');actions.append(originalActions);
toolsTrigger=button('Kartenwerkzeuge öffnen',ICON.layers,()=>toggle('tools'),'rhToolsTrigger');toolsTrigger.setAttribute('aria-controls',actions.id);toolsTrigger.setAttribute('aria-expanded','false');document.getElementById('sr50MapTab').append(toolsTrigger,actions);
// Maintain all existing feature endpoints, only rename visible entrypoint.
const launch=document.getElementById('sr60Launch');if(launch){launch.textContent='Mehr';launch.setAttribute('aria-label','Weitere Radar-Funktionen öffnen')}
document.querySelector('#sr50MapTab .brand-sub')?.replaceChildren(document.createTextNode('SÜDTIROL  /  TRENTINO'));
const words=document.querySelector('#sr50MapTab .brand-title');if(words)words.firstChild.textContent='RADAR  ';
const notice=document.getElementById('notice');if(notice&&!notice.hidden){notice.hidden=true} // still available through health
const language=document.querySelector('.sr58-language-toggle');if(language)language.setAttribute('title','Sprache');
document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==trigger&&!trigger.contains(e.target))panel.hidden=true;if(!actions.hidden&&!actions.contains(e.target)&&e.target!==toolsTrigger&&!toolsTrigger.contains(e.target))actions.hidden=true;trigger.setAttribute('aria-expanded',String(!panel.hidden));toolsTrigger.setAttribute('aria-expanded',String(!actions.hidden))});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});document.querySelectorAll('#sr50MapTab [data-filter]').forEach(b=>b.addEventListener('click',()=>{if(window.innerWidth<750)close()}));for(const btn of originalActions.querySelectorAll('button'))btn.addEventListener('click',close);
// Do not let page zoom or theme changes affect the Leaflet viewport size.
const map=window.SuedtirolRadar37.state.map;window.addEventListener('orientationchange',()=>requestAnimationFrame(()=>map.invalidateSize({pan:false})),{passive:true});
document.body.classList.add('rh-ready');window.SuedtirolRadarHorizon={version:'6.7-preview',close};}
let count=0;const timer=setInterval(()=>{init();if(ready||++count>65)clearInterval(timer)},200);document.addEventListener('sr37:ready',init);document.addEventListener('DOMContentLoaded',init);
})();
