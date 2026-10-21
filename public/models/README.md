# 3D-Modelle

Dieser Ordner enthaelt optionale, echte 3D-Fahrzeugmodelle fuer die 3D-Karte.

## Wichtig: nichts hier ist Pflicht

Laedt eine Datei nicht, schlaegt der Download fehl oder ist sie zu gross,
benutzt die App **automatisch das schematische Modell** aus
`public/radar83-model.mjs`. Die 3D-Ansicht geht dadurch nie kaputt.
`models.json` beschreibt nur, was benutzt werden *soll*.

## Dateien

| Datei | Zweck |
|---|---|
| `models.json` | Konfiguration: Dateiname, reale Masse, Drehung, Namensnennung |
| `CREDITS.md` | Pflichtangaben nach der Lizenz der verwendeten Modelle |

## Eigenes Modell einbauen

1. `.glb` nach `public/models/` legen (`train.glb` oder `bus.glb`)
2. In `models.json` eintragen:

```json
"train": {
  "file": "train.glb",
  "lengthMeters": 44.5,
  "heightMeters": 4.1,
  "yawOffset": 0,
  "credit": {
    "title": "Beispiel FLIRT",
    "author": "Name des Erstellers",
    "license": "CC BY 4.0",
    "licenseUrl": "http://creativecommons.org/licenses/by/4.0/",
    "source": "https://sketchfab.com/3d-models/..."
  }
}
```

3. `credit` ausfuellen. **Bei CC BY ist die Namensnennung Pflicht** - sie
   erscheint dann in der 3D-Ansicht unter dem Bildschirmrand.

## Was der Loader macht

- laedt die `.glb` ueber den GLTFLoader vom CDN
- misst die Bounding-Box des Modells und **skaliert es auf die echten Masse**
  aus `models.json` - ein fremdes Modell wird also nicht geraten, sondern
  gemessen
- dreht das Modell so, dass seine laengste waagerechte Achse auf der
  Z-Achse liegt, und stellt es auf den Boden (`y = 0`)
- zentriert es auf seinen Mittelpunkt
- wendet `yawOffset` an, falls das Modell in die falsche Richtung schaut

Die automatische Drehung um die Hochachse kann eine Nase oder einen
Anhaenger nach vorn zeigen. Deshalb `yawOffset`: nach dem ersten Blick auf
dem Geraet auf 90, 180 oder 270 stellen.

## Groesse

Die App liefert aktuell rund 780 KB JavaScript und CSS. Ein unoptimiertes
Modell liegt bei 3 bis 18 MB. Vor dem Einsatz verkleinern:

```sh
npx @gltf-transform/cli optimize train.glb --compress meshopt --texture-compress webp
```

Zielgroesse: unter 1,5 MB. Das Modell wird **erst geladen, wenn jemand die
3D-Ansicht oeffnet** - wer 3D nie nutzt, laedt es nie.
