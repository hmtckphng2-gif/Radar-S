# Südtirol Radar – Regeln für die Weiterarbeit

Diese Regeln gelten für alle Änderungen an diesem Projekt. Sie sind kurz, damit sie im Alltag eingehalten werden.

## 1. Kein Push und kein Deploy ohne Freigabe
Alle Commits liegen erst lokal. Push auf `main` und Deploy auf Cloudflare nur, wenn du (der Nutzer) das ausdrücklich sagst.

## 2. Nichts neu bauen, was schon funktioniert
3D-Zuganimation, Abfahrten, Live-Daten, Ist/Soll, 2D-Karte, Fokuswechsel, Offline-Hülle bleiben unverändert vorhanden. Nur ergänzen, reparieren, beweisen.

## 3. Kleine Commits, jede Phase mit Test
Pro Phase: eine fokussierte, echte Änderung + mindestens ein neuer Test + `npm run verify` grün. Commit-Nachricht auf Deutsch, schlicht.

## 4. Keine Secrets, keine neuen Abhängigkeiten, kein Build-Schritt
Keine API-Schlüssel in Dateien. Keine npm-Pakete. Kein Bundler. Alles statisch, nur Node.js für Tests.

## 5. Version ist eine Quelle der Wahrheit
`package.json` → `worker.js` (`/api/version`) → `radar80.js` (`BUILD`) → alle `?v=` per `npm run sync`. Alles auf die gleiche Version.

## 6. Live-Daten nie erfinden
Alles unter `/api/` läuft ausschließlich über das Netz. Nie im Cache speichern, nie als aktuell ausgeben, wenn alt.

## 7. Deutsch, schlichte Worte
Kommentare, Commits, Berichte auf Deutsch, sparsam und verständlich.
