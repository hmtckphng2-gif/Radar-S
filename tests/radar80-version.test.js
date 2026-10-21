import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/* Radar 8.4 - the version shown in the app must have exactly one source.
 *
 * Before this release five modules (radar76/77/78/79 and radar80) wrote the
 * brand badge, the document title and the live-version status, each with its
 * own hardcoded number. Their asynchronous version checks raced each other,
 * so the app could show "7.6", "7.8" or "8.3.2" depending on which network
 * response arrived last - and the deployed Worker said 8.4.0 the whole time.
 *
 * These tests lock that down:
 * 1. package.json, worker.js and the UI build marker always say the same.
 * 2. Only radar80.js may read the live version or write the brand badge.
 * 3. The displayed version comes from the server, not from a hardcoded number.
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = root + 'public/';
const read = name => readFileSync(root + name, 'utf8');
const pkg = JSON.parse(read('package.json'));
const radar80 = read('public/radar80.js');
const worker = read('worker.js');
const index = read('public/index.html');

// Every modern (7.x/8.x) UI module. The legacy 3.x-6.x modules are excluded
// on purpose: they still write the badge, and radar80.js restores it.
const modernModules = () =>
  readdirSync(publicDir)
    .filter(name => /^radar[78]\d.*\.(js|mjs)$/.test(name))
    .filter(name => name !== 'radar80.js');

test('the UI build marker matches package.json', () => {
  const match = radar80.match(/const BUILD='([^']+)'/);
  assert.ok(match, 'radar80.js must declare const BUILD');
  assert.equal(match[1], pkg.version);
});

test('the Worker /api/version matches package.json', () => {
  assert.match(worker, new RegExp("version:'" + pkg.version.replace(/\./g, '\\.') + "'"));
});

test('the displayed version comes from the server, not from a hardcoded badge', () => {
  assert.match(radar80, /fetch\('\/api\/version/);
  assert.match(radar80, /serverVersion/);
  // The build marker must never be the value that is displayed.
  assert.match(radar80, /const shown=\(\)=>serverVersion\|\|BUILD;/);
});

test('only radar80.js checks the live version among the 7.x/8.x modules', () => {
  const offenders = modernModules().filter(name => read('public/' + name).includes('/api/version'));
  assert.deepEqual(offenders, [], 'these modules still race for the live version: ' + offenders.join(', '));
});

test('only radar80.js writes the brand badge among the 7.x/8.x modules', () => {
  const offenders = modernModules().filter(name => read('public/' + name).includes('brand-title em'));
  assert.deepEqual(offenders, [], 'these modules still overwrite the version badge: ' + offenders.join(', '));
});

test('no module at all writes the brand badge or the document title', () => {
  // radar80.js is the only owner of the version display. Every legacy module
  // used to write its own number into the badge and the title, which is how
  // the app ended up showing "7.6" while the worker said "8.4.0".
  const all = readdirSync(publicDir)
    .filter(name => /\.(js|mjs)$/.test(name) && name !== 'radar80.js');
  const badgeWriters = all.filter(name => read('public/' + name).includes('brand-title em'));
  const titleWriters = all.filter(name => /document\.title\s*=/.test(read('public/' + name)));
  assert.deepEqual(badgeWriters, [], 'these modules still write the brand badge: ' + badgeWriters.join(', '));
  assert.deepEqual(titleWriters, [], 'these modules still write the document title: ' + titleWriters.join(', '));
});

test('the legacy modules do not carry a hardcoded release number in real code', () => {
  // A version like "5.6" inside a legacy module is a second source of truth.
  // Comments are allowed to keep their historical release name, but no line
  // of code may show a version to the user.
  const suspicious = [];
  for (const name of readdirSync(publicDir)) {
    if (!/\.(js|mjs)$/.test(name) || name === 'radar80.js') continue;
    const lines = read('public/' + name).split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
      const hits = trimmed.match(/Südtirol Radar \d+\.\d+(\.\d+)?/g);
      if (hits) suspicious.push(name + ': ' + hits.join(', '));
    }
  }
  assert.deepEqual(suspicious, [], 'hardcoded release names in code: ' + suspicious.join(' | '));
});

test('the legacy version module is gone and index.html does not load it', () => {
  assert.equal(readdirSync(publicDir).includes('radar76.js'), false);
  assert.equal(index.includes('radar76.js'), false);
});

test('index.html ships the badge and the script tag of the current version', () => {
  assert.ok(index.includes('<em>' + pkg.version + '</em>'), 'the static badge must show ' + pkg.version);
  assert.ok(index.includes('/radar80.js?v=' + pkg.version), 'radar80.js needs a matching cache buster');
  assert.ok(index.includes('class="brand-title"'), 'the version badge element must exist');
});

test('every cache buster in index.html points at the current release', () => {
  // A mixed set of cache busters means that some assets keep an old version
  // in the browser cache while others are refreshed. That is exactly how a
  // stale module can survive a release and start fighting the new one.
  const busters = [...index.matchAll(/\?v=([^"'&\s]+)/g)].map(m => m[1]);
  assert.ok(busters.length > 20, 'index.html should reference versioned assets: ' + busters.length);
  const wrong = [...new Set(busters)].filter(v => v !== pkg.version);
  assert.deepEqual(wrong, [], 'cache busters that do not match package.json: ' + wrong.join(', '));
});
