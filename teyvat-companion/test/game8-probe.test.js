import test from 'node:test';

const htmlToText = html => html
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

test('temporary Game8 search-index build audit (remove after source audit)', async () => {
  const characters = ['Skirk', 'Wanderer', 'Fischl', 'Sucrose', 'Alhaitham', 'Childe', 'Cyno', 'Diluc'];
  const results = await Promise.all(characters.map(async name => {
    const q = 'site:game8.co/games/Genshin-Impact/archives "' + name + '" "Rating and Best Builds" weapons artifacts stats';
    const url = 'https://www.bing.com/search?q=' + encodeURIComponent(q);
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132 Safari/537.36' },
        signal: AbortSignal.timeout(12000),
      });
      const html = await r.text();
      const text = htmlToText(html);
      const low = text.toLowerCase();
      const spots = [];
      let cursor = 0;
      while (spots.length < 4) {
        const pos = low.indexOf('game8.co', cursor);
        if (pos < 0) break;
        spots.push(text.slice(pos, pos + 1900));
        cursor = pos + 8;
      }
      return { name, status: r.status, chars: html.length, excerpts: spots };
    } catch (e) { return { name, error: String(e) }; }
  }));
  for (const result of results) console.log('GAME8_AUDIT_RESULT ' + JSON.stringify(result));
});
