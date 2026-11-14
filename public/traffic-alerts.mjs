// Read-only parsers for official public transport notices. Never render upstream HTML.
function decodeEntities(value=''){
  return String(value).replace(/&#x[(]([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&apos;|&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function plainText(value=''){
  const decoded=decodeEntities(String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1'));
  return decodeEntities(decoded
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<\/(?:p|div|li|br|h[1-6])\s*>/gi,' ')
    .replace(/<[^>]*>/g,' '))
    .replace(/[\t\r\n ]+/g,' ').trim();
}
function tagValue(block,tag){
  const match=String(block).match(new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return match?plainText(match[1]):'';
}
function isoDate(value){
  const m=String(value||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1]+'T00:00:00';
  const n=Date.parse(value||'');
  return Number.isFinite(n)?new Date(n).toISOString():null;
}
function stableId(prefix,value){
  return prefix+'-'+String(value||'notice').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72);
}
export function parseSuedtirolRss(xml){
  const items=[];
  for(const match of String(xml||'').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
    const block=match[1],title=tagValue(block,'title'),description=tagValue(block,'description');
    if(!title)continue;
    const publishedRaw=tagValue(block,'pubDate');
    const guid=tagValue(block,'guid')||title+'|'+publishedRaw;
    items.push({
      id:stableId('vmz',guid),source:'vmz',sourceName:'Verkehrsmeldezentrale Südtirol · Öffentliche Verkehrsmittel',
      title,description,publishedAt:isoDate(publishedRaw),category:'ÖPNV-Meldung',
      priority:/ausfall|störung|sperre|unterbrech|gesperrt/i.test(title+' '+description),
      url:'https://traffic.province.bz.it/de/rss'
    });
  }
  return items;
}
export function parseTrenitaliaNotices(html,kind='circulation'){
  const items=[];
  for(const [index,match] of [...String(html||'').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].entries()){
    const block=match[1];
    const anchor=block.match(/<[a](?:\s[^>]*)?>([\s\S]*?)<\/[a]>/i);
    const title=anchor?plainText(anchor[1]):'';
    if(!title)continue;
    const date=tagValue(block,'h4');
    const info=block.match(/<div\b[^>]*class=["'][^"']*info-text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const description=info?plainText(info[1]):'';
    const priority=/inEvidenza/i.test(block.slice(0,500));
    items.push({
      id:stableId('trenitalia-'+kind,index+'-'+title+'-'+date),
      source:'trenitalia',sourceName:'Trenitalia · ViaggiaTreno',
      title,description,publishedAt:isoDate(date),
      category:kind==='works'?'Geplante Änderungen':'Betriebsmeldung',
      priority,url:'https://www.viaggiatreno.it/infomobilita/index.jsp'
    });
  }
  return items;
}
