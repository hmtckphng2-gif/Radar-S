# Radar 7.0.4 – Cloudflare Workers AI Reiseberater

**Modell:** `@cf/google/gemma-4-26b-a4b-it` (Gemma 4 26B A4B) über das native Cloudflare-AI-Binding `env.AI`.

**Kein OpenRouter-Konto, keine externe API und kein API-Key erforderlich.** Das AI-Binding wird unter `ai.binding: "AI"` in `wrangler.jsonc` konfiguriert.

Cloudflare Workers AI hat auf dem kostenlosen Workers-Tarif ein Kontingent von **10.000 Neurons pro Tag**, keine 10.000 oder 100.000 Anfragen. Bei ausgeschöpftem Limit oder fehlendem AI-Binding bleibt die lokale, regelbasierte Fahrplanbewertung funktionsfähig. Auf einem kostenpflichtigen Cloudflare-Tarif kann Mehrverbrauch berechnet werden; im Cloudflare-Dashboard das Budget kontrollieren.

Die vorhandene `AI_JOURNEY_LIMITER`-Binding begrenzt öffentliche Anfragen. Der Worker akzeptiert ausschließlich same-origin-POST-Anfragen mit beschränkter Länge. Der Chat erhält nur die eingegebene Frage, einige kurze Chat-Nachrichten und maximal acht GTFS-Routen-Zusammenfassungen; keine Standort- oder Bewegungsdaten. Die KI interpretiert ausschließlich bereitgestellte Verbindungen und darf fehlende Echtzeit-, Gehzeit- und Tarifdaten nicht erfinden.

Veröffentlichung: Änderungen auf GitHub **allein** garantieren kein aktives Cloudflare-Deployment. Nach dem Deploy in Cloudflare die AI-Binding prüfen, die API mit einem gültigen Request testen und das verwendete Kontingent beobachten.
