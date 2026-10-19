/* Südtirol Radar 6.0 Beta 1 — Nova: compatible presentation layer over 5.x */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const make=(tag,cls,text,on)=>{const n=el(tag,cls,text);if(on)n.addEventListener('click',on);return n};
 const svgPaths={map:'<path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',departures:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6M7 17h8"/>',stats:'<path d="M4 20V11h4v9M10 20V5h4v15M16 20v-7h4v7"/>',favorites:'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9z"/>'};
 const tabs=[['map','Karte'],['departures','Abfahrten'],['stats','Statistik'],['favorites','Favoriten']];
 function icon(id){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('aria-hidden','true');n.innerHTML=svgPaths[id];return n}
 let dock,pop,pane,initialized=false;
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 let layoutFrame=0;
 function measureLayout(){
  layoutFrame=0;
  const root=document.body;if(!root.classList.contains('sr60'))return;
  root.classList.add('sr611-layout');
  root.classList.toggle('sr611-standalone',standalone());
  // CSS env() values are resolved using an element in the current viewport.
  const probe=document.getElementById('sr611SafeProbe')||(()=>{const n=document.createElement('div');n.id='sr611SafeProbe';n.setAttribute('aria-hidden','true');n.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);height:0;width:0;';root.append(n);return n})();
  const cp=getComputedStyle(probe);
  const safeTop=Math.max(0,parseFloat(cp.paddingTop)||0);
  const safeBottom=Math.max(0,parseFloat(cp.paddingBottom)||0);
  root.style.setProperty('--sr611-safe-top',safeTop+'px');root.style.setProperty('--sr611-safe-bottom',safeBottom+'px');
  const header=document.querySelector('#sr50MapTab .topbar');const hr=header?.getBoundingClientRect();
  if(hr?.height)root.style.setProperty('--sr611-header-bottom',Math.ceil(hr.bottom)+'px');
  const dr=dock?.getBoundingClientRect();const viewport=window.visualViewport?.height||window.innerHeight;
  const viewHeight=Math.max(1,document.documentElement.clientHeight||window.innerHeight);
  root.style.setProperty('--sr611-view-height',viewHeight+'px');
  root.style.setProperty('--sr611-visible-height',Math.max(1,viewport)+'px');
  if(dr?.height)root.style.setProperty('--sr611-dock-space',Math.max(0,Math.ceil(viewHeight-dr.top))+'px');
  requestAnimationFrame(positionPill);
 }
 function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(measureLayout)}
 function setupLayout(){scheduleLayout();window.addEventListener('resize',scheduleLayout,{passive:true});window.addEventListener('orientationchange',scheduleLayout,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleLayout()});window.visualViewport?.addEventListener('resize',scheduleLayout,{passive:true});if(window.ResizeObserver){const ro=new ResizeObserver(scheduleLayout);const header=document.querySelector('#sr50MapTab .topbar');if(header)ro.observe(header);if(dock)ro.observe(dock)}setTimeout(scheduleLayout,350);setTimeout(scheduleLayout,1500)}

 function switchTab(id){const engine=window.SuedtirolRadar50;if(engine?.switchTab)engine.switchTab(id);else{const b=document.querySelector('#sr50BottomNav .sr50-nav-btn[data-tab="'+id+'"]');b?.click()};syncTabs(id);if(pop)pop.hidden=true}
 function syncTabs(fallback){if(!dock)return;const active=document.querySelector('#sr50BottomNav .sr50-nav-btn.active')?.dataset.tab||fallback||'map';for(const b of dock.querySelectorAll('[data-nova-tab]'))b.setAttribute('aria-current',b.dataset.novaTab===active?'page':'false');requestAnimationFrame(positionPill)}
 function positionPill(){if(!dock)return;const active=dock.querySelector('.sr60-navitem[aria-current="page"]');const pill=dock.querySelector('.sr61-indicator');if(!active||!pill)return;const dr=dock.getBoundingClientRect(),ar=active.getBoundingClientRect();if(!ar.width)return;pill.style.width=ar.width+'px';pill.style.height=ar.height+'px';pill.style.transform='translate3d('+(ar.left-dr.left)+'px,'+(ar.top-dr.top)+'px,0)';dock.classList.add('sr61-ready')}
 function createDock(){if($('sr60Dock'))return;dock=el('nav','sr60-dock');dock.id='sr60Dock';dock.setAttribute('aria-label','Radar Hauptnavigation');dock.append(el('span','sr61-indicator'));for(const [id,label] of tabs){const b=make('button','sr60-navitem',undefined,()=>switchTab(id));b.type='button';b.dataset.novaTab=id;b.append(icon(id),el('span','',label));dock.append(b)}document.body.append(dock);syncTabs();requestAnimationFrame(()=>requestAnimationFrame(positionPill));window.addEventListener('resize',positionPill,{passive:true});if(window.ResizeObserver)new ResizeObserver(positionPill).observe(dock);const old=$('sr50BottomNav');if(old){new MutationObserver(()=>syncTabs()).observe(old,{subtree:true,attributes:true,attributeFilter:['class']})}}
 function addOption(title,description,cb){const b=make('button','sr60-option',title,cb);b.type='button';b.append(el('small','',description));pane.append(b)}
 function close(){if(pop)pop.hidden=true}
 function createMenu(){pop=el('section','sr60-pop');pop.id='sr60Pop';pop.hidden=true;pop.setAttribute('role','dialog');pop.setAttribute('aria-modal','true');pop.setAttribute('aria-label','Radar Schnellzugriff');pane=el('div','sr60-pane');pane.append(make('button','sr60-close','✕',close),el('div','sr60-version','PROJECT NOVA · 6.6 NATIVE READY'),el('h2','','Radar Intelligence'),el('p','','Alle bisherigen Live-Daten-, Such- und Analysefunktionen bleiben erreichbar.'));pop.append(pane);document.body.append(pop);pop.addEventListener('click',e=>{if(e.target===pop)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 addOption('⌕ Universal Search','Zugnummer, Linie oder Bahnhof suchen',()=>{close();if(window.SuedtirolRadar58?.open)window.SuedtirolRadar58.open('search');else{$('search')?.focus();switchTab('map')}});
 addOption('⚠ Verkehrsintelligenz','Verspätungen, Störungen und Ausfälle',()=>{close();window.SuedtirolRadar58?.open?.('issues')});
 addOption('◎ Datenqualität','Aktualität und Herkunft der Feed-Daten',()=>{close();window.SuedtirolRadar58?.open?.('health')});
 addOption('▤ Stations & Connections','Bahnhöfe, gemeldete Zugnähe und Abfahrten',()=>{close();window.SuedtirolRadar60Intelligence?.open?.()});
 addOption('◉ Einführung & Hilfe','Kurzer interaktiver Rundgang durch Radar 6.5',()=>{close();window.SuedtirolRadar63?.openTutorial?.()});
 addOption('☆ Favoriten & Alerts','Favoriten und bestehende Alert-Einstellungen',()=>{close();window.SuedtirolRadar58?.open?.('alerts')});
 const launch=make('button','sr60-launch','✦ Intelligence',()=>{pop.hidden=false});launch.type='button';launch.id='sr60Launch';launch.setAttribute('aria-label','Intelligence Menü öffnen');document.body.append(launch);
 }
 function start(){if(initialized)return;initialized=true;document.body.classList.add('sr60');createDock();createMenu();setupLayout();const version=document.querySelector('.brand-title em');if(version)version.textContent='6.6.1';document.title='Südtirol Radar 6.6 · Native Ready Foundation';window.SuedtirolRadar60={version:'6.6',switchTab,openMenu:()=>{pop.hidden=false}};
 let tries=0;const monitor=()=>{const old=$('sr50BottomNav');if(old){old.classList.add('sr60-native-nav');syncTabs()}else if(tries++<150)setTimeout(monitor,150)};monitor();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
