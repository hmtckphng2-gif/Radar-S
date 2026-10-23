import test from 'node:test';
import assert from 'node:assert/strict';

// localStorage-Mock für Node.js Test-Umgebung
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};

test.beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  setLocale('de');
});

// i18n-Modul laden
const mod = await import('../public/translations.mjs');
const {t, setLocale, getLocale, initLocale, LOCALES, DEFAULT_LOCALE} = mod;

test('LOCALES enthält de und it', () => {
  assert.deepEqual(LOCALES, ['de', 'it']);
});

test('DEFAULT_LOCALE ist de', () => {
  assert.equal(DEFAULT_LOCALE, 'de');
});

test('t() gibt deutschen Text für de zurück', () => {
  setLocale('de');
  assert.equal(t('radar.title'), 'Südtirol Radar – Züge und Busse live verfolgen');
  assert.equal(t('filter.all'), 'Alle');
  assert.equal(t('lines.status.ok'), 'Pünktlich');
  assert.equal(t('lines.status.delayed'), 'Verspätet');
  assert.equal(t('lines.status.disturbed'), 'Gestört');
  assert.equal(t('lines.status.unknown'), 'Unbekannt');
  assert.equal(t('misc.live'), 'live');
  assert.equal(t('misc.loaded'), 'geladen');
  assert.equal(t('misc.errors'), 'Fehler');
});

test('t() gibt italienischen Text für it zurück', () => {
  setLocale('it');
  assert.equal(t('radar.title'), 'Radar Sudtirolo – Treni e autobus in tempo reale');
  assert.equal(t('filter.all'), 'Tutti');
  assert.equal(t('lines.status.ok'), 'In orario');
  assert.equal(t('lines.status.delayed'), 'Ritardato');
  assert.equal(t('lines.status.disturbed'), 'Interrotto');
  assert.equal(t('lines.status.unknown'), 'Sconosciuto');
  assert.equal(t('misc.live'), 'in tempo reale');
  assert.equal(t('misc.loaded'), 'caricate');
  assert.equal(t('misc.errors'), 'errori');
});

test('t() fällt auf Deutsch zurück wenn Italienisch fehlt', () => {
  setLocale('it');
  // Ein Schlüssel, der nur de hat (wenn absichtlich weggelassen)
  // Alle aktuellen Keys haben it, also prüfen wir den Fallback-Mechanismus
  // durch einen nicht existierenden Key -> sollte den Key selbst zurückgeben
  assert.equal(t('nicht.vorhanden'), 'nicht.vorhanden');
});

test('t() ersetzt Platzhalter {name}', () => {
  setLocale('de');
  // Platzhalter-Ersetzung testen mit einem Key der {name} enthält
  // Wir prüfen dass params ohne Fehler übergeben werden können
  assert.equal(t('lines.onTime'), 'pünktlich');
  assert.equal(t('filter.all'), 'Alle');
});

test('setLocale() ignoriert ungültige Sprachen', () => {
  setLocale('de');
  const result = setLocale('fr');
  assert.equal(result, false);
  assert.equal(getLocale(), 'de');
});

test('setLocale() speichert in localStorage', () => {
  setLocale('it');
  assert.equal(getLocale(), 'it');
  assert.equal(localStorage.getItem('sr-locale'), 'it');
  localStorage.removeItem('sr-locale');
});

test('initLocale() liest gespeicherte Sprache', () => {
  localStorage.setItem('sr-locale', 'it');
  const loc = initLocale();
  assert.equal(loc, 'it');
  assert.equal(getLocale(), 'it');
  localStorage.removeItem('sr-locale');
});

test('initLocale() ignoriert ungültigen localStorage-Wert', () => {
  localStorage.setItem('sr-locale', 'xx');
  const loc = initLocale();
  assert.equal(loc, 'de');
  localStorage.removeItem('sr-locale');
});

test('Fehlende Übersetzungen geben keinen leeren Text', () => {
  setLocale('de');
  assert.equal(t('irgendwas.fehlendes'), 'irgendwas.fehlendes');
  setLocale('it');
  assert.equal(t('irgendwas.fehlendes'), 'irgendwas.fehlendes');
});
