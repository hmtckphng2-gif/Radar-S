/* Radar 5.8.2 – German / Italian interface localization */
(()=>{
'use strict';
const KEY='sr58_locale_v1';
let lang='de';
try{lang=localStorage.getItem(KEY)==='it'?'it':'de'}catch{}
const terms={
'Karte':'Mappa','Abfahrten':'Partenze','Statistik':'Statistiche','Favoriten':'Preferiti',
'Alle':'Tutti','Züge':'Treni','Busse':'Autobus','Zug':'Treno','Bus':'Autobus',
'FAHRPLAN · SÜDTIROL':'ORARI · ALTO ADIGE','NETWORK INTELLIGENCE':'INTELLIGENCE DI RETE',
'AUSGEWÄHLTER BAHNHOF':'STAZIONE SELEZIONATA','ABFAHRTEN · NÄCHSTE 4 STUNDEN':'PARTENZE · PROSSIME 4 ORE',
'Fahrten':'corse','Fahrt':'corsa','Nur Fahrplan':'Solo orario',
'Verkehrsstörungen':'Problemi al traffico','VERKEHRSSTÖRUNGEN':'PROBLEMI AL TRAFFICO',
'Details ›':'Dettagli ›','Details':'Dettagli',
'Störungen':'Disservizi','Netzwerk':'Rete','Anschlüsse':'Coincidenze',
'Fahrzeuge':'Veicoli','Suche':'Cerca','Alarme':'Avvisi','Daten':'Dati',
'Aktuelle Störungen':'Disservizi attuali','Netzwerk-Radar':'Radar della rete',
'Feed Health Center':'Stato delle fonti dati','Fahrzeug-Explorer':'Esplora veicoli',
'Globale Suche':'Ricerca globale','Benachrichtigungen':'Notifiche',
'Live-Benachrichtigungen':'Notifiche in tempo reale',
'Keine aktuelle Meldung':'Nessuna segnalazione attuale',
'Keine auswertbaren Störungsmeldungen':'Nessuna segnalazione analizzabile',
'Keine passenden Einträge in den aktuell geladenen Daten.':'Nessun risultato nei dati caricati.',
'Fahrt auswählen …':'Seleziona una corsa …',
'Bahnhof oder Haltestelle':'Stazione o fermata',
'Haltestelle oder Bahnhof':'Fermata o stazione',
'Verspätungen':'Ritardi','Verspätung':'Ritardo','Ausfall':'Cancellazione',
'Gleiswechsel':'Cambio binario','Gleis':'Binario',
'Bestätigte Ausfälle und entfallene Halte':'Cancellazioni e fermate saltate confermate',
'Gleiswechsel (blauer Hinweis)':'Cambi binario (avviso blu)',
'Nur favorisierte Linien, Züge und Haltestellen':'Solo linee, treni e fermate preferite',
'Nur favorisierte Linien und Züge':'Solo linee e treni preferiti',
'Benachrichtigungen in der geöffneten App':'Notifiche con app aperta',
'Nur für Favoriten melden':'Avvisa solo per i preferiti',
'Ausfälle melden':'Avvisa delle cancellazioni',
'Gleiswechsel melden':'Avvisa dei cambi binario',
'Verspätungen melden':'Avvisa dei ritardi',
'Verspätung ab':'Ritardo da',
'Min.':'min','min':'min','Unbekannt':'Sconosciuto',
'Alle Fahrzeuge':'Tutti i veicoli','Auf Karte anzeigen':'Mostra sulla mappa',
'Keine passenden aktiven Züge in den eingegangenen Fahrzeugdaten.':'Nessun treno attivo corrispondente nei dati ricevuti.',
'Fahrzeugtyp':'Tipo di veicolo','Fahrzeugkennung':'Identificativo veicolo',
'Positionsqualität':'Qualità della posizione','Zeitpunkt unbekannt':'Ora sconosciuta',
'Keine Feed-Statuswerte verfügbar.':'Nessuno stato delle fonti disponibile.',
'Quelle meldet OK':'Fonte disponibile','Feed-Status:':'Stato fonte:',
'Warte auf Daten':'In attesa dei dati','VERBINDE …':'CONNESSIONE …',
'Abfahrten direkt hier ansehen: Plan und bestätigte GTFS-RT-Meldungen klar getrennt.':'Consulta qui le partenze: orari e dati GTFS-RT confermati sono distinti.',
'Haltestelle oder Bahnhof suchen. Abfahrten ohne Kartenwechsel ansehen.':'Cerca una fermata o stazione. Consulta le partenze senza cambiare mappa.',
'Keine Echtzeitdaten':'Nessun dato in tempo reale',
'Geplant':'Previsto','Aktuell':'Attuale','Letzte Aktualisierung':'Ultimo aggiornamento',
'Statistiken':'Statistiche','Einstellungen':'Impostazioni','Schließen':'Chiudi',
'Linie':'Linea','Linien':'Linee','Bahnhof':'Stazione','Haltestelle':'Fermata',
'Live':'In diretta','Status':'Stato','Betroffene Linien':'Linee interessate',
'Gemeldete Ausfälle':'Cancellazioni segnalate','Verspätete Fahrten':'Corse in ritardo',
'Favoriten öffnen':'Apri preferiti','Mindestens zwei Zeichen eingeben':'Inserisci almeno due caratteri',
'Fahrt auswählen, um mögliche Anschlüsse am nächsten Halt zu prüfen.':'Seleziona una corsa per verificare le coincidenze alla prossima fermata.'
};
const patterns=[
 [/^(\d+) betroffene Linien · (\d+) Meldungen$/,'$1 linee interessate · $2 segnalazioni'],
 [/^(\d+) betroffene Linien · (\d+) Fahrten$/,'$1 linee interessate · $2 corse'],
 [/^(\d+) FAHRTEN$/,'$1 CORSE'],
 [/^(\d+) Fahrten$/,'$1 corse'],
 [/^Zug (.+) · \+(\d+) Min\.$/,'Treno $1 · +$2 min'],
 [/^Bus (.+) · \+(\d+) Min\.$/,'Bus $1 · +$2 min'],
 [/^Zug (.+) · Ausfall$/,'Treno $1 · Cancellato'],
 [/^Bus (.+) · Ausfall$/,'Bus $1 · Cancellato'],
 [/^Zug (.+) · Halt entfällt$/,'Treno $1 · Fermata soppressa'],
 [/^Bus (.+) · Halt entfällt$/,'Bus $1 · Fermata soppressa'],
 [/^Gleiswechsel · (.+)$/,'Cambio binario · $1'],
 [/^(\d+) gemeldete Ausfälle · (.+)$/,'$1 cancellazioni segnalate · $2'],
 [/^vor (\d+) Min\.$/,'$1 min fa'],
 [/^\+(\d+) min$/,'+$1 min']
];
const reverse=new Map(Object.entries(terms).map(([de,it])=>[it,de]));
const memory=new WeakMap();
const placeholders={'Zug, Linie, Haltestelle oder Fahrzeug':'Treno, linea, fermata o veicolo','Zugnummer oder Fahrzeugkennung':'Numero treno o identificativo veicolo','Bahnhof, Buslinie, Zug, Fahrzeug …':'Stazione, linea bus, treno, veicolo …','Linie / Fahrzeug suchen':'Cerca linea / veicolo','z. B. Bozen, Meran…':'es. Bolzano, Merano…'};
let observer,scheduled=false;
function translateText(text){
 const lead=text.match(/^\s*/)[0],trail=text.match(/\s*$/)[0],core=text.trim();
 if(!core)return text;
 if(terms[core])return lead+terms[core]+trail;
 for(const [pattern,replacement] of patterns)if(pattern.test(core))return lead+core.replace(pattern,replacement)+trail;
 return text;
}
function applyNode(node){
 if(node.nodeType!==3||!node.parentElement||node.parentElement.closest('script,style,textarea,code,[contenteditable],.sr58-language-toggle'))return;
 const original=memory.get(node)??node.nodeValue;
 if(!memory.has(node))memory.set(node,original);
 const desired=lang==='it'?translateText(original):original;
 if(node.nodeValue!==desired)node.nodeValue=desired;
}
function walk(root){
 if(!root)return;
 if(root.nodeType===3){applyNode(root);return}
 if(root.nodeType!==1)return;
 if(root.matches('script,style,textarea,code,[contenteditable]'))return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())applyNode(walker.currentNode);
 for(const el of root.querySelectorAll('input[placeholder]')){
  const original=el.dataset.sr58PlaceholderDe||el.getAttribute('placeholder');
  if(!el.dataset.sr58PlaceholderDe)el.dataset.sr58PlaceholderDe=original;
  el.setAttribute('placeholder',lang==='it'?(placeholders[original]||original):original);
 }
}
function update(){
 if(observer)observer.disconnect();
 walk(document.body);
 document.documentElement.lang=lang;
 const button=document.getElementById('sr58LanguageToggle');
 if(button){button.textContent=lang==='de'?'IT':'DE';button.setAttribute('aria-label',lang==='de'?'Passa all’italiano':'Auf Deutsch umstellen');button.title=lang==='de'?'Italiano':'Deutsch'}
 if(observer)observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update()})}
