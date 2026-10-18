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
