# Südtirol Radar — KI-Übergabe & Projektregeln

> **Zuerst lesen, bevor du Code änderst.** Diese Datei ist der Einstieg für neue Coding-Assistenten (ChatGPT, Claude, AshnaAI, Gemini usw.). Sie beschreibt das gewünschte Verhalten und den technisch überprüften Stand. **GitHub `main` ist die Wahrheit**, nicht alte ZIP-Dateien, Chats, Versionspläne oder diese Datei, falls sich der Code später verändert hat.
>
> Stand dieser Übergabe: **2026-10-21**. Die Web-App nutzt laut `package.json` Version **9.6.0**; die separate Expo-Hülle hat in `mobile/app.json` weiterhin Version **8.0.0**. Versionen dürfen unterschiedlich sein und sollten nicht ungeprüft gleichgesetzt werden.

## 1. Auftrag und wichtigste Links

**Projekt:** „Südtirol Radar“ — mobil optimierte Web-App zur Darstellung von Bussen, Zügen, Haltestellen, Abfahrten, Anschlüssen und Datenqualität in Südtirol/Trentino. Öffentliche Verkehrsdaten sind nicht zwangsläufig präzises Live-GPS.

- GitHub (Quellcode): https://github.com/hmtckphng2-gif/Radar-S
- Produktions-Web-App: https://radar-s.j9fr2vg4vm.workers.dev/
- Einstiegsseite: `public/index.html`; Worker: `worker.js`; Konfiguration: `wrangler.jsonc`
- Wichtige Tests: `npm run verify`; CI unter `.github/workflows/`
- API-Dokumentation: `docs/RADAR_API_V1.md`
- Architektur-Hintergrund: `docs/ARCHITECTURE-7.0.6.md`

**Arbeitsprinzip:** Vor jeder Änderung den aktuellen `main`-Branch lesen. Möglichst **kleine, nicht-destruktive Commits** erstellen, testen und anschließend das Ergebnis separat auf GitHub Actions und in der echten App prüfen. Ein GitHub-Commit ist **keine** Bestätigung für einen erfolgreichen Cloudflare-Deploy.

## 2. Unverhandelbare Produktregeln

1. **Bestehendes Projekt fortsetzen, niemals grundlos neu bauen.** Keine Features, CSS-Dateien, Feeds, historischen Module oder Tabs löschen, nur weil sie alt heißen. Der lange gewachsene `public/index.html` bindet viele Legacy-Module ein. Refactoring nur nach nachgewiesenen Abhängigkeiten und Regressionstests.
2. **Ist/Soll für Züge ist eine Kernfunktion.** Trenne die aus dem Feed gemeldete Verspätung (z. B. `+0`) strikt von räumlicher/zeitlicher Fahrplanabweichung (z. B. Fahrzeug mehrere Kilometer hinter der Soll-Position). **Keine nicht nachgewiesenen Verspätungsminuten erfinden.** Unterschiede klar sichtbar erklären.
3. **Keine erfundenen Live-Daten.** Wenn Fahrzeuge nur geschätzt, veraltet, ungeklärt oder ohne verifiziertes GPS sind, exakt so kennzeichnen. Behalte letzte bekannte Marker wenn sinnvoll sichtbar, aber **als alt/nicht live** markiert. Nicht automatisch veraltete Positionen ausblenden.
4. **Map-Sync-Fix und funktionierende Marker-Taps erhalten.** Keine Rückkehr zu alten überlagernden Menüs; alle Tabs/Details auf dem iPhone anklickbar lassen. Keine falsche Bewegung/Animation für Positionen ohne aktuelle Daten.
5. **iPhone-first:** PWA und Safari auf dem iPhone 14 Pro prüfen. Kleine, gut lesbare UI, kompakte Details, wisch- und ziehbare Sheets, verlässlich schließbare Dialoge, flüssige Übergänge, sparsame Kartenbuttons; PWA-Stand-alone und Safari können sich unterschiedlich verhalten.
6. **Stil:** modern, minimalistisch, menschlich/handgemacht, hochwertiges dunkles Graphit und auf Wunsch alternative Farbschemata; ungefähr 70 % Apple Maps / 30 % Flightradar24. Kein übertriebenes „KI-UI“, kein hektisches Glow, keine riesigen Header oder aufgeblähte Karten.
7. **Sprache:** Deutsch standardmäßig; Italienisch-Umschaltung nicht entfernen. Hauptnavigation einfach und verständlich.
8. **Verspätungsfarben:** kräftiges Rot grundsätzlich erst ab **15 Minuten**; Ausfälle/Störungen sind eigene Zustände.
9. **Auskunft mit Herkunft und Unsicherheit:** Fahrplan, Prognose, Ist-Position, Soll-Position, Anbieter-Meldung und KI-Einschätzung niemals vermischen. Wagen-/Zugmodelle, Gleise und Linien nur mit nachprüfbarer Zuordnung behaupten.
10. **Releases vollständig statt unfertige „Beta“ versprechen.** Für große neue Funktionssets zunächst eine **anklickbare, auswählbare Feature-Checkliste** mit knappen Beschreibungen anbieten, Auswahl bestätigen und danach implementieren. Nicht ungefragt alle Vorschläge auf einmal einbauen.

