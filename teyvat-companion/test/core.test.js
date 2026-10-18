import test from 'node:test';
import assert from 'node:assert/strict';
import { enkaTtlSeconds, isValidGenshinUid, mergeEnkaShowcaseCharacter } from '../src/core.js';
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
