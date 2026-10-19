export function isValidGenshinUid(value) {
  return /^[0-9]{9,10}$/.test(String(value ?? '').trim());
}


/**
 * Validate and normalize the outer shape of a Teyvat Companion backup before
 * importing it. A malformed file must never silently reset a user's workspace.
 */
function isBackupRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeTrackerBackup(input) {
  if (!isBackupRecord(input)) {
    throw new Error('The backup must be a JSON object.');
  }
  if (input.format != null && input.format !== 'teyvat-companion-backup-v1') {
    throw new Error('This backup format is not supported by this version of Teyvat Companion.');
  }

  const rawCharacters = Array.isArray(input.characters)
    ? input.characters
    : isBackupRecord(input.characters)
      ? Object.entries(input.characters).map(([id, character]) =>
          isBackupRecord(character) ? { ...character, id: character.id ?? id } : character)
      : null;
  if (!rawCharacters) {
    throw new Error('No character data was found. Choose a Teyvat Companion backup.');
  }

  if (input.extraCharacters !== undefined && !Array.isArray(input.extraCharacters)) {
    throw new Error('The backup has an invalid "extraCharacters" section. Your current data was not changed.');
  }

  const charactersById = new Map();
  const allCharacters = [...rawCharacters, ...(Array.isArray(input.extraCharacters) ? input.extraCharacters : [])];
  for (const character of allCharacters) {
    if (!isBackupRecord(character) || character.id == null || !String(character.id).trim()) continue;
    const id = String(character.id).trim();
    charactersById.set(id, { ...character, id });
  }
  if (!charactersById.size) {
    throw new Error('The backup contains no valid character records. Your current data was not changed.');
  }

  for (const key of ['materials', 'teams', 'goals', 'tasks', 'mapMarkers']) {
    if (input[key] !== undefined && !Array.isArray(input[key])) {
      throw new Error('The backup has an invalid "' + key + '" section. Your current data was not changed.');
    }
  }
  if (input.account != null && !isBackupRecord(input.account)) {
    throw new Error('The backup has an invalid account section. Your current data was not changed.');
  }
  for (const key of ['enkaSnapshot', 'goodInventory', 'akashaSnapshot']) {
    if (input[key] != null && !isBackupRecord(input[key])) {
      throw new Error('The backup has an invalid "' + key + '" section. Your current data was not changed.');
    }
  }

  return { ...input, characters: [...charactersById.values()] };
}

export function enkaTtlSeconds(value) {
  const ttl = Number(value);
  return Number.isFinite(ttl) && ttl > 0 ? Math.min(86400, Math.ceil(ttl)) : 60;
}

/**
 * Normalize the account's public display-list entries plus detailed showcase entries.
 * This is deliberately a public display list, NOT a complete owned-character inventory.
 */
export function parseEnkaPublicRoster(playerInfo, detailedAvatars = [], characters = []) {
  const basicRows = Array.isArray(playerInfo?.showAvatarInfoList) ? playerInfo.showAvatarInfoList : [];
  const detailRows = Array.isArray(detailedAvatars) ? detailedAvatars : [];
  const output = new Map();

  const avatarIdOf = row => String(row?.avatarId ?? row?.avatarID ?? row?.id ?? '').trim();
  const levelOf = row => {
    const raw = row?.level ?? row?.propMap?.['4001']?.val ?? row?.propMap?.['4001']?.ival;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
  };
  const matchOf = avatarId => (characters || []).find(character =>
    avatarId && String(character?.apiId ?? '') === avatarId
  ) || (characters || []).find(character => avatarId && String(character?.id ?? '') === avatarId) || null;

  for (const row of basicRows) {
    const avatarId = avatarIdOf(row);
    if (!avatarId) continue;
    const match = matchOf(avatarId);
    output.set(avatarId, {
      avatarId,
      characterId: match?.id || '',
      name: match?.name || row?.name || `Character ID ${avatarId}`,
      level: levelOf(row),
      costumeId: row?.costumeId ?? null,
      detailsAvailable: false,
    });
  }

  for (const row of detailRows) {
    const avatarId = avatarIdOf(row);
    if (!avatarId) continue;
    const previous = output.get(avatarId) || {};
    const match = matchOf(avatarId);
    output.set(avatarId, {
      ...previous,
      avatarId,
      characterId: match?.id || previous.characterId || '',
      name: match?.name || previous.name || row?.name || `Character ID ${avatarId}`,
      level: levelOf(row) ?? previous.level ?? null,
      costumeId: row?.costumeId ?? previous.costumeId ?? null,
      detailsAvailable: true,
    });
  }

  return [...output.values()];
}

/**
 * Flatten Enka's public saved-build object into displayable, character-matched records.
 * Preserve raw avatar_data/settings because the provider can evolve these payloads.
 */
export function flattenEnkaSavedBuilds(savedBuilds, characters = []) {
  if (!savedBuilds || typeof savedBuilds !== 'object' || Array.isArray(savedBuilds)) return [];
  const result = [];
  for (const [avatarKey, rawList] of Object.entries(savedBuilds)) {
    if (!Array.isArray(rawList)) continue;
    const avatarId = String(avatarKey);
    const character = (characters || []).find(item => String(item?.apiId ?? '') === avatarId)
      || (characters || []).find(item => String(item?.id ?? '') === avatarId)
      || null;
    for (const [index, raw] of rawList.slice(0, 50).entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      // Never surface a build explicitly marked private even if an API response includes it.
      if (raw.public === false) continue;
      const rawOrder = Number(raw.order);
      result.push({
        id: String(raw.id ?? (avatarId + '-' + index)),
        avatarId: String(raw.avatar_id ?? raw.avatarId ?? avatarId),
        characterId: character?.id || '',
        characterName: character?.name || ('Character ID ' + avatarId),
        name: String(raw.name || ('Build ' + (Number.isFinite(rawOrder) ? rawOrder + 1 : index + 1))),
        order: Number.isFinite(rawOrder) ? rawOrder : index,
        live: raw.live === true,
        isPublic: typeof raw.public === 'boolean' ? raw.public : null,
        image: typeof raw.image === 'string' ? raw.image : '',
        avatarData: raw.avatar_data ?? raw.avatarData ?? null,
        settings: raw.settings ?? null,
      });
      if (result.length >= 500) break;
    }
    if (result.length >= 500) break;
  }
  return result.sort((a, b) =>
    a.characterName.localeCompare(b.characterName) ||
    a.order - b.order ||
    a.name.localeCompare(b.name)
  );
}