## 3. Architektur, Dateien, Ausführung

- **`worker.js`**: Cloudflare Worker mit öffentlichen, überwiegend lesenden JSON-APIs, Feed-Whitelist, Cache, AI-Route und Asset-Weitergabe.
- **`wrangler.jsonc`**: Workers-Bindings (`ASSETS`, `AI`, `AI_JOURNEY_LIMITER`, `HISTORY_DB`). Der tatsächliche Deployment-Worker heißt laut Workflow **`radar-s`**; der `name` in `wrangler.jsonc` kann anders heißen — nicht ohne Nachprüfung umstellen.
- **`public/index.html`**: HTML-Startpunkt; viele CSS-/JS-Includes aus Releases 3.x–8.x. Nicht nur anhand der Dateinamen entscheiden, was entbehrlich ist.
- **`public/core.js`**, **`public/app.js`**: Datenparser/grundlegende Leaflet-Karte, Marker und Refresh.
- **`public/radar*.js/.mjs/.css`**: generationsweise ergänzte UI/Intelligenz/Animation. Je nach Feature konkrete Imports/Events/DOM-IDs suchen und gezielt testen.
- **`public/radar70-route.mjs`**, **`public/radar703-advisor.mjs`**, **`public/radar705-groups.mjs`**, **`public/radar705-motion.mjs`**: Fahrplan-Suche/Deterministik, Advisor, Gruppierung, konservative Bewegungsdarstellung. Siehe Architektur-Doku.
- `public/radar80.js`: **einzige Quelle** fuer die angezeigte Version. Der Brand-Badge zeigt die Version des ausgelieferten Workers (`/api/version`); der Build-Marker `BUILD` dient nur der Erkennung eines veralteten Cache-Standes. Andere Module schreiben keine Version mehr.
- `public/radar83-map.mjs`: 3D-Kinematik. Die Kamera folgt dem Fahrzeug, solange der Nutzer die Karte nicht selbst bewegt hat (`followDecision` in `radar83-logic.mjs`).
- `public/sw.js`: Service Worker der App-Huelle. **Regel: `/api/*` wird nie gecacht** (Live-Daten duerfen nicht als aktuell erscheinen, wenn sie alt sind). Nur die Huelle wird zwischengespeichert; eine Fehlerseite darf nie als Startseite in den Cache.
- `tools/sync-version.mjs`: vergibt die Versionsangabe an **alle** `?v=`-Stellen, auch an die Importe der Module untereinander. Die Worker-Einstiege (`radar-history-worker.mjs`) behalten ihre reinen Pfade, weil der Worker sie von der Platte aufloest.
- `dev/legacy/`: frueher geladene Module, die nicht mehr gebraucht werden. Sie bleiben zum Nachschauen im Repository, werden aber nicht ausgeliefert und nicht getestet.
- `public/.assetsignore`: verhindert, dass lokale Vorschau-Seiten (`test-*.html`, `isolate-*.html`) hochgeladen werden. Die Diagnose-Seiten bleiben oeffentlich.
- **`public/radar66-api.mjs`**: normalisierte Fahrzeuge/Datenqualität für API v1.
- **`public/radar-history-worker.mjs`** und **`db/history-schema.sql`**: Historienspeicher (der Collector ist bewusst deaktiviert).
- **`mobile/`**: separater Expo/React-Native-Client, aktuell mit WebView der Radar-Website und nativer Bedien-/Statushülle. **Nicht** mit der Web-PWA verwechseln.

