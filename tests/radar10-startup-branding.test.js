import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const [html, js, css] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/radar10-startup.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/radar10-startup.css', import.meta.url), 'utf8')
]);
test('startup brand uses valid UTF-8 German text', () => {
  assert.match(html, /<meta charset="utf-8">/i);
  assert.match(html, /<div class="sr10-wordmark">SÜDTIROL <span>RADAR<\/span><\/div>/);
  assert.match(js, /LIVE-VERKEHR AUS SÜDTIROL/);
  assert.doesNotMatch(html + js, /SÃ|Ãƒ|Â¼|â€|ðŸ/);
});
test('startup SVG logo has explicit silver contrast on graphite', () => {
  assert.match(html, /class="sr10-brand-mark"[^>]*><svg/);
  assert.match(css, /#sr10Startup \.sr10-brand-mark svg \{[^}]*stroke:\s*#e1e6ec !important/s);
  assert.match(css, /#sr10Startup \.sr10-brand-mark svg circle \{[^}]*fill:\s*#e1e6ec !important/s);
  assert.match(css, /#sr10Startup \.sr10-wordmark \{[^}]*color:\s*#f3f5f7 !important/s);
});
