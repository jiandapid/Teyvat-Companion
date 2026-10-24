import test from 'node:test';

test('temporary Game8 public-page probe (remove after source audit)', async () => {
  try {
    const response = await fetch('https://game8.co/games/Genshin-Impact/archives/345514', {
      headers: { 'user-agent': 'Mozilla/5.0 TeyvatCompanion public guide audit' },
      signal: AbortSignal.timeout(12000),
    });
    const html = await response.text();
    const clean = html
      .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, ' ')
      .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&#x27;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\\s+/g, ' ');
    const title = html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]?.replace(/&amp;/g, '&') || '';
    const at = clean.toLowerCase().indexOf('best builds');
    console.log('GAME8_PROBE_RESULT ' + JSON.stringify({
      status: response.status,
      finalUrl: response.url,
      chars: html.length,
      title,
      bestBuildsAt: at,
      excerpt: at >= 0 ? clean.slice(at, at + 5500) : clean.slice(0, 5500),
    }));
  } catch (error) {
    console.log('GAME8_PROBE_ERROR ' + String(error?.stack || error));
  }
});
