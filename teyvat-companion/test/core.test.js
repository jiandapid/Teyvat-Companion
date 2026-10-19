import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTeamComposition, buildProgressionPlan, enkaTtlSeconds, flattenEnkaSavedBuilds, getCharacterUpgradeMaterialRequirements, isValidGenshinUid, matchGoodCharacterKey, mergeCharacterCatalogue, mergeEnkaShowcaseCharacter, MIN_PLAYABLE_CHARACTER_COUNT, normalizeAkashaArtifacts, normalizeAkashaProfiles, normalizeTrackerBackup, optimizeArtifactLoadout, parseEnkaPublicRoster, parseGoodInventory, validateCharacterCatalogue } from '../src/core.js';
import { CHARACTER_BUILD_GUIDES } from '../src/builds.js';
import { MATERIAL_STARTER, NAV_ITEMS, STARTER_CHARACTERS, STARTER_TEAMS } from '../src/data.js';

test('accepts normal 9- and 10-digit Genshin UIDs', () => {
  assert.equal(isValidGenshinUid('123456789'), true);
  assert.equal(isValidGenshinUid('1234567890'), true);
  assert.equal(isValidGenshinUid(' 123456789 '), true);
});

test('rejects malformed Genshin UIDs', () => {
  for (const uid of ['', '12345678', '12345678901', '12345abcd', '-123456789', '12 3456789']) {
    assert.equal(isValidGenshinUid(uid), false, String(uid));
  }
});

test('uses a positive integer Enka cache TTL and a safe fallback', () => {
  assert.equal(enkaTtlSeconds(180.2), 181);
  assert.equal(enkaTtlSeconds('45'), 45);
  assert.equal(enkaTtlSeconds(0), 60);
  assert.equal(enkaTtlSeconds(-5), 60);
  assert.equal(enkaTtlSeconds(undefined), 60);
});

test('caps the Enka retry delay so malformed TTL data cannot lock sync for too long', () => {
  assert.equal(enkaTtlSeconds(9999999), 86400);
});

test('imports the public Enka display list even when detailed showcase data is disabled', () => {
  const roster = parseEnkaPublicRoster({
    showAvatarInfoList: [
      { avatarId: 10000046, level: 90 },
      { avatarId: 10000025, level: 80, costumeId: 200001 },
    ],
  }, [], [
    { id: 'kazuha', name: 'Kaedehara Kazuha', apiId: '10000046' },
    { id: 'raiden', name: 'Raiden Shogun', apiId: '10000025' },
  ]);

  assert.equal(roster.length, 2);
  assert.deepEqual(roster.map(item => item.characterId), ['kazuha', 'raiden']);
  assert.deepEqual(roster.map(item => item.level), [90, 80]);
  assert.equal(roster[1].costumeId, 200001);
  assert.ok(roster.every(item => item.detailsAvailable === false));
});

test('detailed Enka records enrich public display-list entries without duplicating them', () => {
  const roster = parseEnkaPublicRoster(
    { showAvatarInfoList: [{ avatarId: '10000046', level: 80 }] },
    [{ avatarId: '10000046', propMap: { '4001': { val: '90' } }, equipList: [] }],
    [{ id: 'kazuha', name: 'Kaedehara Kazuha', apiId: '10000046' }],
  );

  assert.equal(roster.length, 1);
  assert.equal(roster[0].name, 'Kaedehara Kazuha');
  assert.equal(roster[0].level, 90);
  assert.equal(roster[0].detailsAvailable, true);
});

test('detailed Enka records still work if the basic public display list is absent', () => {
  const roster = parseEnkaPublicRoster(
    {},
    [{ avatarId: 10000046, propMap: { '4001': { ival: 90 } } }],
    [{ id: 'kazuha', name: 'Kaedehara Kazuha', apiId: '10000046' }],
  );
  assert.equal(roster.length, 1);
  assert.equal(roster[0].characterId, 'kazuha');
  assert.equal(roster[0].level, 90);
  assert.equal(roster[0].detailsAvailable, true);
});

