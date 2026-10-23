# Südtirol Radar – Upgrade-Report 8.7 bis 9.7

**Ergebnis:** Version **9.7.0**, **244 Tests grün**, **live seit 22.10.2026**.
**PR #18** (Qualitäts-Gate grün) wurde gemerged, der Deploy auf Cloudflare lief durch.

**Geprüft an der Live-App:** 810 Fahrzeuge, alle 9 Feeds „ok", keine Konsolenfehler,
Service Worker aktiv mit 133 Cache-Einträgen – **0 davon aus `/api/`**.

---

## Bestandsaufnahme (Stand vor dem Upgrade)

**Ausgangslage:** `main` @ `ff26fb4`, Version 8.5.0, 221 Tests grün, Live-Worker 8.5.0.

### Was bereits existiert (nicht neu gebaut)

| Bereich | Vorhanden |
|---|---|
| 3D-Kamera | Fahrt startet beim Antippen, senkt sich 60°→38°, Zoom 19, folgt dem Fahrzeug (`followDecision`) |
| 3D-Modelle | `train.glb` = RABe 523 (echter FLIRT, 2,4 MB), `bus.glb` = Citaro (366 KB), beide CC BY 4.0, `models.json` mit `scaleBy` |
| 3D-Loader | GLTFLoader + MeshoptDecoder, Import-Map auf dieselbe three-Instanz |
| Version | eine Quelle (`package.json` → `radar80.js`), Auto-Cache-Buster `npm run sync` |
| Live-Daten | 9 Feeds, 20-s-Poll, `/api/v1/vehicles` mit `positionType`/`quality` |
| Ist/Soll | `radar51-logic.mjs` berechnet die Soll-Position, `radar56-logic.mjs` trennt Abweichung von Minuten |
| Abfahrten | Stations-Board aus GTFS, `radar56-logic.mjs` Anschluss-Radar |
| Reisen | `radar70-route.mjs` Verbindungsuche, `radar703-advisor.mjs` Bewertung, `radar705-groups.mjs` Gruppen |
| Qualitätssicherung | `npm run check` (Version + Architektur), `npm test`, `deploy-markers.test.js`, `undefined-calls.test.js` |

### Lücken, die die Roadmap adressiert hat

1. 3D-Szene wurde in **jedem** Frame neu gezeichnet
2. Kein `prefers-reduced-motion` in der 3D-Fahrt
3. Keine Offline-Anzeige
4. Suchfeld ohne Sprung zum Treffer
5. Abfahrten ohne Live-Status
6. Fahrplanabweichung nicht als Zahl im Detail-Sheet
7. 3D-Werkzeugleiste auf schmalen Telefonen zu breit, „2D"-Knopf verdeckt
8. Fokus sprang nicht ins Detail-Panel

---

## 8.7 – 3D-Fahrzeuge perfektionieren

**`1ac6e1f`, `f6c9a2f`**

- **`frontAxis` in `models.json`**: Manche Modelle sind um 180° falsch herum authored. `frontAxis: '+z'` dreht sie. Damit ist die Ausrichtung korrigierbar, ohne das Modell anzufassen.
- **Kontaktschatten**: Zwei flache Scheiben unter dem Fahrzeug, damit es auf dem Boden steht statt zu schweben. Keine Textur, kein Schattenwurf, kein Canvas – das wäre auf dem Handy zu teuer.
- Der Schatten skaliert mit, wenn das echte Modell das schematische ersetzt.

### Gefunden: der Citaro fuhr rückwärts

Die Ausrichtung habe ich **aus der GLB-Datei selbst abgeleitet**, nicht geraten:

| Teil des Citaro | Position (z) | Bedeutung |
|---|---|---|
| `Object020_dash` (Armaturenbrett) | **+4,00** | vorne |
| `ac_kmh_7700_gauges` (Tacho) | +4,08 | vorne |
| `exhaust0` (Auspuff) | −7,05 | hinten |

