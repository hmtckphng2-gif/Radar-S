import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, js] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/radar10-startup.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/radar10-startup.js', import.meta.url), 'utf8')
]);

test('startup overlay is wired into the app shell with versioned assets', () => {
  assert.match(html, /id="sr10Startup"/);
  assert.match(html, /radar10-startup\.css\?v=9\.9\.0/);
  assert.match(html, /radar10-startup\.js\?v=9\.9\.0/);
});

test('startup waits for actual map and feed readiness, then has bounded recovery', () => {
  assert.match(js, /introMs=2300/);
  assert.match(js, /s\.map&&tileCount\(\)>0/);
  assert.match(js, /timeoutMs=14000/);
  assert.match(js, /SR-LIVE-DATA-01/);
  assert.match(js, /SR-MAP-01/);
  assert.match(js, /location\.reload\(\)/);
});

test('startup supports reduced motion and respects app-owned data fetching', () => {
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(js, /fetch\s*\(/);
  assert.doesNotMatch(js, /serviceWorker/);
});
