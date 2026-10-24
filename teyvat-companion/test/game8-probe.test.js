import test from 'node:test';

const blockAfter = (lines, regex, count=8) => {
 const idx=lines.findIndex(line=>regex.test(line));
 return idx<0?[]:lines.slice(idx,idx+count);
};
const trimTable = lines => lines.map(line=>line.length>1200?line.slice(0,1200)+' …':line);
test('temporary Game8 compact build-table audit (remove after source audit)', async () => {
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
   const relevant={
    weapon: trimTable(blockAfter(lines,/^\|\s*Best Weapons?(?: for [^|]+)?\s*\|/i,7)),
    artifact: trimTable(blockAfter(lines,/^\|\s*Best Artifact Sets?(?: for [^|]+)?\s*\|/i,6).length?blockAfter(lines,/^\|\s*Best Artifact Sets?(?: for [^|]+)?\s*\|/i,6):blockAfter(lines,/^\|\s*Best Artifacts?\s*\|/i,6)),
    stats: trimTable(blockAfter(lines,/^\|\s*(?:Stat Priority|Artifact Main Stats|Main Stats)\s*\|/i,5)),
    talents: trimTable(lines.filter(l=>/Talent Priority|Talent Priorities|^\|\s*\*\*(?:1st|2nd|3rd|4th)\*\*/i.test(l)).slice(0,8)),
   };
   return {name,status:r.status,chars:md.length,relevant};
  }catch(e){return{name,error:String(e)}}
 }));
 for(const x of out) console.log('GAME8_TABLE_DATA '+JSON.stringify(x));
});
