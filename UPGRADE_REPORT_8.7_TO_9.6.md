# Südtirol Radar – Upgrade-Report 8.7 bis 9.6

**Ergebnis:** Version **9.6.0**, **238 Tests grün**, 16 Commits lokal.
**Push und Deployment wurden bewusst NICHT ausgeführt** – das braucht deine ausdrückliche Zustimmung.

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
2. **Die App-Huelle wird zwischengespeichert**, damit die Karte ohne Verbindung startet.
3. **Keine Fehlerseite wird gespeichert.** Ein 502 vom Proxy darf nicht als Startseite in den Cache wandern.

*Im Browser nachgemessen:* Cache **134 Dateien**, davon **0 aus `/api/`**. Mit abgeschaltetem Server lädt die App vollständig aus dem Cache (Titel, 41 Module, Version 9.6.0).

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

- **Kein Push, kein Deploy.** Alles liegt lokal.
- **Keine bestehende Funktion neu gebaut.** 3D-Zuganimation, Abfahrten, Live-Daten, Ist/Soll und die 2D-Karte sind unverändert vorhanden.
- **Keine Secrets**, keine neuen Abhängigkeiten, kein Build-Schritt.
- **Der History-Collector bleibt deaktiviert** (`triggers.crons: []`, Opt-in-Guard unverändert).
- **Apple/EAS unverändert** – kein App-Store-Zugang, keine Signaturen.

### Zwei Punkte, die schon fertig waren

Beim Nachsehen habe ich zwei Aufgaben gefunden, die ich im Bericht als offen genannt hatte – sie sind aber **bereits vorhanden**:

1. **Die 15-Minuten-Regel ist zentral.** `radar52-logic.mjs` liefert `isSevereDelay()`, `radar58.js` benutzt sie. Sie steht nirgends mehr inline.
2. **Die Live-Verspätung je Reiseabschnitt existiert.** `freshDelay(leg,end)` in `radar70.js` rechnet die Verspätung für jeden Abschnitt der gefundenen Reise aus.

Beides wurde **nicht** neu gebaut.

## Offen für dich

1. **Push und Deploy** freigeben – dann laufen CI, Quality Gate und Deploy.
2. **Auf dem iPhone prüfen**: FLIRT-Ausrichtung (`frontAxis` steht auf `-z`, bei Bedarf auf `+z` umstellen), Citaro (sollte jetzt vorwärts fahren), Kontaktschatten, Offline-Banner, Fokuswechsel im Detail-Panel, Abfahrten mit Live-Status.
3. **Die visuelle Prüfung der 3D-Ausrichtung steht noch aus.** Der Screenshot-Weg im Browser war nicht bedienbar; die Ausrichtung habe ich deshalb aus den GLB-Knoten abgeleitet. Das ist belastbar, aber ein Blick auf das Gerät wäre besser.