function ensureGlass(){
 let retries=0;
 const attach=()=>{
  const nav=document.getElementById('sr50BottomNav');
  if(!nav){if(retries++<120)setTimeout(attach,200);return}
  if(nav.querySelector('.sr58-liquid-pill'))return;
  const pill=document.createElement('span');pill.className='sr58-liquid-pill';pill.setAttribute('aria-hidden','true');nav.prepend(pill);nav.classList.add('sr58-liquid-nav');
  const buttons=[...nav.querySelectorAll('.sr50-nav-btn')];
  const move=()=>{
   const active=nav.querySelector('.sr50-nav-btn.active')||buttons[0];if(!active)return;
   const a=active.getBoundingClientRect(),n=nav.getBoundingClientRect();
   pill.style.width=a.width+'px';pill.style.height=a.height+'px';
   pill.style.transform='translate3d('+(a.left-n.left)+'px,'+(a.top-n.top)+'px,0)';pill.classList.add('sr58-liquid-ready');
  };
  const obs=new MutationObserver(move);for(const b of buttons){obs.observe(b,{attributes:true,attributeFilter:['class']});b.addEventListener('click',()=>requestAnimationFrame(move))}
  window.addEventListener('resize',move,{passive:true});requestAnimationFrame(()=>requestAnimationFrame(move));
 };
 attach();
}

function boot(){
 if(!document.body)return;
 const toggle=document.createElement('button');toggle.id='sr58LanguageToggle';toggle.type='button';toggle.className='sr58-language-toggle';
 toggle.addEventListener('click',()=>{lang=lang==='de'?'it':'de';try{localStorage.setItem(KEY,lang)}catch{}update()});
 document.body.append(toggle);
 ensureGlass();
 observer=new MutationObserver(records=>{
  for(const r of records)if(r.type==='characterData'&&r.target.nodeType===3){
   const previous=memory.get(r.target);
   if(previous!==undefined&&r.target.nodeValue!==(lang==='it'?translateText(previous):previous))memory.set(r.target,r.target.nodeValue);
  }
  schedule();
 });
 update();
 window.SuedtirolRadarLocale={get:()=>lang,set:next=>{if(!['de','it'].includes(next))return;lang=next;try{localStorage.setItem(KEY,lang)}catch{}update()}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
