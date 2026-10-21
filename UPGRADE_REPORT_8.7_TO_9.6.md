# Südtirol Radar – Upgrade-Report 8.7 bis 9.6

**Ergebnis:** Version **9.6.0**, **231 Tests grün**, alle Commits lokal.
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

**`1ac6e1f`**

- **`frontAxis` in `models.json`**: Manche Modelle sind um 180° falsch herum authored. `frontAxis: '+z'` dreht sie. Damit ist die Ausrichtung korrigierbar, ohne das Modell anzufassen.
- **Kontaktschatten**: Zwei flache Scheiben unter dem Fahrzeug, damit es auf dem Boden steht statt zu schweben. Keine Textur, kein Schattenwurf, kein Canvas – das wäre auf dem Handy zu teuer.
- Der Schatten skaliert mit, wenn das echte Modell das schematische ersetzt.

*Tests:* `radar83-model.test.js` misst die Ausrichtung und prüft, dass der Schatten flach, transparent und texturlos ist.

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

**`576bdeb`**

- MapLibre ruft den Custom-Layer in **jedem** Frame auf. Jetzt wird nur noch gezeichnet, wenn sich Kamera oder Modell bewegt haben (`renderKey` aus Projektionsmatrix + Position + Ausrichtung). Auf dem Handy ist das der teuerste Einzelposten der 3D-Ansicht.

## 9.3 – Suche und Navigation

**`a024a5e`**

- Die **Enter-Taste** im Suchfeld wählt den ersten passenden Zug oder Bus und zentriert die Karte darauf (`firstSearchHit`, `jumpToFirstHit`).
- Die Trefferprüfung nutzt dieselbe Sichtbarkeitslogik wie die Marker, es werden also keine ausgeblendeten Fahrzeuge gewählt.

## 9.4 – Offline- und Fehlerzustände

**`a024a5e`**

- Ein **Offline-Banner** erscheint, wenn `navigator.onLine` false ist, und verschwindet wieder, sobald die Verbindung zurückkommt.
- Der Text sagt ausdrücklich, dass die Live-Positionen nicht aktualisiert werden können und Fahrplan und gespeicherte Daten verfügbar bleiben. Alte Positionen werden nicht stillschweigend als aktuell dargestellt.

## 9.5 – Barrierefreiheit

**`a5688c6`**

- Die Karte ist mit **Tab** erreichbar und beschrieben (Pfeiltasten verschieben die Karte).
- Das Detail-Panel ist mit dem Titel verknüpft (`aria-labelledby="sheetTitle"`) und kann den Fokus bekommen (`tabindex="-1"`).
- Beim Öffnen wandert der Fokus **in das Panel**, beim Schließen **zurück auf die Karte**.

## 9.6 – Finaler Qualitätscheck

- **231 Tests grün** (vorher 221, +10), 128 JS-Module geprüft, 92 HTML-Verweise in Ordnung, alle 96 Cache-Buster synchron auf 9.6.0.
- `node tools/mobile-config-check.mjs` bestanden (Expo-Hülle bleibt auf 8.0.0, eigene Versionsspur).
- Versionssprung auf **9.6.0** in `package.json`, `worker.js` (`/api/version`), `radar80.js` (`BUILD`) und `index.html` (Badge + Meta-Description).

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

---

## Was nicht gemacht wurde

- **Kein Push, kein Deploy.** Alles liegt lokal.
- **Keine bestehende Funktion neu gebaut.** 3D-Zuganimation, Abfahrten, Live-Daten, Ist/Soll und die 2D-Karte sind unverändert vorhanden.
- **Keine Secrets**, keine neuen Abhängigkeiten, kein Build-Schritt.
- **Der History-Collector bleibt deaktiviert** (`triggers.crons: []`, Opt-in-Guard unverändert).
- **Apple/EAS unverändert** – kein App-Store-Zugang, keine Signaturen.

## Offen für dich

1. **Push und Deploy** freigeben – dann laufen CI, Quality Gate und Deploy.
2. **Auf dem iPhone prüfen**: 3D-Fahrt, Ausrichtung des FLIRT (`frontAxis` steht auf `-z`, bei Bedarf auf `+z` stellen), Offline-Banner, Fokuswechsel im Detail-Panel, Abfahrten mit Live-Status.
3. Optional die 15-Minuten-Regel zentralisieren (`radar58.js` nutzt sie an zwei Stellen inline) – bewusst liegen gelassen, weil sie Funktionsverhalten berührt.