test('flattens public Enka saved builds, maps characters, and orders build choices', () => {
  const builds = flattenEnkaSavedBuilds({
    '10000046': [
      { id: 3, name: 'Live Kazuha', order: 2, live: true, avatar_data: { genshin: { equipList: [] } } },
      { id: 1, name: 'EM Support', order: 0, live: false, public: true, settings: { mainStat: 'EM' } },
      { id: 9, name: 'Private draft', order: 1, live: false, public: false },
    ],
    '10000025': [{ id: 4, name: 'Raiden Burst', order: 0, live: false }],
  }, [
    { id: 'kazuha', name: 'Kaedehara Kazuha', apiId: '10000046' },
    { id: 'raiden', name: 'Raiden Shogun', apiId: '10000025' },
  ]);

  assert.equal(builds.length, 3, 'explicitly private builds are excluded');
  assert.deepEqual(builds.map(build => build.name), ['EM Support', 'Live Kazuha', 'Raiden Burst']);
  assert.equal(builds[0].characterId, 'kazuha');
  assert.equal(builds[0].characterName, 'Kaedehara Kazuha');
  assert.equal(builds[0].live, false);
  assert.equal(builds[1].live, true);
  assert.equal(builds[1].avatarData.genshin.equipList.length, 0);
  assert.equal(builds[0].settings.mainStat, 'EM');
});

test('ignores invalid Enka saved-build payloads and malformed items', () => {
  assert.deepEqual(flattenEnkaSavedBuilds(null), []);
  assert.deepEqual(flattenEnkaSavedBuilds([]), []);
  const builds = flattenEnkaSavedBuilds({
    '12345': [null, 'bad', [], { name: 'Unmatched' }],
  });
  assert.equal(builds.length, 1);
  assert.equal(builds[0].characterId, '');
  assert.equal(builds[0].characterName, 'Character ID 12345');
});

test('normalizes AKASHA public calculations, leaderboard ranks and character matches', () => {
  const profiles = normalizeAkashaProfiles([
    {
      _id: 'calc-record-1',
      uid: '123456789',
      characterId: 10000046,
      type: 'genshin',
      name: 'Kazuha',
      constellation: 0,
      md5: '0123456789abcdef0123456789abcdef',
      artifactSets: { ViridescentVenerer: { count: 4, icon: 'vv.png' } },
      calculations: {
        '1001': {
          calculationId: 1001, short: 'EM', name: 'Elemental Mastery Support',
          weapon: { name: 'Freedom-Sworn', rarity: 5, refinement: 1 },
          result: 154321, ranking: 450, outOf: 36000, stats: { elementalMastery: 950 },
          variant: { name: 'em', displayName: 'EM Support' },
        },
      },
    },
  ], '123456789', [
    { id: 'kazuha', apiId: '10000046', name: 'Kaedehara Kazuha' },
  ]);

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].characterId, 'kazuha');
  assert.equal(profiles[0].characterName, 'Kaedehara Kazuha');
  assert.equal(profiles[0].md5, '0123456789abcdef0123456789abcdef');
  assert.equal(profiles[0].artifactSets[0].name, 'ViridescentVenerer');
  assert.equal(profiles[0].calculations[0].weapon.name, 'Freedom-Sworn');
  assert.equal(profiles[0].calculations[0].ranking, 450);
  assert.equal(profiles[0].calculations[0].outOf, 36000);
  assert.ok(Math.abs(profiles[0].calculations[0].topPercent - 1.25) < 0.001);
  assert.equal(profiles[0].calculations[0].variant.displayName, 'EM Support');
});

