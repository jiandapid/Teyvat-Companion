import test from 'node:test';

test('temporary Game8 search-index probe (remove after source audit)', async () => {
  for (const url of [
    'https://www.google.com/search?q=' + encodeURIComponent('site:game8.co/games/Genshin-Impact/archives Ayaka best builds artifacts weapons'),
    'https://www.bing.com/search?q=' + encodeURIComponent('site:game8.co/games/Genshin-Impact/archives Ayaka best builds artifacts weapons'),
  ]) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132 Safari/537.36' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();
      const clean = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&#x27;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ');
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
      console.log('GAME8_PROBE_RESULT ' + JSON.stringify({
        url,
        status: response.status,
        finalUrl: response.url,
        chars: html.length,
        title,
        excerpt: clean.slice(0, 7500),
      }));
    } catch (error) {
      console.log('GAME8_PROBE_ERROR ' + String(error?.stack || error));
    }
  }
});
