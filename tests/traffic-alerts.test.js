import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSuedtirolRss,parseTrenitaliaNotices} from '../public/traffic-alerts.mjs';

test('parses official South Tyrol public transport RSS items as plain text',()=>{
  const xml='<rss><channel><item><title>Buslinie 1: Umleitung</title><description>&lt;p&gt;Haltestelle &lt;b&gt;Rathaus&lt;/b&gt; entfällt.&lt;/p&gt;</description><pubDate>Sat, 14 Nov 2026 19:00:00 GMT</pubDate><guid>vmz-1</guid></item></channel></rss>';
  const items=parseSuedtirolRss(xml);
  assert.equal(items.length,1);
  assert.equal(items[0].source,'vmz');
  assert.equal(items[0].title,'Buslinie 1: Umleitung');
  assert.match(items[0].description,/Rathaus entfällt/);
  assert.equal(items[0].priority,false);
});

test('marks serious South Tyrol notices as priority',()=>{
  const items=parseSuedtirolRss('<rss><item><title>Zugausfall und Streckensperre</title><description>Kein Zugverkehr</description><guid>urgent</guid></item></rss>');
  assert.equal(items[0].priority,true);
});

test('parses Trenitalia circulation and planned-work notices without rendering HTML',()=>{
  const html='<ul><li><a class="headingNewsAccordion inEvidenza">STRECKENUNTERBRECHUNG</a><div><h4>14.11.2026</h4><div class="info-text"><p>Die Strecke <b>Bozen–Meran</b> ist gesperrt.</p></div></div></li></ul>';
  const items=parseTrenitaliaNotices(html,'works');
  assert.equal(items.length,1);
  assert.equal(items[0].source,'trenitalia');
  assert.equal(items[0].category,'Geplante Änderungen');
  assert.equal(items[0].priority,true);
  assert.match(items[0].description,/Bozen–Meran ist gesperrt/);
  assert.doesNotMatch(items[0].description,/<[^>]+>/);
});
