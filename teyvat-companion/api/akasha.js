const UID_PATTERN = /^[0-9]{9,10}$/;
const MD5_PATTERN = /^[a-fA-F0-9]{32}$/;
const AKASHA_API = 'https://akasha.cv/api';
// Match the current community wrapper's user agent. AKASHA's API is undocumented and
// can reject automated requests as it changes; this identifies the client consistently.
const USER_AGENT = 'akasha-py';

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

function providerError(status, detail = '') {
  if (status === 404) return 'AKASHA has no public calculation/artifact data for this request. Confirm your UID and make sure your public profile is indexed.';
  if (status === 429) return 'AKASHA rate-limited this request. Wait a few minutes before trying again.';
  if (status === 401 || status === 403) {
    return 'AKASHA rejected the public API request (HTTP ' + status + '). This can be an API access or automated-request restriction, not necessarily a problem with your UID.'
      + (detail ? ' Provider message: ' + detail : ' Its public API may block serverless requests or may have changed.');
  }
  return 'AKASHA returned HTTP ' + status + (detail ? '. Provider message: ' + detail : '. Its community API can change without notice.');
}

function safeProviderDetail(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const raw = typeof payload.message === 'string' ? payload.message
    : typeof payload.error === 'string' ? payload.error
    : typeof payload.error?.description === 'string' ? payload.error.description
    : typeof payload.error?.message === 'string' ? payload.error.message
    : '';
  const detail = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!detail || /<html|<!doctype|stack trace| at [\w.]+ \(/i.test(detail)) return '';
  return detail.slice(0, 180);
}

