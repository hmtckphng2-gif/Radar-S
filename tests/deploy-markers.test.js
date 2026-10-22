import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/* Radar 8.5 - the deploy markers must survive every change.
 *
 * The deploy workflow checks the live site for a marker string in each
 * important file. If somebody rewrites a file and drops that string, the
 * deploy fails AFTER the worker was already switched over - the app is then
 * live but the release is marked as broken. That happened on 21.10.2026 with
 * radar83-model.mjs.
 *
 * This test reads the markers straight from the workflow and checks them
 * against the local files, so the problem shows up in `npm test` instead of
 * in a failed production deploy.
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + name, 'utf8');
const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/radar-deploy.yml');

// Every ['/path','marker'] pair of the verification step.
function collectMarkers(source) {
  const out = [];
  const re = /\[\s*'(\/[^']+)'\s*,\s*(?:'([^']*)'|"([^"]*)")\s*\]/g;
  for (const m of source.matchAll(re)) {
    const path = m[1];
    let marker = m[2] !== undefined ? m[2] : m[3];
    if (marker === undefined) continue;
    // The dynamic entry uses the package version at deploy time.
    marker = marker.replace(/"\s*\+\s*expected\s*\+\s*"/g, pkg.version);
    out.push({path, marker});
  }
  return out;
}

test('the deploy workflow contains markers to check', () => {
  const markers = collectMarkers(workflow);
  assert.ok(markers.length >= 3, 'the deploy must verify several live files: ' + markers.length);
});

test('every deploy marker exists in the file it belongs to', () => {
  const markers = collectMarkers(workflow);
  const missing = markers
    .map(m => {
      const file = 'public/' + m.path.replace(/^\//, '');
      let content = '';
      try { content = read(file); } catch { return m.path + ' (Datei fehlt)'; }
      return content.includes(m.marker) ? null : m.path + ' -> "' + m.marker + '"';
    })
    .filter(Boolean);
  assert.deepEqual(missing, [], 'Marker fehlen in der Datei: ' + missing.join(', '));
});

test('the live version check compares against package.json', () => {
  assert.match(workflow, /readFileSync\('package\.json','utf8'\)/);
  assert.match(workflow, /response\.version!==expected/);
  // 9.7: Die Pruefung muss warten, bis der neue Worker ausgeliefert ist.
  assert.match(workflow, /const retry = async/, 'die Live-Pruefung braucht eine Warteschleife');
  assert.match(workflow, /return await check\(\)/, 'ohne await faengt der try-Block die Rejection nicht');
});

test('the history collector stays off in the deployed configuration', () => {
  assert.match(workflow, /triggers\?\.crons\?\.length/);
  const wrangler = read('wrangler.jsonc');
  assert.match(wrangler, /"crons"\s*:\s*\[\]/, 'wrangler.jsonc must keep an empty cron list');
});
