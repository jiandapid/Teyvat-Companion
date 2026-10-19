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

function publicProfileSegment(value, maxLength = 96) {
  const segment = String(value ?? '').trim();
  return segment.length > 0 && segment.length <= maxLength && /^[a-zA-Z0-9_-]+$/.test(segment) ? segment : '';
}

/**
 * Fetch only a verified/public Enka profile's saved builds. This is an optional
 * enrichment: its failure must never turn a valid UID/showcase sync into a failure.
 */
async function fetchPublicSavedBuilds(owner, timeoutMs = 2500) {
  const username = publicProfileSegment(owner?.username, 64);
  const hash = publicProfileSegment(owner?.hash, 96);
  if (!username || !hash) {
    return { status: owner ? 'invalid-public-profile-metadata' : 'no-public-Enka-profile', builds: null };
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 250) {
    return { status: 'skipped-time-budget', builds: null };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(2500, timeoutMs));
  try {
    const url = 'https://enka.network/api/profile/' + encodeURIComponent(username)
      + '/hoyos/' + encodeURIComponent(hash) + '/builds/';
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: response.status === 404 ? 'no-public-saved-builds' : 'temporarily-unavailable', builds: null };
    }
    const builds = await response.json();
    if (!builds || typeof builds !== 'object' || Array.isArray(builds)) {
      return { status: 'invalid-saved-build-response', builds: null };
    }
    return { status: 'loaded', builds };
  } catch (error) {
    return { status: error?.name === 'AbortError' ? 'timeout' : 'temporarily-unavailable', builds: null };
  } finally {
    clearTimeout(timeout);
  }
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

  const requestStartedAt = Date.now();
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
    const includeBuilds = String(req.query?.includeBuilds || '') === '1';
    // Keep enough of the function's timeout budget for the primary UID response.
    // Saved-build enrichment is optional and must never break the core roster import.
    const savedBudget = Math.min(2500, Math.max(0, 8500 - (Date.now() - requestStartedAt)));
    const saved = includeBuilds ? await fetchPublicSavedBuilds(payload.owner, savedBudget) : null;
    const responsePayload = includeBuilds
      ? { ...payload, savedBuilds: saved.builds, savedBuildsStatus: saved.status }
      : payload;
    // This endpoint exposes only publicly visible profile/showcase data. CDN caching
    // shares Enka's TTL across visitors so one UID cannot hammer the provider.
    return json(res, 200, responsePayload, {
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
