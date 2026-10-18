import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgressionPlan, enkaTtlSeconds, isValidGenshinUid, matchGoodCharacterKey, mergeCharacterCatalogue, mergeEnkaShowcaseCharacter, parseGoodInventory } from '../src/core.js';
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

test('main navigation uses unique ids and exposes the important app pages', () => {
  const ids = NAV_ITEMS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const page of ['dashboard', 'characters', 'builds', 'teams', 'materials', 'map', 'account', 'guides', 'settings']) {
    assert.ok(ids.includes(page), 'missing nav page: ' + page);
  }
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
