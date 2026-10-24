import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_ROLE_CATEGORIES, CHARACTER_BUILD_ALIASES, CHARACTER_BUILD_GUIDES, CHARACTER_ROLE_BUILDS, getCharacterBuildRoleOptions, getGame8SearchUrl } from '../src/builds.js';

const validCategories = new Set(BUILD_ROLE_CATEGORIES);
const OCT_23_REVIEWED_PRIMARY_BUILDS = new Set(['fischl', 'xiangling', 'yelan', 'zhongli', 'neuvillette', 'sucrose', 'layla', 'wanderer', 'kazuha', 'raiden', 'furina', 'escoffier', 'mona', 'bennett', 'nahida', 'xingqiu']);
const expectedReviewDate = key => OCT_23_REVIEWED_PRIMARY_BUILDS.has(key) ? '2026-10-23' : '2026-10-22';
const expectedReviewLabel = key => OCT_23_REVIEWED_PRIMARY_BUILDS.has(key) ? '23 Oct 2026' : '22 Oct 2026';

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

test('every character has exactly three selectable role sections with complete build data', () => {
  for (const [characterKey, profile] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    const options = getCharacterBuildRoleOptions(profile);
    assert.equal(options.length, 3, characterKey + ': exactly three role sections must be shown');
    assert.deepEqual(options.map(option => option.buildCategory), BUILD_ROLE_CATEGORIES, characterKey + ': role sections must be Main DPS, Sub DPS, Support');
    for (const option of options) {
      assert.ok(option.id && option.profile, characterKey + ': every role must have a selectable build profile');
      assert.ok(['curated', 'provisional', 'needs-review', 'creator-reference', 'reference-only', 'adapted'].includes(option.status), characterKey + ': role needs an honest evidence status');
      assert.equal(option.profile.buildCategory, option.buildCategory, characterKey + ': selected profile must match its role');
      assertCompleteProfile(characterKey + '/' + option.buildCategory, option.profile);
      assert.ok(Array.isArray(option.playstyles) && option.playstyles.length > 0, characterKey + ': each role must expose at least one playstyle');
      assert.ok(option.playstyles.every(style => style.profile?.buildCategory === option.buildCategory), characterKey + ': playstyles must stay within the selected role');
      if (option.status === 'adapted') {
        assert.match(option.profile.sourceNote, /role sections|starting template/i);
        assert.match(option.profile.playstyle, /experimental|role-adapted/i);
      }
    }
  }
});

test('the static character-role registry stores three separate complete build records for every character', () => {
  const characterKeys = Object.keys(CHARACTER_BUILD_GUIDES);
  assert.ok(characterKeys.length >= 123, 'expected the current full playable roster');
  assert.deepEqual(Object.keys(CHARACTER_ROLE_BUILDS).sort(), [...characterKeys].sort());

  for (const characterKey of characterKeys) {
    const base = CHARACTER_BUILD_GUIDES[characterKey];
    const roles = CHARACTER_ROLE_BUILDS[characterKey];
    assert.equal(roles.length, 3, characterKey + ': registry must store exactly three role builds');
    assert.deepEqual(roles.map(option => option.buildCategory), BUILD_ROLE_CATEGORIES);
    assert.deepEqual(Object.keys(base.roleBuilds), BUILD_ROLE_CATEGORIES, characterKey + ': role builds must be directly available on the character profile');

    const profileReferences = new Set();
    const roleIds = new Set();
    for (const option of roles) {
      assert.ok(base.roleBuilds[option.buildCategory], characterKey + ': missing stored ' + option.buildCategory + ' profile');
      assert.equal(base.roleBuilds[option.buildCategory], option, characterKey + ': direct and indexed role profile must agree');
      assert.equal(option.profile.buildCategory, option.buildCategory);
      assert.equal(option.profile.characterKey, characterKey);
      assert.ok(option.profile.roleBuildId.startsWith(characterKey + ':'), characterKey + ': build IDs must be character-specific');
      assert.ok(!roleIds.has(option.profile.roleBuildId), characterKey + ': role profile IDs must not collide');
      roleIds.add(option.profile.roleBuildId);
      assert.ok(!profileReferences.has(option.profile), characterKey + ': each role needs its own profile object');
      profileReferences.add(option.profile);
      assertCompleteProfile(characterKey + '/' + option.buildCategory, option.profile);
      assert.ok(option.profile.teamFocus && option.profile.playstyle, characterKey + ': role profile needs team and rotation guidance');
      assert.ok(option.profile.sourceName && option.profile.sourceNote, characterKey + ': role profile must explain source/evidence status');
    }

    assert.deepEqual(getCharacterBuildRoleOptions(base).map(option => option.profile.roleBuildId), roles.map(option => option.profile.roleBuildId),
      characterKey + ': UI selector must read the stored role profiles');
  }
});

