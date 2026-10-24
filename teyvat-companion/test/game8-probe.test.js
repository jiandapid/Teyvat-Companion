import test from 'node:test';

test('temporary Game8 Markdown build-section audit (remove after source audit)', async () => {
 const guides=[
  ['Skirk','https://game8.co/games/Genshin-Impact/archives/333140'],
  ['Wanderer','https://game8.co/games/Genshin-Impact/archives/309656'],
  ['Fischl','https://game8.co/games/Genshin-Impact/archives/297524'],
  ['Sucrose','https://game8.co/games/Genshin-Impact/archives/297525'],
  ['Alhaitham','https://game8.co/games/Genshin-Impact/archives/383712'],
  ['Childe','https://game8.co/games/Genshin-Impact/archives/305862'],
  ['Cyno','https://game8.co/games/Genshin-Impact/archives/315233'],
  ['Diluc','https://game8.co/games/Genshin-Impact/archives/297518'],
 ];
 const out=await Promise.all(guides.map(async ([name,url])=>{
  try{
   const r=await fetch('https://r.jina.ai/'+url,{headers:{'user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
   const md=await r.text();
   const lines=md.split(/\r?\n/);
   const headings=lines.filter(l=>/^#{1,4} /.test(l));
   let start=lines.findIndex(l=>/^#{1,4} .*best builds?/i.test(l) || /^#{1,4} .*recommended (weapons?|artifacts?)/i.test(l));
   if(start<0) start=lines.findIndex(l=>/best weapon|best artifact|recommended main stats/i.test(l));
   const excerpt=start>=0?lines.slice(Math.max(0,start),Math.min(lines.length,start+110)).join('\n'):lines.slice(0,100).join('\n');
   return {name,status:r.status,chars:md.length,headings:headings.filter(h=>/build|weapon|artifact|stat|talent|dps|support/i.test(h)).slice(0,45),excerpt:excerpt.slice(0,10500)};
  }catch(e){return{name,error:String(e)}}
 }));
 for(const x of out) console.log('GAME8_MARKDOWN_AUDIT '+JSON.stringify(x));
});