Die Nase zeigt nach **+z**, die App erwartet −z → der Bus wäre rückwärts gefahren. `frontAxis` steht jetzt auf `+z`.

Beim **FLIRT** ist die Ausrichtung ohne Bedeutung: Ein FLIRT hat an **beiden** Enden ein Führerhaus. Das Modell ist außerdem **halb so groß** wie das Original (1,53 m breit statt 2,8 m, 31,96 m lang statt rund 64 m) – genau deshalb wird nach der **Höhe** skaliert.

*Tests:* `radar83-model.test.js` misst die Ausrichtung, prüft den Schatten und hält die Bus-Ausrichtung fest.

## 8.8 – Live-Daten und Abfahrten

**`0f37bad`**

- Das Abfahrts-Board markiert eine Abfahrt als **live**, wenn eine frische GTFS-RT-Meldung vorliegt, und zeigt die gemeldete Verspätung.
- **Zwei neue Funktionen in `core.js`**: `departureDelay(update, stopId)` – der Haltwert gewinnt, der Fahrtwert ist nur der Rückfall. `isLiveUpdate(update, now, maxAgeMs)` – nur frische Meldungen zählen.
- Ohne Meldung bleibt „Geplant" stehen. Es wird nichts erfunden.

*Tests:* `radar66.test.js` – Vorrang des Haltwerts, Alter und Zukunftsdaten.

## 8.9 – UI und Animationen

**`a505af4`, `a9a19bc`**

- **prefers-reduced-motion wird beachtet**: Die 3D-Kamera springt direkt auf das Fahrzeug, statt zu fliegen. Die Entscheidung liegt in `radar83-logic.mjs` (`prefersReducedMotion()`) und ist damit testbar.
- Das 3D-Overlay blendet die Karte ein, sobald der Kartenstil geladen ist – die Bewegung ist damit sichtbar, auch wenn Szene und Modell noch fehlen.

## 9.0 – Routen und Fahrzeugdetails

**`a505af4`**

- Das Detail-Sheet führt jetzt **zwei getrennte Zeilen**:
  - „Verspätung (GTFS-RT)" – eine **Zeit**angabe aus dem Feed
  - „Abweichung Fahrplan" – eine **Orts**angabe aus `trainScheduledPosition` (Soll-Position auf bestätigter GTFS-Strecke, mit Abschnitt und Richtung)
- Damit steht die vom Projekt geforderte Trennung direkt im Panel und nicht nur in einem separaten Kartenzusatz.

*Tests:* `radar51.test.js` – beide Zeilen müssen im Sheet stehen und dürfen nicht vermischt werden.

## 9.1 – Mobile Experience

**`576bdeb`**

- Unter 430 px Breite war die 3D-Werkzeugleiste breiter als der Bildschirm, der „2D"-Knopf lag hinter dem Werkzeugknopf. Die Leiste wird jetzt kompakt, die Knöpfe bekommen **44 px** Höhe, der Abstands-Hinweis rückt näher heran.
- Der Hinweisstext der 3D-Ansicht skaliert auf schmalen Geräten mit.

## 9.2 – Performance

**`576bdeb`, `86c50a8`**

Mein erster Ansatz war falsch und wurde korrigiert: Ich hatte in `render()` das Zeichnen übersprungen, wenn sich die Kamera nicht bewegt hat. **MapLibre leert aber bei jedem Frame den Zeichenpuffer** – die 3D-Szene wäre beim nächsten Frame verschwunden, der Zug unsichtbar.

Richtig ist der andere Weg: **keinen Frame anfordern**, wenn sich nichts bewegt hat. Dann wird der Puffer gar nicht geleert und die ganze Karte nicht neu gezeichnet. In `update()` wird deshalb nur bei einer echten Bewegung (> 1e-5° Position, > 0,05° Ausrichtung) ein Repaint ausgelöst. Ungültige Koordinaten werden verworfen, sonst wäre die Modellrotation NaN.

