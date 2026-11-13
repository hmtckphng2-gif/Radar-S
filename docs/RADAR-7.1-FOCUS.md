# Radar 7.1 – Cinematic Vehicle Focus

## Zweck

Auswahl von Zügen und Bussen: längere Leaflet-`flyTo`-Animation (1,3–1,95 Sekunden) zu **tatsächlich vorhandenen** Fahrzeugmarkern, ohne GTFS-Positionsdaten zu schätzen oder neue Feeddaten zu erzeugen. Die vorhandene Fahrzeugübersicht wird erst **nach** dem Kamerafokus als kleines, aufziehbares Sheet sichtbar. Ist/Soll, Fahrtdetails, Snap-Gesten, Follow Mode und bisherige Menübereiche bleiben bestehen.

## Implementierung

- `public/radar71-camera-logic.mjs`: reine Funktionen für Zoom, Dauer, sichere Position und gültige Fahrtrichtung.
- `public/radar71-camera.mjs`: abbrechbarer Kamera-Ablauf, Richtungsanzeige und optional native Map-Bearing API.
- `public/radar71.css`: Übergangseffekte und visuelle Fokussierung.
- `public/app.js`: setzt die Panel-Verzögerung vor der Fahrzeugauswahl.
- `public/radar42.js`: kleine Sheet-Snap-Schnittstelle; keine neue parallele Gestenimplementierung.
- `public/radar52.js`: die ältere 0,75-s-Kamerafahrt wird bei aktiver 7.1-Kamera übersprungen; sämtliche Analysen bleiben.
- `public/radar43.js`, `public/radar55.js`: vorhandene Follow-Kameras greifen nicht während des Cinematic-Focus ein.

## Kartendrehung

**Leaflet 1.9.4 besitzt keine native Drehfunktion.** Ohne zusätzliche kompatible Kartenbibliothek zeigt Radar deshalb nur eine drehende Richtungsmarkierung, sofern eine frische Fahrtrichtung aus dem Feed kommt. Wird später eine geprüfte `map.setBearing()`-Implementierung installiert, kann die echte Kameradrehung automatisch genutzt werden. Eine CSS-Drehung aller Karten-Panes wurde absichtlich vermieden: sie würde Touch-Koordinaten, Map-Sync und Marker gefährden.

## Sicherheit und UX

- Bei veralteten Positionen wird der Datenstatus angezeigt, kein Live-GPS behauptet.
- Reduzierte Bewegung (`prefers-reduced-motion`) überspringt den langen Kameraflug.
- Schnelle Auswahl eines anderen Fahrzeugs bricht den vorherigen Fokus ab.
- Manuelles Ziehen, Multi-Touch, Mausrad, Escape, Wechsel des Tabs und Schließen des Sheets beenden laufende Effekte.
- Die gemeldete Position bleibt beim Zentrieren der einzige räumliche Bezug.

## Tests

`npm run verify` inklusive fünf neuer Unit-Tests ausführen. Vor der Behauptung, dass PWA/Standalone visuell perfekt funktioniert, auf einem realen iPhone prüfen.
