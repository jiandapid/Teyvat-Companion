const UID_PATTERN = /^[0-9]{9,10}$/;
const ENKA_URL = 'https://enka.network/api/uid/';
const USER_AGENT = 'TeyvatCompanion/1.0 (+https://github.com/jiandapid/Teyvat-Companion; public showcase sync)';

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

function errorMessage(status) {
  if (status === 400) return 'Enka rejected this UID. Check the digits and the game server.';
  if (status === 404) return 'No public profile was found. Confirm the UID and enable Character Details in the in-game showcase.';
  if (status === 424) return 'Enka is temporarily unavailable after a game update or maintenance.';
  if (status === 429) return 'Enka rate-limited this request. Wait until the displayed refresh time before trying again.';
  if (status === 500 || status === 503) return 'Enka is having a server problem. Your saved tracker data was not changed.';
  return 'The public showcase provider returned HTTP ' + status + '.';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Use GET for a public showcase lookup.' }, { 'Cache-Control': 'no-store' });
  }

  const uid = String(req.query?.uid || '').trim();
  if (!UID_PATTERN.test(uid)) {
    return json(res, 400, { error: 'Enter a valid 9–10 digit Genshin UID.' }, { 'Cache-Control': 'no-store' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const upstream = await fetch(ENKA_URL + encodeURIComponent(uid) + '/', {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const status = [400, 404, 424, 429, 500, 503].includes(upstream.status) ? upstream.status : 502;
      const headers = { 'Cache-Control': 'no-store' };
      const retryAfter = upstream.headers.get('retry-after');
      if (retryAfter) headers['Retry-After'] = retryAfter;
      return json(res, status, { error: errorMessage(upstream.status), upstreamStatus: upstream.status }, headers);
    }

    let payload;
    try {
      payload = await upstream.json();
    } catch {
      return json(res, 502, { error: 'Enka returned a response that was not valid JSON.' }, { 'Cache-Control': 'no-store' });
    }
    if (!payload || typeof payload !== 'object' || (!payload.playerInfo && !Array.isArray(payload.avatarInfoList))) {
      return json(res, 502, { error: 'Enka returned an incomplete showcase response. Try again later.' }, { 'Cache-Control': 'no-store' });
    }

    const requestedTtl = Number(payload.ttl);
    const ttl = Number.isFinite(requestedTtl) && requestedTtl > 0 ? Math.min(86400, Math.ceil(requestedTtl)) : 60;
    // This endpoint exposes only publicly visible profile/showcase data. CDN caching
    // shares Enka's TTL across visitors so one UID cannot hammer the provider.
    return json(res, 200, payload, {
      'Cache-Control': 'public, s-maxage=' + ttl + ', stale-while-revalidate=30',
      'X-Enka-Cache-TTL': String(ttl),
    });
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    return json(res, aborted ? 504 : 502, {
      error: aborted ? 'Enka took too long to respond. Your saved tracker data was not changed.' : 'Could not reach Enka. Check the deployment and try again later.',
    }, { 'Cache-Control': 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}