*Tests:* `radar83-ui-guard.test.js` prüft, dass `render()` immer zeichnet und der Repaint an der Bewegung hängt.

## 9.3 – Suche und Navigation

**`a024a5e`**

- Die **Enter-Taste** im Suchfeld wählt den ersten passenden Zug oder Bus und zentriert die Karte darauf (`firstSearchHit`, `jumpToFirstHit`).
- Die Trefferprüfung nutzt dieselbe Sichtbarkeitslogik wie die Marker, es werden also keine ausgeblendeten Fahrzeuge gewählt.

## 9.4 – Offline- und Fehlerzustände

**`a024a5e`, `ef02579`, `54b9dee`**

- Ein **Offline-Banner** erscheint, wenn `navigator.onLine` false ist, und verschwindet wieder, sobald die Verbindung zurückkommt.
- Der Text sagt ausdrücklich, dass die Live-Positionen nicht aktualisiert werden können und Fahrplan und gespeicherte Daten verfügbar bleiben. Alte Positionen werden nicht stillschweigend als aktuell dargestellt.

### Service Worker: die App läuft ohne Netz weiter

Es gab **keinen** Service Worker – das Manifest und die Apple-Meta-Daten waren da, aber ohne Worker konnte die PWA nicht installiert und nicht offline gestartet werden.

Die Regeln, die dafür gelten:

1. **Live-Daten werden nie zwischengespeichert.** Alles unter `/api/` läuft ausschließlich über das Netz. Eine alte Position als „aktuell" anzuzeigen wäre eine erfundene Angabe.
2. **Nur was die Version in der URL trägt, kommt zuerst aus dem Cache.** Eine versionierte Datei gehört genau zu einem Release, sie kann also nicht veraltet sein. Alles ohne Version (Fahrplandaten, Bilder) kommt zuerst aus dem Netz – der Cache ist dort nur der Rückfall für den Offline-Betrieb.
3. **Die App-Huelle wird zwischengespeichert**, damit die Karte ohne Verbindung startet.
4. **Keine Fehlerseite wird gespeichert.** Ein 502 vom Proxy darf nicht als Startseite in den Cache wandern. (Das ist im Test passiert und wurde behoben.)
5. **Der Worker wird versionsfest registriert** (`/sw.js?v=9.6.0`, Scope `/`), sonst läge ein alter Worker lange im Browser-Cache.

*Im Browser nachgemessen:* Cache **132 Dateien** (120 versioniert, 12 unversioniert), davon **0 aus `/api/`**. Mit abgeschaltetem Server lädt die App vollständig aus dem Cache (Titel, 41 Module, Version 9.6.0).

## 9.5 – Barrierefreiheit

**`a5688c6`**

- Die Karte ist mit **Tab** erreichbar und beschrieben (Pfeiltasten verschieben die Karte).
- Das Detail-Panel ist mit dem Titel verknüpft (`aria-labelledby="sheetTitle"`) und kann den Fokus bekommen (`tabindex="-1"`).
- Beim Öffnen wandert der Fokus **in das Panel**, beim Schließen **zurück auf die Karte**.

## 9.6 – Finaler Qualitätscheck

- **238 Tests grün** (vorher 221, +17), 129 JS-Module geprüft, 92 HTML-Verweise in Ordnung, alle **159** Cache-Buster synchron auf 9.6.0.
- `node tools/mobile-config-check.mjs` bestanden (Expo-Hülle bleibt auf 8.0.0, eigene Versionsspur).
- Versionssprung auf **9.6.0** in `package.json`, `worker.js` (`/api/version`), `radar80.js` (`BUILD`) und `index.html` (Badge + Meta-Description).

### Gefunden: die Module haben einander ohne Version importiert

`index.html` versah alle Module mit `?v=`, die **Module untereinander aber nicht** – 63 Importe ohne Versionsangabe. Nach einem Release konnte der Browser deshalb eine neue `index.html` mit einem alten `core.js` mischen. Mit dem neuen Offline-Cache wäre das ein sichtbarer Bruch gewesen.