### Verifizierbare APIs (Source of Truth = aktuelle Worker-Routen)

- `GET /api/version`
- `GET /api/v1/vehicles`, `GET /api/v1/diagnostics`, `GET /api/v1/models`
- STA-/Trentino-/Trenitalia-Positionen, Trip-Updates und Alerts über die serverseitige Whitelist (`FEEDS` in `worker.js`)
- Offizielle Daten aus weiteren Quellen nur nach Quellprüfung, Nutzungsbedingungen, Rate-Limits und transparentem Herkunftsnachweis integrieren.
- `POST /api/ai/journey` / `/api/ai/journey-chat`: Same-Origin-Prüfung, JSON-/Größenvalidierung und Cloudflare-Rate-Limiter sind bereits vorhanden; diese Schutzmaßnahmen **nicht** entfernen. AI-Antworten dürfen nicht als Live-Echtzeitdaten ausgegeben werden.
- `/api/history/*` ist an die D1-Historienarchitektur gebunden; Verfügbarkeit und Datenstand können eingeschränkt sein.

**Öffentliche CORS-Freigabe** für *lesende* API-Daten ist beabsichtigt. Authentifizierte, nutzerspezifische Funktionen benötigen eine separate, abgesicherte Architektur.

## 4. Kritische Schutzregel: D1 History Collector AUS LASSEN

**Wichtig wegen Cloudflare-Free-Tier-Schreibquota und potenzieller Kosten/Fehler:**

- `wrangler.jsonc`: `triggers.crons` muss **`[]`** bleiben.
- `collectHistory` hat einen expliziten Opt-in-Guard über `HISTORY_COLLECTOR_ENABLED === 'true'`. **Nicht aktivieren**, kein Cron eintragen, keinen automatischen Collector deployen.
- D1-Binding kann vorhanden sein, ohne dass Sammel-Jobs aktiviert sein sollen.
- Vor Änderungen am History-Backend Budget, Speicherung, Cleanup/Retention, Schreibfrequenz, tatsächliche Free-Tier-Grenzen und Nutzerzustimmung klären. Nur nach **ausdrücklicher Zustimmung des Nutzers** aktivieren.
- `.github/workflows/radar-deploy.yml` prüft, dass keine Cron-Trigger konfiguriert sind. Diese Prüfung erhalten.

## 5. Datenwahrheit und Qualitätsanzeige

- Positionen können echte Feed-Beobachtungen, verspätete Feed-Einträge, projizierte/geschätzte Werte oder unbekannte Qualität haben.
- `/api/v1/vehicles`: `positionType`, `quality`, `source`, `observedAt`, `sourceCount` korrekt anzeigen, ohne aus einem einzigen Punkt „GPS live“ zu behaupten.
- Bei API-v1-Snapshots werden laut API-Dokumentation Feed-Snapshots älter als 300 Sekunden als `old` eingestuft und aus `vehicles` ausgeschlossen; **die bestehende Webseite kann davon unabhängig klar markierte letzte bekannte Marker anzeigen**.
- Zug-/Bus-Klassifikation und Linienzuordnung nur mit belegten GTFS-Mappings; keine frei erfundenen Liniennummern.
- Duplikate in Stationsabfahrten reduzieren; unklare Daten nicht durch fiktive Präzision ersetzen.
- Zeitplan- und räumliche Abweichung separat darstellen. Rot erst ab +15 Minuten (außer eigenständige Ausfall-/Störungszustände).
  Die Regel liegt einmalig in `radar52-logic.mjs` (`delaySeverity`, `isSevereDelay`) und wird in `radar58.js` verwendet. Sie ist durch `tests/radar52-delay.test.js` abgesichert.
- Anbieter-Feeds maßvoll abfragen, Cache/Request-Limits respektieren; BusOne-Nutzung ggf. nur nichtkommerziell und mit Quellenangaben.

