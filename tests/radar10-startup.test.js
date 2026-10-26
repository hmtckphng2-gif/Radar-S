import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const [html,css,js]=await Promise.all([readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/radar10-startup.css',import.meta.url),'utf8'),readFile(new URL('../public/radar10-startup.js',import.meta.url),'utf8')]);
test('startup assets are linked with a fresh cache key',()=>{assert.match(html,/id="sr10Startup"/);assert.match(html,/radar10-startup\.css\?v=9\.9\.0/);assert.match(html,/radar10-startup\.js\?v=9\.9\.0/)});
test('logo and train intro finish before readiness can dismiss the overlay',()=>{assert.match(js,/introMs=4200/);assert.match(js,/minimumMs=4900/);assert.match(css,/@keyframes sr10-logo-zoom/);assert.match(css,/@keyframes sr10-train-pass/)});
test('loading timeout never opens an automatic error diagnosis popup',()=>{assert.doesNotMatch(html,/id="sr10StartupError"/);assert.doesNotMatch(js,/showError|SR-LIVE-DATA-01|SR-MAP-01/);assert.match(js,/elapsed>=timeoutMs\)\{close\(\)/)});
test('startup respects reduced motion and does not fetch or cache live APIs',()=>{assert.match(css,/prefers-reduced-motion:reduce/);assert.doesNotMatch(js,/fetch\s*\(/);assert.doesNotMatch(js,/serviceWorker/)});