test('normalizes AKASHA artifact pieces with slot, main stat, substats, level and crit value', () => {
  const artifacts = normalizeAkashaArtifacts([
    {
      id: 'artifact-1',
      name: 'Royal Flora',
      setName: 'Noblesse Oblige',
      stars: 5,
      mainStatKey: 'FIGHT_PROP_HP',
      mainStatValue: 4780,
      substats: {
        'Crit RATE': 0.101,
        'Crit DMG': 0.14,
        'Energy Recharge': 0.052,
        'ATK%': 0.058,
      },
      equipType: 'EQUIP_BRACER',
      level: 21,
      critValue: 34.2,
      icon: 'artifact.png',
    },
  ]);

  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].setName, 'Noblesse Oblige');
  assert.equal(artifacts[0].slot, 'Flower of Life');
  assert.equal(artifacts[0].level, 20);
  assert.equal(artifacts[0].rarity, 5);
  assert.equal(artifacts[0].mainStat.value, 4780);
  assert.equal(artifacts[0].substats.length, 4);
  assert.equal(artifacts[0].critValue, 34.2);
});

test('AKASHA normalizers safely handle missing, malformed and unmatched public data', () => {
  assert.deepEqual(normalizeAkashaProfiles(null, '123456789'), []);
  assert.deepEqual(normalizeAkashaArtifacts({ message: 'changed API' }), []);
  const profiles = normalizeAkashaProfiles([
    { characterId: 999999, name: 'Unknown entry', md5: 'hash', calculations: null },
  ], '123456789', []);
  assert.equal(profiles[0].characterId, '');
  assert.equal(profiles[0].characterName, 'Unknown entry');
  assert.deepEqual(profiles[0].calculations, []);
});

test('sync imports account equipment without overwriting the planned build', () => {
  const original = {
    id: 'xingqiu',
    owned: false,
    level: 70,
    constellation: 2,
    weaponName: 'Sacrificial Sword (planned)',
    artifact: 'Emblem of Severed Fate (planned)',
    mainStats: 'ER% / Hydro DMG / CRIT',
    notes: 'Target 80/90 next',
    enkaBuild: { weapon: 'Old weapon' },
  };
  const imported = {
    avatarId: 'xingqiu-api',
    level: 90,
    constellation: 4,
    talents: [1, 10, 12],
    weapon: 'Favonius Sword',
    weaponLevel: 90,
    artifactSummary: 'Noblesse Oblige',
    artifacts: [{ name: 'Royal Flora', level: 20 }],
    friendship: 10,
  };
  const synced = mergeEnkaShowcaseCharacter(original, imported, '2026-10-18T12:00:00.000Z');

  assert.equal(synced.owned, true);
  assert.equal(synced.level, 90);
  assert.equal(synced.constellation, 4);
  assert.equal(synced.weaponName, 'Sacrificial Sword (planned)');
  assert.equal(synced.artifact, 'Emblem of Severed Fate (planned)');
  assert.equal(synced.mainStats, 'ER% / Hydro DMG / CRIT');
  assert.equal(synced.notes, 'Target 80/90 next');
  assert.equal(synced.enkaBuild.weapon, 'Favonius Sword');
  assert.equal(synced.enkaBuild.artifacts[0].name, 'Royal Flora');
  assert.equal(synced.enkaBuild.syncedAt, '2026-10-18T12:00:00.000Z');
  assert.deepEqual(original.enkaBuild, { weapon: 'Old weapon' }, 'merge must not mutate the original object');
});

test('sync does not replace saved progress with missing level or constellation values', () => {
  const character = { id: 'mona', level: 70, constellation: 1, weaponName: 'Planned weapon' };
  const synced = mergeEnkaShowcaseCharacter(character, { weapon: 'Actual weapon' }, '2026-10-18T12:00:00.000Z');
  assert.equal(synced.level, 70);
  assert.equal(synced.constellation, 1);
  assert.equal(synced.weaponName, 'Planned weapon');
  assert.equal(synced.enkaBuild.weapon, 'Actual weapon');
});

test('main navigation uses unique ids and exposes the important pages without the removed map section', () => {
  const ids = NAV_ITEMS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const page of ['dashboard', 'characters', 'builds', 'teams', 'materials', 'account', 'guides', 'settings']) {
    assert.ok(ids.includes(page), 'missing nav page: ' + page);
  }
  assert.equal(ids.includes('map'), false, 'interactive map should remain removed by design');
});

