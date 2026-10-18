export function isValidGenshinUid(value) {
  return /^[0-9]{9,10}$/.test(String(value ?? '').trim());
}

export function enkaTtlSeconds(value) {
  const ttl = Number(value);
  return Number.isFinite(ttl) && ttl > 0 ? Math.ceil(ttl) : 60;
}

export function mergeEnkaShowcaseCharacter(character, imported, syncedAt) {
  const current = character || {};
  const entry = imported || {};
  const validLevel = Number.isFinite(Number(entry.level)) && Number(entry.level) > 0;
  const hasConstellation = entry.constellation !== null
    && entry.constellation !== undefined
    && Number.isFinite(Number(entry.constellation));
  const enkaBuild = {
    ...(current.enkaBuild || {}),
    syncedAt,
    avatarId: entry.avatarId || '',
    level: entry.level ?? null,
    constellation: entry.constellation ?? null,
    talentLevels: Array.isArray(entry.talents) ? [...entry.talents] : [],
    weapon: entry.weapon || '',
    weaponLevel: entry.weaponLevel ?? null,
    artifacts: Array.isArray(entry.artifacts) ? [...entry.artifacts] : [],
    friendship: entry.friendship ?? null,
  };

  return {
    ...current,
    owned: true,
    ...(validLevel ? { level: Number(entry.level) } : {}),
    ...(hasConstellation ? { constellation: Math.max(0, Math.min(6, Number(entry.constellation))) } : {}),
    // Keep the user's editable planned build fields; current equipped gear belongs in enkaBuild.
    enkaBuild,
  };
}

const compactName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isTravelerRecord = value => /^traveler-/i.test(String(value?.id || ''))
  || /^(traveler|aether|lumine)(\s|$)/i.test(String(value?.name || ''));

function sameCatalogueCharacter(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  if (isTravelerRecord(a) || isTravelerRecord(b)) return false;
  if (a.apiId && b.apiId && String(a.apiId) === String(b.apiId)) return true;
  const aName = compactName(a.name);
  return Boolean(aName && aName === compactName(b.name));
}

function mergeDuplicateCharacter(existing, incoming) {
  return {
    ...incoming,
    ...existing,
    id: existing.id || incoming.id,
    owned: Boolean(existing.owned || incoming.owned),
    level: Math.max(Number(existing.level) || 1, Number(incoming.level) || 1),
    talents: [0, 1, 2].map(i => Math.max(Number(existing.talents?.[i]) || 1, Number(incoming.talents?.[i]) || 1)),
    constellation: Math.max(Number(existing.constellation) || 0, Number(incoming.constellation) || 0),
    weaponName: existing.weaponName || incoming.weaponName || '',
    artifact: existing.artifact || incoming.artifact || '',
    mainStats: existing.mainStats || incoming.mainStats || '',
    notes: existing.notes || incoming.notes || '',
    enkaBuild: existing.enkaBuild || incoming.enkaBuild || null,
    gameData: existing.gameData || incoming.gameData || null,
  };
}

/**
 * Refresh catalogue metadata while retaining the app's stable local IDs and tracking fields.
 * Some data sources use alternate slugs (e.g. "kaedehara-kazuha" vs the starter ID "kazuha").
 */
export function mergeCharacterCatalogue(previousCharacters, freshRecords) {
  const byId = new Map();

  // First collapse duplicates left by older catalogue refreshes, without merging Traveler elements.
  for (const character of Array.isArray(previousCharacters) ? previousCharacters : []) {
    const match = [...byId.values()].find(existing => sameCatalogueCharacter(existing, character));
    if (!match) {
      if (character?.id) byId.set(character.id, character);
      continue;
    }
    byId.set(match.id, mergeDuplicateCharacter(match, character));
  }

  // Then refresh metadata, keeping the matched record's stable ID and user-specific progress.
  for (const fresh of Array.isArray(freshRecords) ? freshRecords : []) {
    if (!fresh?.id) continue;
    const match = [...byId.values()].find(existing => sameCatalogueCharacter(existing, fresh));
    const existing = match || null;
    const canonicalId = existing?.id || fresh.id;
    byId.set(canonicalId, {
      ...fresh,
      ...(existing || {}),
      id: canonicalId,
      apiId: fresh.apiId || existing?.apiId || '',
      apiSlug: fresh.apiSlug || existing?.apiSlug || '',
      rawName: fresh.rawName || existing?.rawName || fresh.name,
      name: fresh.name || existing?.name || canonicalId,
      title: fresh.title || existing?.title || '',
      element: fresh.element || existing?.element || 'Unknown',
      weapon: fresh.weapon || existing?.weapon || 'Unknown',
      rarity: fresh.rarity || existing?.rarity || 0,
      region: fresh.region || existing?.region || 'Unknown',
      image: fresh.image || existing?.image || '',
      iconImage: fresh.iconImage || existing?.iconImage || '',
      portraitImage: fresh.portraitImage || existing?.portraitImage || '',
      imageType: fresh.imageType || existing?.imageType || '',
      materialGuides: fresh.materialGuides?.length ? fresh.materialGuides : (existing?.materialGuides || []),
      source: fresh.source || existing?.source || '',
      owned: existing?.owned ?? false,
      level: existing?.level ?? 1,
      talents: existing?.talents || [1, 1, 1],
      constellation: existing?.constellation ?? 0,
      weaponName: existing?.weaponName || '',
      artifact: existing?.artifact || '',
      mainStats: existing?.mainStats || '',
      notes: existing?.notes || '',
      role: existing?.role || fresh.role || 'Unassigned',
      gameData: existing?.gameData || fresh.gameData || null,
    });
  }

  return [...byId.values()];
}
