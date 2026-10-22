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


test('current build-source attribution distinguishes reviewed rankings from provisional kits', () => {
  for (const [key, profile] of Object.entries(CHARACTER_BUILD_GUIDES)) {
    assert.ok(profile.sourceName, key + ': primary build must identify its source');
    assert.ok(profile.sourceNote, key + ': primary build must explain evidence scope');
    assert.ok(profile.sourceUrl.startsWith('https://'), key + ': primary build source must be secure');
    if (profile.sourceCheckedAt) {
      assert.ok(profile.sourceNote.includes('Checked ' + String(Number(profile.sourceCheckedAt.slice(8, 10))) + ' Oct ' + profile.sourceCheckedAt.slice(0, 4)), key + ': dated review note must match its per-character source check date');
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
  assert.equal(CHARACTER_BUILD_GUIDES.columbina.buildCategory, 'Support', 'current Genshin.gg build index classifies Columbina as Support');
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
    } else {
      assert.equal(primaryOption.status, 'curated', characterKey + ': dated source-reviewed primary profile must be identified');
    }
    for (const variant of profile.alternateBuilds || []) {
      const roleOption = options.find(option => option.buildCategory === variant.buildCategory);
      const playstyleOption = roleOption?.playstyles.find(style => style.id === variant.id);
      assert.ok(playstyleOption, characterKey + '/' + variant.id + ': role variant must remain selectable');
      if (/youtube\.com|youtu\.be/i.test(variant.sourceUrl || '')) {
        assert.equal(playstyleOption.status, 'creator-reference', characterKey + '/' + variant.id + ': direct video links are source references, not guarantees of current optimality');
      } else if (/genshin\.gg\/characters\//i.test(variant.sourceUrl || '')) {
        assert.equal(playstyleOption.status, 'reference-only', characterKey + '/' + variant.id + ': a primary character page must not be presented as proof of an alternate role');
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

test('Oct 22 source-review batch follows the current Genshin.gg primary listing', () => {
  const expected = {
    neuvillette: { role: 'Main DPS', weapon: 'Tome of the Eternal Flow', artifact: 'Marechaussee Hunter 4-piece', sands: 'HP%' },
    escoffier: { role: 'Sub DPS', weapon: 'Symphonist of Scents', artifact: 'Golden Troupe 4-piece', sands: 'ATK% / Energy Recharge' },
    mona: { role: 'Support', weapon: 'Thrilling Tales of Dragon Slayers', artifact: 'Noblesse Oblige 4-piece', sands: 'Energy Recharge / ATK%' },
    zhongli: { role: 'Support', weapon: 'Black Tassel', artifact: 'Archaic Petra 4-piece', sands: 'HP%' },
    xiangling: { role: 'Sub DPS', weapon: 'Staff of the Scarlet Sands', artifact: 'Emblem of Severed Fate 4-piece', sands: 'Energy Recharge / ATK%' },
    yelan: { role: 'Sub DPS', weapon: 'Elegy for the End', artifact: 'Emblem of Severed Fate 4-piece', sands: 'Energy Recharge' },
    fischl: { role: 'Sub DPS', weapon: 'The Daybreak Chronicles', artifact: 'Golden Troupe 4-piece', sands: 'ATK%' },
    sucrose: { role: 'Support', weapon: 'A Thousand Floating Dreams', artifact: 'Viridescent Venerer 4-piece', sands: 'Elemental Mastery' },
    alhaitham: { role: 'Main DPS', weapon: 'Light of Foliar Incision', artifact: 'Gilded Dreams 4-piece', sands: 'Elemental Mastery / ATK%' },
    ganyu: { role: 'Main DPS', weapon: "Hunter's Path", artifact: "Shimenawa's Reminiscence 4-piece", sands: 'ATK%' },
    tighnari: { role: 'Sub DPS', weapon: "Hunter's Path", artifact: "Wanderer's Troupe 4-piece", sands: 'ATK% / Elemental Mastery' },
    venti: { role: 'Sub DPS', weapon: 'The Daybreak Chronicles', artifact: 'Viridescent Venerer 4-piece', sands: 'ATK%' },
    xiao: { role: 'Main DPS', weapon: 'Primordial Jade Winged-Spear', artifact: 'Vermillion Hereafter 4-piece', sands: 'ATK%' },
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
    assert.equal(profile.weapons[0]?.name, expectation.weapon, key + ': first displayed weapon agrees with current Genshin.gg listing');
    assert.equal(profile.artifacts[0]?.name, expectation.artifact, key + ': first displayed artifact agrees with current Genshin.gg listing');
    assert.equal(profile.stats.sands, expectation.sands, key + ': main stat matches the source snapshot');
    assert.equal(profile.sourceCheckedAt, '2026-10-22', key + ': current source review date is present');
    assert.match(profile.sourceNote, /Checked 22 Oct 2026/i, key + ': source note shows the review date');
    assert.ok(profile.weapons.length >= (key === 'escoffier' ? 5 : key === 'odette' ? 4 : 5), key + ': include the source-supported weapon options only');
    assert.ok(profile.artifacts.length >= (key === 'escoffier' ? 3 : 5), key + ': include available source-supported set options');
  }
});

test('Oct 22 source-review batch two follows current Genshin.gg character listings', () => {
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
    assert.equal(profile.sourceCheckedAt, '2026-10-22', key + ': individual source review date is recorded');
    assert.match(profile.sourceNote, /Checked 22 Oct 2026/i, key + ': review note date matches');
    if (expectation.weapons) assert.equal(profile.weapons.length, expectation.weapons, key + ': store only visible weapon entries');
    if (expectation.artifacts) assert.equal(profile.artifacts.length, expectation.artifacts, key + ': store source-supported artifact count');
  }
});
