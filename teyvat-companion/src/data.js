export const ELEMENTS = ['All elements', 'Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'];
export const ELEMENT_META = {
  // Saturated, accessible element colors work on the updated parchment UI as
  // text/icon colors while their translucent variants stay soft in portraits.
  Pyro: { icon: '✦', color: '#b74835', soft: 'rgba(183,72,53,.13)' },
  Hydro: { icon: '◈', color: '#286f9b', soft: 'rgba(40,111,155,.13)' },
  Anemo: { icon: '❋', color: '#34795f', soft: 'rgba(52,121,95,.13)' },
  Electro: { icon: 'ϟ', color: '#7650a5', soft: 'rgba(118,80,165,.13)' },
  Dendro: { icon: '❧', color: '#587e31', soft: 'rgba(88,126,49,.13)' },
  Cryo: { icon: '❄', color: '#286e88', soft: 'rgba(40,110,136,.13)' },
  Geo: { icon: '⬡', color: '#89651f', soft: 'rgba(137,101,31,.13)' },
};

// Starter records are a small, clearly editable local catalogue. Refresh game data in Settings to try the public dataset.
export const STARTER_CHARACTERS = [
  { id:'skirk', name:'Skirk', element:'Cryo', weapon:'Sword', rarity:5, role:'Main DPS', region:'Unknown', owned:true, level:90, talents:[9,9,9], constellation:0, weaponName:'Azurelight', artifact:'Finale of the Deep Galleries', mainStats:'ATK% / Cryo DMG / CRIT', notes:'Prioritize a consistent rotation and teammates that support her damage window.', image:'https://genshin.jmp.blue/characters/skirk/portrait' },
  { id:'escoffier', name:'Escoffier', element:'Cryo', weapon:'Polearm', rarity:5, role:'Support', region:'Fontaine', owned:true, level:80, talents:[6,8,8], constellation:0, weaponName:'Symphonist of Scents', artifact:'Golden Troupe / support options', mainStats:'ATK% / Cryo DMG / CRIT or utility', notes:'Team value depends on having the right Hydro/Cryo partners; tune ER to rotation needs.', image:'https://genshin.jmp.blue/characters/escoffier/portrait' },
  { id:'xingqiu', name:'Xingqiu', element:'Hydro', weapon:'Sword', rarity:4, role:'Sub DPS', region:'Liyue', owned:true, level:80, talents:[1,8,9], constellation:4, weaponName:'Sacrificial Sword', artifact:'Emblem of Severed Fate', mainStats:'ER or ATK% / Hydro DMG / CRIT', notes:'Burst uptime is central to his off-field Hydro application.', image:'https://genshin.jmp.blue/characters/xingqiu/portrait' },
  { id:'mona', name:'Mona', element:'Hydro', weapon:'Catalyst', rarity:5, role:'Support', region:'Mondstadt', owned:true, level:70, talents:[1,6,8], constellation:0, weaponName:'Favonius Codex', artifact:'Emblem of Severed Fate', mainStats:'ER / Hydro DMG / CRIT', notes:'Use her Burst to set up short damage windows; rotation timing matters.', image:'https://genshin.jmp.blue/characters/mona/portrait' },
  { id:'furina', name:'Furina', element:'Hydro', weapon:'Sword', rarity:5, role:'Sub DPS', region:'Fontaine', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Splendor of Tranquil Waters', artifact:'Golden Troupe', mainStats:'HP% / HP% or Hydro DMG / CRIT', notes:'Team-wide healing support is important for her buffing mode.', image:'https://genshin.jmp.blue/characters/furina/portrait' },
  { id:'nahida', name:'Nahida', element:'Dendro', weapon:'Catalyst', rarity:5, role:'Support', region:'Sumeru', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'A Thousand Floating Dreams', artifact:'Deepwood Memories', mainStats:'EM / EM or Dendro DMG / EM or CRIT', notes:'Build around the reaction your team actually triggers.', image:'https://genshin.jmp.blue/characters/nahida/portrait' },
  { id:'raiden', name:'Raiden Shogun', element:'Electro', weapon:'Polearm', rarity:5, role:'Main DPS', region:'Inazuma', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'The Catch', artifact:'Emblem of Severed Fate', mainStats:'ER or ATK% / ATK% or Electro DMG / CRIT', notes:'Burst cost and team rotation influence her Energy Recharge target.', image:'https://genshin.jmp.blue/characters/raiden/portrait' },
  { id:'bennett', name:'Bennett', element:'Pyro', weapon:'Sword', rarity:4, role:'Support', region:'Mondstadt', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Sapwood Blade', artifact:'Noblesse Oblige', mainStats:'ER / HP% or Pyro DMG / Healing or CRIT', notes:'A high base-ATK weapon and Burst talent are especially valuable for his buff.', image:'https://genshin.jmp.blue/characters/bennett/portrait' },
  { id:'kazuha', name:'Kaedehara Kazuha', element:'Anemo', weapon:'Sword', rarity:5, role:'Support', region:'Inazuma', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Favonius Sword', artifact:'Viridescent Venerer', mainStats:'EM / EM / EM', notes:'Swirl and resistance reduction work best when the target element can be Swirled.', image:'https://genshin.jmp.blue/characters/kaedehara-kazuha/portrait' },
  { id:'zhongli', name:'Zhongli', element:'Geo', weapon:'Polearm', rarity:5, role:'Shielder', region:'Liyue', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Black Tassel', artifact:'Tenacity of the Millelith', mainStats:'HP% / HP% / HP%', notes:'A shield-focused build emphasizes uptime and survivability.', image:'https://genshin.jmp.blue/characters/zhongli/portrait' },
  { id:'neuvillette', name:'Neuvillette', element:'Hydro', weapon:'Catalyst', rarity:5, role:'Main DPS', region:'Fontaine', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Tome of the Eternal Flow', artifact:'Marechaussee Hunter', mainStats:'HP% / Hydro DMG / CRIT DMG', notes:'His charged-attack playstyle benefits from stable interruption resistance or defensive support.', image:'https://genshin.jmp.blue/characters/neuvillette/portrait' },
  { id:'xiangling', name:'Xiangling', element:'Pyro', weapon:'Polearm', rarity:4, role:'Sub DPS', region:'Liyue', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'The Catch', artifact:'Emblem of Severed Fate', mainStats:'ER or ATK% / Pyro DMG / CRIT', notes:'Energy Recharge and reliable off-field Pyro application are key.', image:'https://genshin.jmp.blue/characters/xiangling/portrait' },
  { id:'yelan', name:'Yelan', element:'Hydro', weapon:'Bow', rarity:5, role:'Sub DPS', region:'Liyue', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Favonius Warbow', artifact:'Emblem of Severed Fate', mainStats:'HP% or ER / Hydro DMG / CRIT', notes:'Favonius can ease team energy needs; ER depends on teammates and rotation.', image:'https://genshin.jmp.blue/characters/yelan/portrait' },
  { id:'qiqi', name:'Qiqi', element:'Cryo', weapon:'Sword', rarity:5, role:'Healer', region:'Liyue', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Sacrificial Sword', artifact:'Ocean-Hued Clam', mainStats:'ATK% / ATK% / Healing Bonus', notes:'Healing-focused options are straightforward; energy can be awkward.', image:'https://genshin.jmp.blue/characters/qiqi/portrait' },
  { id:'wanderer', name:'Wanderer', element:'Anemo', weapon:'Catalyst', rarity:5, role:'Main DPS', region:'Sumeru', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'The Widsith', artifact:'Desert Pavilion Chronicle', mainStats:'ATK% / Anemo DMG / CRIT', notes:'Consider team buffs and defensive interruption resistance.', image:'https://genshin.jmp.blue/characters/wanderer/portrait' },
  { id:'layla', name:'Layla', element:'Cryo', weapon:'Sword', rarity:4, role:'Shielder', region:'Sumeru', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Favonius Sword', artifact:'Tenacity of the Millelith', mainStats:'HP% / HP% / HP%', notes:'Prioritize shield strength and enough ER if using her Burst regularly.', image:'https://genshin.jmp.blue/characters/layla/portrait' },
  { id:'gaming', name:'Gaming', element:'Pyro', weapon:'Claymore', rarity:4, role:'Main DPS', region:'Liyue', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Serpent Spine', artifact:'Marechaussee Hunter', mainStats:'ATK% / Pyro DMG / CRIT', notes:'Plunge-oriented teams and healing support can improve comfort.', image:'https://genshin.jmp.blue/characters/gaming/portrait' },
  { id:'fischl', name:'Fischl', element:'Electro', weapon:'Bow', rarity:4, role:'Sub DPS', region:'Mondstadt', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'The Stringless', artifact:'Golden Troupe', mainStats:'ATK% / Electro DMG / CRIT', notes:'Keep Oz active and fit her skill recast into the rotation.', image:'https://genshin.jmp.blue/characters/fischl/portrait' },
  { id:'sucrose', name:'Sucrose', element:'Anemo', weapon:'Catalyst', rarity:4, role:'Support', region:'Mondstadt', owned:false, level:1, talents:[1,1,1], constellation:0, weaponName:'Sacrificial Fragments', artifact:'Viridescent Venerer', mainStats:'EM / EM / EM', notes:'Elemental Mastery sharing is most useful in reaction teams.', image:'https://genshin.jmp.blue/characters/sucrose/portrait' },
];

export const MATERIAL_STARTER = [
  { id:'mora', name:'Mora', category:'Currency', owned:0, required:0, note:'General upgrade currency' },
  { id:'hero-wit', name:"Hero's Wit", category:'EXP', owned:0, required:0, note:'Character EXP books' },
  { id:'talent-books', name:'Talent books', category:'Talent', owned:0, required:0, note:'Set exact material name for your character' },
  { id:'boss-drop', name:'Normal boss drop', category:'Boss', owned:0, required:0, note:'Add the exact drop you need' },
  { id:'local-specialty', name:'Local specialty', category:'Local specialty', owned:0, required:0, note:'Add the exact regional specialty' },
  { id:'enemy-drop', name:'Enemy drops', category:'Enemy', owned:0, required:0, note:'Enemy materials vary by character' },
];

export const STARTER_TEAMS = [
  { id:'team-sample-1', name:'Freeze / Cryo showcase (example)', characters:['skirk','escoffier','xingqiu','mona'], description:'Example preset using your local starter roster. Review the rotation and survivability for your own account.' },
];

export const NAV_ITEMS = [
  { id:'dashboard', label:'Dashboard', icon:'LayoutDashboard' },
  { id:'characters', label:'Characters', icon:'Users' },
  { id:'builds', label:'Character Builds', icon:'BookOpen' },
  { id:'optimizer', label:'Artifact Optimizer', icon:'Layers3' },
  { id:'teams', label:'Builds & Teams', icon:'Swords' },
  { id:'advisor', label:'Teyvat Advisor', icon:'Compass' },
  { id:'materials', label:'Materials & Farming', icon:'PackageOpen' },

  { id:'account', label:'Account Tracker', icon:'ChartNoAxesCombined' },
  { id:'guides', label:'Guides & Videos', icon:'PlayCircle' },
  { id:'settings', label:'Settings', icon:'Settings2' },
];
