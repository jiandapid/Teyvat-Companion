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