const AKASHA_SLOT_LABELS = {
  EQUIP_BRACER: 'Flower of Life',
  EQUIP_NECKLACE: 'Plume of Death',
  EQUIP_SHOES: 'Sands of Eon',
  EQUIP_RING: 'Goblet of Eonothem',
  EQUIP_DRESS: 'Circlet of Logos',
};

function safeAkashaNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize the public Akasha System calculation payload.
 * Akasha is a community service whose response shapes can change; missing fields stay null.
 */
export function normalizeAkashaProfiles(payload, uid, characters = []) {
  const rows = Array.isArray(payload) ? payload
    : Array.isArray(payload?.profiles) ? payload.profiles
    : Array.isArray(payload?.data) ? payload.data : [];
  return rows.slice(0, 120).filter(row => row && typeof row === 'object' && !Array.isArray(row)).map((row, rowIndex) => {
    const rawCharacterId = String(row.characterId ?? row.character_id ?? '');
    const character = (characters || []).find(item =>
      rawCharacterId && String(item?.apiId ?? '') === rawCharacterId
    ) || (characters || []).find(item => rawCharacterId && String(item?.id ?? '') === rawCharacterId)
      || (characters || []).find(item => row.name && compactName(item?.name) === compactName(row.name))
      || null;
    const rawCalcs = row.calculations;
    const calcRows = Array.isArray(rawCalcs) ? rawCalcs
      : rawCalcs && typeof rawCalcs === 'object' ? Object.entries(rawCalcs).map(([key, value]) => ({ ...value, _calcKey: key })) : [];
    const calculations = calcRows.slice(0, 30).filter(calc => calc && typeof calc === 'object' && !Array.isArray(calc)).map((calc, calcIndex) => {
      const ranking = safeAkashaNumber(calc.ranking ?? calc.rank);
      const outOf = safeAkashaNumber(calc.outOf ?? calc.out_of);
      const providedPercent = safeAkashaNumber(calc.topPercent ?? calc.top_percent);
      const topPercent = providedPercent ?? (ranking > 0 && outOf > 0 ? (ranking / outOf) * 100 : null);
      const weapon = calc.weapon && typeof calc.weapon === 'object' ? calc.weapon : {};
      const result = safeAkashaNumber(calc.result ?? calc.damage);
      const calculationId = safeAkashaNumber(calc.calculationId ?? calc.id ?? calc._calcKey);
      return {
        id: calculationId ?? (rowIndex + '-' + calcIndex),
        short: String(calc.short || ''),
        name: String(calc.name || calc.displayName || calc.short || ('Calculation ' + (calcIndex + 1))),
        details: String(calc.details || ''),
        weapon: {
          name: String(weapon.name || ''),
          icon: String(weapon.icon || ''),
          rarity: safeAkashaNumber(weapon.rarity),
          refinement: safeAkashaNumber(weapon.refinement),
          substat: String(weapon.substat || ''),
          type: String(weapon.type || ''),
        },
        result,
        ranking: ranking != null && ranking > 0 ? ranking : null,
        outOf: outOf != null && outOf > 0 ? outOf : null,
        topPercent: topPercent != null && topPercent >= 0 ? topPercent : null,
        stats: calc.stats && typeof calc.stats === 'object' && !Array.isArray(calc.stats) ? calc.stats : {},
        variant: calc.variant && typeof calc.variant === 'object'
          ? { name: String(calc.variant.name || ''), displayName: String(calc.variant.displayName || '') }
          : null,
      };
    });
    const rawSets = row.artifactSets ?? row.artifact_sets ?? {};
    const artifactSets = Array.isArray(rawSets)
      ? rawSets.slice(0, 10).map(item => typeof item === 'string' ? { name: item, count: null, icon: '' } : ({
          name: String(item?.name || item?.setName || 'Unknown set'),
          count: safeAkashaNumber(item?.count),
          icon: String(item?.icon || ''),
        }))
      : rawSets && typeof rawSets === 'object'
        ? Object.entries(rawSets).slice(0, 10).map(([name, item]) => ({
            name,
            count: safeAkashaNumber(item?.count ?? item),
            icon: String(item?.icon || ''),
          }))
        : [];
    return {
      id: String(row._id ?? row.id ?? (String(uid) + '-' + rawCharacterId + '-' + rowIndex)),
      uid: String(row.uid ?? uid ?? ''),
      characterId: character?.id || '',
      rawCharacterId,
      characterName: character?.name || String(row.name || row.characterName || ('Character ID ' + rawCharacterId)),
      type: String(row.type || ''),
      name: String(row.name || character?.name || 'Character build'),
      icon: String(row.icon || ''),
      constellation: safeAkashaNumber(row.constellation),
      md5: String(row.md5 || row.hash || ''),
      artifactSets,
      calculations,
    };
  });
}