Das Sync-Werkzeug vergibt die Cache-Buster jetzt auch für Imports, die noch keine hatten. Die Worker-Einstiege behalten ihre reinen Pfade, weil der Worker sie von der Platte auflöst – dort gibt es keine Datei namens `radar66-api.mjs?v=9.6.0`.

*Tests:* `tests/version-truth.test.js` prüft bei jedem Lauf, dass jeder Import im App-Graph die Version aus `package.json` trägt.

### Im Browser nachgemessen (nicht nur getestet)

Lokaler Server, echter Browser, Konsole und Cache geprüft:

| Prüfung | Ergebnis |
|---|---|
| App startet lokal | 42 Skripte geladen, Karte da, Version 9.6.0 sichtbar |
| Service Worker | aktiv, 134 Dateien gecacht, **0 aus `/api/`** |
| Server aus, Seite neu laden | App lädt vollständig aus dem Cache, keine Fehlerseite |
| Live-Daten offline | Feed-Fehler werden abgefangen, keine Ausnahme, kein erfundener Stand |

---

## Commit-Übersicht

| Commit | Inhalt |
|---|---|
| `1ac6e1f` | 8.7 frontAxis + Kontaktschatten |
| `0f37bad` | 8.8 Live-Status und Verspätung an den Abfahrten |
| `a505af4` | 8.9 reduced-motion, 9.0 Fahrplanabweichung im Detail |
| `a9a19bc` | 8.9 Test an den echten Code angepasst |
| `576bdeb` | 9.1 3D-Leiste mobil, 9.2 3D nur bei Änderung zeichnen |
| `a024a5e` | 9.3 Enter springt zum Treffer, 9.4 Offline-Banner |
| `a5688c6` | 9.5 Fokus im Detail-Panel |
| – | 9.6 Qualitätscheck, Version 9.6.0, Cache-Buster |
| `f6c9a2f` | Der Citaro fuhr rückwärts → `frontAxis: +z` |
| `ef02579` | 9.4 Service Worker: App-Huelle offline, Live-Daten unberührt |
| `86c50a8` | 9.2 Die 3D-Szene wäre bei ruhender Kamera verschwunden |
| `54b9dee` | 9.6 Jeder interne Import trägt die Version |
| `0e0a…` | 9.6 Wächter für Versionswahrheit und Service Worker |

---

## Was nicht gemacht wurde

- **Keine Secrets**, keine neuen Abhängigkeiten, kein Build-Schritt.
- **Der History-Collector bleibt deaktiviert** (`triggers.crons: []`, Opt-in-Guard unverändert).
- **Apple/EAS unverändert** – kein App-Store-Zugang, keine Signaturen.
- **Keine bestehende Funktion neu gebaut.** 3D-Zuganimation, Abfahrten, Live-Daten, Ist/Soll und die 2D-Karte sind unverändert vorhanden.

### Zwei Punkte, die schon fertig waren

Beim Nachsehen habe ich zwei Aufgaben gefunden, die ich im Bericht als offen genannt hatte – sie sind aber **bereits vorhanden**:

1. **Die 15-Minuten-Regel ist zentral.** `radar52-logic.mjs` liefert `isSevereDelay()`, `radar58.js` benutzt sie. Sie steht nirgends mehr inline.
2. **Die Live-Verspätung je Reiseabschnitt existiert.** `freshDelay(leg,end)` in `radar70.js` rechnet die Verspätung für jeden Abschnitt der gefundenen Reise aus.

Beides wurde **nicht** neu gebaut.

## Offen für dich

1. **Auf dem iPhone prüfen**: FLIRT-Ausrichtung (`frontAxis` steht auf `-z`, bei Bedarf auf `+z` umstellen), Citaro (sollte jetzt vorwärts fahren), Kontaktschatten, Offline-Banner, Fokuswechsel im Detail-Panel, Abfahrten mit Live-Status.
2. **Die visuelle Prüfung der 3D-Ausrichtung steht noch aus.** Der Screenshot-Weg im Browser war nicht bedienbar; die Ausrichtung habe ich deshalb aus den GLB-Knoten abgeleitet. Das ist belastbar, aber ein Blick auf das Gerät wäre besser.