## 6. Mobile / Apple App Store: aktueller Stand

Der User arbeitet mit **iPhone 14 Pro und einem Windows-11-Lenovo Flex 5, ohne Mac**. Er möchte langfristig eine App, die **alle im Apple App Store** finden können. Keine kostenpflichtige Developer-Mitgliedschaft vorhanden bzw. kein App Store Connect-Zugang bestätigt; Apple meldete: „Dein Apple Account ist nicht für iTunes Connect eingerichtet“. Der kostenlose Beta-Developer-Zugang genügt **nicht** zur App-Store-Veröffentlichung.

Das Repo enthält:
- `mobile/app.json`: Expo App-Name „Südtirol Radar“, **Slug `sebastian-fischer`** (muss mit bestehendem Expo-Projekt übereinstimmen), **Owner `seebabuss-team`**, verknüpfte EAS-Project-ID `7f2ea5bd-9a55-41a6-9e8a-ff3273e7626b`; iOS-Bundle-ID `it.suedtirolradar.mobile`.
- `mobile/eas.json`: `production`-Profil, `preview`-Profil mit **iOS-Simulator**, Versionierungsquelle `remote`.
- Der **letzte dokumentierte iOS-Production-Build scheiterte an fehlenden Apple-Signing-Credentials**, nicht mehr am Expo-Slug oder der EAS-Projekt-ID.
- EAS-Build from GitHub: Git ref **`main`**, Base Directory **`mobile`**, iOS, Build profile **`production`** (exakte Schreibweise), automatische Store-Übermittlung zunächst **aus**.
- Für App-Store-Veröffentlichung braucht der rechtlich berechtigte Herausgeber eine gültige Apple Developer Program-Mitgliedschaft oder tatsächlich bewilligten Gebührenerlass. **Keine Altersangaben fälschen, keine Signierung umgehen.**
- **Expo Go** zum Entwicklungs-Test auf dem iPhone; **PWA** über Home-Bildschirm; der iOS-Simulator-Build ist **nicht** als direkt installierbare iPhone-App zu verwechseln. Eine WebView-basierte App ist nicht automatisch App-Review-fähig (Apple Minimum Functionality beachten).

**Keine Apple-Keys, Expo-Tokens, Cloudflare-Secrets, Passwörter oder private Zertifikate ins Repository schreiben.**

## 7. UX- und Release-Hintergrund (keine pauschalen Implementierungszusagen)

Frühere Nutzerwünsche, die bei neuen Features berücksichtigt werden sollen:
- Startscreen als kompakter Bahnhofs-Abfahrtsmonitor mit gespeicherten Stationen, daneben Karte und klare Reiter.
- Stations-/Bahnhof-Details, Anschluss-Radar, Reisefortschritt, Live Journey, globale Suche, Störungs-/Quellenstatus, Analytics mit belastbarer Datengrundlage.
- Smart Follow Camera, natürliches hereinzoomen beim Fahrzeug-Tap, glatte Animation und konsequent funktionierende Gesten.
- Linien-Störungsbanner bei **tatsächlich belegten** Problemen; keine angebliche Live-Notification ohne echte Push-Infrastruktur.
- Minimalistisch-graphitfarbene Map-Cluster (ab 8.0.1 überarbeitet), Zoom zu tatsächlichen Cluster-Mitgliedern.
- Weniger Buttons auf der Karte, keine überlappenden Sheets, mobile `Ist/Soll`-Anzeige immer sichtbar und verständlich.
- Bei neuen großen Versionen zunächst Feature-Auswahl anbieten und nur Ausgewähltes umsetzen.

**Historische Release-Namen sind nicht gleich aktueller Status.** Bei Widersprüchen immer GitHub-`main`, Tests und Live-Deployment prüfen.

## 8. Security, SEO, Performance

Die erste gezielte Sicherheits-/SEO-Runde (Commit `f2fa572`, 2026-10-20) hat Titel/Description, Canonical, Open-Graph-Infos, Favicon, Sitemap/`robots.txt` sowie zusätzliche API-Header ergänzt. **Das war kein vollständiger Security-Audit.** Die zuvor angestoßene Vollprüfung/Testsuite hatte Zeitüberschreitungen. Nicht behaupten, dass alle Secrets/XSS/Dependencies nachweislich sicher sind.

