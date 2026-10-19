import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_ROLE_CATEGORIES, CHARACTER_BUILD_ALIASES, CHARACTER_BUILD_GUIDES, getCharacterBuildRoleOptions } from '../src/builds.js';

const validCategories = new Set(BUILD_ROLE_CATEGORIES);

function assertCompleteProfile(key, profile) {
  assert.ok(profile.role, key + ': role is required');
  assert.ok(validCategories.has(profile.buildCategory), key + ': buildCategory must be Main DPS, Sub DPS, or Support');
  assert.ok(Array.isArray(profile.artifacts) && profile.artifacts.length > 0, key + ': artifact options are required');
  assert.ok(profile.stats?.sands && profile.stats?.goblet && profile.stats?.circlet, key + ': all three main-stat slots are required');
  assert.ok(Array.isArray(profile.substats) && profile.substats.length > 0, key + ': substat priority is required');
  assert.ok(Array.isArray(profile.weapons) && profile.weapons.length > 0, key + ': weapon options are required');
  assert.ok(Array.isArray(profile.talentOrder) && profile.talentOrder.length > 0, key + ': talent priority is required');
  assert.ok(/^https:\/\//.test(profile.sourceUrl), key + ': source URL is required');
}

test('every character has a complete primary build profile', () => {
  const entries = Object.entries(CHARACTER_BUILD_GUIDES);
  assert.ok(entries.length >= 123, 'expected the complete current character build catalogue');
  for (const [key, profile] of entries) {
    assertCompleteProfile(key, profile);
    assert.ok(!profile.sourceUrl.endsWith('/builds/'), key + ': use a character-specific source URL');
  }
});

test('every character build page has all three role categories represented', () => {
  for (const [characterKey, profile] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    const options = getCharacterBuildRoleOptions(profile);
    for (const role of BUILD_ROLE_CATEGORIES) {
      assert.ok(options.some(option => option.buildCategory === role), characterKey + ': missing role category ' + role);
    }
    const available = options.filter(option => option.status === 'available');
    const unreviewed = options.filter(option => option.status === 'unreviewed');
    assert.ok(available.length >= 1, characterKey + ': expected a primary build');
    for (const option of available) assert.ok(option.profile, characterKey + ': available role must have actual profile data');
    for (const option of unreviewed) {
      assert.equal(option.profile, null, characterKey + ': unreviewed role must not recycle a different role profile');
      assert.match(option.label, /not reviewed|not recommended/i);
    }
  }
});

test('even a missing profile displays the three explicit role gaps instead of an invented build', () => {
  const options = getCharacterBuildRoleOptions(null);
  assert.deepEqual(options.map(option => option.buildCategory).sort(), [...BUILD_ROLE_CATEGORIES].sort());
  assert.ok(options.every(option => option.status === 'unreviewed' && option.profile === null));
});

test('alternate builds have distinct IDs, full build data, and a direct source note', () => {
  let totalAlternates = 0;
  for (const [characterKey, profile] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    const variants = profile.alternateBuilds || [];
    const ids = new Set();
    for (const variant of variants) {
      totalAlternates += 1;
      assert.ok(variant.id && !ids.has(variant.id), characterKey + ': alternate build IDs must be unique');
      ids.add(variant.id);
      assertCompleteProfile(characterKey + '/' + variant.id, variant);
      assert.ok(variant.sourceName, characterKey + '/' + variant.id + ': label the cited source');
      assert.ok(variant.sourceNote, characterKey + '/' + variant.id + ': explain evidence age/scope');
      assert.ok(!variant.sourceUrl.endsWith('/builds/'), characterKey + '/' + variant.id + ': alternate needs a character/video-specific source');
    }
  }
  assert.ok(totalAlternates >= 4, 'expected at least four researched alternate role/playstyle profiles');
});

test('the build selector catalogue has the intended evidence-backed variants', () => {
  assert.deepEqual(
    CHARACTER_BUILD_GUIDES['kuki-shinobu'].alternateBuilds.map(build => build.id).sort(),
    ['aggravate', 'pure-healer']
  );
  assert.ok(CHARACTER_BUILD_GUIDES.nahida.alternateBuilds.some(build => build.id === 'on-field-driver'));
  assert.ok(CHARACTER_BUILD_GUIDES.kazuha.alternateBuilds.some(build => build.id === 'quickswap-dps'));
});

test('recent roster additions have current source-backed primary build profiles', () => {
  for (const key of ['ineffa', 'iansan', 'yumemizuki-mizuki']) {
    assertCompleteProfile(key, CHARACTER_BUILD_GUIDES[key]);
  }
  assert.equal(CHARACTER_BUILD_GUIDES.ineffa.buildCategory, 'Sub DPS');
  assert.equal(CHARACTER_BUILD_GUIDES.iansan.buildCategory, 'Support');
  assert.equal(CHARACTER_BUILD_GUIDES['yumemizuki-mizuki'].buildCategory, 'Main DPS');
  assert.equal(CHARACTER_BUILD_ALIASES.mizuki, 'yumemizuki-mizuki');
});

test('current Genshin.gg role labels are reflected for recently corrected profiles', () => {
  assert.equal(CHARACTER_BUILD_GUIDES.raiden.buildCategory, 'Sub DPS');
  assert.equal(CHARACTER_BUILD_GUIDES['escoffier'].buildCategory, 'Sub DPS');
  assert.equal(CHARACTER_BUILD_GUIDES.tighnari.buildCategory, 'Sub DPS');
  assert.equal(CHARACTER_BUILD_GUIDES.heizou.buildCategory, 'Sub DPS');
  assert.equal(CHARACTER_BUILD_GUIDES.lisa.buildCategory, 'Support');
  assert.equal(CHARACTER_BUILD_GUIDES.dehya.buildCategory, 'Support');
  assert.equal(CHARACTER_BUILD_GUIDES.ifa.buildCategory, 'Main DPS');
  assert.ok(CHARACTER_BUILD_GUIDES.raiden.alternateBuilds.some(build => build.id === 'on-field-burst-carry'));
});

test('Kaeya is included and alternate sources remain direct and role-specific', () => {
  assertCompleteProfile('kaeya', CHARACTER_BUILD_GUIDES.kaeya);
  assert.ok(CHARACTER_BUILD_GUIDES.kaeya.alternateBuilds.some(build => build.id === 'freeze-main-dps'));
  for (const [key, ids] of Object.entries({
    escoffier: ['freeze-support-buffer'],
    dehya: ['main-dps-burst-carry', 'burgeon-sub-dps'],
    thoma: ['burgeon-sub-dps'],
    venti: ['full-em-support'],
    'yae-miko': ['on-field-aggravate'],
    sucrose: ['on-field-reaction-driver'],
    barbara: ['on-field-hydro-driver'],
  })) {
    for (const id of ids) {
      const variant = CHARACTER_BUILD_GUIDES[key].alternateBuilds.find(build => build.id === id);
      assert.ok(variant, key + ': expected researched alternate ' + id);
      assert.ok(variant.sourceName && variant.sourceNote, key + '/' + id + ': source and caveat are required');
      assertCompleteProfile(key + '/' + id, variant);
    }
  }
});