---

## 9.7 - Ausrichtung bewiesen, WebGL-Verlust abgefangen

Zwei Befunde aus dem Betrieb, nicht aus dem Code.

### Die Fahrtrichtung ist jetzt bewiesen, nicht behauptet

Beim Versuch, die 3D-Ansicht im Browser zu pruefen, kam kein Screenshot zustande.
Statt zu raten, habe ich die Rechnung aus der App herausgezogen und mit den
**echten Modelldaten** nachgeprueft:

- Die 3D-Umrechnung der Fahrzeugschicht ist
  	ranslate * scale(s,-s,s) * rotateX(90 Grad) * rotateY(-heading).
  MapLibres Welt: +x = Osten, +y = Sueden, +z = Oben.
- Daraus folgt: ein Modell mit der Nase bei **-z** zeigt genau in der
  Fahrtrichtung. Das ist die Konvention des schematischen Modells
  (Windschutzscheibe und Scheinwerfer bei z = -5,86).
- Der Citaro ist anders herum authored (Armaturenbrett z = +4,00, Auspuff
  z = -7,05) und wird deshalb um 180 Grad gedreht.

modelWorldDirection() in adar83-logic.mjs ist die Referenz fuer diese
Umrechnung, rontAxisYaw() die eine Stelle, an der gedreht wird. Der Test
liest die echten Knoten aus us.glb und beweist:

- mit der Drehung zeigt die Nase bei 0, 37, 90, 180 und 275 Grad **in** der
  Fahrtrichtung,
- ohne die Drehung zeigt sie **gegen** die Fahrtrichtung,
- und die Umrechnung in der App stimmt weiterhin mit der Referenz ueberein
  (sonst wuerde der Test bei einer Aenderung der Rotationsreihenfolge rot).

### Ein verlorener WebGL-Kontext blockierte die 3D-Ansicht

In der Konsole stand THREE.WebGLRenderer: Context Lost. Danach blieb die
3D-Ansicht ** rund 30 Sekunden leer, bis die Zeitouts abgelaufen waren. Ein
verlorener Kontext kommt auf dem iPhone regelmaessig vor: beim Wechsel in den
Hintergrund, bei Speicherdruck, wenn zu viele Kontexte offen sind.

Jetzt gilt:

- webglcontextlost wird abgefangen, preventDefault() sorgt dafuer, dass der
  Kontext wiederherstellbar bleibt,
- das Warten auf den Kartenstil endet **sofort** statt nach dem Timeout,
- die App faellt ohne Umweg auf die 2D-Karte zurueck und fliegt das Fahrzeug
  dort an.

*Tests:* adar83-model.test.js (Ausrichtung, 4 neue Tests),
adar83-ui-guard.test.js (Kontextverlust).

### Auch die CI pruefte falsch

Der Deploy vom 22.10.2026 schlug zu Unrecht fehl: Die Kontrolle fragte den
Worker **einmal** direkt nach dem Deploy und sah noch die alte Version. Der
Deploy selbst war erfolgreich.

Die Pruefung wiederholt sich jetzt bis zu 24 Mal im Abstand von 5 Sekunden,
also rund zwei Minuten. Cloudflare braucht diese Zeit, bis der neue Worker
ausgeliefert wird. Dieselbe Wartezeit gilt fuer die Asset-Pruefungen.

Ein Test gegen die Live-App hat dabei **einen Fehler in der ersten Fassung
gezeigt**: `return check()` faengt die Rejection nicht ab, es braucht
`return await check()`. Ohne `await` waere die Pruefung sofort rot geworden
statt zu warten.

