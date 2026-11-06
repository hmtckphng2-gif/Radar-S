import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('late scheduled-train timetable responses cannot overwrite the latest selection', () => {
  assert.match(app, /let selectionRenderToken=0/);
  assert.match(app, /const selectionToken=\+\+selectionRenderToken/);
  assert.match(app, /selectionToken===selectionRenderToken&&state\.activeSheet==='vehicle'&&state\.selectedKey===null/);
});

test('live vehicle selection and closing the sheet invalidate pending scheduled responses', () => {
  assert.match(app, /if\(resetSelection\)selectionRenderToken\+\+/);
  assert.match(app, /selectionRenderToken\+\+;\s*state\.selectedKey=key/);
});
