import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/radar10-polish.css', import.meta.url), 'utf8')
]);

test('final visual layer loads last with the current cache key', () => {
  assert.match(html, /radar10-polish\.css\?v=9\.9\.0/);
  assert.ok(html.indexOf('radar10-polish.css?v=9.9.0') > html.indexOf('radar10-shell.css?v=9.9.0'));
  assert.doesNotMatch(html, /radar10-menu\.css/);
});

test('visual polish uses one graphite/silver system with separate train and bus accents', () => {
  assert.match(css, /--radar-polish-bg:\s*#0b0d10/i);
  assert.match(css, /--radar-polish-silver:\s*#d4dae1/i);
  assert.match(css, /--radar-polish-train:\s*#78a6ff/i);
  assert.match(css, /--radar-polish-bus:\s*#f2a15e/i);
  assert.doesNotMatch(css, /#(?:00ffff|00e5d4|00d9c0|14b8a6)\b/i);
});

test('mobile layout prioritizes search and keeps filter chips usable without wrapping', () => {
  assert.match(css, /@media\s*\(max-width:\s*520px\)/);
  assert.match(css, /\.search-wrap\s*\{[^}]*order:\s*-1/s);
  assert.match(css, /\.segments\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /env\(safe-area-inset-top\)/);
});

test('accessibility and iOS-native interaction preferences are preserved', () => {
  assert.match(css, /button:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /prefers-reduced-transparency:\s*reduce/);
  assert.match(css, /prefers-contrast:\s*more/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('visual-only redesign preserves essential controls and map/detail entrypoints', () => {
  for (const id of ['map', 'statusBtn', 'healthBtn', 'favBtnTop', 'langBtn', 'linesBtn', 'themeToggle', 'sheet', 'closeSheet', 'search']) {
    assert.ok(html.includes(`id="${id}"`), `missing existing UI hook: ${id}`);
  }
});