test('even an unknown character gets all three complete role-adapted templates', () => {
  const options = getCharacterBuildRoleOptions(null, { id: 'future-character', name: 'Future Character', element: 'Hydro', weapon: 'Sword' });
  assert.equal(options.length, 3);
  assert.deepEqual(options.map(option => option.buildCategory), BUILD_ROLE_CATEGORIES);
  for (const option of options) {
    assert.equal(option.status, 'adapted');
    assertCompleteProfile('unknown/' + option.buildCategory, option.profile);
    assert.equal(option.profile.stats.goblet.includes('Hydro DMG Bonus') || option.buildCategory === 'Support', true);
    assert.match(option.profile.sourceNote, /not a claim that this role is optimal/i);
  }
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

test('legacy-reviewed role labels are preserved during the Game8 source migration', () => {
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
      assert.ok(variant.sourceUrl.includes('game8.co') || variant.sourceUrl.includes('youtube.com'), key + '/' + id + ': use a Game8-restricted search or a role-specific creator source');
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


test('current build-source attribution distinguishes reviewed rankings from provisional kits', () => {
  for (const [key, profile] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    assert.ok(profile.sourceName, key + ': primary build must identify its source');
    assert.ok(profile.sourceNote, key + ': primary build must explain evidence scope');
    assert.ok(profile.sourceUrl.startsWith('https://'), key + ': primary build source must be secure');
    if (profile.sourceCheckedAt) {
      assert.ok(profile.sourceNote.includes('Checked ' + String(Number(profile.sourceCheckedAt.slice(8, 10))) + ' Oct ' + profile.sourceCheckedAt.slice(0, 4)) || profile.sourceNote.includes('Game8 verification pending'), key + ': source metadata must explain legacy review or pending Game8 verification');
    }
    for (const alternate of profile.alternateBuilds || []) {
      assert.ok(alternate.sourceName, key + '/' + alternate.id + ': alternate must identify its source');
      assert.ok(alternate.sourceNote, key + '/' + alternate.id + ': alternate must explain evidence scope');
    }
  }
});

test('expanded current profiles include multiple real options and role caveats', () => {
  for (const key of ['skirk', 'xingqiu', 'furina', 'nahida', 'raiden', 'bennett', 'kazuha', 'ayaka', 'ayato', 'childe', 'diluc', 'eula', 'hu-tao', 'itto', 'jean', 'keqing', 'klee', 'kokomi', 'nilou', 'shenhe', 'nefer', 'zibai', 'varka', 'durin', 'linnea', 'jahoda', 'aino', 'iansan', 'yumemizuki-mizuki']) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': reviewed primary profile exists');
    assert.ok(profile.weapons.length >= 4, key + ': expanded weapon options');
    assert.ok(profile.artifacts.length >= 3 || ['nefer', 'jahoda', 'iansan'].includes(key), key + ': expanded artifact options or shorter source listing');
    assert.ok(profile.sourceCheckedAt, key + ': expected dated source review for this profile');
  }
  assert.equal(CHARACTER_BUILD_GUIDES.columbina.buildCategory, 'Support', 'existing catalogue classifies Columbina as Support');
  assert.match(CHARACTER_BUILD_GUIDES.columbina.role, /Support/i);
});

test('Vesna and Vodyanitsa have complete, clearly provisional source-linked profiles', () => {
  const vesna = CHARACTER_BUILD_GUIDES.vesna;
  const vodyanitsa = CHARACTER_BUILD_GUIDES.vodyanitsa;
  assertCompleteProfile('vesna', vesna);
  assertCompleteProfile('vodyanitsa', vodyanitsa);
  assert.equal(vesna.buildCategory, 'Main DPS');
  assert.equal(vodyanitsa.buildCategory, 'Support');
  assert.equal(vesna.sourceCheckedAt, null);
  assert.equal(vodyanitsa.sourceCheckedAt, null);
  assert.match(vesna.sourceNote, /does not publish a ranked weapon\/artifact list/i);
  assert.match(vodyanitsa.sourceNote, /does not publish a ranked weapon\/artifact list/i);
  for (const key of ['vesna', 'vodyanitsa']) {
    const options = getCharacterBuildRoleOptions(CHARACTER_BUILD_GUIDES[key]);
    assert.equal(options.length, 3);
    assert.ok(options.some(option => option.status === 'adapted'), key + ': less-supported role tabs must remain marked experimental');
  }
});


test('every listed character has three independent selectable role builds and flags off-meta roles', () => {
  const entries = Object.entries(CHARACTER_BUILD_GUIDES);
  assert.ok(entries.length >= 125, 'current build roster should include all listed character profiles');
  let independentCount = 0;
  for (const [key, profile] of entries) {
    const options = getCharacterBuildRoleOptions(profile);
    assert.equal(options.length, 3, key + ': exactly three role builds');
    assert.deepEqual(options.map(option => option.buildCategory), ['Main DPS', 'Sub DPS', 'Support']);
    for (const option of options) {
      assertCompleteProfile(key + '/' + option.buildCategory, option.profile);
      if (option.status === 'adapted') {
        independentCount += 1;
        assert.match(option.profile.id, /^independent-/i, key + '/' + option.buildCategory + ': must be its own role build, not a generic shared template');
        assert.match(option.profile.role, /Independent/i);
        assert.match(option.profile.sourceNote, /not a claim that this role is optimal/i);
        assert.match(option.profile.playstyle, /Experimental independent/i);
        assert.ok(option.profile.artifacts.length >= 3, key + '/' + option.buildCategory + ': needs distinct artifact candidates');
        assert.ok(option.profile.weapons.length >= 3, key + '/' + option.buildCategory + ': needs role-specific weapon candidates');
        assert.notDeepEqual(option.profile.stats, profile.stats, key + '/' + option.buildCategory + ': role stats must be independently specified');
      }
    }
  }
  assert.ok(independentCount > 100, 'expected independent role builds for the many characters without a native source-ranked build in that role');
});

test('off-meta role builds explain when shared sets and weapon options are conditional', () => {
  for (const [key, profile] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    for (const option of getCharacterBuildRoleOptions(profile)) {
      if (option.status !== 'adapted') continue;
      assert.ok(option.profile.sourceUrl.startsWith('https://'), key + '/' + option.buildCategory + ': should retain a character-specific reference');
      assert.match(option.profile.sourceNote, /not source-ranked|source does not rank/i);
      assert.match(option.profile.teamFocus, /only|if|actual/i);
      assert.ok(option.profile.weapons.every(weapon => /not ranked|not a best-in-slot|before investing|passive/i.test(weapon.note)), key + '/' + option.buildCategory + ': weapon trade-offs should be stated');
      assert.ok(option.profile.artifacts.every(artifact => /role-specific candidates|not ranked|only|when|if|conditional|depends/i.test(artifact.note)), key + '/' + option.buildCategory + ': artifact conditions should be stated');
    }
  }
});

test('build role evidence labels do not imply a character page validates every alternate role', () => {
  for (const [characterKey, profile] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    const options = getCharacterBuildRoleOptions(profile);
    const primaryOption = options.find(option => option.buildCategory === profile.buildCategory);
    assert.ok(primaryOption, characterKey + ': primary role option exists');
    if (/does not publish a ranked weapon\/artifact list/i.test(profile.sourceNote || '')) {
      assert.equal(primaryOption.status, 'provisional', characterKey + ': pages without ranked gear lists must be provisional');
    } else if (profile.sourceCheckedAt == null) {
      assert.equal(primaryOption.status, 'needs-review', characterKey + ': undated profiles need review rather than being called unranked');
    } else if (/^Game8 —/i.test(profile.sourceName || '') && profile.sourceCheckedAt) {
      assert.equal(primaryOption.status, 'curated', characterKey + ': explicitly Game8-reviewed primary profiles remain curated');
    } else {
      assert.equal(primaryOption.status, 'needs-review', characterKey + ': legacy review dates must not be mistaken for Game8 verification');
    }
    for (const variant of profile.alternateBuilds || []) {
      const roleOption = options.find(option => option.buildCategory === variant.buildCategory);
      const playstyleOption = roleOption?.playstyles.find(style => style.id === variant.id);
      assert.ok(playstyleOption, characterKey + '/' + variant.id + ': role variant must remain selectable');
      if (variant.sourceRoleVerified === true) {
        assert.equal(playstyleOption.status, 'curated', characterKey + '/' + variant.id + ': explicitly role-verified Game8 variants remain curated');
      } else if (/youtube\.com|youtu\.be/i.test(variant.sourceUrl || '')) {
        assert.equal(playstyleOption.status, 'creator-reference', characterKey + '/' + variant.id + ': direct video links are source references, not guarantees of current optimality');
      } else if (/google\.com\/search\?q=.*game8\.co|game8\.co\/games\/Genshin-Impact\/archives|genshin\.gg\/characters\//i.test(variant.sourceUrl || '')) {
        assert.equal(playstyleOption.status, 'reference-only', characterKey + '/' + variant.id + ': a character guide or Game8 search does not validate an alternate role unless explicitly role-verified');
      }
    }
  }
});

test('uncited role templates stay explicitly experimental and newer unranked profiles stay provisional', () => {
  for (const characterKey of ['vesna', 'vodyanitsa']) {
    const profile = CHARACTER_BUILD_GUIDES[characterKey];
    assert.equal(getCharacterBuildRoleOptions(profile).find(option => option.buildCategory === profile.buildCategory).status, 'provisional');
  }
  const unknown = getCharacterBuildRoleOptions(null, { id: 'future-unit', name: 'Future Unit', element: 'Electro', weapon: 'Sword' });
  assert.ok(unknown.every(option => option.status === 'adapted'));
});

test('Oct 22 legacy source-review batch preserves existing primary listing data pending Game8 verification', () => {
  const expected = {
    escoffier: { role: 'Sub DPS', weapon: 'Symphonist of Scents', artifact: 'Golden Troupe 4-piece', sands: 'ATK% / Energy Recharge' },
    mona: { role: 'Support', weapon: 'Thrilling Tales of Dragon Slayers', artifact: 'Noblesse Oblige 4-piece', sands: 'Energy Recharge / ATK%' },
    fischl: { role: 'Sub DPS', weapon: 'The Daybreak Chronicles', artifact: 'Golden Troupe 4-piece', sands: 'ATK%' },
    sucrose: { role: 'Support', weapon: 'A Thousand Floating Dreams', artifact: 'Viridescent Venerer 4-piece', sands: 'Elemental Mastery' },
    alhaitham: { role: 'Main DPS', weapon: 'Light of Foliar Incision', artifact: 'Gilded Dreams 4-piece', sands: 'Elemental Mastery / ATK%' },
    ganyu: { role: 'Main DPS', weapon: "Hunter's Path", artifact: "Shimenawa's Reminiscence 4-piece", sands: 'ATK%' },
    tighnari: { role: 'Sub DPS', weapon: "Hunter's Path", artifact: "Wanderer's Troupe 4-piece", sands: 'ATK% / Elemental Mastery' },
    venti: { role: 'Sub DPS', weapon: 'The Daybreak Chronicles', artifact: 'Viridescent Venerer 4-piece', sands: 'ATK%' },
    yoimiya: { role: 'Main DPS', weapon: 'Thundering Pulse', artifact: "Shimenawa's Reminiscence 4-piece", sands: 'ATK% / Elemental Mastery' },
    layla: { role: 'Support', weapon: 'Key of Khaj-Nisut', artifact: 'Tenacity of the Millelith 4-piece', sands: 'HP%' },
    gaming: { role: 'Main DPS', weapon: 'Gest of the Mighty Wolf', artifact: 'Crimson Witch of Flames 4-piece', sands: 'Elemental Mastery' },
    odette: { role: 'Sub DPS', weapon: 'Whitelake Frostfeather', artifact: 'Heart of the Furnace 4-piece', sands: 'ATK%' },
  };
  for (const [key, expectation] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': source-reviewed profile exists');
    assert.equal(profile.buildCategory, expectation.role, key + ': role must match current source page');
    assert.ok(typeof profile.role === 'string' && profile.role.length > 0, key + ': role descriptor must be present');
    assert.equal(profile.weapons[0]?.name, expectation.weapon, key + ': first displayed weapon agrees with current legacy source listing');
    assert.equal(profile.artifacts[0]?.name, expectation.artifact, key + ': first displayed artifact agrees with current legacy source listing');
    assert.equal(profile.stats.sands, expectation.sands, key + ': main stat matches the source snapshot');
    assert.equal(profile.sourceCheckedAt, expectedReviewDate(key), key + ': current source review date is present');
    assert.ok(profile.sourceNote.includes('Checked ' + expectedReviewLabel(key)), key + ': source note shows the review date');
    assert.ok(profile.weapons.length >= (key === 'escoffier' ? 5 : key === 'odette' ? 4 : key === 'mona' ? 3 : key === 'xingqiu' ? 4 : 5), key + ': include the source-supported weapon options only');
    assert.ok(profile.artifacts.length >= (key === 'escoffier' ? 3 : key === 'mona' ? 2 : key === 'xingqiu' ? 3 : 5), key + ': include available source-supported set options');
  }
});

test('Oct 22 legacy source-review batch two preserves character listings pending Game8 verification', () => {
  const expected = {
    arlecchino: { role: 'Main DPS', weapon: "Crimson Moon's Semblance", artifact: 'Fragment of Harmonic Whimsy 4-piece', sands: 'ATK%' },
    mavuika: { role: 'Main DPS', weapon: 'A Thousand Blazing Suns', artifact: 'Obsidian Codex 4-piece', sands: 'Elemental Mastery', weapons: 4, artifacts: 3 },
    xilonen: { role: 'Support', weapon: 'Peak Patrol Song', artifact: 'Scroll of the Hero of Cinder City 4-piece', sands: 'DEF% / Energy Recharge', artifacts: 3 },
    citlali: { role: 'Support', weapon: "Starcaller's Watch", artifact: 'Scroll of the Hero of Cinder City 4-piece', sands: 'Elemental Mastery / Energy Recharge', weapons: 4, artifacts: 3 },
    chasca: { role: 'Main DPS', weapon: "Astral Vulture's Crimson Plumage", artifact: 'Obsidian Codex 4-piece', sands: 'ATK%', artifacts: 4 },
    ororon: { role: 'Support', weapon: 'Polar Star', artifact: 'Scroll of the Hero of Cinder City 4-piece', sands: 'ATK% / Energy Recharge', artifacts: 3 },
    varesa: { role: 'Main DPS', weapon: 'Vivid Notions', artifact: "Long Night's Oath 4-piece", sands: 'ATK%', artifacts: 4 },
    ifa: { role: 'Sub DPS', weapon: "Tulaytullah's Remembrance", artifact: 'Obsidian Codex 4-piece', sands: 'ATK%' },
    lauma: { role: 'Support', weapon: "Nightweaver's Looking Glass", artifact: "Silken Moon's Serenade 4-piece", sands: 'Energy Recharge / Elemental Mastery', artifacts: 4 },
    emilie: { role: 'Sub DPS', weapon: 'Lumidouce Elegy', artifact: 'Unfinished Reverie 4-piece', sands: 'ATK%' },
    mualani: { role: 'Main DPS', weapon: "Surf's Up", artifact: 'Obsidian Codex 4-piece', sands: 'Elemental Mastery / HP%' },
    kinich: { role: 'Main DPS', weapon: 'Fang of the Mountain King', artifact: 'Obsidian Codex 4-piece', sands: 'ATK%' },
    clorinde: { role: 'Main DPS', weapon: 'Absolution', artifact: 'Fragment of Harmonic Whimsy 4-piece', sands: 'ATK% / Elemental Mastery', weapons: 4, artifacts: 4 },
    wriothesley: { role: 'Main DPS', weapon: 'Cashflow Supervision', artifact: 'Disenchantment in Deep Shadow 4-piece', sands: 'ATK%', goblet: 'ATK%', artifacts: 4 },
  };
  for (const [key, expectation] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': profile exists');
    assert.equal(profile.buildCategory, expectation.role, key + ': role matches the current source page');
    assert.ok(typeof profile.role === 'string' && profile.role.length > 0, key + ': role description is present');
    assert.equal(profile.weapons[0]?.name, expectation.weapon, key + ': first visible source weapon is stored correctly');
    assert.equal(profile.artifacts[0]?.name, expectation.artifact, key + ': first visible source artifact is stored correctly');
    assert.equal(profile.stats.sands, expectation.sands, key + ': main stat matches the source');
    if (expectation.goblet) assert.equal(profile.stats.goblet, expectation.goblet, key + ': visible source Goblet is preserved');
    assert.equal(profile.sourceCheckedAt, expectedReviewDate(key), key + ': individual source review date is recorded');
    assert.ok(profile.sourceNote.includes('Checked ' + expectedReviewLabel(key)), key + ': review note date matches');
    if (expectation.weapons) assert.equal(profile.weapons.length, expectation.weapons, key + ': store only visible weapon entries');
    if (expectation.artifacts) assert.equal(profile.artifacts.length, expectation.artifacts, key + ': store source-supported artifact count');
  }
});

