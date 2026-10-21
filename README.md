# Südtirol Radar 8.5

Mobil optimierte Live-Karte für Züge, Busse, Abfahrten und Haltestellen in Südtirol
und Trentino. Cloudflare Worker, kein Build-Schritt, keine Abhängigkeiten.

**Produktion:** https://radar-s.j9fr2vg4vm.workers.dev/
**Quellcode:** https://github.com/hmtckphng2-gif/Radar-S

## Aufbau

| Ort | Inhalt |
|---|---|
| `worker.js` | Cloudflare Worker: Feed-Proxy, `/api/v1/*`, Workers-AI-Reiseberater, RFI- und ViaggiaTreno-Routen |
| `wrangler.jsonc` | Bindings: `ASSETS`, `AI`, `AI_JOURNEY_LIMITER`, `HISTORY_DB` |
| `public/` | Die Web-App. Wird 1:1 als statisches Asset ausgeliefert, kein Bundler |
| `public/core.js` | Reine GTFS-Funktionen ohne DOM: Parser, Verspätung, Shape-Projektion |
| `public/app.js` | Die App: Karte, Marker, Animation, Detail-Panels |
| `public/radar83-*.mjs` | 3D-Modus: MapLibre-Karte, FLIRT-inspiriertes 3D-Modell, Kamera-Logik |
| `public/data/*.json` | Statische GTFS-Indizes, Haltestellen und Strecken (täglich per Action erneuert) |
| `tests/` | 190 Tests, reine Logik ohne Browser |
| `tools/` | Architekturprüfung, GTFS-Import, Mobile-Konfigurationsprüfung |
| `dev/legacy/` | Frühere Module, die nicht mehr geladen werden. Siehe `dev/legacy/README.md` |

## API

| Route | Zweck |
|---|---|
| `GET /api/version` | Version des laufenden Workers |
| `GET /api/v1/vehicles` | normalisierte Fahrzeug-Snapshots mit `positionType`, `quality`, `observedAt` |
| `GET /api/v1/diagnostics` | Feed-Status, Duplikate, Konflikte zwischen Quellen |
| `GET /api/v1/models` | nur belegte Fahrzeugtyp-Zuordnungen |
| `GET /api/health` | Erreichbarkeit des Proxys |
| `GET /api/sta`, `/api/trentino`, `/api/trains` | Roh-Feeds (GTFS-RT JSON) |
| `GET /api/station-platforms/{id}` | RFI-Anzeigetafel |
| `GET /api/train-platforms/{nummer}` | ViaggiaTreno-Fahrtverlauf |
| `POST /api/ai/journey`, `/api/ai/journey-chat` | Reiseberater, nur same-origin, Rate-Limit 6/60 s |
| `GET /api/history/*` | Historie, **standardmäßig deaktiviert** |

Alle lesenden Routen dürfen `GET`, `HEAD` und `OPTIONS`.

## Datengrundsätze

- Anzeigte Positionen sind **empfangene Feed-Positionen**, keine vorhergesagten GPS-Positionen.
- Gemeldete Verspätung (GTFS-RT) und räumliche Abweichung vom Fahrplan sind **zwei verschiedene
  Werte** und werden getrennt ausgewiesen. Kräftiges Rot gilt erst ab 15 Minuten Verspätung.
- Linien, Zugnummern und Fahrtziele werden nur gezeigt, wenn sie durch statische GTFS-Daten
  oder eine offizielle Quelle belegt sind.
- Kein Zugriff auf den D1-History-Collector: `wrangler.jsonc` hat `triggers.crons: []` und der
  Collector bleibt bis zu einer ausdrücklichen Freigabe deaktiviert.

## Entwicklung

```sh
npm run verify        # Versionspruefung + Architekturpruefung + alle Tests
npm run check         # nur Versionspruefung, Syntax, Imports, HTML-Referenzen
npm run sync          # setzt alle Cache-Buster auf die package.json-Version
npm test              # nur Tests
node tools/mobile-config-check.mjs
```

Node 20 oder neuer wird gebraucht. Es gibt bewusst **keine** Abhängigkeiten.

**Eine Versionsangabe im ganzen Projekt.** `package.json` ist die Quelle. Beim
Erhoehen der Version:

```sh
npm version 8.6.0 --no-git-tag-version
npm run sync          # alle "?v="-Stellen nachziehen
```

`npm run check` bricht ab, wenn eine Cache-Buster-Stelle nicht zur
`package.json` passt. Ein vergessener Cache-Buster wuerde eine alte Datei im
Browser-Cache liegen lassen, die dann mit der neuen Datei kämpft - genau das
hat im August 2026 zu einer falschen Versionsanzeige gefuehrt.

**Ein echtes 3D-Modell einbauen.** Die 3D-Karte kann statt des schematischen Modells
eine heruntergeladene `.glb` benutzen. Mit einem kostenlosen Sketchfab-Token geht das
in einem Schritt:

```sh
$env:SKETCHFAB_TOKEN="sk-..."
node tools/fetch-sketchfab-model.mjs --uid 3f45e0d560614aab98cee987cb7347e9 --kind train
```

Das Skript laedt die Datei nach `public/models/` und schreibt die Namensnennung
automatisch in `models.json` und `CREDITS.md`. Fehlt die Datei oder schlaegt der
Download fehl, bleibt das schematische Modell stehen - die 3D-Ansicht geht nie kaputt.

`public/.assetsignore` verhindert, dass die lokalen Vorschau-Seiten (`test-*.html`,
`isolate-*.html`) hochgeladen werden. Die Diagnose-Seiten bleiben absichtlich öffentlich.

## Deployment

Die GitHub-Action „Deploy Radar to Cloudflare" deployed bei jedem Push auf `main`. Sie prüft
zuerst `npm run verify`, stellt sicher, dass kein Cron-Trigger gesetzt ist, deployt und
verifiziert danach die Live-Version gegen `package.json`.

Die Cloudflare-Integration „Workers Builds" läuft zusätzlich und markiert Pull-Request-Branches
als fehlgeschlagen, ohne dass dort etwas gebaut wird. Das ist kein Signal über die Qualität des
Commits: maßgeblich sind der Quality-Gate-Check und der Deploy-Check auf `main`.

## Nutzungsbedingungen

BusOne: nichtkommerziell, Quellenangabe, vernünftige Abfragefrequenz. Für einen kommerziellen
Einsatz ist die Erlaubnis des Anbieters einzuholen.
