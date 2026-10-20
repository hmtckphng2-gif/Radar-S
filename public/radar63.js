/* Radar 6.3 — device-local onboarding and version synchronization */
(()=>{'use strict';
 const VERSION='7.4',KEY='sr74_tutorial_complete_v1';
 const steps={
 de:[
 {title:'Willkommen bei Radar',body:'Deine Karte für Züge und Busse in Südtirol und Trentino. Blau steht für Züge, Orange für Busse. Du kannst Fahrzeuge direkt antippen.'},
 {title:'Live bedeutet nicht immer GPS',body:'Die Datenquellen können echte Meldungen oder geschätzte Positionen liefern. Achte auf Aktualität und Datenqualität im Fahrzeugmenü.'},
 {title:'Züge und Busse finden',body:'Nutze die Filter Alle, Züge und Busse oder suche nach Zugnummer, Linie, Bahnhof oder Ziel.'},
 {title:'Ist/Soll richtig verstehen',body:'Im Zugmenü siehst du den Abstand zur Fahrplanposition. Die modellierte Zeitabweichung ist eine Schätzung, die gemeldete Verspätung kommt separat aus dem Feed.'},
 {title:'Abfahrten und Stationen',body:'Unter Abfahrten kannst du einen Bahnhof wählen. Fahrplan, Prognosen und Gleise erscheinen nur, wenn die Quelle sie tatsächlich liefert.'},
 {title:'Favoriten und Details',body:'Speichere wichtige Stationen als Favoriten. Für Verlauf, Analysen und zusätzliche Daten öffnest du die erweiterten Fahrzeugdetails.'},
 {title:'Sprache und Hilfe',body:'Mit DE / IT wechselst du zwischen Deutsch und Italienisch. Über das Intelligence-Menü kannst du dieses Tutorial jederzeit erneut starten.'}
 ],
 it:[
 {title:'Benvenuto su Radar',body:'La mappa di treni e autobus in Alto Adige e Trentino. Il blu indica i treni e l’arancione gli autobus. Tocca un veicolo per aprirne i dettagli.'},
 {title:'Tempo reale non significa sempre GPS',body:'Le fonti possono fornire segnalazioni reali o posizioni stimate. Controlla sempre aggiornamento e qualità dei dati nei dettagli del veicolo.'},
 {title:'Trova treni e autobus',body:'Usa i filtri Tutti, Treni e Autobus oppure cerca un numero di treno, una linea, una stazione o una destinazione.'},
 {title:'Come leggere effettivo e previsto',body:'Nei dettagli del treno vedi la distanza dalla posizione prevista. Lo scostamento temporale modellato è una stima; il ritardo comunicato proviene separatamente dalla fonte.'},
 {title:'Partenze e stazioni',body:'Nella sezione Partenze scegli una stazione. Orari, previsioni e binari compaiono soltanto se la fonte li fornisce davvero.'},
 {title:'Preferiti e dettagli',body:'Salva le stazioni importanti nei Preferiti. Per andamento, analisi e altri dati apri i dettagli avanzati del veicolo.'},
 {title:'Lingua e guida',body:'Usa DE / IT per passare dal tedesco all’italiano. Puoi riaprire questa guida in qualsiasi momento dal menu Intelligence.'}
 ]
 };
 const tutorialLang=()=>window.SuedtirolRadarLanguage?.get?.()==='it'?'it':'de';
 const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
 let overlay,index=0,previousFocus=null,initialized=false;
 function stored(){try{return localStorage.getItem(KEY)==='1'}catch{return false}}
 function done(){try{localStorage.setItem(KEY,'1')}catch{}close()}
 function close(){if(!overlay)return;overlay.remove();overlay=null;document.body.classList.remove('sr63-tutorial-open');previousFocus?.focus?.();previousFocus=null}
 function show(){if(!overlay)return;overlay.replaceChildren();const locale=tutorialLang(),items=steps[locale],step=items[index],dialog=make('div','sr63-tutorial-panel');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','sr63TutorialTitle');dialog.setAttribute('aria-describedby','sr63TutorialBody');const kicker=make('div','sr63-tutorial-kicker','SÜDTIROL RADAR · '+VERSION);dialog.append(kicker,make('div','sr63-tutorial-count',(locale==='it'?'PASSO ':'SCHRITT ')+(index+1)+' / '+items.length));const title=make('h2','',step.title);title.id='sr63TutorialTitle';dialog.append(title);const p=make('p','',step.body);p.id='sr63TutorialBody';dialog.append(p);const dots=make('div','sr63-tutorial-dots');for(let i=0;i<items.length;i++){const dot=make('span',i===index?'sr63-current':'');dot.setAttribute('aria-hidden','true');dots.append(dot)}dialog.append(dots);const actions=make('div','sr63-tutorial-actions');const skip=make('button','sr63-tutorial-skip',locale==='it'?'Salta':'Überspringen');skip.type='button';skip.addEventListener('click',done);actions.append(skip);if(index>0){const back=make('button','sr63-tutorial-back',locale==='it'?'Indietro':'Zurück');back.type='button';back.addEventListener('click',()=>{index--;show()});actions.append(back)}const next=make('button','sr63-tutorial-next',index===items.length-1?(locale==='it'?'Fine':'Fertig'):(locale==='it'?'Avanti':'Weiter'));next.type='button';next.addEventListener('click',()=>{if(index===items.length-1)done();else{index++;show()}});actions.append(next);dialog.append(actions);overlay.append(dialog);next.focus()}
 function openTutorial(){if(overlay){index=0;show();return}document.getElementById('sr60Pop')?.setAttribute('hidden','');previousFocus=document.activeElement;overlay=make('div','sr63-tutorial-overlay');overlay.id='sr63Tutorial';overlay.addEventListener('click',e=>{if(e.target===overlay)done()});document.body.append(overlay);document.body.classList.add('sr63-tutorial-open');index=0;show()}
 document.addEventListener('keydown',e=>{if(!overlay)return;if(e.key==='Escape'){e.preventDefault();done()}if(e.key==='Tab'){const b=[...overlay.querySelectorAll('button:not([disabled])')];if(!b.length)return;const first=b[0],last=b[b.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 function syncVersion(){const mark=document.querySelector('.brand-title em');if(mark)mark.textContent=VERSION;document.title='Südtirol Radar '+VERSION+''}
 function start(){if(initialized)return;initialized=true;syncVersion();window.addEventListener('load',syncVersion,{once:true});setTimeout(syncVersion,2200);const meta=document.querySelector('meta[name=description]');if(meta)meta.content='Südtirol Radar 6.6: Zug- und Buskarte, Station Intelligence Pro, Abfahrten, Favoriten und Einführung.';window.SuedtirolRadar63={version:VERSION,openTutorial};if(!stored())setTimeout(()=>{if(!stored())openTutorial()},1000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
