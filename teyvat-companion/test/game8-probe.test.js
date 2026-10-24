import test from 'node:test';
import { CHARACTER_BUILD_GUIDES } from '../src/builds.js';

const cleanText = value => String(value || '')
  .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\*\*/g, '')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&#x27;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim();

function linksBetween(lines, start, end, maxCount) {
  if (start < 0) return [];
  const text = lines.slice(start, end > start ? end : start + 18).join('\n')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  const names = [];
  const re = /\[([^\]]+)\]\(https:\/\/game8\.co\/games\/Genshin-Impact\/archives\/[^)]+\)/gi;
  for (const m of text.matchAll(re)) {
    const name = cleanText(m[1]);
    if (!name || /^(?:Genshin Impact|Character Tier List|List of|Stats|Talent|Artifacts and Set Bonuses|Weapons)$/i.test(name)) continue;
    if (!names.some(x => x.toLowerCase() === name.toLowerCase())) names.push(name);
    if (names.length >= maxCount) break;
  }
  return names;
}
function extractProfile(md, key, profile) {
  const lines=md.split(/\r?\n/);
  const weaponAt=lines.findIndex(l=>/^\|.*\bBest\b.*\bWeapons?\b/i.test(l));
  const artifactAt=lines.findIndex((l,i)=>i>(weaponAt<0?-1:weaponAt) && /^\|.*\bBest\b.*\bArtifacts?\b/i.test(l));
  const statsAt=lines.findIndex((l,i)=>i>(artifactAt<0?weaponAt:artifactAt) && /^\|.*(?:Stat Priority|Artifact Main Stats|Main Stats)\b/i.test(l));
  const talentAt=lines.findIndex(l=>/^\|\s*\*\*1st\*\*\s*\|/.test(l));
  const weaponEnd=[artifactAt,statsAt].filter(i=>i>weaponAt).sort((a,b)=>a-b)[0] ?? weaponAt+18;
  const artifactEnd=[statsAt].filter(i=>i>artifactAt).sort((a,b)=>a-b)[0] ?? artifactAt+18;
  const weapons=linksBetween(lines,weaponAt,weaponEnd,5);
  const artifacts=linksBetween(lines,artifactAt,artifactEnd,4);
  const stats={};
  const statLines=lines.slice(Math.max(0,statsAt),Math.max(0,statsAt)+9).join('\n').replace(/!\[[^\]]*\]\([^)]+\)/g,'');
  for (const [keyName,rx] of [
    ['sands',/\*\*Sands:?\*\*:?\s*([^|\n]+)/i],
    ['goblet',/\*\*Goblet:?\*\*:?\s*([^|\n]+)/i],
    ['circlet',/\*\*Circlet:?\*\*:?\s*([^|\n]+)/i],
  ]) {
    const m=statLines.match(rx);
    if(m) stats[keyName]=cleanText(m[1]).replace(/\s*\|\s*$/,'');
  }
  if (!stats.sands || !stats.goblet || !stats.circlet) {
    const tableLine=statLines.split(/\r?\n/).find(l=>l.trim().startsWith('|') && l.split('|').length>=4 && !/---|\*\*Sands|Artifact Main Stats|Stat Priority/i.test(l));
    if(tableLine) {
      const cells=tableLine.split('|').map(cleanText).filter(Boolean);
      if(cells.length>=3) { stats.sands ||= cells[0]; stats.goblet ||= cells[1]; stats.circlet ||= cells[2]; }
    }
  }
  let substats=[];
  const subMatch=md.match(/\|\s*\*\*Substats?\*\*:\s*([^|\n]+)/i);
  if(subMatch) substats=subMatch[1].split(/\s*>\s*|\s*,\s*/).map(cleanText).filter(Boolean);
  if(!substats.length) {
    const line=lines.find(l=>/^\|\s*Artifact Sub ?Stats?\s*\|/i.test(l));
    if(line) substats=line.split('|').slice(2).map(cleanText).filter(Boolean).flatMap(v=>v.split(/\s*,\s*/)).map(cleanText).filter(Boolean);
  }
  let talentOrder=[];
  if(talentAt>=0) {
    const row=lines.slice(talentAt+1,talentAt+6).find(l=>l.trim().startsWith('|') && !/---|\*\*1st\*\*/i.test(l));
    if(row) {
      const cells=row.split('|').slice(1,-1).map(cleanText);
      talentOrder=cells.flatMap(cell => {
        const found=cell.match(/Normal Attack|Elemental Skill|Elemental Burst/gi);
        if(found?.length) return found;
        if(/\bSkill\b/i.test(cell)) return ['Elemental Skill'];
        if(/\bBurst\b/i.test(cell)) return ['Elemental Burst'];
        return [];
      });
      talentOrder=[...new Set(talentOrder)];
    }
  }
  const title=md.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || 'Game8 — '+key;
  const complete=weapons.length>=1 && artifacts.length>=1 && stats.sands && stats.goblet && stats.circlet && substats.length>=2 && talentOrder.length>=2;
  return {
    key, url:profile.sourceUrl, role:profile.role || profile.buildCategory || 'Main DPS', title,
    weapons, artifacts, stats, substats, talentOrder,
    complete:Boolean(complete),
    diagnostics:{weaponAt,artifactAt,statsAt,talentAt,markdownChars:md.length}
  };
}
test('temporary full Game8 primary-build audit; remove after source records are committed', async () => {
  const candidates=Object.entries(CHARACTER_BUILD_GUIDES)
    .filter(([,p])=>p.game8ReviewStatus==='pending' && /^https:\/\/game8\.co\/games\/Genshin-Impact\/archives\//.test(p.sourceUrl||''))
    .map(([key,p])=>({key,profile:p}));
  let cursor=0;
  const out=[];
  const workers=Array.from({length:5}, async ()=>{
    while(cursor<candidates.length) {
      const item=candidates[cursor++];
      try {
        const response=await fetch('https://r.jina.ai/'+item.profile.sourceUrl,{headers:{'user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
        const md=await response.text();
        if(!response.ok) out.push({key:item.key,url:item.profile.sourceUrl,complete:false,error:'HTTP '+response.status,chars:md.length});
        else out.push(extractProfile(md,item.key,item.profile));
      } catch(e) { out.push({key:item.key,url:item.profile.sourceUrl,complete:false,error:String(e)}); }
    }
  });
  await Promise.all(workers);
  for (const profile of out) console.log('GAME8_PROFILE_JSON '+JSON.stringify(profile));
  console.log('GAME8_PROFILE_SUMMARY '+JSON.stringify({
    attempted:candidates.length,
    complete:out.filter(x=>x.complete).length,
    incomplete:out.filter(x=>!x.complete).length,
    failures:out.filter(x=>x.error).map(x=>({key:x.key,error:x.error})),
    pendingKeys:out.filter(x=>!x.complete).map(x=>x.key),
  }));
});