test('Oct 22 legacy source-review batch three preserves build listings pending Game8 verification', () => {
  const expected = {
    baizhu: { role: 'Support', weapon: "Jadefall's Splendor", artifact: 'Deepwood Memories 4-piece', sands: 'HP% / Energy Recharge', goblet: 'HP%', circlet: 'HP', weapons: 5, artifacts: 5 },
    chevreuse: { role: 'Support', weapon: 'Favonius Lance', artifact: 'Noblesse Oblige 4-piece', sands: 'HP%', weapons: 4, artifacts: 5 },
    beidou: { role: 'Sub DPS', weapon: "Wolf's Gravestone", artifact: 'Emblem of Severed Fate 4-piece', sands: 'ATK% / Energy Recharge', weapons: 5, artifacts: 5 },
    'kuki-shinobu': { role: 'Sub DPS', weapon: 'Freedom-Sworn', artifact: 'Flower of Paradise Lost 4-piece', sands: 'Elemental Mastery', goblet: 'Elemental Mastery', circlet: 'Elemental Mastery', weapons: 5, artifacts: 5 },
    faruzan: { role: 'Support', weapon: 'Favonius Warbow', artifact: 'Viridescent Venerer 4-piece', sands: 'Energy Recharge', goblet: 'Anemo DMG', weapons: 5, artifacts: 5 },
    dehya: { role: 'Support', weapon: 'Favonius Greatsword', artifact: 'Tenacity of the Millelith 4-piece', sands: 'HP%', weapons: 4, artifacts: 5 },
    kirara: { role: 'Support', weapon: 'Favonius Sword', artifact: "Tenacity of the Millelith 2-piece + Vourukasha's Glow 2-piece", sands: 'HP% / Energy Recharge', weapons: 5, artifacts: 4 },
    navia: { role: 'Main DPS', weapon: 'Verdict', artifact: 'Nighttime Whispers in the Echoing Woods 4-piece', sands: 'ATK%', goblet: 'Geo DMG', weapons: 5, artifacts: 5 },
    lyney: { role: 'Main DPS', weapon: 'The First Great Magic', artifact: 'Marechaussee Hunter 4-piece', sands: 'ATK%', goblet: 'Pyro DMG', weapons: 5, artifacts: 5 },
    wanderer: { role: 'Main DPS', weapon: "Tulaytullah's Remembrance", artifact: 'Desert Pavilion Chronicle 4-piece', sands: 'ATK%', goblet: 'Anemo DMG', weapons: 5, artifacts: 5 },
    qiqi: { role: 'Support', weapon: 'Favonius Sword', artifact: 'Tenacity of the Millelith 4-piece', sands: 'ATK% / Energy Recharge', goblet: 'ATK%', weapons: 5, artifacts: 5 },
    collei: { role: 'Support', weapon: 'Elegy for the End', artifact: 'Deepwood Memories 4-piece', sands: 'Energy Recharge / ATK% / Elemental Mastery', goblet: 'Dendro DMG', weapons: 5, artifacts: 5 },
  };
  for (const [key, expectation] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': profile exists');
    assert.equal(profile.buildCategory, expectation.role, key + ': role matches current source');
    assert.equal(profile.weapons[0]?.name, expectation.weapon, key + ': first visible weapon matches source');
    assert.equal(profile.artifacts[0]?.name, expectation.artifact, key + ': first visible artifact matches source');
    assert.equal(profile.stats.sands, expectation.sands, key + ': Sands matches source');
    if (expectation.goblet) assert.equal(profile.stats.goblet, expectation.goblet, key + ': Goblet matches source');
    if (expectation.circlet) assert.equal(profile.stats.circlet, expectation.circlet, key + ': Circlet matches source');
    assert.equal(profile.weapons.length, expectation.weapons, key + ': preserve the visible source-listed weapon count');
    assert.equal(profile.artifacts.length, expectation.artifacts, key + ': preserve source-listed artifact count');
    assert.equal(profile.sourceCheckedAt, expectedReviewDate(key), key + ': per-character source-review date is recorded');
    assert.ok(profile.sourceNote.includes('Checked ' + expectedReviewLabel(key)), key + ': source attribution date matches');
  }
});