/** Normalize detailed public artifact rows from Akasha's build-artifact endpoint. */
export function normalizeAkashaArtifacts(payload) {
  const rows = Array.isArray(payload) ? payload
    : Array.isArray(payload?.artifacts) ? payload.artifacts
    : Array.isArray(payload?.data) ? payload.data : [];
  const percentKey = key => /%|rate|crit|damage bonus|energy recharge|bonus/i.test(String(key || ''));
  const asPercentPoints = value => {
    const n = safeAkashaNumber(value);
    if (n == null) return null;
    return Math.abs(n) <= 1 ? n * 100 : n;
  };
  return rows.slice(0, 10).filter(row => row && typeof row === 'object' && !Array.isArray(row)).map((row, index) => {
    const rawMain = row.mainStat && typeof row.mainStat === 'object' ? row.mainStat : {};
    const mainKey = String(row.mainStatKey ?? rawMain.key ?? rawMain.name ?? 'Unknown');
    const mainValue = safeAkashaNumber(row.mainStatValue ?? rawMain.value);
    const rawSubstats = row.substats ?? row.subStats ?? [];
    const substats = Array.isArray(rawSubstats)
      ? rawSubstats.slice(0, 4).map(stat => ({
          key: String(stat?.key ?? stat?.name ?? 'Unknown'),
          value: safeAkashaNumber(stat?.value),
        }))
      : rawSubstats && typeof rawSubstats === 'object'
        ? Object.entries(rawSubstats).slice(0, 4).map(([key, value]) => ({ key: String(key), value: safeAkashaNumber(value) }))
        : [];
    const lookupStat = pattern => {
      const match = substats.find(stat => pattern.test(stat.key));
      return match ? match.value : null;
    };
    const explicitCv = safeAkashaNumber(row.critValue ?? row.crit_value ?? row.cv);
    const rate = lookupStat(/crit\s*rate|critRate|criticalrate/i);
    const damage = lookupStat(/crit\s*damage|crit\s*dmg|critDMG|criticaldamage/i);
    const computedCv = rate != null && damage != null
      ? asPercentPoints(rate) * 2 + asPercentPoints(damage)
      : null;
    const rawLevel = safeAkashaNumber(row.level);
    return {
      id: String(row.id ?? row.name ?? (String(row.setName || row.set_name || 'artifact') + '-' + index)),
      name: String(row.name || 'Artifact'),
      setName: String(row.setName ?? row.set_name ?? 'Unknown set'),
      rarity: safeAkashaNumber(row.stars ?? row.rarity),
      slot: AKASHA_SLOT_LABELS[String(row.equipType ?? row.equip_type ?? '')] || String(row.equipType ?? row.equip_type ?? 'Artifact slot'),
      level: rawLevel == null ? null : Math.max(0, Math.min(20, rawLevel - 1)),
      mainStat: { key: mainKey, value: mainValue },
      substats,
      critValue: explicitCv ?? computedCv,
      icon: String(row.icon || ''),
      isMainStatPercent: percentKey(mainKey),
    };
  });
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


/**
 * Reject suspiciously small/invalid refresh responses instead of replacing a
 * good local catalogue with a partial upstream response.
 */
export const MIN_PLAYABLE_CHARACTER_COUNT = 100;

export function validateCharacterCatalogue(records, minimum = MIN_PLAYABLE_CHARACTER_COUNT) {
  if (!Array.isArray(records)) {
    throw new Error('The character data source returned an invalid catalogue.');
  }
  const byId = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const id = String(record.id ?? '').trim();
    const name = String(record.name ?? '').trim();
    if (!id || !name) continue;
    byId.set(id, { ...record, id, name });
  }
  const normalized = [...byId.values()];
  const expectedMinimum = Number.isFinite(Number(minimum)) ? Math.max(1, Math.floor(Number(minimum))) : MIN_PLAYABLE_CHARACTER_COUNT;
  if (normalized.length < expectedMinimum) {
    throw new Error(
      'The refresh returned only ' + normalized.length + ' unique character records; expected at least ' +
      expectedMinimum + '. Your existing catalogue was kept. Try again when the source has recovered.'
    );
  }
  return normalized;
}


/**
 * Aggregate source-provided character ascension plus all listed talent upgrade
 * material costs. Returns totals for the full Level 90 / level-10 talent plan;
 * callers must label that target clearly and must not invent missing costs.
 */
