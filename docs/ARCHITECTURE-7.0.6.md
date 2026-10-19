# Radar 7.0.6 – Architecture & Stability

Dieses Update ist ein **nicht-destruktives** Fundament: Keine alten Radar-Module, Feeds, Styles oder bestehenden Menüs wurden entfernt. Der bestehende Startpunkt `public/index.html` und die Worker-API bleiben unverändert. Die in Releases 5.x–7.x gewachsenen Features arbeiten weiterhin über ihre bisherigen Schnittstellen.

## Modul-Grenzen

- `worker.js`: Cloudflare-API, Cache, Datenproxy und Workers AI; Secrets/AI-Bindings bleiben ausschließlich serverseitig.
- `public/core.js`: Parser und Positions-/GTFS-Datengrundlagen, keine UI-Manipulation.
- `public/app.js`: Leaflet-Karte, Marker, Animation und Datenrefresh; Ist/Soll darf nicht durch eine geschätzte Echtzeitbehauptung ersetzt werden.
- `public/radar70-route.mjs`: deterministische Verbindungssuche und Duplikatbereinigung; niemals Fahrten durch KI erfinden lassen.
- `public/radar703-advisor.mjs`: fahrplanbasierte Bewertung; keine Netzwerkanfragen.
- `public/radar705-groups.mjs`: reine Präsentationsgruppierung mit aufklappbaren Alternativen.
- `public/radar70.js`: Home/Reisen-Oberfläche und Benutzerinteraktion.
- `public/radar705-motion.mjs`: konservative Zeitgrenzen für Marker-Wiedergabe; keine Positionsvorhersage.
- Ältere `radar*.js`/`radar*.css`: bestehende UX-Module bleiben aktiv und werden **nicht** automatisch zusammengeführt.

## Regeln für spätere Updates

1. `npm run verify` vor jedem Release ausführen.
2. Für fachliche Änderungen zunächst einen Test der Datenlogik ergänzen, dann erst die UI anpassen.
3. Neue Funktionen in einem klar benannten Modul entwickeln; keine weitere globale CSS-Kaskade ohne Prüfung der Überschneidungen.
4. Keine Änderungen an Feed-Zuordnung, Positionsechtheit, Ist/Soll oder Cache-Regeln ohne gezielte Regressionstests.
5. Keine KI-Antwort als Echtzeit-Quelle oder verifizierte Fahrt kennzeichnen.
6. GitHub-Commit und bestätigtes Cloudflare-Deployment sind getrennte Schritte; reale iPhone-PWA-Tests bleiben erforderlich.

## Qualitäts-Gate

Das Skript `tools/architecture-check.mjs` prüft **alle** lokalen `.js`/`.mjs`-Dateien mit `node --check`, auflösbare relative Imports, HTML-Ressourcen und doppelt geladene Skripte. `.github/workflows/radar-quality.yml` startet bei Pushes/PRs dieselbe Prüfung plus die bestehende Testsuite.

## Nächste kontrollierte Refactoring-Schritte

Nach erfolgreicher CI und iPhone-Prüfung können zuerst der separate Datenservice, danach die Fahrtdarstellung und zuletzt die Legacy-CSS-Dateien in kleinen PRs konsolidiert werden. Pro Schritt sollen Vorher/Nachher-Tests sicherstellen, dass sämtliche Funktionen erhalten bleiben.