test('Oct 22 legacy source-review batch four preserves primary listings pending Game8 verification', () => {
  const expected = {
    yanfei: { role: 'Main DPS', weapon: 'Skyward Atlas', artifact: 'Crimson Witch of Flames 4-piece', sands: 'ATK%', goblet: 'Pyro DMG', weapons: 5, artifacts: 5 },
    thoma: { role: 'Support', weapon: 'Favonius Lance', artifact: 'Noblesse Oblige 4-piece', sands: 'Energy Recharge / HP%', goblet: 'HP%', weapons: 5, artifacts: 5 },
    yaoyao: { role: 'Support', weapon: 'Favonius Lance', artifact: 'Deepwood Memories 4-piece', sands: 'HP% / Energy Recharge', goblet: 'HP%', circlet: 'Healing Bonus', weapons: 5, artifacts: 5 },
    'yun-jin': { role: 'Support', weapon: 'Favonius Lance', artifact: 'Husk of Opulent Dreams 4-piece', sands: 'DEF% / Energy Recharge', goblet: 'DEF%', circlet: 'DEF%', weapons: 5, artifacts: 5 },
    chongyun: { role: 'Support', weapon: "Wolf's Gravestone", artifact: 'Blizzard Strayer 2-piece + Noblesse Oblige 2-piece', sands: 'ATK% / Energy Recharge / Elemental Mastery', goblet: 'Cryo DMG', weapons: 5, artifacts: 5 },
    candace: { role: 'Support', weapon: 'Favonius Lance', artifact: 'Noblesse Oblige 4-piece', sands: 'Energy Recharge / HP%', goblet: 'HP%', weapons: 5, artifacts: 5 },
    ningguang: { role: 'Main DPS', weapon: 'Lost Prayer to the Sacred Winds', artifact: 'Archaic Petra 2-piece + Emblem of Severed Fate 2-piece', sands: 'ATK%', goblet: 'Geo DMG', weapons: 5, artifacts: 5 },
    noelle: { role: 'Main DPS', weapon: 'Redhorn Stonethresher', artifact: 'Husk of Opulent Dreams 4-piece', sands: 'DEF% / Energy Recharge', goblet: 'Geo DMG', weapons: 5, artifacts: 5 },
    razor: { role: 'Main DPS', weapon: 'Gest of the Mighty Wolf', artifact: 'A Day Carved From Rising Winds 4-piece', sands: 'ATK%', goblet: 'Electro DMG', weapons: 5, artifacts: 5 },
    rosaria: { role: 'Support', weapon: 'Staff of Homa', artifact: 'Blizzard Strayer 4-piece', sands: 'ATK%', goblet: 'Cryo DMG', weapons: 5, artifacts: 5 },
    sara: { role: 'Support', weapon: 'Skyward Harp', artifact: 'Emblem of Severed Fate 4-piece', sands: 'Energy Recharge / ATK%', goblet: 'Electro DMG', weapons: 5, artifacts: 5 },
    sayu: { role: 'Support', weapon: "Wolf's Gravestone", artifact: 'Viridescent Venerer 4-piece', sands: 'Energy Recharge / Elemental Mastery', goblet: 'ATK% / Elemental Mastery', weapons: 5, artifacts: 5 },
  };
  for (const [key, expectation] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': profile exists');
    assert.equal(profile.buildCategory, expectation.role, key + ': role matches current source');
    assert.equal(profile.weapons[0]?.name, expectation.weapon, key + ': first weapon agrees with source ordering');
    assert.equal(profile.artifacts[0]?.name, expectation.artifact, key + ': first artifact agrees with source ordering');
    assert.equal(profile.stats.sands, expectation.sands, key + ': Sands agree with source stats');
    assert.equal(profile.stats.goblet, expectation.goblet, key + ': Goblet agrees with source stats');
    if (expectation.circlet) assert.equal(profile.stats.circlet, expectation.circlet, key + ': Circlet agrees with source stats');
    assert.equal(profile.weapons.length, expectation.weapons, key + ': source weapon list count is preserved');
    assert.equal(profile.artifacts.length, expectation.artifacts, key + ': source artifact list count is preserved');
    assert.ok(profile.talentOrder.length > 0, key + ': kit-based talent priority stays available');
    assert.equal(profile.sourceCheckedAt, '2026-10-22', key + ': source-review date is recorded');
    assert.match(profile.sourceNote, /Checked 22 Oct 2026/i, key + ': source note has matching review date');
  }
});