async function requestAkasha(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const upstream = await fetch(AKASHA_API + path, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!upstream.ok) {
      let providerDetail = '';
      try { providerDetail = safeProviderDetail(await upstream.clone().json()); } catch { /* Some edge protections return HTML instead of JSON. */ }
      const status = [400, 401, 403, 404, 429].includes(upstream.status) ? upstream.status : 502;
      return {
        ok: false,
        status,
        error: status === 502
          ? 'AKASHA returned HTTP ' + upstream.status + '. Its community API may have changed.'
          : providerError(status, providerDetail),
      };
    }
    let payload;
    try { payload = await upstream.json(); }
    catch { return { ok: false, status: 502, error: 'AKASHA returned invalid JSON.' }; }
    if (payload && !Array.isArray(payload) && typeof payload === 'object' && payload.error) {
      const detail = safeProviderDetail(payload);
      return {
        ok: false,
        status: 502,
        error: 'AKASHA returned an API error' + (detail ? ': ' + detail : '. Its community API may have changed.'),
      };
    }
    return { ok: true, data: payload?.data ?? payload };
  } catch (error) {
    return {
      ok: false,
      status: error?.name === 'AbortError' ? 504 : 502,
      error: error?.name === 'AbortError' ? 'AKASHA took too long to respond. Your existing tracker data was not changed.' : 'Could not reach AKASHA. Try again later.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function cleanCalculationRecord(record) {
  const calculations = record?.calculations;
  const entries = Array.isArray(calculations)
    ? calculations.map((value, index) => [String(index), value])
    : calculations && typeof calculations === 'object' ? Object.entries(calculations) : [];
  const safeCalculations = {};
  for (const [key, calc] of entries.slice(0, 30)) {
    if (!calc || typeof calc !== 'object' || Array.isArray(calc)) continue;
    const weapon = calc.weapon && typeof calc.weapon === 'object' ? calc.weapon : {};
    safeCalculations[key] = {
      calculationId: calc.calculationId ?? calc.id ?? null,
      short: String(calc.short || ''),
      name: String(calc.name || ''),
      details: String(calc.details || ''),
      weapon: {
        name: String(weapon.name || ''),
        icon: String(weapon.icon || ''),
        substat: String(weapon.substat || ''),
        type: String(weapon.type || ''),
        rarity: weapon.rarity ?? null,
        refinement: weapon.refinement ?? null,
      },
      result: calc.result ?? null,
      stats: calc.stats && typeof calc.stats === 'object' && !Array.isArray(calc.stats)
        ? Object.fromEntries(Object.entries(calc.stats).slice(0, 40)) : {},
      ranking: calc.ranking ?? null,
      outOf: calc.outOf ?? calc.out_of ?? null,
      topPercent: calc.topPercent ?? calc.top_percent ?? null,
      variant: calc.variant && typeof calc.variant === 'object' ? {
        name: String(calc.variant.name || ''),
        displayName: String(calc.variant.displayName || ''),
      } : null,
    };
  }
  const artifactSets = record?.artifactSets ?? record?.artifact_sets ?? {};
  const safeSets = Array.isArray(artifactSets)
    ? artifactSets.slice(0, 10)
    : artifactSets && typeof artifactSets === 'object'
      ? Object.fromEntries(Object.entries(artifactSets).slice(0, 10)) : {};
  return {
    _id: String(record?._id ?? record?.id ?? ''),
    characterId: record?.characterId ?? record?.character_id ?? null,
    type: String(record?.type || ''),
    uid: String(record?.uid || ''),
    artifactSets: safeSets,
    calculations: safeCalculations,
    constellation: record?.constellation ?? null,
    md5: String(record?.md5 || record?.hash || ''),
    name: String(record?.name || ''),
    icon: String(record?.icon || ''),
  };
}

function cleanArtifact(artifact, index) {
  const substats = artifact?.substats ?? artifact?.subStats ?? {};
  const safeSubstats = Array.isArray(substats)
    ? substats.slice(0, 4).map(stat => ({
        name: String(stat?.name ?? stat?.key ?? 'Unknown'),
        value: stat?.value ?? null,
      }))
    : substats && typeof substats === 'object'
      ? Object.fromEntries(Object.entries(substats).slice(0, 4)) : {};
  const main = artifact?.mainStat && typeof artifact.mainStat === 'object' ? artifact.mainStat : {};
  return {
    id: String(artifact?.id ?? artifact?.name ?? ('artifact-' + index)),
    name: String(artifact?.name || 'Artifact'),
    setName: String(artifact?.setName ?? artifact?.set_name ?? 'Unknown set'),
    stars: artifact?.stars ?? artifact?.rarity ?? null,
    mainStatKey: String(artifact?.mainStatKey ?? main.key ?? main.name ?? 'Unknown'),
    mainStatValue: artifact?.mainStatValue ?? main.value ?? null,
    substats: safeSubstats,
    equipType: String(artifact?.equipType ?? artifact?.equip_type ?? ''),
    level: artifact?.level ?? null,
    critValue: artifact?.critValue ?? artifact?.crit_value ?? artifact?.cv ?? null,
    icon: String(artifact?.icon || ''),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Use GET for public AKASHA profile/artifact lookups.' }, { 'Cache-Control': 'no-store' });
  }
  const uid = String(req.query?.uid || '').trim();
  if (!UID_PATTERN.test(uid)) {
    return json(res, 400, { error: 'Enter a valid 9–10 digit Genshin UID first.' }, { 'Cache-Control': 'no-store' });
  }

  const md5 = String(req.query?.md5 || '').trim();
  if (md5 && !MD5_PATTERN.test(md5)) {
    return json(res, 400, { error: 'That AKASHA build hash is invalid. Sync the profile again and retry.' }, { 'Cache-Control': 'no-store' });
  }

  if (md5) {
    const result = await requestAkasha('/artifacts/' + encodeURIComponent(uid) + '/' + encodeURIComponent(md5));
    if (!result.ok) {
      return json(res, result.status, { error: result.error || providerError(result.status) }, { 'Cache-Control': 'no-store' });
    }
    const rows = Array.isArray(result.data) ? result.data : Array.isArray(result.data?.artifacts) ? result.data.artifacts : null;
    if (!rows) {
      return json(res, 502, { error: 'AKASHA returned artifact data in an unrecognized format. Existing synced data was kept.' }, { 'Cache-Control': 'no-store' });
    }
    return json(res, 200, {
      uid,
      md5: md5.toLowerCase(),
      fetchedAt: new Date().toISOString(),
      artifacts: rows.slice(0, 10).map(cleanArtifact),
      source: 'AKASHA System public artifact endpoint',
    }, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' });
  }

  const result = await requestAkasha('/getCalculationsForUser/' + encodeURIComponent(uid));
  if (!result.ok) {
    return json(res, result.status, { error: result.error || providerError(result.status) }, { 'Cache-Control': 'no-store' });
  }
  const rows = Array.isArray(result.data) ? result.data
    : Array.isArray(result.data?.profiles) ? result.data.profiles
    : Array.isArray(result.data?.calculations) ? result.data.calculations : null;
  if (!rows) {
    return json(res, 502, { error: 'AKASHA returned calculation data in an unrecognized format. Existing synced data was kept.' }, { 'Cache-Control': 'no-store' });
  }
  return json(res, 200, {
    uid,
    fetchedAt: new Date().toISOString(),
    profiles: rows.slice(0, 120).map(cleanCalculationRecord),
    source: 'AKASHA System public calculation endpoint',
    note: 'Community data API; results depend on the public profile and available leaderboard calculations.',
  }, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' });
}
