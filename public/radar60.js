/* Südtirol Radar 6.0 Beta 1 — Nova: compatible presentation layer over 5.x */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const make=(tag,cls,text,on)=>{const n=el(tag,cls,text);if(on)n.addEventListener('click',on);return n};
 const svgPaths={map:'<path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',departures:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6M7 17h8"/>',stats:'<path d="M4 20V11h4v9M10 20V5h4v15M16 20v-7h4v7"/>',favorites:'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9z"/>'};
 const tabs=[['map','Karte'],['departures','Abfahrten'],['stats','Statistik'],['favorites','Favoriten']];
 function icon(id){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('aria-hidden','true');n.innerHTML=svgPaths[id];return n}
 let dock,pop,pane,initialized=false;
 function switchTab(id){const engine=window.SuedtirolRadar50;if(engine?.switchTab)engine.switchTab(id);else{const b=document.querySelector('#sr50BottomNav .sr50-nav-btn[data-tab="'+id+'"]');b?.click()};syncTabs(id);if(pop)pop.hidden=true}
 function syncTabs(fallback){if(!dock)return;const active=document.querySelector('#sr50BottomNav .sr50-nav-btn.active')?.dataset.tab||fallback||'map';for(const b of dock.querySelectorAll('[data-nova-tab]'))b.setAttribute('aria-current',b.dataset.novaTab===active?'page':'false')}
 function createDock(){if($('sr60Dock'))return;dock=el('nav','sr60-dock');dock.id='sr60Dock';dock.setAttribute('aria-label','Radar Hauptnavigation');for(const [id,label] of tabs){const b=make('button','sr60-navitem',undefined,()=>switchTab(id));b.type='button';b.dataset.novaTab=id;b.append(icon(id),el('span','',label));dock.append(b)}document.body.append(dock);syncTabs();const old=$('sr50BottomNav');if(old){new MutationObserver(()=>syncTabs()).observe(old,{subtree:true,attributes:true,attributeFilter:['class']})}}
 function addOption(title,description,cb){const b=make('button','sr60-option',title,cb);b.type='button';b.append(el('small','',description));pane.append(b)}
 function close(){if(pop)pop.hidden=true}
 function createMenu(){pop=el('section','sr60-pop');pop.id='sr60Pop';pop.hidden=true;pop.setAttribute('role','dialog');pop.setAttribute('aria-modal','true');pop.setAttribute('aria-label','Radar Schnellzugriff');pane=el('div','sr60-pane');pane.append(make('button','sr60-close','✕',close),el('div','sr60-version','PROJECT NOVA · 6.0 BETA 1'),el('h2','','Radar Intelligence'),el('p','','Alle bisherigen Live-Daten-, Such- und Analysefunktionen bleiben erreichbar.'));pop.append(pane);document.body.append(pop);pop.addEventListener('click',e=>{if(e.target===pop)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 addOption('⌕ Universal Search','Zugnummer, Linie oder Bahnhof suchen',()=>{close();if(window.SuedtirolRadar58?.open)window.SuedtirolRadar58.open('search');else{$('search')?.focus();switchTab('map')}});
 addOption('⚠ Verkehrsintelligenz','Verspätungen, Störungen und Ausfälle',()=>{close();window.SuedtirolRadar58?.open?.('issues')});
 addOption('◎ Datenqualität','Aktualität und Herkunft der Feed-Daten',()=>{close();window.SuedtirolRadar58?.open?.('health')});
 addOption('▤ Stations & Connections','Bahnhöfe und Abfahrten erkunden',()=>{close();switchTab('departures')});
 addOption('☆ Favoriten & Alerts','Favoriten und bestehende Alert-Einstellungen',()=>{close();switchTab('favorites')});
 const launch=make('button','sr60-launch','✦ Intelligence',()=>{pop.hidden=false});launch.type='button';launch.id='sr60Launch';launch.setAttribute('aria-label','Intelligence Menü öffnen');document.body.append(launch);
 }
 function start(){if(initialized)return;initialized=true;document.body.classList.add('sr60');createDock();createMenu();const version=document.querySelector('.brand-title em');if(version)version.textContent='6.0 β';document.title='Südtirol Radar 6.0 Beta 1 · Project Nova';window.SuedtirolRadar60={version:'6.0-beta1',switchTab,openMenu:()=>{pop.hidden=false}};
 let tries=0;const monitor=()=>{const old=$('sr50BottomNav');if(old){old.classList.add('sr60-native-nav');syncTabs()}else if(tries++<150)setTimeout(monitor,150)};monitor();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
