# Entwicklung

Dieser Ordner ist **nicht** Teil der ausgelieferten Web-App.

## `legacy/`

Frühere Module, die nicht mehr geladen werden. Sie liegen hier, statt gelöscht zu werden, damit
nichts verloren geht und die Historie lesbar bleibt. Details in `legacy/README.md`.

Die Dateien werden nicht getestet (`npm test` sucht nur in `tests/*.test.js`) und nicht
ausgeliefert. Sie enthalten keine Geheimnisse und keine personenbezogenen Daten.

## Vorschau-Seiten

Die Seiten `public/test-*.html` und `public/isolate-*.html` liegen bewusst in `public/`, weil sie
absolute Pfade auf die App verwenden (`/radar50.css` usw.) und dadurch direkt gegen eine
lokal laufende App getestet werden können. `public/.assetsignore` sorgt dafür, dass Wrangler sie
**nicht** hochlädt - im Repository bleiben sie, in der Produktion sind sie nicht erreichbar.

Lokal testen:

```sh
npx wrangler dev
# dann http://localhost:8787/test-a.html oeffnen
```
