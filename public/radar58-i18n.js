/* Südtirol Radar 5.8.2 – UI localization; default DE, optional IT. */
(()=>{
'use strict';
const KEY='sr58_locale_v1';
const DE={
'Karte':'Karte','Abfahrten':'Abfahrten','Statistik':'Statistik','Favoriten':'Favoriten',
'Alle':'Alle','Züge':'Züge','Busse':'Busse','Details':'Details',
'Nur Fahrplan':'Nur Fahrplan','Ausfall':'Ausfall','Unbekannt':'Unbekannt',
'Suche':'Suche','Netzwerk':'Netzwerk','Störungen':'Störungen',
'Anschlüsse':'Anschlüsse','Fahrzeuge':'Fahrzeuge','Feeds':'Datenquellen',
'Alarme':'Benachrichtigungen','Benachrichtigungen':'Benachrichtigungen',
'Fahrzeug-Explorer':'Fahrzeug-Explorer','Globale Suche':'Globale Suche',
'Netzwerk-Radar':'Netzwerk-Radar','Störungs-Radar':'Störungs-Radar',
'Feed Health Center':'Datenquellen-Status','Anschluss-Intelligence':'Anschlussprüfung',
'VERKEHRSSTÖRUNGEN':'VERKEHRSSTÖRUNGEN','AUSGEWÄHLTER BAHNHOF':'AUSGEWÄHLTER BAHNHOF',
'ABFAHRTEN':'ABFAHRTEN','NÄCHSTE 4 STUNDEN':'NÄCHSTE 4 STUNDEN',
'Nur für Favoriten melden':'Nur für Favoriten melden',
'Live-Benachrichtigungen':'Live-Benachrichtigungen',
'Fahrt auswählen':'Fahrt auswählen','Quelle':'Quelle',
'Haltestelle oder Bahnhof':'Haltestelle oder Bahnhof',
'Abfahrten · nächste 4 Stunden':'Abfahrten · nächste 4 Stunden'
};
const IT={
'Karte':'Mappa','Abfahrten':'Partenze','Statistik':'Statistiche','Favoriten':'Preferiti',
'Alle':'Tutti','Züge':'Treni','Busse':'Autobus','Details':'Dettagli',
'Nur Fahrplan':'Solo orario','Ausfall':'Cancellato','Unbekannt':'Sconosciuto',
'Suche':'Cerca','Netzwerk':'Rete','Störungen':'Disservizi',
'Anschlüsse':'Coincidenze','Fahrzeuge':'Veicoli','Feeds':'Fonti dati',
'Alarme':'Avvisi','Benachrichtigungen':'Notifiche',
'Fahrzeug-Explorer':'Esplora veicoli','Globale Suche':'Ricerca globale',
'Netzwerk-Radar':'Radar della rete','Störungs-Radar':'Radar dei disservizi',
'Feed Health Center':'Stato delle fonti dati','Anschluss-Intelligence':'Analisi coincidenze',
'VERKEHRSSTÖRUNGEN':'DISAGI ALLA CIRCOLAZIONE','AUSGEWÄHLTER BAHNHOF':'STAZIONE SELEZIONATA',
'ABFAHRTEN':'PARTENZE','NÄCHSTE 4 STUNDEN':'PROSSIME 4 ORE',
'Nur für Favoriten melden':'Avvisa solo per i preferiti',
'Live-Benachrichtigungen':'Notifiche in tempo reale',
'Fahrt auswählen':'Seleziona corsa','Quelle':'Fonte',
'Haltestelle oder Bahnhof':'Fermata o stazione',
'Abfahrten · nächste 4 Stunden':'Partenze · prossime 4 ore',
 'Fahrtverlauf 3.0':'Percorso in tempo reale 3.0',
 'NETZWERKANALYSE':'ANALISI DELLA RETE',
 'DATEN OK':'DATI OK'
};
const replacements=[
[/\bNur Fahrplan\b/g,'Solo orario'],[/\bFahrten\b/g,'corse'],
[/\bbetroffene Linien\b/g,'linee interessate'],[/\bMeldungen\b/g,'segnalazioni'],
[/\bMinuten\b/g,'minuti'],[/\bMin\./g,'min.'],[/\bZug\b/g,'Treno'],
[/\bBus\b/g,'Autobus'],[/\bGleiswechsel\b/g,'Cambio binario'],
[/\bVerspätung\b/g,'Ritardo'],[/\bAusfall\b/g,'Cancellato'],
[/\bBahnhof\b/g,'stazione'],[/\bHaltestelle\b/g,'fermata'],
[/\bDatenquelle\b/g,'fonte dati'],[/\bNur Fahrplan\b/g,'Solo orario']
];
// 7.4: extended interface vocabulary, including status, actions and analysis labels.
const vocabulary={
'Verbindung':'Connessione','Verbinde':'Connessione in corso','Verbunden':'Connesso','Offline':'Non in linea','Online':'In linea',
'Keine Daten':'Nessun dato','Keine Ergebnisse':'Nessun risultato','Keine Fahrzeuge':'Nessun veicolo','Keine Abfahrten':'Nessuna partenza',
'Laden':'Caricamento','Lädt':'Caricamento','Aktualisieren':'Aggiorna','Aktualisiert':'Aggiornato','Letzte Aktualisierung':'Ultimo aggiornamento',
'Schließen':'Chiudi','Öffnen':'Apri','Mehr':'Altro','Weniger':'Meno','Zurück':'Indietro','Weiter':'Avanti','Fertig':'Fine','Überspringen':'Salta',
'Einführung':'Introduzione','Hilfe':'Aiuto','Einstellungen':'Impostazioni','Sprache':'Lingua','Design':'Aspetto',
'Hell':'Chiaro','Dunkel':'Scuro','Automatisch':'Automatico','Auswählen':'Seleziona','Ausgewählt':'Selezionato',
'Ankunft':'Arrivo','Abfahrt':'Partenza','Ankünfte':'Arrivi','Anschluss':'Coincidenza','Umstieg':'Cambio','Umsteigen':'Cambiare',
'Pünktlich':'Puntuale','Planmäßig':'Da orario','Fahrplan':'Orario','Fahrplanposition':'Posizione prevista da orario',
'Ist':'Effettivo','Soll':'Previsto','Ist/Soll':'Effettivo/Previsto','Position vs. Fahrplan':'Posizione rispetto all’orario',
'Position und Fahrplan':'Posizione e orario','Zeitabweichung':'Scostamento temporale','Zeitlicher Sollvergleich':'Confronto temporale previsto',
'Räumliche Abweichung':'Scostamento spaziale','Rückstand':'Ritardo spaziale','Vorsprung':'Anticipo spaziale',
'gemeldet':'segnalato','geschätzt':'stimato','berechnet':'calcolato','modelliert':'modellato','Modelliert':'Modellato',
'hinter dem Soll':'dietro la posizione prevista','vor dem Soll':'davanti alla posizione prevista',
'Fahrtverlauf':'Andamento della corsa','Fahrt-Fortschritt':'Avanzamento della corsa','Fahrplanfortschritt':'Avanzamento da orario',
'Nächster Halt':'Prossima fermata','Nächster gemeldeter Halt':'Prossima fermata segnalata',
'Letzter Halt':'Ultima fermata','Halte':'Fermate','Haltestellen':'Fermate','Bahnhöfe':'Stazioni','Bahnhof':'Stazione',
'Gleis':'Binario','Gleis unbekannt':'Binario sconosciuto','Linie':'Linea','Linien':'Linee','Richtung':'Direzione',
'Ziel':'Destinazione','Start':'Partenza','Strecke':'Percorso','Route':'Percorso','Verlauf':'Andamento',
'Fahrzeug':'Veicolo','Fahrzeugdetails':'Dettagli veicolo','Fahrzeugposition':'Posizione del veicolo',
'Zugnummer':'Numero del treno','Regionalzug':'Treno regionale','Buslinie':'Linea autobus',
'Entfernung':'Distanza','Kilometer':'Chilometri','Minuten':'Minuti','Sekunden':'Secondi','Stunden':'Ore',
'Verspätungen':'Ritardi','Verspätung':'Ritardo','Ausfälle':'Cancellazioni','Ausfall':'Cancellazione',
'Störung':'Disservizio','Störungen':'Disservizi','Warnung':'Avviso','Hinweis':'Nota','Wichtig':'Importante',
'Historie':'Cronologia','Verlauf anzeigen':'Mostra andamento','Verlauf öffnen':'Apri andamento',
'Datenqualität':'Qualità dei dati','Datenquellen':'Fonti dati','Quelle':'Fonte','Aktueller Feed':'Dati attuali',
'Echtzeit':'Tempo reale','Echtzeitdaten':'Dati in tempo reale','Live-Daten':'Dati in tempo reale',
'GPS-Position':'Posizione GPS','Simulierte Position':'Posizione simulata','Position geschätzt':'Posizione stimata',
'Karte':'Mappa','Abfahrten':'Partenze','Statistik':'Statistiche','Favoriten':'Preferiti',
'Suchen':'Cerca','Suche':'Ricerca','Filter':'Filtro','Alle':'Tutti','Züge':'Treni','Busse':'Autobus',
'Netzwerk':'Rete','Netzwerkstatus':'Stato della rete','Übersicht':'Panoramica','Details':'Dettagli',
'Benachrichtigungen':'Notifiche','Aktivieren':'Attiva','Deaktivieren':'Disattiva','Speichern':'Salva',
'Gespeichert':'Salvato','Hinzufügen':'Aggiungi','Entfernen':'Rimuovi','Abbrechen':'Annulla',
'Fahrt auswählen':'Seleziona corsa','Fahrt':'Corsa','Fahrten':'Corse',
'heute':'oggi','morgen':'domani','jetzt':'ora','aktuell':'attuale','unbekannt':'sconosciuto',
'keine':'nessuna','kein':'nessun','nicht verfügbar':'non disponibile','verfügbar':'disponibile',
'vorherige':'precedenti','nächste':'prossime','insgesamt':'in totale','ungefähr':'circa',
'Nur Fahrplan':'Solo orario','Daten fehlen':'Dati mancanti','Noch keine Daten':'Ancora nessun dato'
};
const vocabularyPairs=Object.entries(vocabulary).sort((a,b)=>b[0].length-a[0].length);
function translateVocabulary(text,reverse=false){
 let out=text;
 const list=[...vocabularyPairs].sort((a,b)=>reverse?b[1].length-a[1].length:b[0].length-a[0].length);
 for(const [de,it] of list){
  const from=reverse?it:de,to=reverse?de:it;
  const escaped=from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  out=out.replace(new RegExp('(?<![\\p{L}])'+escaped+'(?![\\p{L}])','gu'),to);
 }
 return out;
}
const itToDe=new Map(Object.entries(IT).map(([de,it])=>[it,de]));
const pairs=[
 ['STAZIONE SELEZIONATA','AUSGEWÄHLTER BAHNHOF'],
 ['PROSSIME 4 ORE','NÄCHSTE 4 STUNDEN'],['PARTENZE','ABFAHRTEN'],
 ['Treni','Züge'],['Autobus','Busse'],['Tutti','Alle'],
 ['Mappa','Karte'],['Partenze','Abfahrten'],['Statistiche','Statistik'],['Preferiti','Favoriten'],
 ['Solo orario','Nur Fahrplan'],['Treno','Zug'],['Ritardo','Verspätung'],
 ['Disagi alla circolazione','Verkehrsstörungen'],
 ['Stazione selezionata','Ausgewählter Bahnhof'],
 ['Stazione','Bahnhof'],['Fermata','Haltestelle'],
 ['corse','Fahrten'],['segnalazioni','Meldungen'],['linee interessate','betroffene Linien'],
 ['fonte dati','Datenquelle'],['Dettagli','Details'],['Cerca','Suche'],
 ['Cancellato','Ausfall'],['Sconosciuto','Unbekannt'],
 ['Live Journey 3.0','Fahrtverlauf 3.0'],['NETWORK INTELLIGENCE','NETZWERKANALYSE'],
 ['FEEDS OK','DATEN OK'],['Position vs. Fahrplan','Position und Fahrplan']
];
const phrases=[
 ['TRANSPARENTE ECHTZEITDATEN STATT GESCHÄTZTER PÜNKTLICHKEIT','DATI IN TEMPO REALE VERIFICABILI, NON STIME DI PUNTUALITÀ'],
 ['Transparente Echtzeitdaten statt geschätzter Pünktlichkeit.','Dati in tempo reale verificabili, non stime di puntualità.'],
 ['AUSGEWÄHLTER BAHNHOF','STAZIONE SELEZIONATA'],
 ['NÄCHSTE 4 STUNDEN','PROSSIME 4 ORE'],
 ['VERKEHRSSTÖRUNGEN','DISAGI ALLA CIRCOLAZIONE'],
 ['AKTUELL IM NETZ','ATTUALMENTE IN RETE'],
 ['SCHNELLZUGRIFF','ACCESSO RAPIDO'],
 ['NETZWERK JETZT','RETE ORA'],
 ['Fahrzeuge im Feed','Veicoli nei dati'],
 ['Frische Positionen','Posizioni recenti'],
 ['Züge / Busse','Treni / autobus'],
 ['Alt / ungeklärt','Dati vecchi / incerti'],
 ['Buslinien','Linee autobus'],
 ['Nur Fahrplan','Solo orario'],
 ['Aktueller Feed','Dati attuali'],
 ['Simulierte Position','Posizione simulata'],
 ['Position geschätzt','Posizione stimata'],
 ['Gesamte Strecke zeigen','Mostra percorso completo'],
 ['Fahrplanfortschritt','Avanzamento orario'],
 ['Nächster gemeldeter Halt','Prossima fermata segnalata'],
 ['Fahrtverlauf 3.0','Percorso 3.0'],
 ['Position und Fahrplan','Posizione e orario'],
 ['Streckenverfolgung 2.0','Monitoraggio percorso 2.0'],
 ['DATEN OK','DATI OK'],
 ['Abfahrten','Partenze'],['Züge','Treni'],['Busse','Autobus'],['Alle','Tutti'],
 ['Karte','Mappa'],['Statistik','Statistiche'],['Favoriten','Preferiti'],
 ['Zug','Treno'],['Verspätung','Ritardo'],['Ausfall','Cancellato'],
 ['Meldungen','segnalazioni'],['Fahrten','corse'],['betroffene Linien','linee interessate']
];
let lang='de',busy=false,observer;
try{lang=localStorage.getItem(KEY)==='it'?'it':'de'}catch{}
const original=new WeakMap();
function replaceExact(text,from,to){
 const trimmed=text.trim();
 return trimmed===from?text.replace(trimmed,to):text;
}
function canonical(text){
 let out=text;
 // Canonical German source regardless of previous locale.
 for(const [de,it] of [...phrases].sort((a,b)=>b[1].length-a[1].length)){
  if(out.trim()===it)out=out.replace(it,de);
 }
 for(const [it,de] of pairs){
  if(out.trim()===it)out=out.replace(it,de);
 }
 for(const [it,de] of [['Treno','Zug'],['Solo orario','Nur Fahrplan'],
  ['linee interessate','betroffene Linien'],['segnalazioni','Meldungen'],['corse','Fahrten']]){
  out=out.split(it).join(de);
 }
 return translateVocabulary(out,true);
}
function translate(text,target){
 const source=canonical(text);
 if(target==='de')return source;
 let out=source;
 for(const [de,it] of [...phrases].sort((a,b)=>b[0].length-a[0].length)){
  if(out.trim()===de)out=out.replace(de,it);
 }
 for(const [key,val] of Object.entries(IT).sort((a,b)=>b[0].length-a[0].length)){
  if(out.trim()===key)out=out.replace(key,val);
 }
 for(const [de,it] of [['betroffene Linien','linee interessate'],['Meldungen','segnalazioni'],
  ['Fahrten','corse'],['Nur Fahrplan','Solo orario'],['Zug','Treno']]){
  out=out.split(de).join(it);
 }
 return translateVocabulary(out);
}
function translateNode(node){
 if(node.nodeType!==Node.TEXT_NODE||!node.parentElement)return;
 const parent=node.parentElement;
 if(parent.closest('script,style,textarea,code,[contenteditable],.sr58-language-toggle'))return;
 const now=node.nodeValue;
 if(!now?.trim()||now.length>1200)return;
 let source=original.get(node);
 if(!source||now!==translate(source,'de')&&now!==translate(source,'it')){
  source=canonical(now);original.set(node,source);
 }
 const desired=translate(source,lang);
 if(node.nodeValue!==desired)node.nodeValue=desired;
}
function scan(root){
 if(!root)return;
 if(root.nodeType===Node.TEXT_NODE){translateNode(root);return}
 if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node;while(node=walker.nextNode())translateNode(node);
 const elements=root.nodeType===Node.ELEMENT_NODE?[root,...root.querySelectorAll('*')]:[...root.querySelectorAll('*')];
 for(const el of elements){
  if(el.closest('script,style,textarea,code,[contenteditable],.sr58-language-toggle'))continue;
  for(const attr of ['placeholder','title','aria-label','alt']){
   if(!el.hasAttribute(attr))continue;
   const key='sr58Original'+attr.replace(/(^|-)([a-z])/g,(_,a,b)=>b.toUpperCase());
   const current=el.getAttribute(attr),source=el.dataset[key]||canonical(current);
   el.dataset[key]=source;
   const value=translate(source,lang);
   if(current!==value)el.setAttribute(attr,value);
  }
 }

}
function apply(){
 document.documentElement.lang=lang;
 busy=true;
 try{scan(document.body)}finally{busy=false}
 const b=document.getElementById('sr58LanguageToggle');
 if(b){b.textContent=lang==='de'?'🇩🇪 DE':'🇮🇹 IT';b.title=lang==='de'?'Aktuell Deutsch – auf Italienisch wechseln':'Attualmente italiano – passa al tedesco';b.setAttribute('aria-label',b.title)}
}
function init(){
 if(document.getElementById('sr58LanguageToggle'))return;
 const b=document.createElement('button');b.type='button';b.id='sr58LanguageToggle';b.className='sr58-language-toggle';
 b.addEventListener('click',()=>{lang=lang==='de'?'it':'de';try{localStorage.setItem(KEY,lang)}catch{}apply()});
 document.body.append(b);apply();
 observer=new MutationObserver(changes=>{
  if(busy)return;
  // Translate only changed subtrees; batch feed-driven rerenders.
  busy=true;
  try{for(const change of changes){
   if(change.type==='characterData')translateNode(change.target);
   for(const node of change.addedNodes)scan(node);
  }}finally{busy=false}
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 window.SuedtirolRadarLanguage={get:()=>lang,set:value=>{lang=value==='it'?'it':'de';try{localStorage.setItem(KEY,lang)}catch{}apply()}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