export function getCharacterUpgradeMaterialRequirements(character, materialLookup = {}) {
  const gameData = character?.gameData;
  if (!gameData || typeof gameData !== 'object') return [];
  const totals = new Map();

  const toCostItems = value => {
    if (Array.isArray(value)) {
      return value.map(item => ({
        id: String(item?.id ?? item?.itemId ?? ''),
        count: Number(item?.count ?? item?.amount ?? item?.value ?? 0),
      })).filter(item => item.id && Number.isFinite(item.count) && item.count > 0);
    }
    if (value && typeof value === 'object') {
      return Object.entries(value).map(([id, count]) => ({
        id: String(id),
        count: Number(count?.count ?? count?.amount ?? count) || 0,
      })).filter(item => item.id && Number.isFinite(item.count) && item.count > 0);
    }
    return [];
  };

  const addCosts = (costs, category) => {
    for (const cost of toCostItems(costs)) {
      const current = totals.get(cost.id) || {
        id: cost.id,
        name: String(materialLookup?.[cost.id]?.name || materialLookup?.[cost.id]?.name2 || ''),
        required: 0,
        categories: new Set(),
      };
      current.required += cost.count;
      current.categories.add(category);
      totals.set(cost.id, current);
    }
  };

  const upgrade = gameData.upgrade || {};
  const ascensionPhases = Array.isArray(upgrade.promotes) ? upgrade.promotes
    : Array.isArray(upgrade.promote) ? upgrade.promote
    : [];
  for (const phase of ascensionPhases) {
    addCosts(phase?.costItems ?? phase?.cost_items ?? phase?.materials, 'Character ascension');
  }

  const talents = Array.isArray(gameData.talents) ? gameData.talents : [];
  for (const talent of talents) {
    const upgrades = Array.isArray(talent?.upgrades) ? talent.upgrades
      : Array.isArray(talent?.promote) ? talent.promote
      : Array.isArray(talent?.upgrade) ? talent.upgrade
      : [];
    for (const level of upgrades) {
      addCosts(level?.costItems ?? level?.cost_items ?? level?.materials, 'Talent');
    }
  }

  return [...totals.values()]
    .filter(item => Number.isFinite(item.required) && item.required > 0)
    .map(item => ({
      id: item.id,
      name: item.name || ('Material ID ' + item.id),
      resolved: Boolean(item.name),
      required: Math.ceil(item.required),
      categories: [...item.categories],
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}


const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanGoodArtifact(item) {
  const substats = (Array.isArray(item.substats) ? item.substats : [])
    .filter(stat => stat && typeof stat.key === 'string')
    .map(stat => ({ key: stat.key, value: numberOr(stat.value) }));
  let critValue = 0;
  for (const stat of substats) {
    const token = compactName(stat.key);
    if (token.includes('critrate') || token.includes('criticalrate')) critValue += numberOr(stat.value) * 2;
    else if (token.includes('critdmg') || token.includes('criticaldamage')) critValue += numberOr(stat.value);
  }
  return {
    setKey: String(item.setKey || 'Unknown'),
    slotKey: String(item.slotKey || 'unknown'),
    level: Math.max(0, Math.min(20, numberOr(item.level))),
    rarity: [1, 2, 3, 4, 5].includes(Number(item.rarity)) ? Number(item.rarity) : 5,
    mainStatKey: String(item.mainStatKey || 'unknown'),
    location: String(item.location || ''),
    lock: Boolean(item.lock),
    substats,
    critValue: round2(critValue),
  };
}

/**
 * Import the documented Genshin Open Object Description (GOOD) inventory format.
 * Supports GOOD v1–v3 and keeps imports in the browser; it does not require a game login.
 */
export function parseGoodInventory(input, importedAt = new Date().toISOString()) {
  let obj = input;
  if (typeof input === 'string') {
    try { obj = JSON.parse(input); }
    catch { throw new Error('This file is not valid JSON.'); }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Choose a GOOD JSON object.');
  if (obj.format !== 'GOOD') throw new Error('This is not a GOOD file. Expected format: "GOOD".');
  if (![1, 2, 3].includes(Number(obj.version))) throw new Error('Unsupported GOOD version. Supported versions are 1, 2 and 3.');
  const rawCharacters = Array.isArray(obj.characters) ? obj.characters : [];
  const rawWeapons = Array.isArray(obj.weapons) ? obj.weapons : [];
  const rawArtifacts = Array.isArray(obj.artifacts) ? obj.artifacts : [];
  if (!rawCharacters.length && !rawWeapons.length && !rawArtifacts.length) {
    throw new Error('The GOOD file contains no characters, weapons or artifacts.');
  }
  if (rawCharacters.length > 300 || rawWeapons.length > 3000 || rawArtifacts.length > 5000) {
    throw new Error('This file exceeds the safety limit for inventory items.');
  }

  const characters = rawCharacters.filter(item => item && typeof item.key === 'string' && item.key.trim())
    .map(item => ({
      key: item.key.trim(),
      level: Math.max(1, Math.min(100, numberOr(item.level, 1))),
      ascension: Math.max(0, Math.min(6, numberOr(item.ascension))),
      constellation: Math.max(0, Math.min(6, numberOr(item.constellation))),
      talent: {
        auto: Math.max(1, Math.min(15, numberOr(item.talent?.auto, 1))),
        skill: Math.max(1, Math.min(15, numberOr(item.talent?.skill, 1))),
        burst: Math.max(1, Math.min(15, numberOr(item.talent?.burst, 1))),
      },
    }));
  const weapons = rawWeapons.filter(item => item && typeof item.key === 'string' && item.key.trim())
    .map(item => ({
      key: item.key.trim(),
      level: Math.max(1, Math.min(90, numberOr(item.level, 1))),
      ascension: Math.max(0, Math.min(6, numberOr(item.ascension))),
      refinement: Math.max(1, Math.min(5, numberOr(item.refinement, 1))),
      location: String(item.location || ''),
      lock: Boolean(item.lock),
    }));
  const artifacts = rawArtifacts.filter(item => item && typeof item.setKey === 'string' && typeof item.slotKey === 'string')
    .map(cleanGoodArtifact);

  if (!characters.length && !weapons.length && !artifacts.length) {
    throw new Error('No usable GOOD inventory entries were found.');
  }

  const artifactsBySlot = artifacts.reduce((acc, artifact) => {
    acc[artifact.slotKey] = (acc[artifact.slotKey] || 0) + 1;
    return acc;
  }, {});
  return {
    format: 'GOOD',
    version: Number(obj.version),
    source: String(obj.source || 'GOOD file import'),
    importedAt,
    characters,
    weapons,
    artifacts,
    summary: {
      characters: characters.length,
      weapons: weapons.length,
      artifacts: artifacts.length,
      lockedArtifacts: artifacts.filter(item => item.lock).length,
      artifactsBySlot,
      highCritValueArtifacts: artifacts.filter(item => item.critValue >= 30).length,
    },
  };
}

export function matchGoodCharacterKey(key, characters) {
  const raw = String(key || '').trim();
  if (!raw) return null;
  const token = compactName(raw);
  const traveler = token.match(/^(?:traveler|aether|lumine)(anemo|geo|electro|dendro|hydro|pyro|cryo)$/);
  if (traveler) {
    const match = (characters || []).find(character => String(character.id || '').toLowerCase() === 'traveler-' + traveler[1]);
    if (match) return match;
  }
  const aliases = {
    raidenshogun: ['raiden', 'raiden-shogun'],
    kaedeharakazuha: ['kazuha', 'kaedehara-kazuha'],
    tartaglia: ['childe', 'tartaglia'],
    kamisatoayaka: ['ayaka', 'kamisato-ayaka'],
    kamisatoayato: ['ayato', 'kamisato-ayato'],
  };
  const keys = new Set([token, ...(aliases[token] || []).map(compactName)]);
  return (characters || []).find(character => {
    const candidates = [character.id, character.apiSlug, character.apiSlug?.split('/').pop(), character.name, character.rawName];
    return candidates.some(candidate => keys.has(compactName(candidate)));
  }) || null;
}

/**
 * Build a transparent progression plan from user-entered goals and shortages.
 * It deliberately doesn't invent live resin costs or domain drop rates when those aren't sourced.
 */
export function buildProgressionPlan({ characters = [], goals = [], materials = [], goodInventory = null } = {}) {
  const activeGoals = goals.filter(goal => !goal.done);
  const shortages = materials.map(material => ({
    ...material,
    missing: Math.max(0, numberOr(material.required) - numberOr(material.owned)),
  })).filter(material => material.missing > 0);
  shortages.sort((a, b) => numberOr(b.priority) - numberOr(a.priority) || b.missing / Math.max(1, numberOr(b.required)) - a.missing / Math.max(1, numberOr(a.required)));

  const actions = [];
  if (activeGoals.length) {
    const goal = activeGoals[0];
    const character = characters.find(item => item.id === goal.character);
    actions.push({
      kind: 'goal',
      title: 'Continue your active goal',
      detail: (character ? character.name + ': ' : '') + goal.title + (goal.target ? ' · ' + goal.target : ''),
      reason: 'An unfinished goal is your clearest declared priority.',
      goalId: goal.id,
    });
  }
  if (shortages.length) {
    const material = shortages[0];
    actions.push({
      kind: 'material',
      title: 'Farm a tracked material shortage',
      detail: material.name + ' · ' + material.missing + ' still needed',
      reason: 'This shortage comes from quantities you entered; verify the correct drop source and the current rotation in-game.',
      materialId: material.id,
      missing: material.missing,
    });
  }
  const artifacts = goodInventory?.artifacts || [];
  const usableArtifacts = artifacts.filter(item => Number(item.rarity) === 5);
  if (usableArtifacts.length) {
    const bestCv = [...usableArtifacts].sort((a, b) => numberOr(b.critValue) - numberOr(a.critValue))[0];
    actions.push({
      kind: 'artifacts',
      title: 'Audit your imported artifact inventory',
      detail: usableArtifacts.length + ' five-star artifacts imported' + (bestCv?.critValue ? ' · highest generic CRIT Value ' + round2(bestCv.critValue) : ''),
      reason: 'CRIT Value is only a quick sorting signal, not a character-specific build score. Main stats, set effects and team needs matter.',
    });
  }
  const underLevelled = characters.filter(character => character.owned && numberOr(character.level, 1) < 80)
    .sort((a, b) => numberOr(a.level, 1) - numberOr(b.level, 1))[0];
  if (underLevelled) {
    actions.push({
      kind: 'character',
      title: 'Review a lower-level owned character',
      detail: underLevelled.name + ' · Lv. ' + numberOr(underLevelled.level, 1),
      reason: 'Compare their role and team value before spending EXP books or boss resin.',
      characterId: underLevelled.id,
    });
  }
  if (!actions.length) {
    actions.push({
      kind: 'review',
      title: 'Choose one upgrade target',
      detail: 'Pick a character, talent, weapon or artifact set to focus on this week.',
      reason: 'A concrete target makes the next resin decision easier to evaluate.',
    });
  }
  return actions.slice(0, 4);
}


const ARTIFACT_SLOTS = ['flower', 'plume', 'sands', 'goblet', 'circlet'];
const ARTIFACT_SET_INFO = {
  GladiatorsFinale: { label: "Gladiator's Finale", two: 'atk', four: 'normal' },
  ShimenawasReminiscence: { label: "Shimenawa's Reminiscence", two: 'atk', four: 'normal' },
  EmblemOfSeveredFate: { label: 'Emblem of Severed Fate', two: 'energy', four: 'burst' },
  GoldenTroupe: { label: 'Golden Troupe', two: 'skill', four: 'offFieldSkill' },
  DeepwoodMemories: { label: 'Deepwood Memories', two: 'dendro', four: 'dendroRes' },
  GildedDreams: { label: 'Gilded Dreams', two: 'em', four: 'reaction' },
  ViridescentVenerer: { label: 'Viridescent Venerer', two: 'anemo', four: 'swirl' },
  NoblesseOblige: { label: 'Noblesse Oblige', two: 'burst', four: 'teamBuff' },
  TenacityOfTheMillelith: { label: 'Tenacity of the Millelith', two: 'hp', four: 'teamBuff' },
  VourukashasGlow: { label: "Vourukasha's Glow", two: 'hp', four: 'skillBurst' },
  MarechausseeHunter: { label: 'Marechaussee Hunter', two: 'normal', four: 'crit' },
  FinaleOfTheDeepGalleries: { label: 'Finale of the Deep Galleries', two: 'cryo', four: 'cryo' },
  DesertPavilionChronicle: { label: 'Desert Pavilion Chronicle', two: 'anemo', four: 'normal' },
  OceanHuedClam: { label: 'Ocean-Hued Clam', two: 'healing', four: 'healing' },
  ArchaicPetra: { label: 'Archaic Petra', two: 'geo', four: 'teamBuff' },
  CrimsonWitchOfFlames: { label: 'Crimson Witch of Flames', two: 'pyro', four: 'reaction' },
  FlowerOfParadiseLost: { label: 'Flower of Paradise Lost', two: 'em', four: 'reaction' },
  HuskOfOpulentDreams: { label: 'Husk of Opulent Dreams', two: 'def', four: 'def' },
  HeartOfDepth: { label: 'Heart of Depth', two: 'hydro', four: 'normal' },
  BlizzardStrayer: { label: 'Blizzard Strayer', two: 'cryo', four: 'crit' },
  ThunderingFury: { label: 'Thundering Fury', two: 'electro', four: 'reaction' },
  PaleFlame: { label: 'Pale Flame', two: 'physical', four: 'normal' },
  BloodstainedChivalry: { label: 'Bloodstained Chivalry', two: 'physical', four: 'normal' },
  RetracingBolide: { label: 'Retracing Bolide', two: 'shield', four: 'normal' },
  WanderersTroupe: { label: "Wanderer's Troupe", two: 'em', four: 'charged' },
  Thundersoother: { label: 'Thundersoother', two: 'electro', four: 'electro' },
  Lavawalker: { label: 'Lavawalker', two: 'pyro', four: 'pyro' },
};

function optimizerStatKey(raw) {
  const source = String(raw || '').trim().toLowerCase();
  const token = compactName(source);
  const percent = source.includes('%') || source.endsWith('_') || token.includes('percent');
  if (token.includes('critrate') || token === 'crit') return 'critRate';
  if (token.includes('critdmg') || token.includes('criticaldamage')) return 'critDmg';
  if (token.includes('enerrech') || token === 'energyrecharge' || token === 'er') return 'er';
  if (token.includes('elementalmastery') || token === 'elemas' || token === 'em') return 'em';
  for (const element of ['pyro', 'hydro', 'cryo', 'dendro', 'anemo', 'electro', 'geo']) {
    if (token.includes(element) && (token.includes('dmg') || token.includes('damage'))) return element + 'Dmg';
  }
  if (token.includes('physical') && (token.includes('dmg') || token.includes('damage'))) return 'physicalDmg';
  if (token.includes('healing')) return 'healing';
  if (token.includes('atk') || token === 'attack') return percent ? 'atkPercent' : 'atkFlat';
  if (token.includes('hp') || token === 'health') return percent ? 'hpPercent' : 'hpFlat';
  if (token.includes('def') || token === 'defense') return percent ? 'defPercent' : 'defFlat';
  return token || 'unknown';
}

function optimizerMainOptions(profile, slot) {
  const raw = profile?.stats?.[slot];
  if (!raw) return [];
  return String(raw).split(/\s+or\s+|\/|,|;/i).map(value => optimizerStatKey(value)).filter(value => value && value !== 'unknown');
}

function optimizerPreferredSets(profile) {
  const result = [];
  for (const artifact of profile?.artifacts || []) {
    const text = String(artifact?.name || '');
    if (/2[- ]?piece.*hp|hp%.*set/i.test(text)) {
      for (const key of ['TenacityOfTheMillelith', 'VourukashasGlow']) if (!result.includes(key)) result.push(key);
      continue;
    }
    const normalized = compactName(text);
    const key = Object.keys(ARTIFACT_SET_INFO).find(candidate =>
      compactName(candidate) === normalized || compactName(ARTIFACT_SET_INFO[candidate].label) === normalized
    );
    if (key && !result.includes(key)) result.push(key);
  }
  return result;
}

function optimizerContext(character, profile, teamCharacters = []) {
  const role = String(profile?.role || character?.role || '').toLowerCase();
  const profileText = [
    role,
    profile?.playstyle,
    profile?.teamFocus,
    ...(Object.values(profile?.stats || {})),
    ...(profile?.talentOrder || []),
  ].join(' ').toLowerCase();
  const support = /support|healer|shielder|buffer|battery/.test(role);
  const dps = /dps|carry|damage/.test(role);
  const wantsHp = /hp%|health/.test(profileText);
  const wantsDef = /def%|defense/.test(profileText);
  const wantsEr = /energy recharge|\ber\b/.test(profileText);
  const wantsEm = /elemental mastery|\bem\b|reaction|swirl|bloom|aggravate|hyperbloom|burgeon|vaporize|melt/.test(profileText);
  const team = Array.isArray(teamCharacters) ? teamCharacters.filter(Boolean) : [];
  const elements = new Set([character, ...team].filter(Boolean).map(item => String(item.element || '').toLowerCase()));
  const teamHasDendro = elements.has('dendro');
  const teamHasReactionPartner = ['hydro', 'pyro', 'electro'].some(element => elements.has(element));
  const reactionTeam = (teamHasDendro && teamHasReactionPartner) || elements.size >= 3;
  const weights = {
    critRate: dps ? 2.05 : 1.35,
    critDmg: dps ? 1.05 : 0.78,
    atkPercent: dps ? 1.0 : 0.55,
    hpPercent: wantsHp ? 1.05 : 0.38,
    defPercent: wantsDef ? 1.0 : 0.28,
    er: wantsEr || support ? 1.12 : 0.52,
    em: wantsEm ? 0.72 : 0.30,
    atkFlat: dps ? 0.12 : 0.07,
    hpFlat: wantsHp ? 0.012 : 0.004,
    defFlat: wantsDef ? 0.12 : 0.035,
  };
  if (support && team.length > 1) weights.er += 0.16;
  if (reactionTeam && wantsEm) weights.em += 0.14;
  return { character, profile, role, profileText, support, dps, wantsHp, wantsDef, wantsEr, wantsEm, team, elements, reactionTeam, weights };
}

function optimizerSetTagFit(tag, context) {
  const element = String(context.character?.element || '').toLowerCase();
  const profileText = context.profileText;
  switch (tag) {
    case 'atk': return context.dps || /atk%/.test(profileText) ? 7 : 3;
    case 'hp': return context.wantsHp ? 8 : 2;
    case 'def': return context.wantsDef ? 8 : 2;
    case 'energy': return context.wantsEr || context.support ? 8 : 3;
    case 'em': return context.wantsEm || context.reactionTeam ? 8 : 3;
    case 'anemo': return element === 'anemo' ? 9 : 1;
    case 'geo': return element === 'geo' ? 9 : 1;
    case 'cryo': return element === 'cryo' ? 9 : 1;
    case 'hydro': return element === 'hydro' ? 9 : 1;
    case 'pyro': return element === 'pyro' ? 9 : 1;
    case 'electro': return element === 'electro' ? 9 : 1;
    case 'dendro': return element === 'dendro' ? 9 : (context.reactionTeam ? 5 : 1);
    case 'physical': return /physical/.test(profileText) ? 9 : 1;
    case 'skill': return /skill/.test(profileText) || /sub dps|support/.test(context.role) ? 8 : 4;
    case 'offFieldSkill': return /off.field|sub dps|support/.test(profileText) ? 9 : 3;
    case 'burst': return /burst/.test(profileText) || context.support ? 8 : 4;
    case 'skillBurst': return /skill|burst/.test(profileText) || context.support ? 8 : 3;
    case 'dendroRes': return element === 'dendro' || context.reactionTeam ? 9 : 3;
    case 'reaction': return context.wantsEm || context.reactionTeam ? 9 : 3;
    case 'swirl': return element === 'anemo' ? 11 : 2;
    case 'teamBuff': return context.support || /support|team/.test(profileText) ? 9 : 4;
    case 'normal':
    case 'charged': return context.dps ? 8 : 4;
    case 'crit': return context.dps ? 9 : 5;
    case 'healing': return /heal|healing/.test(profileText) || context.support ? 8 : 2;
    case 'shield': return /shield/.test(profileText) || context.support ? 8 : 2;
    default: return 0;
  }
}

function optimizerSetScore(chosen, preferredSets, context) {
  const counts = {};
  for (const artifact of chosen) {
    if (artifact.setKey && artifact.setKey !== 'Unknown') counts[artifact.setKey] = (counts[artifact.setKey] || 0) + 1;
  }
  let score = 0;
  const breakdown = [];
  for (const [key, count] of Object.entries(counts)) {
    const info = ARTIFACT_SET_INFO[key];
    const preferredIndex = preferredSets.indexOf(key);
    const primaryPreferred = preferredIndex === 0;
    const secondaryPreferred = preferredIndex > 0;
    const pieces = [];
    let points = 0;
    if (count >= 2) {
      const fit = info ? optimizerSetTagFit(info.two, context) : (preferredIndex >= 0 ? 6 : 0);
      const preference = primaryPreferred ? 10 : secondaryPreferred ? 6 : 0;
      points += fit + preference;
      pieces.push('2-piece');
    }
    if (count >= 4) {
      const fit = info ? optimizerSetTagFit(info.four, context) : (preferredIndex >= 0 ? 10 : 0);
      const preference = primaryPreferred ? 18 : secondaryPreferred ? 13 : 0;
      points += fit + preference;
      pieces.push('4-piece');
    }
    if (points > 0) {
      score += points;
      breakdown.push({
        key,
        label: info?.label || key,
        count,
        pieces,
        preferred: preferredIndex >= 0,
        preferredRank: preferredIndex,
        points: round2(points),
        explanation: preferredIndex === 0 ? 'First recommended set for this build' : secondaryPreferred ? 'Alternative set listed in the build profile' : 'Set-effect fit estimated from role, stats and team context',
      });
    }
  }
  breakdown.sort((a,b) => b.points-a.points);
  return { score: round2(score), breakdown };
}

function optimizerPieceScore(artifact, slot, context) {
  const wanted = optimizerMainOptions(context.profile, slot);
  const main = optimizerStatKey(artifact.mainStatKey);
  let mainStatScore = 0;
  let mainStatMatches = false;
  if (slot === 'flower') {
    mainStatMatches = main === 'hpFlat';
    mainStatScore = mainStatMatches ? 0 : -14;
  } else if (slot === 'plume') {
    mainStatMatches = main === 'atkFlat';
    mainStatScore = mainStatMatches ? 0 : -14;
  } else if (wanted.length) {
    mainStatMatches = wanted.includes(main);
    mainStatScore = mainStatMatches ? 26 : -18;
  }

  const substatBreakdown = (artifact.substats || []).map(stat => {
    const key = optimizerStatKey(stat.key);
    const weight = context.weights[key] ?? 0.16;
    const points = numberOr(stat.value) * weight;
    return { key, label: String(stat.key), value: numberOr(stat.value), points: round2(points) };
  });
  const substatScore = substatBreakdown.reduce((sum, stat) => sum + stat.points, 0);
  const rarityScore = Number(artifact.rarity) >= 5 ? 2.5 : Number(artifact.rarity) === 4 ? 0 : Number(artifact.rarity) === 3 ? -5 : -10;
  const levelScore = Math.max(0, Math.min(20, numberOr(artifact.level))) * 0.12;
  const score = round2(mainStatScore + substatScore + rarityScore + levelScore);
  const topSubstats = [...substatBreakdown].sort((a,b)=>b.points-a.points).filter(stat=>stat.points>0).slice(0,3);
  const mainLabel = mainStatMatches && wanted.length ? 'Main stat matches this build’s listed options' :
    (wanted.length && !mainStatMatches ? 'Main stat is outside this build’s listed options' :
      slot === 'flower' || slot === 'plume' ? 'Fixed flower/plume main stat' : 'No curated main-stat profile; ranked by substats and sets');
  return {
    ...artifact,
    optimizerId: artifact.optimizerId || artifact.id,
    _optimizerScore: score,
    _mainStatScore: mainStatScore,
    _mainStatMatches: mainStatMatches,
    _mainStatLabel: mainLabel,
    _substatScore: round2(substatScore),
    _topSubstats: topSubstats,
    _rarityScore: rarityScore,
    _levelScore: round2(levelScore),
  };
}

/**
 * Finds high-fit five-piece combinations from an imported GOOD artifact inventory.
 * This is a transparent heuristic (main-stat fit + weighted substats + preferred-set synergy),
 * not a frame-by-frame damage simulator. It never equips items in game.
 */
export function optimizeArtifactLoadout({
  character,
  profile = null,
  artifacts = [],
  teamCharacters = [],
  allCharacters = [],
  topN = 3,
  candidatesPerSlot = 10,
} = {}) {
  if (!character?.id) return { error: 'Choose a character first.' };
  if (!Array.isArray(artifacts) || artifacts.length === 0) return { error: 'Import a GOOD inventory containing artifacts first.' };

  const context = optimizerContext(character, profile, teamCharacters);
  const preferredSets = optimizerPreferredSets(profile);
  const teamIds = new Set(context.team.map(item => item.id).filter(Boolean));
  const source = artifacts.map((artifact, index) => ({
    ...artifact,
    optimizerId: String(artifact.optimizerId || artifact.inventoryId || artifact.id || ('good-artifact-' + index)),
  }));
  const available = source.filter(artifact => !artifact.characterId || !teamIds.has(artifact.characterId) || artifact.characterId === character.id);
  const excludedForTeam = source.length - available.length;
  const slots = {};
  for (const slot of ARTIFACT_SLOTS) {
    const pieces = available.filter(artifact => String(artifact.slotKey || '').toLowerCase() === slot);
    if (!pieces.length) slots[slot] = [];
    else {
      const scored = pieces.map(artifact => optimizerPieceScore(artifact, slot, context));
      scored.sort((a,b) => {
        const preference = artifact => {
          const index = preferredSets.indexOf(artifact.setKey);
          return index === 0 ? 9 : index > 0 ? 5 : 0;
        };
        return (b._optimizerScore + preference(b)) - (a._optimizerScore + preference(a));
      });
      const shortlist = new Map(scored.slice(0, Math.max(1, candidatesPerSlot)).map(item => [item.optimizerId, item]));
      // Preserve set coverage so a slightly weaker piece can still complete a preferred 4-piece set.
      for (const key of preferredSets) {
        for (const item of scored.filter(piece => piece.setKey === key).slice(0, 2)) shortlist.set(item.optimizerId, item);
      }
      slots[slot] = [...shortlist.values()];
    }
  }
  const missingSlots = ARTIFACT_SLOTS.filter(slot => !slots[slot]?.length);
  if (missingSlots.length) {
    return {
      error: 'Your imported inventory is missing artifacts for: ' + missingSlots.join(', ') + '. Import a more complete GOOD file to compare full five-piece builds.',
      missingSlots,
      artifactCount: available.length,
      excludedForTeam,
    };
  }

  const combosAvailable = ARTIFACT_SLOTS.reduce((total, slot) => total * slots[slot].length, 1);
  const best = [];
  let examined = 0;
  const chosen = [];
  const desiredTopN = Math.max(1, Math.min(5, Math.floor(numberOr(topN, 3))));

  function visit(depth, pieceScore) {
    if (depth === ARTIFACT_SLOTS.length) {
      examined += 1;
      const setScore = optimizerSetScore(chosen, preferredSets, context);
      const score = round2(pieceScore + setScore.score);
      const signature = chosen.map(item => item.optimizerId).join('|');
      if (best.some(build => build.signature === signature)) return;
      if (best.length >= desiredTopN && score <= best[best.length - 1].score) return;
      const pieces = chosen.map((item, index) => {
        const slot = ARTIFACT_SLOTS[index];
        const setInfo = setScore.breakdown.find(row => row.key === item.setKey);
        const reasons = [item._mainStatLabel];
        if (item._topSubstats.length) reasons.push('Useful rolls: ' + item._topSubstats.map(stat => stat.label + ' ' + stat.value).join(', '));
        if (setInfo) reasons.push(setInfo.count + ' pieces of ' + setInfo.label + (setInfo.count >= 4 ? ' (4-piece bonus counted)' : ' (2-piece bonus counted)'));
        const equippedCharacter = item.characterId ? allCharacters.find(candidate => candidate.id === item.characterId) : null;
        if (item.location && item.characterId && item.characterId !== character.id) reasons.push('Currently assigned to ' + (equippedCharacter?.name || item.location) + '; reassigning is needed');
        if (item.lock) reasons.push('Locked in imported inventory; suggestion only, no lock state changed');
        return {
          ...item,
          slot,
          slotLabel: slot.charAt(0).toUpperCase() + slot.slice(1),
          score: item._optimizerScore,
          mainStatMatches: item._mainStatMatches,
          reasons,
          substatBreakdown: item._topSubstats,
        };
      });
      const build = {
        signature,
        characterId: character.id,
        characterName: character.name,
        teamName: context.team.length ? context.team.map(member => member.name).join(' · ') : '',
        score,
        pieceScore: round2(pieceScore),
        setBonusScore: setScore.score,
        setBreakdown: setScore.breakdown,
        pieces,
        preferredSets,
        candidateCount: artifacts.length,
        eligibleCount: available.length,
        excludedForTeam,
        combinationsSearched: combosAvailable,
        profileAvailable: Boolean(profile),
        scoringSummary: profile
          ? 'Uses the curated main-stat options and artifact-set preferences for this character, weighted substats, rarity and level, plus an estimated fit for the chosen team.'
          : 'No curated profile is available. Uses role/element-informed substat weights and known set-effect tags where possible; verify this result against a creator guide.',
        caution: 'Relative build-fit score only. It does not simulate exact damage, enemy resistance, weapon passives, rotations, buffs or every reaction multiplier.',
      };
      best.push(build);
      best.sort((a,b)=>b.score-a.score);
      if (best.length > desiredTopN) best.pop();
      return;
    }
    for (const artifact of slots[ARTIFACT_SLOTS[depth]]) {
      chosen[depth] = artifact;
      visit(depth + 1, pieceScore + artifact._optimizerScore);
    }
  }
  visit(0, 0);

  return {
    characterId: character.id,
    characterName: character.name,
    teamName: context.team.length ? context.team.map(member => member.name).join(' · ') : '',
    artifactCount: artifacts.length,
    eligibleCount: available.length,
    excludedForTeam,
    combinationsSearched: examined,
    candidateCountsBySlot: Object.fromEntries(ARTIFACT_SLOTS.map(slot => [slot, slots[slot].length])),
    profileAvailable: Boolean(profile),
    recommendations: best,
    preferredSets,
  };
}
