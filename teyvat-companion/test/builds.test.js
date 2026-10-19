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
      assert.match(option.label, /not reviewed|not recommended|no separate sourced build/i);
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
    ['aggravate', 'hyperbloom-sub-dps', 'pure-healer']
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
  assert.equal(CHARACTER_BUILD_GUIDES.ifa.buildCategory, 'Sub DPS');
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

test('more characters expose additional role-specific recommendations', () => {
  const expected = {
    nahida: ['full-em-dendro-support'],
    collei: ['burst-sub-dps'],
    tighnari: ['on-field-charged-shot-carry'],
    'traveler-dendro': ['dendro-burst-sub-dps'],
    'traveler-electro': ['electro-burst-sub-dps'],
    'traveler-anemo': ['full-em-swirl-support'],
    ororon: ['scroll-team-buffer'],
    mavuika: ['off-field-pyro-sub-dps'],
    zhongli: ['burst-sub-dps'],
    kaeya: ['cryo-battery-support'],
  };
  for (const [key, ids] of Object.entries(expected)) {
    for (const id of ids) {
      const variant = CHARACTER_BUILD_GUIDES[key].alternateBuilds.find(build => build.id === id);
      assert.ok(variant, key + ': expected additional build ' + id);
      assertCompleteProfile(key + '/' + id, variant);
      assert.ok(variant.sourceName && variant.sourceNote, key + '/' + id + ': source metadata is required');
    }
  }
  assert.equal(CHARACTER_BUILD_GUIDES['traveler-anemo'].buildCategory, 'Sub DPS');
});

test('additional alternate-role profiles are complete and source-linked', () => {
  const expected = {
    raiden: ['off-field-electro-support'],
    furina: ['on-field-hydro-driver'],
    'kuki-shinobu': ['hyperbloom-sub-dps'],
    yanfei: ['c4-shield-support'],
    navia: ['quickswap-burst-sub-dps'],
    emilie: ['burning-team-support'],
  };
  for (const [key, ids] of Object.entries(expected)) {
    for (const id of ids) {
      const variant = CHARACTER_BUILD_GUIDES[key].alternateBuilds.find(build => build.id === id);
      assert.ok(variant, key + ': expected alternate build ' + id);
      assertCompleteProfile(key + '/' + id, variant);
      assert.ok(variant.sourceName && variant.sourceNote, key + '/' + id + ': source details are required');
      assert.ok(variant.sourceUrl.startsWith('https://genshin.gg/characters/'), key + '/' + id + ': use a character-specific source');
    }
  }
  assert.match(CHARACTER_BUILD_GUIDES.yanfei.alternateBuilds.find(b => b.id === 'c4-shield-support').sourceNote, /Constellation 4/);
  assert.equal(CHARACTER_BUILD_GUIDES['kuki-shinobu'].alternateBuilds.find(b => b.id === 'hyperbloom-sub-dps').buildCategory, 'Sub DPS');
});


test('remaining role coverage batch has complete source-noted variants', () => {
  const expected = {
    alhaitham: ['quickswap-dendro-sub-dps'],
    ayaka: ['burst-sub-dps'],
    ayato: ['burst-hydro-sub-dps'],
    childe: ['burst-nuke-sub-dps'],
    diluc: ['plunge-main-dps'],
    eula: ['burst-swap-sub-dps'],
    cyno: ['quickbloom-em-carry'],
    nilou: ['hydro-driver-bloom'],
    shenhe: ['cryo-burst-sub-dps'],
    beidou: ['electro-team-support'],
    heizou: ['on-field-swirl-driver'],
    razor: ['thundering-furry-reaction-carry'],
    rosaria: ['freeze-main-dps'],
    sara: ['burst-sub-dps'],
    sayu: ['on-field-swirl-driver'],
    baizhu: ['quickbloom-sub-dps'],
    kirara: ['burst-sub-dps'],
    wriothesley: ['melt-main-dps'],
    clorinde: ['quickbloom-main-dps'],
    sethos: ['charged-shot-aggravate'],
    xilonen: ['geo-burst-sub-dps'],
    citlali: ['cryo-burst-sub-dps'],
    'lan-yan': ['on-field-swirl-driver'],
    lauma: ['off-field-bloom-sub-dps'],
    columbina: ['hydro-support-buffer'],
    durin: ['burst-main-dps'],
    dori: ['electro-hyperbloom-support'],
    lynette: ['on-field-swirl-driver'],
    sigewinne: ['burst-sub-dps'],
    kachina: ['geo-team-support'],
    'traveler-hydro': ['hydro-burst-sub-dps'],
    'traveler-pyro': ['pyro-burst-sub-dps'],
    ineffa: ['on-field-electro-driver'],
    iansan: ['high-uptime-atk-support'],
    'yumemizuki-mizuki': ['full-em-swirl-support'],
    aloy: ['freeze-main-dps'],
    freminet: ['cryo-shatter-main-dps'],
    xingqiu: ['energy-buffer-support'],
    yoimiya: ['off-field-burst-sub-dps'],
    faruzan: ['burst-damage-sub-dps'],
    ifa: ['full-em-swirl-support'],
    linnea: ['lunar-crystallize-sub-dps'],
    charlotte: ['cryo-burst-sub-dps'],
    prune: ['full-em-swirl-driver'],
    odette: ['on-field-cryo-main-dps'],
    albedo: ['archaic-petra-team-support'],
    keqing: ['physical-main-dps'],
    dahlia: ['scroll-team-support'],
    jahoda: ['full-em-swirl-support'],
  };
  for (const [key, ids] of Object.entries(expected)) {
    assert.ok(CHARACTER_BUILD_GUIDES[key], key + ': profile missing');
    for (const id of ids) {
      const variant = (CHARACTER_BUILD_GUIDES[key].alternateBuilds || []).find(build => build.id === id);
      assert.ok(variant, key + ': expected alternate ' + id);
      assertCompleteProfile(key + '/' + id, variant);
      assert.ok(variant.sourceName && variant.sourceNote, key + '/' + id + ': source rationale required');
    }
  }
});
