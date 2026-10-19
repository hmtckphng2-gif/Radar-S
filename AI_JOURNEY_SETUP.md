# Radar 7.0.3 – KI-Reiseberater

Die fahrplanbasierte Empfehlungslogik ist ohne externen KI-Dienst nutzbar.

Für echte Modellantworten im Cloudflare Worker:
- In Cloudflare unter Worker-Secrets `OPENROUTER_API_KEY` setzen. Niemals in GitHub oder Frontendcode eintragen.
- `OPENROUTER_MODEL` als Umgebungsvariable auf ein verfügbares OpenRouter-Modell setzen.
- Wrangler erstellt mit `wrangler.jsonc` die Binding `AI_JOURNEY_LIMITER` (6 Anfragen pro Minute pro Client-IP und Cloudflare-Standort).
- Zusätzlichen Cloudflare-WAF-Schutz und Anbieter-Kostenlimits empfehlen wir für öffentliche Nutzung.

Ohne Modellkonfiguration liefert der Worker 503 und die Oberfläche kennzeichnet eine rein fahrplanbasierte Antwort. Die an das KI-Modell übertragenen Daten enthalten nur die Frage und bis zu acht kompakte Fahrplanverbindungen; keine GPS-Positionen.
