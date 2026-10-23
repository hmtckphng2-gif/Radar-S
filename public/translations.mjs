// Südtirol Radar 9.9.0 — Übersetzungen (Deutsch / Italienisch)
// Zentrum für alle UI-Texte. Fehlende Schlüssel fallen auf den deutschen Originaltext zurück.

export const LOCALES = ['de', 'it'];
export const DEFAULT_LOCALE = 'de';

let currentLocale = DEFAULT_LOCALE;

export function setLocale(locale) {
  if (!LOCALES.includes(locale)) return false;
  currentLocale = locale;
  try { localStorage.setItem('sr-locale', locale); } catch {}
  try { document.documentElement.lang = locale; } catch {}
  return true;
}

export function getLocale() {
  return currentLocale;
}

export function initLocale() {
  try {
    const stored = localStorage.getItem('sr-locale');
    if (stored && LOCALES.includes(stored)) {
      currentLocale = stored;
    }
  } catch {}
  try { document.documentElement.lang = currentLocale; } catch {}
  return currentLocale;
}

// Übersetzungen: Schlüssel -> { de, it }
const T = {
  // App-Titel
  'radar.title': { de: 'Südtirol Radar – Züge und Busse live verfolgen', it: 'Radar Sudtirolo – Treni e autobus in tempo reale' },
  'radar.subtitle': { de: 'SÜDTIROL · TRENTINO', it: 'SUDTIROLO · TRENTINO' },

  // Navigation / Filter
  'filter.all': { de: 'Alle', it: 'Tutti' },
  'filter.trains': { de: 'Züge', it: 'Treni' },
  'filter.buses': { de: 'Busse', it: 'Autobus' },
  'filter.linefav': { de: 'Linien-Fav.', it: 'Linee prefer.' },

  // Suche
  'search.label': { de: 'Zugnummer, Linie oder Ziel suchen', it: 'Cerca numero treno, linea o destinazione' },
  'search.placeholder': { de: 'Nummer / Ziel', it: 'Numero / Destinazione' },
  'search.noResults': { de: 'Keine Fahrzeuge gefunden', it: 'Nessun veicolo trovato' },
  'search.jumpToFirst': { de: 'Enter springt zum ersten Treffer', it: 'Invio salta al primo risultato' },

  // Status / Feeds
  'status.connecting': { de: 'VERBINDE', it: 'COLLEGAMENTO' },
  'status.feedsOk': { de: 'FEEDS OK', it: 'FEED OK' },
  'status.offline': { de: 'OFFLINE', it: 'OFFLINE' },
  'status.refresh': { de: 'Daten jetzt aktualisieren', it: 'Aggiorna i dati ora' },
  'status.loading': { de: 'LÄDT …', it: 'CARICAMENTO …' },
  'status.error': { de: 'FEHLER', it: 'ERRORE' },
  'status.startupError': { de: 'Fehler beim Start. Bitte Diagnose im Hinweisfeld prüfen.', it: 'Errore all’avvio. Controllare la diagnosi nel campo avviso.' },

  // Positionshinweis
  'notice.position': { de: 'Positionshinweis: Trenitalia und Trentino zeigen teilweise simulierte Fahrzeugpositionen. Zugnummern und Buslinien werden nicht geraten.', it: 'Avviso posizione: Trenitalia e Trentino mostrano talvolta posizioni simulate. I numeri dei treni e delle linee autobus non vengono indovinati.' },

  // Karte / Viewport
  'map.noVehicles': { de: 'Keine Positionen', it: 'Nessuna posizione' },
  'map.mapButton': { de: 'Alle Fahrzeuge zeigen', it: 'Mostra tutti i veicoli' },
  'map.refreshButton': { de: 'Daten aktualisieren', it: 'Aggiorna dati' },
  'map.fitButton': { de: 'Karte auf Fahrzeuge zentrieren', it: 'Centra la mappa sui veicoli' },
  'map.stationButton': { de: 'Haltestellen suchen', it: 'Cerca fermate' },
  'map.areaButton': { de: 'Ort auswählen', it: 'Scegli località' },
  'map.tileButton': { de: 'Kartenanbieter wechseln', it: 'Cambia fornitore mappe' },
  'map.area.all': { de: 'Alle Fahrzeuge', it: 'Tutti i veicoli' },
  'map.tooltip.viewport': { de: 'Tippen, um alle sichtbaren Fahrzeugpositionen zu finden', it: 'Tocca per trovare tutte le posizioni dei veicoli visibili' },

  // Tastatur
  'shortcuts.hint': { de: 'Tastatur: R = neu laden · F = Fahrzeuge zeigen · S = Stationen · ? = Quellen', it: 'Tastiera: R = ricarica · F = mostra veicoli · S = stazioni · ? = fonti' },

  // Zeit / Datum
  'time.lastUpdate': { de: 'Abfrage', it: 'Aggiornamento' },
  'time.noData': { de: 'Noch keine Daten', it: 'Nessun dato' },
  'time.notLive': { de: 'NICHT LIVE', it: 'NON IN TEMPO REALE' },

  // Fahrzeug-Detail
  'detail.train': { de: 'ZUGDETAILS', it: 'DETTAGLI TRENO' },
  'detail.bus': { de: 'BUSDETAILS', it: 'DETTAGLI AUTOBUS' },
  'detail.delay': { de: 'Verspätung (GTFS-RT)', it: 'Ritardo (GTFS-RT)' },
  'detail.delayCancelled': { de: 'Entfällt', it: 'Soppresso' },
  'detail.delayNoRt': { de: 'Keine bestätigten Verspätungsdaten', it: 'Nessun dato sul ritardo confermato' },
  'detail.planDelay': { de: 'Abweichung Fahrplan', it: 'Scostamento orario' },
  'detail.positionAge': { de: 'Positionsalter', it: 'Età posizione' },
  'detail.speed': { de: 'Geschwindigkeit', it: 'Velocità' },
  'detail.source': { de: 'Quelle', it: 'Fonte' },
  'detail.reliability': { de: 'Zuverlässigkeit', it: 'Affidabilità' },
  'detail.reliability.current': { de: 'aktuell', it: 'attuale' },
  'detail.reliability.delayed': { de: 'verzögert', it: 'ritardato' },
  'detail.reliability.stale': { de: 'alt/unklar', it: 'vecchio/non chiaro' },
  'detail.positionFeed': { de: 'ein Feed-Messwert, nicht zwingend GPS.', it: 'un dato del feed, non necessariamente GPS.' },
  'detail.positionSim': { de: 'simuliert/geschätzt, keine GPS-Ortung.', it: 'simulato/stimato, nessuna localizzazione GPS.' },
  'detail.stale': { de: 'Dieser Marker ist nur die letzte bekannte Position; der aktuelle Feed enthält ihn nicht.', it: 'Questo marcatore è solo l’ultima posizione nota; il feed attuale non lo contiene.' },
  'detail.busLineUnverified': { de: 'Ohne passenden statischen GTFS-Eintrag keine bestätigte Liniennummer.', it: 'Senza un corrispondente dato GTFS statico nessun numero di linea confermato.' },
  'detail.busMovement': { de: 'Kartenbewegung: zeitverzögert zwischen empfangenen Punkten entlang einer geprüften GTFS-Strecke; keine sekundengenaue GPS-Ortung.', it: 'Movimento mappa: ritardato tra i punti ricevuti lungo una tratta GTFS verificata; nessuna localizzazione GPS al secondo.' },
  'detail.busMovementNoShape': { de: 'Nur tatsächlich empfangene Positionen, keine erfundene Bewegung.', it: 'Solo posizioni realmente ricevute, nessun movimento inventato.' },
  'detail.trainLineUnverified': { de: 'Die offizielle Zugnummer ist noch nicht zugeordnet.', it: 'Il numero ufficiale del treno non è ancora assegnato.' },
  'detail.trainReplay': { de: 'Markerbewegung ist eine zeitverzögerte Wiedergabe zwischen empfangenen Feedpositionen auf einer passenden GTFS-Strecke, keine sekundengenaue Live-GPS-Ortung.', it: 'Il movimento del marcatore è una riproduzione ritardata tra le posizioni del feed ricevute lungo una tratta GTFS corrispondente, nessuna localizzazione GPS al secondo in tempo reale.' },
  'detail.trainPositions': { de: 'Nur empfangene Feedpositionen – ohne zwei passende Messpunkte wird keine zusätzliche Zugbewegung dargestellt.', it: 'Solo posizioni del feed ricevute – senza due punti di riferimento corrispondenti non viene mostrato alcun movimento aggiuntivo del treno.' },
  'detail.modelCard': { de: 'Baureihenfoto (nicht garantiert exakte Einheit)', it: 'Foto della serie (non garantita come esatta unità)' },
  'detail.trainType.confirmed': { de: 'Bestätigter Typ', it: 'Tipo confermato' },
  'detail.trainType.planned': { de: 'Geplanter Typ', it: 'Tipo previsto' },

  // Abfahrten / Station Board
  'board.title': { de: 'Abfahrten', it: 'Partenze' },
  'board.subtitle': { de: 'Geplante Zeiten aus GTFS, nicht mit RFI abgeglichen', it: 'Orari pianificati da GTFS, non verificati con RFI' },
  'board.noDepartures': { de: 'Keine kommenden GTFS-Abfahrten für den heutigen Tag gefunden. Das ist keine Aussage über aktuelle Zugausfälle.', it: 'Nessuna partenza GTFS trovata per oggi. Non è un’indicazione su soppressioni effettive.' },
  'board.live': { de: 'Live', it: 'In tempo reale' },
  'board.liveNoDelay': { de: 'Live, keine Verspätung', it: 'In tempo reale, senza ritardo' },
  'board.planned': { de: 'Geplant', it: 'Pianificato' },
  'board.delay': { de: 'Min.', it: 'Min.' },
  'board.delayEarlier': { de: 'Min. früher', it: 'Min. prima' },
  'board.platform': { de: 'Gleis', it: 'Binario' },
  'board.stop': { de: 'Steig', it: 'Fermata' },

  // Fahrzeug-Liste (gleiche Linie)
  'line.title': { de: 'Alle Fahrzeuge der Linie', it: 'Tutti i veicoli della linea' },
  'line.noVehicles': { de: 'Keine Fahrzeuge dieser Linie aktuell gemeldet.', it: 'Nessun veicolo di questa linea segnalato al momento.' },

  // Fahrplan-Suche / Stationen
  'station.title': { de: 'Haltestellen', it: 'Fermate' },
  'station.subtitle': { de: 'GTFS-Fahrplandaten, nicht mit RFI abgeglichen', it: 'Dati orari GTFS, non verificati con RFI' },
  'station.search': { de: 'Bahnhof oder Haltestelle suchen', it: 'Cerca stazione o fermata' },
  'station.noStations': { de: 'Keine GTFS-Haltestellendaten geladen. Starte zuerst den automatischen GTFS-Import.', it: 'Nessun dato GTFS fermate caricato. Avvia prima l’importazione automatica GTFS.' },
  'station.noMatch': { de: 'Keine passende Haltestelle gefunden.', it: 'Nessuna fermata trovata.' },
  'station.schedule': { de: 'Fahrtverlauf', it: 'Percorso corsa' },
  'station.scheduleSource': { de: 'GTFS-Fahrplan', it: 'Orario GTFS' },
  'station.tripUpdate': { de: '+ TripUpdates', it: '+ TripUpdates' },
  'station.noStops': { de: 'Keine vollständigen Haltestelleninformationen für diese Fahrt verfügbar.', it: 'Nessuna informazione completa sulle fermate disponibile per questa corsa.' },
  'station.planTime': { de: 'Planzeit', it: 'Orario pianificato' },
  'station.skipped': { de: 'Halt entfällt', it: 'Fermata soppressa' },

  // Reiseverbindung / Reisen
  'journey.title': { de: 'Reiseverbindung', it: 'Connessione viaggio' },
  'journey.direct': { de: 'Direkt', it: 'Diretto' },
  'journey.transfers': { de: 'Umstieg(e)', it: 'Cambio/i' },
  'journey.risk': { de: 'Risiko', it: 'Rischio' },

  // 3D / Kamera
  'camera.title': { de: '3D-Ansicht', it: 'Vista 3D' },
  'camera.replay': { de: 'Wiedergabe', it: 'Riproduzione' },
  'camera.back': { de: '2D', it: '2D' },

  // Betrieb / Status
  'health.title': { de: 'Betriebsstatus', it: 'Stato operativo' },
  'health.feeds': { de: 'Live-Feeds', it: 'Feed in tempo reale' },
  'health.vehicles': { de: 'Fahrzeuge', it: 'Veicoli' },
  'health.regions': { de: 'GTFS-Regionen', it: 'Regioni GTFS' },
  'health.updated': { de: 'Letzte Aktualisierung', it: 'Ultimo aggiornamento' },
  'health.tiles': { de: 'Kartenkacheln', it: 'Tessere mappa' },
  'health.feedsOk': { de: 'FEEDS OK', it: 'FEED OK' },
  'health.offline': { de: 'OFFLINE', it: 'OFFLINE' },
  'health.feedsBanner': { de: 'Alle Live-Feeds nicht erreichbar.', it: 'Tutti i feed in tempo reale non raggiungibili.' },
  'health.feedsBannerSub': { de: 'Die Kartenpositionen können veraltet sein. Fahrplan-Daten bleiben verfügbar.', it: 'Le posizioni sulla mappa potrebbero essere datate. I dati orari rimangono disponibili.' },
  'health.retry': { de: 'Erneut versuchen', it: 'Riprova' },

  // Favoriten
  'fav.title': { de: 'Favorisierte Fahrzeuge', it: 'Veicoli preferiti' },
  'fav.empty': { de: 'Keine favorisierten Fahrzeuge. Tippe in einem Fahrzeug-Detail auf „★ Favorit“.', it: 'Nessun veicolo preferito. Tocca in un dettaglio veicolo „★ Preferito“.' },
  'fav.btn': { de: '★ Favorit', it: '★ Preferito' },
  'fav.btnRemove': { de: 'Aus Favoriten entfernen', it: 'Rimuovi dai preferiti' },
  'fav.btnAdd': { de: 'Zu Favoriten hinzufügen', it: 'Aggiungi ai preferiti' },
  'fav.lineBtn': { de: 'Linie favorisiert', it: 'Linea preferita' },
  'fav.lineBtnAdd': { de: 'Linie favorisieren', it: 'Aggiungi linea ai preferiti' },
  'fav.lineBtnRemove': { de: 'Linie aus Favoriten entfernen', it: 'Rimuovi linea dai preferiti' },
  'fav.status': { de: 'Favoriten', it: 'Preferiti' },

  // Linien-Status (neu 9.9)
  'lines.title': { de: 'Linien-Status', it: 'Stato linee' },
  'lines.subtitle': { de: 'Status aller verfügbaren Linien', it: 'Stato di tutte le linee disponibili' },
  'lines.noLines': { de: 'Keine Linien gefunden.', it: 'Nessuna linea trovata.' },
  'lines.line': { de: 'Linie', it: 'Linea' },
  'lines.status.ok': { de: 'Pünktlich', it: 'In orario' },
  'lines.status.delayed': { de: 'Verspätet', it: 'Ritardato' },
  'lines.status.disturbed': { de: 'Gestört', it: 'Interrotto' },
  'lines.status.unknown': { de: 'Unbekannt', it: 'Sconosciuto' },
  'lines.status.old': { de: 'Veraltet', it: 'Datato' },
  'lines.vehicles': { de: 'Fahrzeuge', it: 'Veicoli' },
  'lines.delay': { de: 'Verspätung', it: 'Ritardo' },
  'lines.onTime': { de: 'pünktlich', it: 'in orario' },
  'lines.delayedBy': { de: 'Verspätung', it: 'ritardo' },
  'lines.onTimeShort': { de: 'pünktlich', it: 'in orario' },
  'lines.filterSearch': { de: 'Linie suchen…', it: 'Cerca linea…' },
  'lines.filterAll': { de: 'Alle', it: 'Tutte' },
  'lines.filterOnTime': { de: 'Pünktlich', it: 'In orario' },
  'lines.filterDelayed': { de: 'Verspätet', it: 'Ritardato' },
  'lines.filterDisturbed': { de: 'Gestört', it: 'Interrotto' },
  'lines.noMatch': { de: 'Keine passende Linie gefunden.', it: 'Nessuna linea trovata.' },
  'lines.highlight': { de: 'Fahrzeuge der Linie auf Karte hervorheben', it: 'Evidenzia veicoli della linea sulla mappa' },
  'lines.refresh': { de: 'Aktualisieren', it: 'Aggiorna' },

  // Sonstiges
  'misc.ok': { de: 'OK', it: 'OK' },
  'misc.cancel': { de: 'Abbrechen', it: 'Annulla' },
  'misc.close': { de: 'Schließen', it: 'Chiudi' },
  'misc.minutes': { de: 'Min.', it: 'Min.' },
  'misc.earlier': { de: 'früher', it: 'prima' },
  'misc.favorites': { de: 'Favoriten', it: 'Preferiti' },
  'misc.back': { de: 'Zurück', it: 'Indietro' },
  'misc.vehicles': { de: 'Fahrzeuge', it: 'Veicoli' },
  'misc.trains': { de: 'Züge', it: 'Treni' },
  'misc.buses': { de: 'Busse', it: 'Autobus' },
  'misc.live': { de: 'live', it: 'in tempo reale' },
  'misc.loaded': { de: 'geladen', it: 'caricate' },
  'misc.errors': { de: 'Fehler', it: 'errori' },
  'status.old': { de: 'veraltet', it: 'datato' },
  'status.offlineSub': { de: 'Die Live-Positionen können nicht aktualisiert werden. Fahrplan und gespeicherte Daten bleiben verfügbar.', it: 'Le posizioni in tempo reale non possono essere aggiornate. Orari e dati salvati rimangono disponibili.' },
  'health.feedsBannerSub': { de: 'Die Kartenpositionen können veraltet sein. Fahrplan-Daten bleiben verfügbar.', it: 'Le posizioni sulla mappa potrebbero essere datate. I dati orari rimangono disponibili.' },
  'healthPanel.aria': { de: 'Betriebsstatus', it: 'Stato operativo' },
  'favPanel.aria': { de: 'Fahrzeug-Favoriten', it: 'Veicoli preferiti' },
  'linesPanel.aria': { de: 'Linien-Status', it: 'Stato linee' },
  'linesSearch.aria': { de: 'Linie suchen', it: 'Cerca linea' },
  'notice.positionTitle': { de: 'Positionshinweis:', it: 'Avviso posizione:' },
  'place.bozen': { de: 'Bozen', it: 'Bolzano' },
  'place.meran': { de: 'Meran', it: 'Merano' },
  'place.brixen': { de: 'Brixen', it: 'Bressanone' },
  'place.sterzing': { de: 'Sterzing', it: 'Vipiteno' },
  'place.bruneck': { de: 'Bruneck', it: 'Brunico' },
  'place.trento': { de: 'Trient', it: 'Trento' },
  'statusBtn.aria': { de: 'Status und Datenquellen', it: 'Stato e fonti dati' },
  'statusBtn.title': { de: 'Datenquellen ansehen', it: 'Vedi fonti dati' },
  'healthBtn.aria': { de: 'Betriebsstatus', it: 'Stato operativo' },
  'healthBtn.title': { de: 'Betriebsstatus ansehen', it: 'Vedi stato operativo' },
  'favBtn.aria': { de: 'Fahrzeug-Favoriten', it: 'Veicoli preferiti' },
  'favBtn.title': { de: 'Meine favorisierten Fahrzeuge', it: 'I miei veicoli preferiti' },
  'langBtn.aria': { de: 'Sprache wechseln', it: 'Cambia lingua' },
  'langBtn.title': { de: 'Sprache wechseln', it: 'Cambia lingua' },
  'linesBtn.aria': { de: 'Linien-Status', it: 'Stato linee' },
  'linesBtn.title': { de: 'Linien-Status ansehen', it: 'Vedi stato linee' },
  'themeToggle.aria': { de: 'Hell-/Dunkelmodus wechseln', it: 'Cambia tema' },
  'themeToggle.title': { de: 'Theme wechseln', it: 'Cambia tema' },
  'nav.filter': { de: 'Fahrzeugfilter', it: 'Filtro veicoli' },
};

export function t(key, params = {}) {
  const entry = T[key];
  if (!entry) return key;
  let text = entry[currentLocale] || entry[DEFAULT_LOCALE] || key;
  // Einfache Platzhalter-Ersetzung {name}
  for (const [name, val] of Object.entries(params)) {
    text = text.replace(new RegExp('{' + name + '}', 'g'), String(val));
  }
  return text;
}