test('starter teams only reference characters that exist in the starter catalogue', () => {
  const ids = new Set(STARTER_CHARACTERS.map(character => character.id));
  for (const team of STARTER_TEAMS) {
    for (const id of team.characters) assert.ok(ids.has(id), team.name + ' references missing character ' + id);
  }
});

test('starter material IDs and character IDs are unique', () => {
  assert.equal(new Set(STARTER_CHARACTERS.map(character => character.id)).size, STARTER_CHARACTERS.length);
  assert.equal(new Set(MATERIAL_STARTER.map(material => material.id)).size, MATERIAL_STARTER.length);
});

test('each curated build profile has the minimum structure needed by the UI', () => {
  assert.ok(Object.keys(CHARACTER_BUILD_GUIDES).length >= 10);
  for (const [id, guide] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    assert.ok(guide.role, id + ' is missing role');
    assert.ok(Array.isArray(guide.artifacts), id + ' is missing artifacts list');
    assert.ok(Array.isArray(guide.weapons), id + ' is missing weapons list');
    assert.ok(Array.isArray(guide.talentOrder), id + ' is missing talent order');
    assert.ok(guide.stats && guide.stats.sands && guide.stats.goblet && guide.stats.circlet, id + ' is missing main stats');
  }
});

test('catalogue refresh keeps stable IDs and removes alias duplicates', () => {
  const previous = [
    { id: 'kazuha', name: 'Kaedehara Kazuha', owned: true, level: 90, weaponName: 'Favonius Sword', notes: 'Build him next', rarity: 5 },
    { id: 'kaedehara-kazuha', name: 'Kaedehara Kazuha', owned: true, level: 70, artifact: 'Viridescent Venerer', rarity: 5 },
  ];
  const fresh = [
    { id: 'kaedehara-kazuha', name: 'Kaedehara Kazuha', apiId: '10000047', element: 'Anemo', weapon: 'Sword', rarity: 5, image: 'fresh-art.png', source: 'test source' },
  ];
  const merged = mergeCharacterCatalogue(previous, fresh);
  assert.equal(merged.length, 1, 'alias slugs must not create duplicate character cards');
  assert.equal(merged[0].id, 'kazuha', 'keep the starter ID used by saved teams and goals');
  assert.equal(merged[0].level, 90);
  assert.equal(merged[0].owned, true);
  assert.equal(merged[0].weaponName, 'Favonius Sword');
  assert.equal(merged[0].notes, 'Build him next');
  assert.equal(merged[0].image, 'fresh-art.png');
  assert.equal(merged[0].apiId, '10000047');
});

