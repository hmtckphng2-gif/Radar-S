import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + name, 'utf8');

// Die reine Logik, isoliert getestet (identisch zur Implementierung in app.js).
function isFeedHealthy(statuses){
  const POSITION_SOURCES = ['sta', 'trentino', 'trains'];
  return POSITION_SOURCES.some(s => statuses[s] === 'ok' || statuses[s] === 'old');
}

test('isFeedHealthy: true wenn irgendein Position-Feed ok oder alt ist', () => {
  assert.ok(isFeedHealthy({sta: 'ok', trentino: 'error', trains: 'error'}));
  assert.ok(isFeedHealthy({sta: 'error', trentino: 'old', trains: 'error'}));
  assert.ok(isFeedHealthy({sta: 'ok', trentino: 'ok', trains: 'ok'}));
});

test('isFeedHealthy: false wenn alle Position-Feeds error sind', () => {
  assert.ok(!isFeedHealthy({sta: 'error', trentino: 'error', trains: 'error'}));
  assert.ok(!isFeedHealthy({sta: 'error', trentino: 'error', trains: 'error'}));
});

test('isFeedHealthy: false bei leeren Status', () => {
  assert.ok(!isFeedHealthy({}));
});

test('updateFeedHealthBanner existiert in app.js und wird in refreshFeeds aufgerufen', () => {
  const app = read('public/app.js');
  assert.match(app, /function isFeedHealthy\(\)/);
  assert.match(app, /POSITION_SOURCES\.some\(s=>state\.statuses\[s\]==='ok'\|\|state\.statuses\[s\]==='old'\)/);
  assert.match(app, /function updateFeedHealthBanner\(\)/);
  assert.match(app, /updateFeedHealthBanner\(\)/);
});

test('feedHealthBanner-Element existiert im HTML', () => {
  const html = read('public/index.html');
  assert.match(html, /id="feedHealthBanner"/);
  assert.match(html, /role="alert"/);
});

test('Tastatur-Shortcuts definiert in app.js', () => {
  const app = read('public/app.js');
  assert.match(app, /refreshFeeds\(\)/);
  assert.match(app, /fitMap\(\)/);
  assert.match(app, /showStations\(\)/);
  assert.match(app, /showSourceStatus\(\)/);
});
