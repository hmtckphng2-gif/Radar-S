// Historische Verspätungsanalyse für Haltestellen.
// Reine Logik ohne DOM-Abhängigkeit, unit-tested.
// Alle Daten stammen von der History-API (Feed-Prognosen, keine bestätigten Ankünfte).

export const MIN_SAMPLES_FOR_RELIABLE_STATS = 5;

// Berechnet Verzögerungsstatistiken aus Stop-Delay-Ereignissen.
// Gibt {sampleCount, averageMinutes, medianMinutes, latePercent, uniqueForecasts} zurück.
export function computeDelayStats(events) {
  const values = events
    .filter(e => e.delay_seconds !== null && e.delay_seconds !== undefined)
    .map(e => Number(e.delay_seconds))
    .filter(Number.isFinite);

  if (!values.length) {
    return { sampleCount: 0, averageMinutes: null, medianMinutes: null, latePercent: null, uniqueForecasts: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    sampleCount: values.length,
    averageMinutes: Math.round((values.reduce((a, b) => a + b, 0) / values.length) / 6) / 10,
    medianMinutes: Math.round(median / 6) / 10,
    latePercent: Math.round(values.filter(x => x > 60).length / values.length * 100),
    uniqueForecasts: values.length
  };
}

// Prüft, ob genug Daten für eine zuverlässige Statistik vorliegen.
export function hasEnoughData(stats) {
  return stats.sampleCount >= MIN_SAMPLES_FOR_RELIABLE_STATS && stats.averageMinutes !== null;
}

// Analysiert, ob Fahrzeuge an einer Haltestelle Verspätung aufholen oder aufbauen.
// Vergleicht Ankunfts- vs. Abfahrtsverspätung pro Fahrt an derselben Haltestelle.
// Gibt {catchUpMinutes, buildUpMinutes, unchangedCount, tripsAnalyzed, trend} zurück.
// trend: 'catching_up' | 'building_up' | 'stable' | 'insufficient'
export function analyzeCatchUpBuildup(events) {
  // Gruppiere nach trip_id + trip_start_date + stop_sequence
  const byTrip = new Map();
  for (const e of events) {
    if (e.delay_seconds === null || e.delay_seconds === undefined) continue;
    const key = [e.source, e.trip_id, e.trip_start_date, e.stop_sequence].join('|');
    if (!byTrip.has(key)) byTrip.set(key, {});
    const entry = byTrip.get(key);
    if (e.event_type === 'arrival') entry.arrivalDelay = Number(e.delay_seconds);
    if (e.event_type === 'departure') entry.departureDelay = Number(e.delay_seconds);
  }

  let catchUpTotal = 0, buildUpTotal = 0, unchangedCount = 0, tripsAnalyzed = 0;
  for (const entry of byTrip.values()) {
    if (entry.arrivalDelay === undefined || entry.departureDelay === undefined) continue;
    tripsAnalyzed++;
    const diff = entry.departureDelay - entry.arrivalDelay;
    if (diff < -30) { catchUpTotal += -diff; }           // mehr als 30s weniger Verspätung beim Abfahren
    else if (diff > 30) { buildUpTotal += diff; }        // mehr als 30s mehr Verspätung beim Abfahren
    else { unchangedCount++; }
  }

  let trend = 'insufficient';
  if (tripsAnalyzed >= 3) {
    if (catchUpTotal > buildUpTotal * 1.2) trend = 'catching_up';
    else if (buildUpTotal > catchUpTotal * 1.2) trend = 'building_up';
    else trend = 'stable';
  }

  return { catchUpMinutes: Math.round(catchUpTotal / 60), buildUpMinutes: Math.round(buildUpTotal / 60), unchangedCount, tripsAnalyzed, trend };
}

// Vergleicht die Zuverlässigkeit verschiedener Linien an derselben Haltestelle.
// Benötigt statische GTFS-Daten, um trip_id auf route_id/line zu mappen.
export function compareLinesByStop(events, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const byLine = new Map();

  for (const e of events) {
    if (e.delay_seconds === null || e.delay_seconds === undefined) continue;
    const tripInfo = getTripInfo(e.trip_id, staticData, source);
    const line = tripInfo.line || 'Unbekannt';
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push(Number(e.delay_seconds));
  }

  const result = [];
  for (const [line, delays] of byLine.entries()) {
    const sorted = [...delays].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    const latePct = Math.round(delays.filter(x => x > 60).length / delays.length * 100);
    result.push({
      line,
      sampleCount: delays.length,
      averageMinutes: Math.round(avg / 6) / 10,
      medianMinutes: Math.round(median / 6) / 10,
      latePercent: latePct
    });
  }

  result.sort((a, b) => b.sampleCount - a.sampleCount);
  return result;
}

// Hilfsfunktion: Linieninfo für eine Fahrt (gleiche Logik wie haltestelle-logic.mjs).
function getTripInfo(tripId, staticData, source = 'sta') {
  const db = staticData[source] || {};
  const t = db.trips?.[tripId];
  if (!t) return { line: '', headsign: '' };
  const mappedRouteId = t[0] || '';
  const r = db.routes?.[mappedRouteId];
  return { line: r ? r[0] : '', headsign: t[1] || '' };
}

// Generiert eine KI-Zusammenfassung (3-4 Zeilen) ausschließlich auf Basis echter Daten.
// Gibt Array von 3-4 kurzen Strings zurück.
export function generateAISummary(stats, catchUpBuildup, lines) {
  const linesOut = [];

  if (!hasEnoughData(stats)) {
    linesOut.push('Noch nicht genug historische Messungen für eine zuverlässige Verspätungsstatistik.');
    linesOut.push('Die angezeigten Werte basieren auf Feed-Prognosen, nicht auf bestätigten Ankünften.');
    linesOut.push('Mehr Daten sammeln, sobald der History-Collector weitere Beobachtungen speichert.');
    return linesOut;
  }

  // Zeile 1: Durchschnittliche Verspätung
  const avg = stats.averageMinutes;
  if (avg > 5) {
    linesOut.push(`Fahrzeuge verspäteten sich im Durchschnitt um ${avg} Minuten an dieser Haltestelle.`);
  } else if (avg > 0) {
    linesOut.push(`Fahrzeuge waren im Durchschnitt um ${avg} Minuten verspätet an dieser Haltestelle.`);
  } else if (avg === 0) {
    linesOut.push('Fahrzeuge kamen im Durchschnitt pünktlich an dieser Haltestelle an.');
  } else {
    linesOut.push(`Fahrzeuge waren im Durchschnitt um ${Math.abs(avg)} Minuten früher an dieser Haltestelle.`);
  }

  // Zeile 2: Aufholen vs. Aufbauen
  if (catchUpBuildup.tripsAnalyzed >= 3) {
    if (catchUpBuildup.trend === 'catching_up') {
      linesOut.push(`Bei ${catchUpBuildup.tripsAnalyzed} beobachteten Fahrten wurde Verspätung an dieser Haltestelle teilweise aufgeholt (ø ${catchUpBuildup.catchUpMinutes} Min.).`);
    } else if (catchUpBuildup.trend === 'building_up') {
      linesOut.push(`Bei ${catchUpBuildup.tripsAnalyzed} beobachteten Fahrten baute sich weitere Verspätung an dieser Haltestelle auf (ø ${catchUpBuildup.buildUpMinutes} Min.).`);
    } else {
      linesOut.push(`Bei ${catchUpBuildup.tripsAnalyzed} beobachteten Fahrten blieb die Verspätung an dieser Haltestelle weitgehend stabil.`);
    }
  } else {
    linesOut.push('Zu wenige Fahrten für eine Aussage zum Aufholen oder Aufbauen von Verspätung.');
  }

  // Zeile 3: Zuverlässigkeit der Linien
  if (lines.length > 0) {
    const best = lines[0];
    const worst = lines[lines.length - 1];
    if (best.latePercent !== worst.latePercent) {
      linesOut.push(`Linie ${best.line} war am zuverlässigsten (${best.latePercent}% Verspätungen >5 Min), Linie ${worst.line} am wenigsten (${worst.latePercent}%).`);
    } else {
      linesOut.push(`Alle beobachteten Linien zeigten eine ähnliche Verspätungsrate von ${best.latePercent}% (>5 Min).`);
    }
  } else {
    linesOut.push('Keine Linienübergreifende Vergleichsdaten verfügbar.');
  }

  // Zeile 4: Datenhinweis
  linesOut.push(`Basis: ${stats.sampleCount} historische Messungen (Feed-Prognosen, nicht bestätigte Ankünfte).`);

  return linesOut;
}

// Bewertet die Datenqualität und gibt eine menschenlesbare Meldung zurück.
export function assessDataQuality(stats) {
  if (stats.sampleCount === 0) {
    return { level: 'none', message: 'Keine historischen Messungen verfügbar.' };
  }
  if (stats.sampleCount < MIN_SAMPLES_FOR_RELIABLE_STATS) {
    return { level: 'insufficient', message: `Nur ${stats.sampleCount} historische Messungen – noch keine zuverlässige Statistik möglich.` };
  }
  return { level: 'sufficient', message: `${stats.sampleCount} historische Messungen vorhanden.` };
}