test('catalogue merge keeps different Traveler element rows separate', () => {
  const previous = [
    { id: 'traveler-anemo', name: 'Traveler (Anemo)', element: 'Anemo', owned: true },
    { id: 'traveler-geo', name: 'Traveler (Geo)', element: 'Geo', owned: false },
  ];
  const merged = mergeCharacterCatalogue(previous, [
    { id: 'traveler-anemo', name: 'Traveler (Anemo)', element: 'Anemo', owned: true },
    { id: 'traveler-geo', name: 'Traveler (Geo)', element: 'Geo', owned: false },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(c => c.id), ['traveler-anemo', 'traveler-geo']);
});

test('imports GOOD v3 character, weapon and artifact inventory', () => {
  const good = parseGoodInventory({
    format: 'GOOD',
    version: 3,
    source: 'Teyvat Companion test',
    characters: [{ key: 'Xingqiu', level: 80, ascension: 5, constellation: 4, talent: { auto: 1, skill: 8, burst: 9 } }],
    weapons: [{ key: 'SacrificialSword', level: 90, ascension: 6, refinement: 3, location: 'Xingqiu', lock: true }],
    artifacts: [{
      setKey: 'EmblemOfSeveredFate', slotKey: 'plume', level: 20, rarity: 5, mainStatKey: 'atk',
      location: 'Xingqiu', lock: true,
      substats: [{ key: 'critRate_', value: 10.1 }, { key: 'critDMG_', value: 14.0 }, { key: 'atk_', value: 5.8 }],
    }],
  }, '2026-10-18T12:00:00.000Z');
  assert.equal(good.format, 'GOOD');
  assert.equal(good.version, 3);
  assert.equal(good.characters.length, 1);
  assert.equal(good.weapons.length, 1);
  assert.equal(good.artifacts.length, 1);
  assert.equal(good.artifacts[0].critValue, 34.2);
  assert.equal(good.summary.lockedArtifacts, 1);
  assert.equal(good.importedAt, '2026-10-18T12:00:00.000Z');
});

test('rejects malformed or unsupported GOOD imports instead of replacing data', () => {
  assert.throws(() => parseGoodInventory('{broken'), /valid JSON/);
  assert.throws(() => parseGoodInventory({ format: 'not GOOD', version: 3 }), /not a GOOD file/);
  assert.throws(() => parseGoodInventory({ format: 'GOOD', version: 9, artifacts: [{}] }), /Unsupported GOOD version/);
  assert.throws(() => parseGoodInventory({ format: 'GOOD', version: 3 }), /contains no/);
});

test('maps GOOD character keys to roster entries without confusing Traveler elements', () => {
  const roster = [
    { id: 'raiden', name: 'Raiden Shogun' },
    { id: 'traveler-anemo', name: 'Traveler (Anemo)', element: 'Anemo' },
    { id: 'traveler-geo', name: 'Traveler (Geo)', element: 'Geo' },
  ];
  assert.equal(matchGoodCharacterKey('RaidenShogun', roster).id, 'raiden');
  assert.equal(matchGoodCharacterKey('TravelerAnemo', roster).id, 'traveler-anemo');
  assert.equal(matchGoodCharacterKey('TravelerGeo', roster).id, 'traveler-geo');
});

test('progression plan puts user-set goals and known material shortages ahead of generic tips', () => {
  const plan = buildProgressionPlan({
    characters: [{ id: 'xingqiu', name: 'Xingqiu', owned: true, level: 70 }],
    goals: [{ id: 'g1', character: 'xingqiu', title: 'Raise Burst', target: 'Talent level 9', done: false }],
    materials: [{ id: 'books', name: 'Talent books', required: 10, owned: 4 }],
    goodInventory: { artifacts: [{ rarity: 5, critValue: 38.2 }] },
  });
  assert.equal(plan[0].kind, 'goal');
  assert.equal(plan[1].kind, 'material');
  assert.equal(plan[1].missing, 6);
  assert.equal(plan[2].kind, 'artifacts');
});

const xingqiuBuildProfile = {
  role: 'Off-field Hydro / Sub DPS',
  artifacts: [{ name: 'Emblem of Severed Fate', note: 'Recommended set for Burst damage and Energy Recharge.' }],
  stats: { sands: 'ER% or ATK%', goblet: 'Hydro DMG Bonus', circlet: 'CRIT Rate / CRIT DMG' },
  substats: ['Enough ER to Burst every rotation', 'CRIT Rate / CRIT DMG', 'ATK%'],
  talentOrder: ['Elemental Burst', 'Elemental Skill', 'Normal Attack'],
  playstyle: 'Burst uptime is central to his off-field role.',
};

function makeTestArtifact(slotKey, setKey, mainStatKey, suffix, overrides = {}) {
  return {
    optimizerId: slotKey + '-' + setKey + '-' + suffix,
    setKey,
    slotKey,
    level: 20,
    rarity: 5,
    mainStatKey,
    location: '',
    characterId: '',
    lock: false,
    substats: [
      { key: 'critRate_', value: 7.0 },
      { key: 'critDMG_', value: 14.0 },
      { key: 'enerRech_', value: 5.2 },
      { key: 'atk_', value: 5.8 },
    ],
    ...overrides,
  };
}

test('artifact optimizer returns a five-slot loadout and evaluates preferred 4-piece bonuses', () => {
  const slots = [
    ['flower', 'hp', 'flower'],
    ['plume', 'atk', 'plume'],
    ['sands', 'enerRech_', 'sands'],
    ['goblet', 'hydro_dmg_', 'goblet'],
    ['circlet', 'critRate_', 'circlet'],
  ];
  const inventory = [];
  for (const [slot, stat, suffix] of slots) {
    inventory.push(makeTestArtifact(slot, 'EmblemOfSeveredFate', stat, 'preferred-' + suffix));
    inventory.push(makeTestArtifact(slot, 'GladiatorsFinale', stat, 'alternative-' + suffix, {
      substats: [
        { key: 'critRate_', value: 3.1 },
        { key: 'critDMG_', value: 7.0 },
        { key: 'def_', value: 7.3 },
        { key: 'hp_', value: 5.8 },
      ],
    }));
  }
  const result = optimizeArtifactLoadout({
    character: { id: 'xingqiu', name: 'Xingqiu', element: 'Hydro', role: 'Sub DPS' },
    profile: xingqiuBuildProfile,
    artifacts: inventory,
  });
  assert.ok(result.recommendations.length > 0);
  const best = result.recommendations[0];
  assert.equal(best.pieces.length, 5);
  assert.deepEqual(best.pieces.map(piece => piece.slot), ['flower','plume','sands','goblet','circlet']);
  assert.ok(best.setBreakdown.some(set => set.key === 'EmblemOfSeveredFate' && set.count >= 4 && set.preferred));
  assert.ok(best.setBonusScore > 0);
  assert.ok(best.pieces.every(piece => piece.reasons.length > 0));
  assert.ok(result.combinationsSearched > 0);
});

test('artifact optimizer strongly prefers valid main stats when the build profile is available', () => {
  const slots = [
    ['flower', 'hp', 'flower'],
    ['plume', 'atk', 'plume'],
    ['sands', 'enerRech_', 'sands'],
    ['goblet', 'hydro_dmg_', 'goblet'],
    ['circlet', 'critRate_', 'circlet'],
  ];
  const inventory = [];
  for (const [slot, preferredStat, suffix] of slots) {
    inventory.push(makeTestArtifact(slot, 'EmblemOfSeveredFate', preferredStat, 'correct-' + suffix));
    if (!['flower','plume'].includes(slot)) {
      inventory.push(makeTestArtifact(slot, 'EmblemOfSeveredFate', 'def_', 'wrong-' + suffix, {
        substats: [
          { key: 'critRate_', value: 19.4 },
          { key: 'critDMG_', value: 27.2 },
          { key: 'atk_', value: 5.8 },
          { key: 'enerRech_', value: 5.2 },
        ],
      }));
    }
  }
  const result = optimizeArtifactLoadout({
    character: { id: 'xingqiu', name: 'Xingqiu', element: 'Hydro', role: 'Sub DPS' },
    profile: xingqiuBuildProfile,
    artifacts: inventory,
    topN: 1,
  });
  assert.deepEqual(result.recommendations[0].pieces.filter(piece => ['sands','goblet','circlet'].includes(piece.slot)).map(piece => piece.mainStatMatches), [true,true,true]);
});

test('optimizer avoids using a teammate current gear when a team is selected', () => {
  const artifacts = [
    makeTestArtifact('flower','EmblemOfSeveredFate','hp','team-gear',{characterId:'bennett',location:'Bennett'}),
    ...[
      ['flower','hp','f'],['plume','atk','p'],['sands','atk_','s'],['goblet','hydro_dmg_','g'],['circlet','critRate_','c'],
    ].map(([slot,stat,suffix])=>makeTestArtifact(slot,'EmblemOfSeveredFate',stat,'free-'+suffix)),
  ];
  const result = optimizeArtifactLoadout({
    character:{id:'xingqiu',name:'Xingqiu',element:'Hydro',role:'Sub DPS'},
    profile:xingqiuBuildProfile,
    artifacts,
    teamCharacters:[{id:'bennett',name:'Bennett',element:'Pyro'},{id:'xingqiu',name:'Xingqiu',element:'Hydro'}],
    allCharacters:[{id:'bennett',name:'Bennett'}],
    topN:1,
  });
  assert.equal(result.excludedForTeam,1);
  assert.ok(result.recommendations[0].pieces.every(piece=>piece.characterId !== 'bennett'));
});

test('optimizer returns an actionable error when a slot is missing', () => {
  const result = optimizeArtifactLoadout({
    character:{id:'xingqiu',name:'Xingqiu',element:'Hydro'},
    profile:xingqiuBuildProfile,
    artifacts:[makeTestArtifact('flower','EmblemOfSeveredFate','hp','only-flower')],
  });
  assert.match(result.error,/missing artifacts for/);
  assert.ok(result.missingSlots.includes('circlet'));
});


test('normalizes a valid tracker backup and deduplicates character IDs', () => {
  const backup = normalizeTrackerBackup({
    format: 'teyvat-companion-backup-v1',
    characters: [
      { id: 'skirk', name: 'Skirk' },
      null,
      { id: 'mona', name: 'Mona' },
      { id: 'skirk', name: 'Skirk Updated' },
    ],
    account: { uid: '123456789' },
    materials: [],
    teams: [],
    goals: [],
    tasks: [],
    mapMarkers: [],
  });

  assert.deepEqual(backup.characters.map(character => character.id), ['skirk', 'mona']);
  assert.equal(backup.characters[0].name, 'Skirk Updated');
  assert.equal(backup.account.uid, '123456789');
});

test('normalizes legacy character maps and includes extra-character records', () => {
  const backup = normalizeTrackerBackup({
    characters: { skirk: { name: 'Skirk' } },
    extraCharacters: [{ id: 'custom-character', name: 'Custom Character' }],
  });

  assert.deepEqual(backup.characters.map(character => character.id), ['skirk', 'custom-character']);
});

test('rejects invalid backup shapes and malformed tracker sections', () => {
  assert.throws(() => normalizeTrackerBackup(null), /JSON object/);
  assert.throws(() => normalizeTrackerBackup({ account: { uid: '123456789' } }), /character data/);
  assert.throws(() => normalizeTrackerBackup({ format: 'future-format', characters: [{ id: 'skirk' }] }), /format is not supported/);
  assert.throws(() => normalizeTrackerBackup({ characters: [{ id: 'skirk' }], materials: {} }), /invalid "materials"/);
  assert.throws(() => normalizeTrackerBackup({ characters: [null, {}] }), /no valid character records/);
});


test('catalogue validation deduplicates IDs and rejects partial or malformed refreshes', () => {
  const rows = [
    { id: 'skirk', name: 'Skirk', rarity: 5 },
    { id: 'mona', name: 'Mona', rarity: 5 },
    { id: 'skirk', name: 'Skirk Revised', rarity: 5 },
    null,
    { name: 'Missing ID' },
    { id: 'empty-name', name: ' ' },
  ];
  const normalized = validateCharacterCatalogue(rows, 2);
  assert.equal(normalized.length, 2);
  assert.equal(normalized.find(row => row.id === 'skirk').name, 'Skirk Revised');
  assert.throws(() => validateCharacterCatalogue(rows, 3), /only 2 unique character records/);
  assert.throws(() => validateCharacterCatalogue({ items: rows }, 2), /invalid catalogue/);
  assert.equal(MIN_PLAYABLE_CHARACTER_COUNT, 120);
});

test('full upgrade material planning aggregates ascension and talent counts by material ID', () => {
  const requirements = getCharacterUpgradeMaterialRequirements({
    id: 'sample',
    name: 'Sample Character',
    gameData: {
      upgrade: {
        promotes: [
          { promoteLevel: 1, costItems: [{ id: 'mora', count: 100 }, { id: 'shared-drop', count: 2 }] },
          { promoteLevel: 2, costItems: [{ id: 'mora', count: 200 }, { id: 'boss-drop', count: 1 }, { id: 'shared-drop', count: 3 }] },
        ],
      },
      talents: [
        { name: 'Normal Attack', upgrades: [{ level: 2, costItems: [{ id: 'mora', count: 10 }, { id: 'talent-book', count: 2 }, { id: 'shared-drop', count: 4 }] }] },
        { name: 'Elemental Skill', upgrades: [{ level: 2, costItems: [{ id: 'mora', count: 10 }, { id: 'talent-book', count: 2 }] }] },
      ],
    },
  }, {
    mora: { name: 'Mora' },
    'shared-drop': { name: 'Shared enemy drop' },
    'boss-drop': { name: 'Boss material' },
    'talent-book': { name: 'Talent book' },
  });

  const mora = requirements.find(row => row.id === 'mora');
  const shared = requirements.find(row => row.id === 'shared-drop');
  const books = requirements.find(row => row.id === 'talent-book');
  assert.equal(mora.required, 320);
  assert.equal(shared.required, 9);
  assert.deepEqual(shared.categories, ['Character ascension', 'Talent']);
  assert.equal(shared.resolved, true);
  assert.equal(books.required, 4);
  assert.equal(requirements.find(row => row.id === 'boss-drop').required, 1);
});

test('upgrade material planning safely returns no invented costs for missing game data', () => {
  assert.deepEqual(getCharacterUpgradeMaterialRequirements({ id: 'skirk' }, {}), []);
  const unresolved = getCharacterUpgradeMaterialRequirements({
    gameData: { upgrade: { promotes: [{ costItems: [{ id: 'unknown-id', count: 3 }] }], }, talents: [] },
  }, {});
  assert.equal(unresolved[0].name, 'Material ID unknown-id');
  assert.equal(unresolved[0].resolved, false);
  assert.equal(unresolved[0].required, 3);
});


test('team composition analysis surfaces possible reactions and defensive-role gaps', () => {
  const result = analyzeTeamComposition([
    { id: 'hu-tao', name: 'Hu Tao', element: 'Pyro', role: 'Main DPS', owned: true },
    { id: 'xingqiu', name: 'Xingqiu', element: 'Hydro', role: 'Sub DPS', owned: true },
    { id: 'kazuha', name: 'Kaedehara Kazuha', element: 'Anemo', role: 'Support', owned: false },
    { id: 'layla', name: 'Layla', element: 'Cryo', role: 'Shielder', owned: true },
  ]);

  assert.equal(result.memberCount, 4);
  assert.equal(result.ownedCount, 3);
  assert.ok(result.reactions.includes('Vaporize'));
  assert.ok(result.reactions.includes('Swirl'));
  assert.ok(result.checks.some(check => check.title.startsWith('Potential reactions:')));
  assert.ok(!result.checks.some(check => check.title === 'Survivability not identified'));
});

test('team composition analysis handles incomplete teams and duplicate slots safely', () => {
  const result = analyzeTeamComposition([
    { id: 'mona', name: 'Mona', element: 'Hydro', role: 'Support' },
    { id: 'mona', name: 'Mona', element: 'Hydro', role: 'Support' },
  ]);

  assert.equal(result.memberCount, 2);
  assert.equal(result.uniqueMemberCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.ok(result.checks.some(check => check.level === 'warning' && check.title === 'Duplicate character slots'));
  assert.ok(result.checks.some(check => check.title.startsWith('Party has')));
  assert.ok(result.checks.some(check => check.title === 'Survivability not identified'));
});

test('team composition analysis never treats possible reactions as exact rotation advice', () => {
  const result = analyzeTeamComposition([
    { id: 'nahida', name: 'Nahida', element: 'Dendro', role: 'Support' },
    { id: 'xingqiu', name: 'Xingqiu', element: 'Hydro', role: 'Sub DPS' },
    { id: 'raiden', name: 'Raiden Shogun', element: 'Electro', role: 'Sub DPS' },
    { id: 'thoma', name: 'Thoma', element: 'Pyro', role: 'Shielder' },
  ]);
  const reactionCheck = result.checks.find(check => check.title.startsWith('Potential reactions:'));
  assert.ok(result.reactions.includes('Hyperbloom'));
  assert.ok(result.reactions.includes('Burgeon'));
  assert.match(reactionCheck.detail, /application, timing, ICDs/);
});