test('25 additional primary profiles preserve legacy role and gear data pending Game8 verification', () => {
  const expected = {
    barbara: { role:'Support', weapon:'Thrilling Tales of Dragon Slayers', artifact:'Maiden Beloved 4-piece', sands:'HP%', goblet:'HP%', circlet:'Healing Bonus', weapons:5, artifacts:5 },
    diona: { role:'Support', weapon:'Favonius Warbow', artifact:'Noblesse Oblige 4-piece', sands:'Energy Recharge / HP%', goblet:'HP%', circlet:'HP% / Healing Bonus', weapons:5, artifacts:5 },
    gorou: { role:'Support', weapon:'Favonius Warbow', artifact:'The Exile 4-piece', sands:'Energy Recharge', goblet:'Geo DMG', circlet:'CRIT Rate', weapons:5, artifacts:5 },
    heizou: { role:'Sub DPS', weapon:'A Thousand Floating Dreams', artifact:'Viridescent Venerer 4-piece', sands:'Elemental Mastery', goblet:'Elemental Mastery', circlet:'Elemental Mastery', weapons:5, artifacts:5 },
    kaeya: { role:'Sub DPS', weapon:'Primordial Jade Cutter', artifact:'Emblem of Severed Fate 4-piece', sands:'Energy Recharge / ATK%', goblet:'Cryo DMG', circlet:'CRIT Rate / CRIT DMG', weapons:5, artifacts:5 },
    kaveh: { role:'Main DPS', weapon:'Favonius Greatsword', artifact:'Deepwood Memories 4-piece', sands:'Energy Recharge / Elemental Mastery', goblet:'Elemental Mastery', circlet:'Elemental Mastery', weapons:5, artifacts:5 },
    xianyun: { role:'Support', weapon:"Crane's Echoing Call", artifact:'Viridescent Venerer 4-piece', sands:'Energy Recharge / ATK%', goblet:'ATK%', circlet:'Healing Bonus / ATK%', weapons:5, artifacts:5 },
    sethos: { role:'Sub DPS', weapon:"Hunter's Path", artifact:"Wanderer's Troupe 4-piece", sands:'Elemental Mastery', goblet:'Electro DMG', circlet:'CRIT Rate / CRIT DMG', weapons:2, artifacts:5 },
    flins: { role:'Main DPS', weapon:'Bloodsoaked Ruins', artifact:"Night of the Sky's Unveiling 4-piece", sands:'ATK%', goblet:'ATK%', circlet:'CRIT Rate / CRIT DMG', weapons:5, artifacts:5 },
    illuga: { role:'Support', weapon:'Favonius Lance', artifact:"Silken Moon's Serenade 4-piece", sands:'Elemental Mastery / Energy Recharge', goblet:'Elemental Mastery', circlet:'Elemental Mastery', weapons:4, artifacts:2 },
    aloy: { role:'Sub DPS', weapon:'Thundering Pulse', artifact:'Noblesse Oblige 4-piece', sands:'ATK% / Elemental Mastery', goblet:'Cryo DMG', circlet:'CRIT Rate / CRIT DMG', weapons:5, artifacts:5 },
    amber: { role:'Sub DPS', weapon:'Elegy for the End', artifact:'Noblesse Oblige 4-piece', sands:'Energy Recharge', goblet:'Pyro DMG', circlet:'CRIT Rate / CRIT DMG', weapons:5, artifacts:5 },
    charlotte: { role:'Support', weapon:'Prototype Amber', artifact:'Noblesse Oblige 4-piece', sands:'Energy Recharge / ATK%', goblet:'ATK%', circlet:'Healing Bonus / ATK%', weapons:5, artifacts:5 },
    dori: { role:'Support', weapon:'Favonius Greatsword', artifact:'Noblesse Oblige 4-piece', sands:'Energy Recharge / HP% / Elemental Mastery', goblet:'HP% / Elemental Mastery', circlet:'Healing Bonus / HP% / Elemental Mastery', weapons:5, artifacts:5 },
    kachina: { role:'Sub DPS', weapon:'Favonius Lance', artifact:'Scroll of the Hero of Cinder City 4-piece', sands:'Energy Recharge / DEF%', goblet:'Geo DMG / DEF%', circlet:'CRIT Rate / CRIT DMG', weapons:4, artifacts:1 },
    lynette: { role:'Support', weapon:'Sacrificial Sword', artifact:'Viridescent Venerer 4-piece', sands:'Energy Recharge / ATK%', goblet:'Anemo DMG', circlet:'CRIT Rate / CRIT DMG', weapons:5, artifacts:5 },
    mika: { role:'Support', weapon:'Favonius Lance', artifact:'Noblesse Oblige 4-piece', sands:'Energy Recharge / HP%', goblet:'HP%', circlet:'Healing Bonus / HP%', weapons:5, artifacts:5 },
    sigewinne: { role:'Support', weapon:'Silvershower Heartstrings', artifact:'Ocean-Hued Clam 4-piece', sands:'HP%', goblet:'HP%', circlet:'HP%', weapons:4, artifacts:5 },
    dahlia: { role:'Support', weapon:'Favonius Sword', artifact:'Noblesse Oblige 4-piece', sands:'Energy Recharge / HP%', goblet:'HP%', circlet:'HP%', weapons:5, artifacts:3 },
    nicole: { role:'Support', weapon:"Angelos' Heptades", artifact:'Celestial Gift 4-piece', sands:'Energy Recharge / ATK%', goblet:'ATK%', circlet:'ATK% / CRIT Rate', weapons:5, artifacts:3 },
    prune: { role:'Support', weapon:'Favonius Codex', artifact:'Viridescent Venerer 4-piece', sands:'Energy Recharge / ATK%', goblet:'ATK%', circlet:'ATK% / CRIT Rate', weapons:5, artifacts:3 },
    lohen: { role:'Main DPS', weapon:'Disaster and Remorse', artifact:'A Day Carved From Rising Winds 4-piece', sands:'ATK%', goblet:'Cryo DMG', circlet:'CRIT Rate / CRIT DMG', weapons:5, artifacts:5 },
    sandrone: { role:'Main DPS', weapon:'A Teaspoon of Transcendence', artifact:'Disenchantment in Deep Shadow 4-piece', sands:'ATK%', goblet:'ATK%', circlet:'CRIT Rate / CRIT DMG', weapons:5, artifacts:3 },
    alyosha: { role:'Support', weapon:'Symphonist of Scents', artifact:'Heart of the Furnace 4-piece', sands:'ATK% / Energy Recharge', goblet:'ATK%', circlet:'ATK%', weapons:5, artifacts:3 },
  };
  for (const [key, item] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': reviewed profile exists');
    assert.equal(profile.buildCategory, item.role, key + ': existing primary role is preserved pending Game8 verification');
    assert.equal(profile.weapons[0]?.name, item.weapon, key + ': first weapon agrees with source order');
    assert.equal(profile.artifacts[0]?.name, item.artifact, key + ': first artifact agrees with source order');
    assert.equal(profile.stats.sands, item.sands, key + ': Sands source stat');
    assert.equal(profile.stats.goblet, item.goblet, key + ': Goblet source stat');
    assert.equal(profile.stats.circlet, item.circlet, key + ': Circlet source stat');
    assert.equal(profile.weapons.length, item.weapons, key + ': preserve exact number of listed weapon options');
    assert.equal(profile.artifacts.length, item.artifacts, key + ': preserve exact number of listed artifact options');
    assert.equal(profile.sourceCheckedAt, '2026-10-22', key + ': source review date recorded');
    assert.match(profile.sourceNote, /Checked 22 Oct 2026/i, key + ': source note includes matching date');
    assert.ok(profile.substats.length >= 2, key + ': substat priority remains provided');
    assert.ok(profile.talentOrder.length > 0, key + ': talent order remains available');
  }
  assert.deepEqual(CHARACTER_BUILD_GUIDES.sethos.talentOrder, ['Normal Attack', 'Elemental Burst', 'Elemental Skill']);
});


