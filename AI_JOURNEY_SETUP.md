# Radar-Assistent – Free-only Preview

## Anbieter und Reihenfolge

- **Groq `openai/gpt-oss-20b`** zuerst, nur wenn `GROQ_FREE_TIER_ONLY=true` und das Secret `GROQ_API_KEY` vorhanden ist.
- **Cloudflare Workers AI `@cf/google/gemma-4-26b-a4b-it`** als Fallback, nur wenn `CLOUDFLARE_AI_FREE_TIER_ONLY=true` und das AI-Binding vorhanden ist.
- Es gibt keinen kostenpflichtigen Anbieter-Fallback. Sind beide kostenlosen Kontingente erschöpft, liefert die API eine vorübergehende Nichtverfügbarkeit.

Groq Free-Plan-Limits können sich ändern und gelten organisationsweit. Cloudflare Workers AI hat im Workers-Free-Tarif ein tägliches kostenloses Neurons-Kontingent; auf Workers Paid kann Mehrverbrauch kostenpflichtig werden. Die beiden `*_FREE_TIER_ONLY`-Variablen sind eine ausdrückliche Betreiberfreigabe, keine automatische Tarif-Erkennung. Vor einer öffentlichen Freigabe muss der Betreiber bestätigen, dass beide Konten tatsächlich im Free-Tier laufen.

## Sicherheitsmodell

`POST /api/assistant` akzeptiert nur same-origin JSON, kurze Fragen und höchstens sechs kurze Chat-Nachrichten. Der Browser überträgt weder GPS noch Koordinaten. Der Chat wird nicht serverseitig gespeichert oder protokolliert. `AI_JOURNEY_LIMITER` begrenzt Anfragen auf fünf pro Minute und IP/Worker-Region (Cloudflare Rate Limiting ist approximativ und nicht global strikt).

Die KI erhält ausschließlich frische GTFS-Realtime-Fakten. Fahrzeugpositionen, Zugnummern und Buslinien werden nur bei einer tagesaktuellen statischen GTFS-Referenz und exakt passender Fahrt aufgenommen. Gemeldete Verspätung bleibt von einer positionsbasierten Fahrplanabweichung getrennt. Offizielle STA-Service-Alerts werden als solche gekennzeichnet. Jede KI-Begründung muss auf eine vom Worker erzeugte Fakten-ID verweisen; unbekannte oder erfundene IDs werden verworfen. Wenn keine ausreichend frischen Fakten existieren, wird kein Modell aufgerufen.

`/api/*` bleibt vom Service-Worker-Cache ausgeschlossen. D1 History Collector und Cron bleiben deaktiviert. 3D ist standardmäßig ausgeschaltet und kann in der Preview gezielt mit `?radar3d=on` getestet werden.

## Preview-Konfiguration

Die Preview-Konfiguration setzt `ASSISTANT_ENABLED=true`, `GROQ_FREE_TIER_ONLY=true` und `CLOUDFLARE_AI_FREE_TIER_ONLY=true`. Das Secret `GROQ_API_KEY` bleibt serverseitig. `AI` und `AI_JOURNEY_LIMITER` werden als Cloudflare-Bindings konfiguriert. Production (`radar-s`/`main`) wird nicht verändert.
