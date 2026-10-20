# Südtirol Radar 8.0 — Expo iPhone App

Dieses **separate native Projekt** ergänzt die bestehende Radar-Website. Cloudflare Worker und D1 bleiben unverändert; der History-Collector bleibt deaktiviert. Es werden **keine** Apple-, Expo- oder Cloudflare-Schlüssel eingecheckt.

## Lokal starten

```bash
cd mobile
npm install
npx expo install --fix
npx expo start
```

Die native App hat Karte, Verbindungs-/Quellenstatus, Teilen, Zurück zur Karte, Lade- und Fehlermeldungen. WebView lädt `https://radar-s.j9fr2vg4vm.workers.dev/`. Ohne Internet steht die Karte nicht offline zur Verfügung.

## Expo und Apple verbinden

1. Expo-Konto erstellen/anmelden: `npx eas-cli login`, dann `npx eas-cli init` **im Ordner mobile**, damit die echte Expo-Projekt-ID in `app.json` eingetragen wird.
2. Bundle ID `it.suedtirolradar.mobile` auf Verfügbarkeit prüfen und gegebenenfalls **vor dem ersten signierten Build** ändern.
3. Apple Developer Program über einen rechtlich volljährigen Account-Inhaber einrichten. 15-Jährige dürfen nicht über eine falsche Altersangabe einschreiben.
4. `npx eas-cli build --platform ios --profile production` — iOS-Distribution und Signierung mit Apple-Account einrichten.
5. App-Store-Connect-App, Privacy-/Datenschutzangaben, Support-URL, Screenshots, App-Icon und Metadaten erstellen.
6. `npx eas-cli submit --platform ios --profile production` nach Konfiguration der Store-Credentials.
7. App Store Connect: Build für Review auswählen und App Review starten. **EAS Submit veröffentlicht nicht automatisch im App Store.**

`eas.json` enthält bewusst keine erfundene Apple-App-ID, Project ID, Apple-Team-ID oder Zugangsdaten.

**App Review:** Apple prüft Mindestfunktionalität (4.2); die native Statusansicht, Share- und Offline-Recovery sind ein erster Schritt. Eine Freigabe einer teilweise WebView-basierten App ist nicht garantiert.