Vor größeren Releases:
1. Secrets **ohne ihren Inhalt zu protokollieren** prüfen, besonders GitHub-History, GitHub Actions und Cloudflare-Umgebungsvariablen. Bei Leak Schlüssel rotieren.
2. API-Eingaben validieren, Response-/Upstream-Größen und Ratenbegrenzungen kontrollieren, sensible CORS-Konfiguration begrenzen und XSS-Sinks (`innerHTML`, dynamisches HTML) gezielt überprüfen.
3. Eine passende CSP zunächst in Report-Only-Konzept testen, weil externe Karten-/Font-/CDN-Ressourcen und die umfangreiche Legacy-Struktur sonst brechen können. Nicht blind CSP aktivieren.
4. Externe Bibliotheken/Abhängigkeiten und GitHub Actions prüfen; keine destruktiven automatischen Upgrades.
5. HTML enthält viele legacy JS-Module. **Erst Performance-Messung und Import-/DOM-Abhängigkeitsanalyse**, dann modulweise konsolidieren; keine beliebigen Skripte entfernen.
6. Für Marketing/SEO sind Sitemap/Metadata hilfreich; die Live-Webapp ist ein komplexes Kartenprodukt, keine Blog-Site. Nicht jedem Punkt aus Social-Media-Checklisten ohne Kontext folgen.

## 9. Definition of Done für ein Update

- Vorher: aktuellen Branch/Dateien lesen, Versionsstand belegen, Ziel mit kurzen Auswahloptionen abstimmen, wenn es um eine neue größere Releaseplanung geht.
- Änderung: so klein wie möglich, bestehenden Zustand respektieren, migrations-/rollbackfähig, kein Entfernen bestehender Funktionen.
- Tests: `npm run check`, `npm test`, möglichst `npm run verify`; `node tools/mobile-config-check.mjs` bei Änderungen in `mobile/`. Test-Fehler und Timeouts ehrlich dokumentieren.
- Regression: Marker, Züge/Busse-Filter, Stationsmonitor, Details, Ist/Soll, Follow, Sprache, PWA-iPhone, Safari, Dark/Light, Abfahrten, Favoriten.
- Daten: Herkunft, Zeitstempel, Qualitätsstatus und Verspätungslogik verifizieren. Keine erfundenen Verspätungen.
- Deployment: Commit-Link, Actions-Status und tatsächlicher Cloudflare-Version-Endpunkt separat prüfen. **Erst als live melden, wenn bestätigt.**
- Safety: `triggers.crons=[]`, History-Collector weiterhin explizit deaktiviert, keine Secrets.
- Ausgabe für User: Was geändert wurde, was nicht, Tests, mögliche Risiken, direkter GitHub-/Live-Link und ggf. ehrliche Blocker. Kommunikation auf **Deutsch**, gern locker und direkt.

## 10. Start-Prompt für eine neue KI

> Ich möchte Südtirol Radar weiterentwickeln. Lies **zuerst `RADAR_AI_CONTEXT.md` im aktuellen `main`-Branch**, dazu `README.md`, `docs/ARCHITECTURE-7.0.6.md`, `docs/RADAR_API_V1.md`, `worker.js`, `wrangler.jsonc` und die betroffenen UI-Dateien. Verifiziere den aktuellen Stand, statt Versionsstände zu raten. Bewahre bestehende Features, Map-Sync-Fix, trainbezogenen Ist/Soll-Vergleich und korrekte Datenqualitätskennzeichnungen. **D1 History Collector NICHT aktivieren.** Plane neue größere Versionen erst als auswählbare Feature-Checkliste. Mach Änderungen schrittweise mit Tests und zeige Commit/Deploy-Status getrennt. Antworte auf Deutsch. Frage vor destruktiven Änderungen, neuen Kosten, neuen Secrets oder Produktentscheidungen.

---

*Diese Übergabe enthält bewusst keine geheimen Schlüssel oder Kontopasswörter. Bei jeder Nutzung die Datei und den aktuellen Code erneut auf Aktualität prüfen.*
