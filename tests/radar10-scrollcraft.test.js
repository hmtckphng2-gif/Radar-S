import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,css,sw]=await Promise.all([
 readFile(new URL("../public/index.html",import.meta.url),"utf8"),
 readFile(new URL("../public/radar10-scrollcraft.css",import.meta.url),"utf8"),
 readFile(new URL("../public/sw.js",import.meta.url),"utf8")
]);
test("Scroll-Craft stylesheet referenced by the app exists",()=>{
 assert.match(html,/radar10-scrollcraft\.css\?v=9\.9\.1/);
 assert.match(css,/overflow-y:auto/);
});
test("sheet scroll is native, momentum-enabled, and isolated",()=>{
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/overscroll-behavior-y:contain/);
 assert.match(css,/-webkit-overflow-scrolling:touch/);
 assert.match(css,/touch-action:pan-y pinch-zoom/);
});
test("mobile targets and safe-area padding remain accessible",()=>{
 assert.match(css,/min-height:44px/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
});
test("new shell cache is activated and API bypass remains unchanged",()=>{
 assert.match(sw,/radar-shell-v9\.9\.0-scrollcraft/);
 assert.ok(sw.indexOf("if(isApi(url))return;") < sw.indexOf("if(isAsset(url))"));
});
