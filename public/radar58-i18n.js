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
const itToDe=new Map(Object.entries(IT).map(([de,it])=>[it,de]));
const pairs=[
 ['STAZIONE SELEZIONATA','AUSGEWÄHLTER BAHNHOF'],
 ['PROSSIME 4 ORE','NÄCHSTE 4 STUNDEN'],
 ['STAZIONE SELEZIONATA','AUSGEWÄHLTER BAHNHOF'],
 ['PARTENZE','ABFAHRTEN'],
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
 ['STAZIONE SELEZIONATA','AUSGEWÄHLTER BAHNHOF'],['FEEDS OK','DATEN OK'],
 ['REG','REG'],['Position vs. Fahrplan','Position und Fahrplan'],
 ['Solo orario','Nur Fahrplan'],['Treni','Züge'],['Statistiche','Statistik']
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
 for(const [it,de] of pairs)out=replaceExact(out,it,de);
 const canonicalPhrases=[
  ['STAZIONE SELEZIONATA','AUSGEWÄHLTER BAHNHOF'],
  ['Solo orario','Nur Fahrplan'],['Treno','Zug'],['Autobus','Bus'],
  ['linee interessate','betroffene Linien'],['segnalazioni','Meldungen'],
  ['corse','Fahrten'],['Treni','Züge'],['Tutti','Alle'],
  ['Mappa','Karte'],['Partenze','Abfahrten'],['Statistiche','Statistik'],
  ['Preferiti','Favoriten']
 ];
 // Strings can contain train numbers and delay values; don't rely on exact whole-node matching.
 for(const [from,to] of canonicalPhrases){
  const regex=new RegExp('(^|[^\\p{L}])'+from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^\\p{L}])','giu');
  out=out.replace(regex,(_,prefix)=>prefix+to);
 }
 return out;
}
function translate(text,target){
 const source=canonical(text);
 if(target==='de')return source;
 const trimmed=source.trim();
 if(IT[trimmed])return source.replace(trimmed,IT[trimmed]);
 let out=source;
 for(const [regex,value] of replacements)out=out.replace(regex,value);
 for(const [it,de] of pairs)out=replaceExact(out,de,it);
 const phrases=[
  ['AUSGEWÄHLTER BAHNHOF','STAZIONE SELEZIONATA'],
  ['NÄCHSTE 4 STUNDEN','PROSSIME 4 ORE'],
  ['betroffene Linien','linee interessate'],['Meldungen','segnalazioni'],
  ['Fahrten','corse'],['Züge','Treni'],['Busse','Autobus'],
  ['Nur Fahrplan','Solo orario'],['Zug','Treno']
 ];
 for(const [from,to] of phrases){
  out=out.replace(new RegExp('(^|[^\\p{L}])'+from+'(?=$|[^\\p{L}])','giu'),(_,prefix)=>prefix+to);
 }
 return out;
}

function translateNode(node){
 if(node.nodeType!==Node.TEXT_NODE||!node.parentElement)return;
 const parent=node.parentElement;
 if(parent.closest('script,style,textarea,code,[contenteditable],.sr58-language-toggle'))return;
 const now=node.nodeValue;
 if(!now?.trim()||now.length>450)return;
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
 if(root.nodeType===Node.ELEMENT_NODE&&root.matches('input[placeholder]')){
  const src=root.dataset.sr58OriginalPlaceholder||root.getAttribute('placeholder');
  root.dataset.sr58OriginalPlaceholder=src;
  root.setAttribute('placeholder',translate(src,lang));
 }
 for(const input of root.querySelectorAll?.('input[placeholder]')||[]){
  const src=input.dataset.sr58OriginalPlaceholder||input.getAttribute('placeholder');
  input.dataset.sr58OriginalPlaceholder=src;input.setAttribute('placeholder',translate(src,lang));
 }
}
function apply(){
 document.documentElement.lang=lang;
 busy=true;
 try{scan(document.body)}finally{busy=false}
 const b=document.getElementById('sr58LanguageToggle');
 if(b){b.textContent=lang==='de'?'IT':'DE';b.title=lang==='de'?'Passa all’italiano':'Auf Deutsch wechseln';b.setAttribute('aria-label',b.title)}
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