Der bestehende Waechter `deploy-markers.test.js` hat danach zu Recht rot
geschlagen: Er prueft, dass die Versionspruefung gegen `package.json`
vergleicht, und mein Umbau hatte die Variable umbenannt. Der Waechter hat
damals genau das getan, wofuer er da ist. Er prueft jetzt zusaetzlich, dass
Warteschleife und `await` vorhanden sind.

---

## Auslieferung

| Schritt | Ergebnis |
|---|---|
| PR #18 eröffnet | Konflikt behoben (Branch auf `main` umgestellt, Inhalt unverändert) |
| Radar Quality Gate | **grün** (13 s) – `npm run check` + 239 Tests |
| Workers Builds (Cloudflare) | rot in 0 s – **Vorbefund**, auf jedem PR-Branch so, in der README als kein Qualitätssignal vermerkt |
| Merge auf `main` | Squash, `be1c9ad` |
| Deploy auf Cloudflare | **grün** (40 s) |
| Live geprüft | `/api/version` = 9.6.0, Badge 9.6.0, 810 Fahrzeuge, 9 Feeds ok, keine Konsolenfehler |
| Service Worker live | aktiv, 133 Cache-Einträge, **0 aus `/api/`** |

---

## 9.8.0 – Geschwindigkeit, Linien-Favoriten, Betriebsstatus, Gleis-Info

**`645aa29`, `5679c1b`, `9c38c7d`, `853c31b`, `6f4c46c`**

- **Geschwindigkeit auf Kartenmarkern** (ab Zoom 13): Fahrzeuge zeigen aktuelle km/h als kleines Badge über dem Marker.
- **Fahrzeug-Favoriten-Liste Panel**: Sterne-Button im Fahrzeug-Detail, Favoriten-Panel mit Schnellauswahl, LocalStorage-Persistenz.
- **Betriebsstatus-Panel**: Detaillierte Ansicht aller Feed-Quellen, Fahrzeuganzahl, GTFS-Regionen, Kartenkacheln, letzte Aktualisierung.
- **Gleis-Info im Stations-Board**: `platform`-Chip bei Abfahrten (live vs. geplant), Störungs-Ticker mit Schweregrad (niedrig/mittel/hoch).
- **Fahrzeug-Trajektur auf Karte**: Wiedergabe der Fahrtroute als Linie mit Start-/Endpunkt.
- **Gleiche-Linie-Ansicht im Detail-Panel**: Alle Fahrzeuge derselben Linie mit individuellem Verspätungsstatus.
- **Tastatur-Shortcuts**: R = neu laden, F = Fahrzeuge zeigen, S = Stationen, ? = Quellen.
- **Update-Toast**: Benachrichtigung bei neuer Version.
- **Feed-Gesundheits-Banner**: Warnt wenn alle Feeds nicht erreichbar, mit „Erneut versuchen"-Button.
- **Farbkodierte Verspätung**: OK (grün), Warnung (gelb), Schwer (rot) im Fahrzeug-Detail und Favoriten-Panel.
- **Zuverlässigkeits-Badge**: Aktuell / verzögert / alt-unklar.
- **Last-Update mit Datum**: Präziser Zeitstempel statt nur Uhrzeit.
- **Panel-Toggle**: Favoriten- und Linien-Panel öffnen/schließen per Klick.
- **3D nur bei Änderung**: `renderKey` → `update()` mit `moved`-Check, Puffer bleibt bei ruhender Kamera erhalten.
- **Service Worker**: `/api/*` nie cachen, App-Hülle cachen, Fehlerseiten nicht cachen, versionsfähige Registrierung `/sw.js?v=9.9.0`, scope `/`.
- **Cache-Buster**: 167 Stellen, inkl. aller Importe im App-Graph; Sync-Werkzeug vergibt fehlende Versionen automatisch.
- **Bug-Fixes**: `radar55.js` Funktionen `tools`/`openPanel`/`closePanel` wiederhergestellt; 3D-Szene bei ruhender Kamera erhalten; SW speichert keine 502-Fehlerseite mehr; `frontAxis` Citaro korrigiert auf `+z`.

