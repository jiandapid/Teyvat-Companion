import test from 'node:test';
const clean = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ');
test('temporary targeted Game8 search audit (remove after source audit)', async () => {
 const queries=[
  ['Skirk','Azurelight','Finale of the Deep'],
  ['Wanderer',"Tulaytullah's Remembrance",'Desert Pavilion Chronicle'],
  ['Fischl','The Stringless','Golden Troupe'],
  ['Sucrose','Sacrificial Fragments','Viridescent Venerer'],
  ['Alhaitham','Light of Foliar Incision','Gilded Dreams'],
  ['Childe','Polar Star',"Nymph's Dream"],
  ['Cyno','Staff of the Scarlet Sands','Thundering Fury'],
  ['Diluc','Beacon of the Reed Sea','Crimson Witch of Flames'],
 ];
 const out=await Promise.all(queries.map(async ([name,weapon,artifact])=>{
  const q='site:game8.co/games/Genshin-Impact/archives "'+name+'" "'+weapon+'" "'+artifact+'" "Best Builds"';
  const url='https://www.bing.com/search?q='+encodeURIComponent(q);
  try {
   const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132 Safari/537.36'},signal:AbortSignal.timeout(10000)});
   const html=await r.text(); const txt=clean(html);
   const first=txt.toLowerCase().indexOf('game8.co');
   const anchors=[...html.matchAll(/<a\b[^>]*href="([^"]*game8\.co[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].slice(0,4).map(m=>({url:m[1],title:clean(m[2]).slice(0,160)}));
   return {name,weapon,artifact,status:r.status,chars:html.length,anchors,excerpt:first>=0?txt.slice(first,first+2500):txt.slice(0,1800)};
  } catch(e){return {name,error:String(e)}}
 }));
 for(const x of out) console.log('GAME8_DETAIL_QUERY '+JSON.stringify(x));
});
