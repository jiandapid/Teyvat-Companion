import test from 'node:test';
import assert from 'node:assert/strict';
import { enkaTtlSeconds, isValidGenshinUid, mergeEnkaShowcaseCharacter } from '../src/core.js';

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