test('source review stores the published ranks instead of renumbering hidden weapon entries', () => {
  const profile = CHARACTER_BUILD_GUIDES.sigewinne;
  assert.deepEqual(profile.weapons.map(weapon => weapon.name), ['Silvershower Heartstrings', 'Recurve Bow', 'Favonius Warbow', 'Elegy for the End']);
  assert.match(profile.weapons[0].note, /entry #1/);
  assert.match(profile.weapons[1].note, /entry #2/);
  assert.match(profile.weapons[2].note, /entry #4/);
  assert.match(profile.weapons[3].note, /entry #5/);
});

test('Oct 22 legacy source-review batch 2 preserves gear and stat data pending Game8 verification', () => {
  const expected = {
  "wanderer": {
    "role": "Main DPS",
    "weapon": "Tulaytullah's Remembrance",
    "artifact": "Desert Pavilion Chronicle 4-piece",
    "sands": "ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "qiqi": {
    "role": "Support",
    "weapon": "Favonius Sword",
    "artifact": "Tenacity of the Millelith 4-piece",
    "sands": "ATK% / Energy Recharge",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "beidou": {
    "role": "Sub DPS",
    "weapon": "Wolf's Gravestone",
    "artifact": "Emblem of Severed Fate 4-piece",
    "sands": "ATK% / Energy Recharge",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "barbara": {
    "role": "Support",
    "weapon": "Thrilling Tales of Dragon Slayers",
    "artifact": "Maiden Beloved 4-piece",
    "sands": "HP%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "diona": {
    "role": "Support",
    "weapon": "Favonius Warbow",
    "artifact": "Noblesse Oblige 4-piece",
    "sands": "Energy Recharge / HP%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "rosaria": {
    "role": "Support",
    "weapon": "Staff of Homa",
    "artifact": "Blizzard Strayer 4-piece",
    "sands": "ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "yanfei": {
    "role": "Main DPS",
    "weapon": "Skyward Atlas",
    "artifact": "Crimson Witch of Flames 4-piece",
    "sands": "ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "navia": {
    "role": "Main DPS",
    "weapon": "Verdict",
    "artifact": "Nighttime Whispers in the Echoing Woods 4-piece",
    "sands": "ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "arlecchino": {
    "role": "Main DPS",
    "weapon": "Crimson Moon's Semblance",
    "artifact": "Fragment of Harmonic Whimsy 4-piece",
    "sands": "ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "clorinde": {
    "role": "Main DPS",
    "weapon": "Absolution",
    "artifact": "Fragment of Harmonic Whimsy 4-piece",
    "sands": "ATK% / Elemental Mastery",
    "weaponCount": 4,
    "artifactCount": 4
  },
  "lyney": {
    "role": "Main DPS",
    "weapon": "The First Great Magic",
    "artifact": "Marechaussee Hunter 4-piece",
    "sands": "ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "yaoyao": {
    "role": "Support",
    "weapon": "Favonius Lance",
    "artifact": "Deepwood Memories 4-piece",
    "sands": "HP% / Energy Recharge",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "baizhu": {
    "role": "Support",
    "weapon": "Jadefall's Splendor",
    "artifact": "Deepwood Memories 4-piece",
    "sands": "HP% / Energy Recharge",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "kirara": {
    "role": "Support",
    "weapon": "Favonius Sword",
    "artifact": "Tenacity of the Millelith 2-piece + Vourukasha's Glow 2-piece",
    "sands": "HP% / Energy Recharge",
    "weaponCount": 5,
    "artifactCount": 4
  },
  "wriothesley": {
    "role": "Main DPS",
    "weapon": "Cashflow Supervision",
    "artifact": "Disenchantment in Deep Shadow 4-piece",
    "sands": "ATK%",
    "weaponCount": 5,
    "artifactCount": 4
  },
  "xianyun": {
    "role": "Support",
    "weapon": "Crane's Echoing Call",
    "artifact": "Viridescent Venerer 4-piece",
    "sands": "Energy Recharge / ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "charlotte": {
    "role": "Support",
    "weapon": "Prototype Amber",
    "artifact": "Noblesse Oblige 4-piece",
    "sands": "Energy Recharge / ATK%",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "dori": {
    "role": "Support",
    "weapon": "Favonius Greatsword",
    "artifact": "Noblesse Oblige 4-piece",
    "sands": "Energy Recharge / HP% / Elemental Mastery",
    "weaponCount": 5,
    "artifactCount": 5
  },
  "mika": {
    "role": "Support",
    "weapon": "Favonius Lance",
    "artifact": "Noblesse Oblige 4-piece",
    "sands": "Energy Recharge / HP%",
    "weaponCount": 5,
    "artifactCount": 5
  }
};
  for (const [key, item] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': character profile exists');
    assert.equal(profile.buildCategory, item.role, key + ': source role matches');
    assert.equal(profile.weapons[0]?.name, item.weapon, key + ': first visible source weapon matches');
    assert.equal(profile.artifacts[0]?.name, item.artifact, key + ': first visible source artifact matches');
    assert.equal(profile.stats.sands, item.sands, key + ': source main stat matches');
    assert.equal(profile.weapons.length, item.weaponCount, key + ': only visible source weapon entries are included');
    assert.equal(profile.artifacts.length, item.artifactCount, key + ': source visible artifact entries are included');
    assert.equal(profile.sourceCheckedAt, expectedReviewDate(key), key + ': profile has per-character source review date');
    assert.ok(profile.sourceNote.includes('Checked ' + expectedReviewLabel(key)), key + ': source note has matching date');
  }
});

test('Oct 22 legacy primary-source batch preserves current catalogue data pending Game8 verification', () => {
  const expected = {
  "yae-miko": {
    "role": "Sub DPS",
    "weapon": "Kagura's Verity",
    "artifact": "Disenchantment in Deep Shadow 4-piece",
    "stats": {
      "sands": "ATK% / Elemental Mastery",
      "goblet": "ATK% / Elemental Mastery",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "CRIT Rate / CRIT DMG",
      "ATK%",
      "Elemental Mastery"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  },
  "lisa": {
    "role": "Support",
    "weapon": "Kagura's Verity",
    "artifact": "Emblem of Severed Fate 4-piece",
    "stats": {
      "sands": "Elemental Mastery / ATK%",
      "goblet": "Electro DMG",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "CRIT Rate / CRIT DMG",
      "Elemental Mastery",
      "ATK%"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  },
  "lan-yan": {
    "role": "Support",
    "weapon": "Angelos' Heptades",
    "artifact": "Viridescent Venerer 4-piece",
    "stats": {
      "sands": "ATK% / Energy Recharge",
      "goblet": "ATK%",
      "circlet": "ATK%"
    },
    "sub": [
      "Energy Recharge",
      "ATK%",
      "Elemental Mastery"
    ],
    "weaponCount": 5,
    "artifactCount": 1
  },
  "traveler-anemo": {
    "role": "Sub DPS",
    "weapon": "Exaiphanes Blade",
    "artifact": "Viridescent Venerer 4-piece",
    "stats": {
      "sands": "ATK% / Energy Recharge",
      "goblet": "Anemo DMG",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "Energy Recharge",
      "ATK%",
      "CRIT Rate / CRIT DMG"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  },
  "traveler-dendro": {
    "role": "Support",
    "weapon": "Freedom-Sworn",
    "artifact": "Deepwood Memories 4-piece",
    "stats": {
      "sands": "Energy Recharge / ATK%",
      "goblet": "Dendro DMG",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "Energy Recharge",
      "CRIT Rate / CRIT DMG",
      "ATK%"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  },
  "traveler-electro": {
    "role": "Support",
    "weapon": "Favonius Sword",
    "artifact": "Noblesse Oblige 4-piece",
    "stats": {
      "sands": "Energy Recharge",
      "goblet": "Electro DMG",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "Energy Recharge",
      "ATK%",
      "CRIT Rate / CRIT DMG"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  },
  "traveler-geo": {
    "role": "Sub DPS",
    "weapon": "Exaiphanes Blade",
    "artifact": "Nighttime Whispers in the Echoing Woods 4-piece",
    "stats": {
      "sands": "Energy Recharge / ATK%",
      "goblet": "Geo DMG",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "CRIT Rate / CRIT DMG",
      "ATK%",
      "Energy Recharge"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  },
  "traveler-hydro": {
    "role": "Support",
    "weapon": "Favonius Sword",
    "artifact": "Instructor 4-piece",
    "stats": {
      "sands": "Energy Recharge / ATK%",
      "goblet": "Hydro DMG",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "Energy Recharge",
      "CRIT Rate / CRIT DMG",
      "ATK%"
    ],
    "weaponCount": 5,
    "artifactCount": 4
  },
  "traveler-pyro": {
    "role": "Support",
    "weapon": "Favonius Sword",
    "artifact": "Scroll of the Hero of Cinder City 4-piece",
    "stats": {
      "sands": "Energy Recharge / ATK%",
      "goblet": "Pyro DMG",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "Energy Recharge",
      "CRIT Rate / CRIT DMG",
      "ATK%"
    ],
    "weaponCount": 5,
    "artifactCount": 2
  },
  "traveler-cryo": {
    "role": "Main DPS",
    "weapon": "Exaiphanes Blade",
    "artifact": "Disenchantment in Deep Shadow 4-piece",
    "stats": {
      "sands": "ATK%",
      "goblet": "ATK%",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "Energy Recharge",
      "CRIT Rate",
      "ATK%"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  },
  "ineffa": {
    "role": "Sub DPS",
    "weapon": "Fractured Halo",
    "artifact": "Aubade of Morningstar and Moon 4-piece",
    "stats": {
      "sands": "ATK%",
      "goblet": "ATK%",
      "circlet": "CRIT Rate / CRIT DMG"
    },
    "sub": [
      "CRIT Rate / CRIT DMG",
      "ATK%",
      "Energy Recharge"
    ],
    "weaponCount": 5,
    "artifactCount": 5
  }
};
  for (const [key, item] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': source-reviewed profile exists');
    assert.equal(profile.buildCategory, item.role, key + ': current source role matches');
    assert.equal(profile.weapons[0]?.name, item.weapon, key + ': first visible weapon matches source');
    assert.equal(profile.artifacts[0]?.name, item.artifact, key + ': first visible artifact matches source');
    assert.deepEqual(profile.stats, item.stats, key + ': main stats match source');
    assert.deepEqual(profile.substats, item.sub, key + ': substats match source');
    assert.equal(profile.weapons.length, item.weaponCount, key + ': preserve source-visible weapons only');
    assert.equal(profile.artifacts.length, item.artifactCount, key + ': preserve source-visible artifacts only');
    assert.equal(profile.sourceCheckedAt, '2026-10-22', key + ': source review date recorded');
    assert.match(profile.sourceNote, /Checked 22 Oct 2026/i, key + ': per-character review date in source note');
  }
});

test('Vesna and Vodyanitsa were checked but remain provisional without ranked gear lists', () => {
  for (const [key, role] of [['vesna', 'Main DPS'], ['vodyanitsa', 'Support']]) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.equal(profile.buildCategory, role);
    assert.equal(profile.sourceCheckedAt, null);
    assert.match(profile.sourceNote, /Checked 22 Oct 2026/i);
    assert.match(profile.sourceNote, /does not publish a ranked weapon\/artifact list/i);
    const roleOption = getCharacterBuildRoleOptions(profile).find(option => option.buildCategory === role);
    assert.equal(roleOption.status, 'provisional');
  }
});

test('Oct 23 legacy build review keeps gear, contextual notes, and role talent priorities pending Game8 verification', () => {
  const expected = {
    fischl: {
      weapons: ['The Daybreak Chronicles', 'Polar Star', 'Aqua Simulacra', 'Thundering Pulse', 'Chain Breaker R5'],
      artifacts: ['Golden Troupe 4-piece', 'A Day Carved From Rising Winds 4-piece', 'Golden Troupe 2-piece + Thundering Fury 2-piece', 'Golden Troupe 2-piece + Thundersoother 2-piece', 'A Day Carved From Rising Winds 2-piece + Golden Troupe 2-piece'],
      category: 'Sub DPS', stats: { sands: 'ATK%', goblet: 'Electro DMG', circlet: 'CRIT Rate / CRIT DMG' },
      talents: ['Elemental Skill', 'Elemental Burst', 'Normal Attack'],
    },
    sucrose: {
      weapons: ['A Thousand Floating Dreams', 'Wandering Evenstar', 'Sacrificial Fragments', 'Thrilling Tales of Dragon Slayers', 'Hakushin Ring'],
      artifacts: ['Viridescent Venerer 4-piece', 'Instructor 4-piece', "Gilded Dreams 2-piece + Wanderer's Troupe 2-piece", 'Gilded Dreams 4-piece', 'Gilded Dreams 2-piece + Viridescent Venerer 2-piece'],
      category: 'Support', stats: { sands: 'Elemental Mastery', goblet: 'Elemental Mastery', circlet: 'Elemental Mastery' },
      talents: ['Elemental Skill', 'Elemental Burst', 'Normal Attack'],
    },
    layla: {
      weapons: ['Key of Khaj-Nisut', 'Primordial Jade Cutter', 'Favonius Sword', 'Freedom-Sworn', 'Harbinger of Dawn'],
      artifacts: ['Tenacity of the Millelith 4-piece', 'Noblesse Oblige 4-piece', 'Blizzard Strayer 2-piece + Tenacity of the Millelith 2-piece', 'Emblem of Severed Fate 2-piece + Tenacity of the Millelith 2-piece', 'Blizzard Strayer 2-piece + Emblem of Severed Fate 2-piece'],
      category: 'Support', stats: { sands: 'HP%', goblet: 'HP%', circlet: 'HP%' },
      talents: ['Elemental Skill', 'Elemental Burst', 'Normal Attack'],
    },
    wanderer: {
      weapons: ["Tulaytullah's Remembrance", 'Reliquary of Truth', 'Vivid Notions', 'Lost Prayer to the Sacred Winds', 'The Widsith'],
      artifacts: ['Desert Pavilion Chronicle 4-piece', "Shimenawa's Reminiscence 4-piece", 'Echoes of an Offering 4-piece', 'Desert Pavilion Chronicle 2-piece + Viridescent Venerer 2-piece', "Desert Pavilion Chronicle 2-piece + Shimenawa's Reminiscence 2-piece"],
      category: 'Main DPS', stats: { sands: 'ATK%', goblet: 'Anemo DMG', circlet: 'CRIT Rate / CRIT DMG' },
      talents: ['Normal Attack', 'Elemental Skill', 'Elemental Burst'],
    },
  };
  for (const [key, spec] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': build profile is present');
    assert.equal(profile.sourceCheckedAt, '2026-10-23', key + ': source review date');
    assert.match(profile.sourceNote, /Checked 23 Oct 2026/i, key + ': dated source note');
    assert.equal(profile.buildCategory, spec.category, key + ': primary role');
    assert.deepEqual(profile.weapons.map(item => item.name), spec.weapons, key + ': current source-ranked weapon list');
    assert.deepEqual(profile.artifacts.map(item => item.name), spec.artifacts, key + ': current source-ranked artifact list');
    assert.deepEqual(profile.stats, spec.stats, key + ': main stat slots');
    assert.deepEqual(profile.talentOrder, spec.talents, key + ': talent investment order');
    assert.ok(profile.artifacts.every(item => item.note.length > 35), key + ': artifact notes must explain conditions');
    assert.ok(profile.weapons.every(item => item.note.includes('23 Oct 2026')), key + ': weapon entries must carry the correct review date');
  }
  assert.match(CHARACTER_BUILD_GUIDES.fischl.playstyle, /off-field/i);
  assert.match(CHARACTER_BUILD_GUIDES.xiangling.teamFocus, /Energy Recharge/i);
  assert.match(CHARACTER_BUILD_GUIDES.yelan.teamFocus, /Normal Attack/i);
  assert.match(CHARACTER_BUILD_GUIDES.sucrose.artifacts[0].note, /resistance/i);
  assert.match(CHARACTER_BUILD_GUIDES.layla.teamFocus, /shield/i);
  assert.match(CHARACTER_BUILD_GUIDES.wanderer.playstyle, /Shimenawa/i);
});

test('Oct 23 core legacy build batch preserves gear and stat listings pending Game8 verification', () => {
 const expected = {
  kazuha:{role:'Support',weapons:['Freedom-Sworn','Favonius Sword',"Xiphos' Moonlight",'Sacrificial Sword','Skyward Blade'],artifacts:['Viridescent Venerer 4-piece','Instructor 4-piece','Thundering Fury 4-piece',"Gilded Dreams 2-piece + Wanderer's Troupe 2-piece",'Gilded Dreams 2-piece + Viridescent Venerer 2-piece'],stats:{sands:'Elemental Mastery',goblet:'Elemental Mastery',circlet:'Elemental Mastery'},talents:['Elemental Skill','Elemental Burst','Normal Attack']},
  escoffier:{role:'Sub DPS',weapons:['Symphonist of Scents',"Sacrificer's Staff",'Staff of Homa','Engulfing Lightning',"Prospector's Drill",'Tamayuratei no Ohanashi','Favonius Lance'],artifacts:['Golden Troupe 4-piece','Noblesse Oblige 4-piece','Tenacity of the Millelith 4-piece'],stats:{sands:'ATK% / Energy Recharge',goblet:'Cryo DMG Bonus / ATK%',circlet:'CRIT Rate / CRIT DMG'},talents:['Elemental Skill','Elemental Burst','Normal Attack']},
  mona:{role:'Support',weapons:['Thrilling Tales of Dragon Slayers','Prototype Amber','Skyward Atlas'],artifacts:['Noblesse Oblige 4-piece','Song of Days Past 4-piece'],stats:{sands:'Energy Recharge / ATK%',goblet:'ATK% / Hydro DMG Bonus',circlet:'CRIT Rate / CRIT DMG'},talents:['Elemental Burst','Normal Attack','Elemental Skill']},
  nahida:{role:'Sub DPS',weapons:["A Thousand Floating Dreams","Kagura's Verity",'Sacrificial Fragments','Wandering Evenstar','The Widsith'],artifacts:['Deepwood Memories 4-piece','Gilded Dreams 4-piece','Golden Troupe 4-piece','Flower of Paradise Lost 2-piece + Gilded Dreams 2-piece',"Gilded Dreams 2-piece + Wanderer's Troupe 2-piece"],stats:{sands:'Elemental Mastery',goblet:'Elemental Mastery',circlet:'Elemental Mastery'},talents:['Elemental Skill','Elemental Burst','Normal Attack']},
  xingqiu:{role:'Sub DPS',weapons:['Sacrificial Sword','Primordial Jade Cutter','Mistsplitter Reforged','Amenoma Kageuchi'],artifacts:['Emblem of Severed Fate 4-piece','Noblesse Oblige 2-piece + Heart of Depth 2-piece','Noblesse Oblige 4-piece'],stats:{sands:'ATK% / Energy Recharge',goblet:'Hydro DMG Bonus',circlet:'CRIT Rate / CRIT DMG'},talents:['Elemental Burst','Elemental Skill','Normal Attack']}
 };
 for(const [key,spec] of Object.entries(expected)){
  const p=CHARACTER_BUILD_GUIDES[key];
  assert.ok(p,key+': profile exists');
  assert.equal(p.sourceCheckedAt,'2026-10-23',key+': source review date');
  assert.match(p.sourceNote,/Checked 23 Oct 2026/i,key+': dated source note');
  assert.equal(p.buildCategory,spec.role,key+': primary role');
  assert.deepEqual(p.weapons.map(x=>x.name),spec.weapons,key+': source-ranked weapons');
  assert.deepEqual(p.artifacts.map(x=>x.name),spec.artifacts,key+': source-ranked artifacts');
  assert.deepEqual(p.stats,spec.stats,key+': main stats');
  assert.deepEqual(p.talentOrder,spec.talents,key+': talent order');
  assert.ok(p.weapons.every(x=>(x.note.includes('23 Oct 2026') || (key==='mona' && x.note.includes('Game8')))&&x.note.length>45),key+': dated or Game8-sourced weapon caveats');
  assert.ok(p.artifacts.every(x=>(x.note.includes('23 Oct 2026') || (key==='mona' && x.note.includes('Game8')))&&x.note.length>45),key+': dated or Game8-sourced artifact conditions');
 }
 assert.match(CHARACTER_BUILD_GUIDES.kazuha.teamFocus,/Viridescent Venerer/i);
 assert.match(CHARACTER_BUILD_GUIDES.raiden.teamFocus,/Normal Attack talent/i);
 assert.match(CHARACTER_BUILD_GUIDES.furina.teamFocus,/healing/i);
 assert.match(CHARACTER_BUILD_GUIDES.escoffier.teamFocus,/55%/);
 assert.match(CHARACTER_BUILD_GUIDES.mona.teamFocus,/Omen/i);
 assert.match(CHARACTER_BUILD_GUIDES.bennett.teamFocus,/Base ATK/i);
 assert.match(CHARACTER_BUILD_GUIDES.nahida.teamFocus,/Deepwood/i);
 assert.match(CHARACTER_BUILD_GUIDES.xingqiu.teamFocus,/Normal Attacks/i);
});

test('Game8-reviewed profiles use guide-specific gear, stats, talents and role evidence', () => {
  const expected = {
    escoffier: {
      url: 'https://game8.co/games/Genshin-Impact/archives/385307k12',
      category: 'Sub DPS',
      artifact: 'Golden Troupe 4-piece',
      weapon: 'Symphonist of Scents',
      stats: ['ATK% / Energy Recharge', 'Cryo DMG Bonus / ATK%', 'CRIT Rate / CRIT DMG'],
      talents: ['Elemental Skill', 'Elemental Burst', 'Normal Attack'],
    },
    jean: {
      url: 'https://game8.co/games/Genshin-Impact/archives/297536',
      category: 'Support',
      artifact: 'Viridescent Venerer 4-piece',
      weapon: 'Freedom-Sworn',
      stats: ['ATK% / Energy Recharge', 'Anemo DMG Bonus', 'Healing Bonus / CRIT Rate / CRIT DMG'],
      talents: ['Elemental Burst', 'Elemental Skill', 'Normal Attack'],
    },
    eula: {
      url: 'https://game8.co/games/Genshin-Impact/archives/328764',
      category: 'Main DPS',
      artifact: 'Pale Flame 4-piece',
      weapon: 'Song of Broken Pines',
      stats: ['ATK%', 'Physical DMG Bonus', 'CRIT Rate / CRIT DMG'],
      talents: ['Elemental Burst', 'Normal Attack', 'Elemental Skill'],
    },
    freminet: {
      url: 'https://game8.co/games/Genshin-Impact/archives/417207',
      category: 'Main DPS',
      artifact: 'Pale Flame 4-piece',
      weapon: 'Song of Broken Pines',
      stats: ['ATK%', 'Physical DMG Bonus / ATK%', 'CRIT Rate / CRIT DMG'],
      talents: ['Elemental Skill', 'Normal Attack', 'Elemental Burst'],
    },
    'hu-tao': {
      url: 'https://game8.co/games/Genshin-Impact/archives/314347',
      category: 'Main DPS',
      artifact: 'Crimson Witch of Flames 4-piece',
      weapon: 'Staff of Homa',
      stats: ['HP% / Elemental Mastery', 'Pyro DMG Bonus', 'CRIT Rate / CRIT DMG'],
      talents: ['Normal Attack', 'Elemental Skill', 'Elemental Burst'],
    },
    yelan: {
      url: 'https://game8.co/games/Genshin-Impact/archives/372781',
      category: 'Sub DPS',
      artifact: 'Emblem of Severed Fate 4-piece',
      weapon: 'Aqua Simulacra',
      stats: ['HP% / Energy Recharge', 'Hydro DMG Bonus', 'CRIT Rate / CRIT DMG'],
      talents: ['Elemental Burst', 'Elemental Skill', 'Normal Attack'],
    },
    xiao: {
      url: 'https://game8.co/games/Genshin-Impact/archives/297527',
      category: 'Main DPS',
      artifact: 'Long Night\'s Oath 4-piece',
      weapon: 'Primordial Jade Winged-Spear',
      stats: ['ATK% / Energy Recharge', 'Anemo DMG Bonus', 'CRIT Rate / CRIT DMG'],
      talents: ['Normal Attack', 'Elemental Burst', 'Elemental Skill'],
    },
  };
  for (const [key, wanted] of Object.entries(expected)) {
    const profile = CHARACTER_BUILD_GUIDES[key];
    assert.ok(profile, key + ': profile exists');
    assert.equal(profile.sourceUrl, wanted.url, key + ': use the dedicated Game8 build page');
    assert.match(profile.sourceName, /^Game8 —/i, key + ': label Game8 as the current source');
    assert.equal(profile.sourceCheckedAt, '2026-10-23', key + ': source review date is recorded');
    assert.match(profile.sourceNote, /Checked 23 Oct 2026/i, key + ': note should disclose review date');
    assert.equal(profile.buildCategory, wanted.category, key + ': retain the documented primary role');
    assert.equal(profile.artifacts[0].name, wanted.artifact, key + ': source-based lead artifact');
    assert.equal(profile.weapons[0].name, wanted.weapon, key + ': source-based lead weapon');
    assert.deepEqual([profile.stats.sands, profile.stats.goblet, profile.stats.circlet], wanted.stats, key + ': use source-appropriate main stats');
    assert.deepEqual(profile.talentOrder, wanted.talents, key + ': talent priority follows the guide');
    assert.equal(getCharacterBuildRoleOptions(profile).length, 3, key + ': retain all three selectable roles');
  }

  const game8Variants = [
    ['jean', 'Sub DPS', 'game8-sub-dps'],
    ['freminet', 'Main DPS', 'game8-cryo-dps'],
    ['freminet', 'Main DPS', 'game8-hybrid-dps'],
    ['hu-tao', 'Main DPS', 'game8-marechaussee-plunge'],
    ['xiao', 'Main DPS', 'game8-marechaussee-furina'],
  ];
  for (const [key, category, id] of game8Variants) {
    const role = getCharacterBuildRoleOptions(CHARACTER_BUILD_GUIDES[key]).find(option => option.buildCategory === category);
    const variant = role?.playstyles.find(item => item.id === id);
    assert.ok(variant, key + '/' + id + ': source-specific playstyle variant must be selectable');
    assert.equal(variant.status, 'curated', key + '/' + id + ': cited guide explicitly covers the role/playstyle');
    assert.equal(variant.profile.sourceRoleVerified, true, key + '/' + id + ': role evidence flag is preserved');
  }
});



test('Game8 source lookup prefers verified guide URLs and otherwise uses a Game8-restricted search', () => {
  assert.equal(getGame8SearchUrl('Yelan', 'Sub DPS'), 'https://game8.co/games/Genshin-Impact/archives/372781');
  assert.equal(getGame8SearchUrl('Jean', 'Support'), 'https://game8.co/games/Genshin-Impact/archives/297536');
  const fallback = getGame8SearchUrl('Skirk', 'Main DPS');
  assert.match(fallback, /^https:\/\/www\.google\.com\/search\?q=/);
  assert.match(decodeURIComponent(fallback), /site:game8\.co\/games\/Genshin-Impact\/archives/);
  assert.match(decodeURIComponent(fallback), /Skirk/);
});