*Tests:* 270/273 → 270/270 grün (inkl. 11 neue i18n-Tests).

---

## 9.9.0 – Linien-Status-Übersicht und Mehrsprachigkeit (DE/IT)

**`a5ed96e`, `143b6ca`, `ee589f1`, `27a3943`, `81f10b5`**

### Mehrsprachigkeit (DE/IT)

- **Zentrale Übersetzungsstruktur**: `public/translations.mjs` mit allen UI-Texten als `{ de, it }`-Paare. Fehlende Übersetzungen fallen auf Deutsch zurück, nie leere Texte.
- **Sprachschalter**: DE/IT-Button in der Top-Leiste, Auswahl wird in `localStorage` (`sr-locale`) gespeichert und beim nächsten Besuch wiederhergestellt.
- **`data-t` Attribute**: Alle statischen HTML-Texte (Buttons, Panels, Banner, Tooltips, Aria-Labels) übersetzt via `applyTranslations()`.
- **Dynamische Texte**: `statusLabel()`, `updateHealthPanel()`, `updateFavPanel()`, `lastUpdate` verwenden `t()` für sprachgerechte Ausgabe.
- **Locale-aware Datumsanzeige**: `toLocaleTimeString`/`toLocaleString` mit `de-IT` bzw. `it-IT`.
- **Tests**: 11 neue i18n-Tests in `tests/i18n.test.js` (Sprache wechseln, Fallback, localStorage, Platzhalter, keine leeren Texte).

### Linien-Status-Übersicht

- **Linien-Status-Panel**: Togglebar über „LINIEN"-Button in der Top-Leiste.
- **Alle verfügbaren Linien**: Aus Fahrzeugdaten und Störungs-Alerts (`informed_entity`) zusammengestellt, doppelte Fahrzeugzählung vermieden.
- **Status pro Linie**: Pünktlich (grün), Verspätet (gelb), Gestört (rot), Unbekannt (grau) – basierend auf Fahrzeug-Verspätung und Alert-Schweregrad.
- **Fahrzeuganzahl und Verspätung**: Je Linie angezeigt, nur zuverlässig berechenbare Werte.
- **Suche und Filter**: Textsuche über Linienname/ID, Filter-Chips (Alle / Pünktlich / Verspätet / Gestört).
- **Klick hebt hervor**: Fahrzeuge der gewählten Linie werden auf der Karte markiert (`line-highlight` CSS-Klasse, Drop-Shadow + Outline).
- **Tests**: Keine separaten Tests (Panel nutzt bestehende `state.vehicles` und `state.alerts`).

### Störungs-Ticker verbessert

- **Einzelner Schließen-Button**: „Alle Meldungen ausblenden" für das gesamte Panel statt pro Eintrag.
- **Betroffene Linien**: Anzahl der betroffenen Linien pro Störung angezeigt (keine technischen `route_id`s mehr).
- **Gelöschte bleiben weg**: `dismissedAlerts` in `localStorage` (`sr-dismissed-alerts`), gelöschte IDs werden beim nächsten Feed-Refresh ausgefiltert.

*Tests:* 281/281 grün (inkl. 11 neue i18n-Tests).

---

## Auslieferung 9.9.0

| Schritt | Ergebnis |
|---|---|
| Version | 9.9.0 in `package.json`, `worker.js` (`/api/version`), `radar80.js` (`BUILD`), `index.html` (Badge + Meta) |
| Cache-Buster | 167 Stellen auf `?v=9.9.0` via `tools/sync-version.mjs` |
| Radar Quality Gate | **grün** |
| Workers Builds (Cloudflare) | rot in 0 s – **Vorbefund**, auf jedem PR-Branch so, in der README als kein Qualitätssignal vermerkt |
| Tests | 281/281 grün |
| Service Worker | `/api/*` nie cachen, App-Hülle cachen, Fehlerseiten nicht cachen |

