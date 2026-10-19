import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronDown,
  ChevronRight, Compass, Download, ExternalLink, FileJson, Filter, Flame, Gem, Globe2, Info,
  Layers3, Link2, MapPinned, Menu, MoreHorizontal, PackageOpen, Pencil, PlayCircle, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Swords, Target, Trash2, Upload, Users, Clock,
  X, Zap, LayoutDashboard, ChartNoAxesCombined, CalendarDays, Database, Bot,
} from 'lucide-react';
import { ELEMENTS, ELEMENT_META, MATERIAL_STARTER, NAV_ITEMS, STARTER_CHARACTERS, STARTER_TEAMS } from './data';
import { CHARACTER_BUILD_ALIASES, CHARACTER_BUILD_GUIDES, CREATOR_CHANNELS, getCharacterBuildRoleOptions } from './builds';
import { buildProgressionPlan, enkaTtlSeconds, flattenEnkaSavedBuilds, isValidGenshinUid, matchGoodCharacterKey, mergeCharacterCatalogue, mergeEnkaShowcaseCharacter, normalizeAkashaArtifacts, normalizeAkashaProfiles, optimizeArtifactLoadout, parseEnkaPublicRoster, parseGoodInventory } from './core';

const ICONS = { LayoutDashboard, Users, Swords, PackageOpen, MapPinned, ChartNoAxesCombined, PlayCircle, Settings2, Bot, BookOpen, Layers3 };
const STORAGE_KEY = 'teyvat-companion-v1';
const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Other'];
const TASK_STARTER = [
  { id:'task-weekly', title:'Choose one upgrade goal', detail:'Pick a character or weapon to focus on today', done:false, kind:'planning' },
  { id:'task-inventory', title:'Update missing materials', detail:'Enter the materials you already have', done:false, kind:'inventory' },
  { id:'task-domain', title:'Check today’s domain rotation', detail:'Confirm the book or weapon material schedule in-game', done:false, kind:'domain' },
];

function loadInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
      return {
        characters: STARTER_CHARACTERS.map(c => ({...c, ...(saved.characters?.[c.id] || {})})).concat((saved.extraCharacters || []).filter(c => !STARTER_CHARACTERS.some(s => s.id === c.id))),
        materials: saved.materials || MATERIAL_STARTER,
        teams: saved.teams || STARTER_TEAMS,
        goals: saved.goals || [],
        mapMarkers: saved.mapMarkers || [],
        account: { ar: saved.account?.ar ?? 58, worldLevel: saved.account?.worldLevel ?? 8, abyss: saved.account?.abyss || 'Not set', primogems: saved.account?.primogems ?? 0, wishes: saved.account?.wishes ?? 0, pity: saved.account?.pity ?? 0, uid: saved.account?.uid || '', nickname: saved.account?.nickname || '', resinAvailable: Math.max(0, Math.min(200, Number(saved.account?.resinAvailable) || 0)) },
        tasks: saved.tasks || TASK_STARTER,
        enkaSnapshot: saved.enkaSnapshot || null,
        enkaNextFetchAt: Number(saved.enkaNextFetchAt || saved.enkaSnapshot?.nextFetchAt || 0),
        goodInventory: saved.goodInventory || null,
        akashaSnapshot: saved.akashaSnapshot || null,
        lastUpdated: saved.lastUpdated || null,
      };
    }
  } catch (e) { console.warn('Could not read local tracker data', e); }
  return {
    characters: STARTER_CHARACTERS.map(c => ({...c})), materials: MATERIAL_STARTER.map(m => ({...m})), teams: STARTER_TEAMS.map(t => ({...t})), goals: [], mapMarkers: [],
    account: { ar: 58, worldLevel: 8, abyss: 'Not set', primogems: 0, wishes: 0, pity: 0, uid: '', nickname: '', resinAvailable: 0 }, tasks: TASK_STARTER.map(t => ({...t})), enkaSnapshot: null, enkaNextFetchAt: 0, goodInventory: null, akashaSnapshot: null, lastUpdated: null,
  };
}

const formatNumber = n => Number(n || 0).toLocaleString('en-US');
const humanizeGameKey = value => String(value || 'Unknown').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const formatArtifactStat = value => {
  const key = String(value || '').toLowerCase();
  const labels = { hp:'HP', hp_:'HP%', atk:'ATK', atk_:'ATK%', def:'DEF', def_:'DEF%', critrate_:'CRIT Rate', critdmg_:'CRIT DMG', enerrech_:'Energy Recharge', elemas:'Elemental Mastery', physical_dmg_:'Physical DMG Bonus', pyro_dmg_:'Pyro DMG Bonus', hydro_dmg_:'Hydro DMG Bonus', cryo_dmg_:'Cryo DMG Bonus', dendro_dmg_:'Dendro DMG Bonus', electro_dmg_:'Electro DMG Bonus', anemo_dmg_:'Anemo DMG Bonus', geo_dmg_:'Geo DMG Bonus', healing_:'Healing Bonus' };
  return labels[key] || humanizeGameKey(value);
};
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalizeElement = raw => {
  const value = String(raw ?? '').toLowerCase();
  const aliases = { anemo:'Anemo', wind:'Anemo', geo:'Geo', rock:'Geo', electro:'Electro', electric:'Electro', pyro:'Pyro', fire:'Pyro', hydro:'Hydro', water:'Hydro', cryo:'Cryo', ice:'Cryo', dendro:'Dendro', grass:'Dendro' };
  for (const [alias, element] of Object.entries(aliases)) if (value.includes(alias)) return element;
  return '';
};
const normalizeWeapon = raw => {
  const value = String(raw ?? '').toLowerCase();
  if (value.includes('bow')) return 'Bow';
  if (value.includes('catalyst')) return 'Catalyst';
  if (value.includes('claymore')) return 'Claymore';
  if (value.includes('pole')) return 'Polearm';
  if (value.includes('sword') || value.includes('one_hand')) return 'Sword';
  return '';
};
const ambrAssetUrl = raw => {
  let value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) value = value.slice(1);
  if (value.startsWith('assets/UI/')) value = value.slice('assets/UI/'.length);
  const lower = value.toLowerCase();
  if (lower.endsWith('.png')) value = value.slice(0, -4);
  else if (lower.endsWith('.webp')) value = value.slice(0, -5);
  else if (lower.endsWith('.jpg')) value = value.slice(0, -4);
  else if (lower.endsWith('.jpeg')) value = value.slice(0, -5);
  return 'https://gi.yatta.moe/assets/UI/' + value + '.png';
};
const gachaArtworkFromIcon = raw => {
  const value = String(raw ?? '').trim();
  return value && /AvatarIcon/i.test(value) ? ambrAssetUrl(value.replace(/AvatarIcon/gi, 'Gacha_AvatarImg')) : '';
};
const youtubeSearch = (topic, creator = '') => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${creator} Genshin Impact ${topic}`)}`;
function findCharacterBuildGuide(character) {
  if (!character) return null;
  const keys = [character.id, character.apiSlug, character.name].filter(Boolean).map(value => slugify(value));
  for (const key of keys) {
    const resolved = CHARACTER_BUILD_ALIASES[key] || key;
    if (CHARACTER_BUILD_GUIDES[resolved]) return CHARACTER_BUILD_GUIDES[resolved];
  }
  return null;
}

const AMBR_API_ROOT = 'https://gi.yatta.moe/api/v2';
let ambrVersionPromise = null;
async function fetchAmbrData(endpoint) {
  if (!ambrVersionPromise) {
    ambrVersionPromise = fetch(`${AMBR_API_ROOT}/static/version`).then(async response => {
      if (!response.ok) throw new Error(`Project Amber version endpoint returned ${response.status}`);
      const payload = await response.json();
      if (!payload?.data?.vh) throw new Error('Project Amber did not return a data version.');
      return payload.data.vh;
    }).catch(error => { ambrVersionPromise = null; throw error; });
  }
  const version = await ambrVersionPromise;
  const response = await fetch(`${AMBR_API_ROOT}/en/${endpoint}?vh=${encodeURIComponent(version)}`);
  if (!response.ok) throw new Error(`Project Amber returned ${response.status} for ${endpoint}`);
  const payload = await response.json();
  if (!payload || payload.data == null) throw new Error(`Project Amber returned no data for ${endpoint}`);
  return payload.data;
}

function asRecordArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function normalizeAmbrDetail(detail) {
  const upgrade = detail?.upgrade || {};
  const fallbackActive = asRecordArray(detail?.skillTalents).map(talent => ({ ...talent, type: talent.type || talent.unlock || 'Active talent' }));
  const fallbackPassive = asRecordArray(detail?.passiveTalents).map(talent => ({ ...talent, type: 'Passive talent' }));
  const rawTalents = detail?.talent || detail?.talents || [...fallbackActive, ...fallbackPassive];
  return {
    ...detail,
    talents: asRecordArray(rawTalents).map(talent => ({ ...talent, upgrades: asRecordArray(talent?.promote || talent?.upgrades || talent?.upgrade) })),
    constellations: asRecordArray(detail?.constellation || detail?.constellations),
    ascensionMaterials: asRecordArray(detail?.ascension || detail?.ascension_materials),
    upgrade: { ...upgrade, promotes: asRecordArray(upgrade?.promote || upgrade?.promotes) },
  };
}

function normalizeCostItems(value) {
  if (Array.isArray(value)) return value.map(item => ({ id: String(item?.id ?? item?.itemId ?? ''), count: Number(item?.count ?? item?.amount ?? item?.value ?? 0) })).filter(item => item.id && item.count > 0);
  if (value && typeof value === 'object') return Object.entries(value).map(([id, count]) => ({ id: String(id), count: Number(count?.count ?? count?.amount ?? count) || 0 })).filter(item => item.id && item.count > 0);
  return [];
}

function materialNameFor(id, lookup) {
  return lookup?.[String(id)]?.name || lookup?.[String(id)]?.name2 || `Material ID ${id}`;
}

function ElementGlyph({ element, size = 'normal' }) {
  const meta = ELEMENT_META[element] || { icon:'✧', color:'#dbc998', soft:'rgba(219,201,152,.15)' };
  return <span className={`element-glyph ${size}`} style={{'--el-color':meta.color,'--el-soft':meta.soft}}>{meta.icon}</span>;
}

function ProgressBar({ value, max = 100, color = 'gold' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (Number(value) / Number(max)) * 100)) : 0;
  return <div className={`progress-track ${color}`}><span style={{width:`${pct}%`}} /></div>;
}

function StatCard({ icon: Icon, label, value, note, trend, color = 'gold' }) {
  return <div className="stat-card">
    <div className={`stat-icon ${color}`}><Icon size={18} /></div>
    <div className="stat-copy"><div className="eyebrow">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>
    {trend && <div className="stat-trend"><ArrowUpRight size={14}/>{trend}</div>}
  </div>;
}

function CharacterAvatar({ character, size = 'medium' }) {
  const [imageIndex, setImageIndex] = useState(0);
  const imageRoute = String(character?.artworkId || character?.apiSlug || character?.id || '').trim();
  const generatedSplash = imageRoute ? `https://genshin.jmp.blue/characters/${encodeURIComponent(imageRoute)}/gacha-splash` : '';
  const images = [...new Set([character?.dripMarketingImage, character?.imageType === 'gacha-splash' ? character?.image : '', generatedSplash, character?.image, character?.iconImage, character?.portraitImage].filter(Boolean))];
  const currentImage = images[imageIndex] || '';
  useEffect(() => setImageIndex(0), [character?.id, character?.artworkId, character?.apiSlug, character?.dripMarketingImage, character?.image, character?.iconImage, character?.portraitImage]);
  return <div className={`character-avatar ${size}`} style={{'--el-color':(ELEMENT_META[character?.element] || {}).color || '#d9bd76', '--el-soft':(ELEMENT_META[character?.element] || {}).soft || 'rgba(217,189,118,.15)'}}>
    {currentImage ? <img src={currentImage} alt={character?.name ? character.name + ' character artwork' : 'Character artwork'} loading="lazy" onError={() => setImageIndex(index => index + 1)} /> : <div className="avatar-fallback"><ElementGlyph element={character?.element} size="large"/><span>{(character?.name || '?').slice(0,1)}</span></div>}
    <div className="avatar-shade" />
    {[4,5].includes(Number(character?.rarity)) && <div className="avatar-stars" aria-label={Number(character.rarity) + ' star rarity'}>{'★'.repeat(Number(character.rarity))}</div>}
    {character?.owned && <span className="owned-dot"><Check size={10}/></span>}
  </div>;
}

function SectionHeader({ eyebrow, title, subtitle, actions }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function EmptyState({ icon: Icon = Sparkles, title, description, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={23}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export default function App() {
  const [persisted, setPersisted] = useState(loadInitial);
  const [page, setPage] = useState('dashboard');
  const [buildCharacterId, setBuildCharacterId] = useState('');
  const [buildVariantId, setBuildVariantId] = useState('');
  const [buildPlaystyleId, setBuildPlaystyleId] = useState('');
  const [buildSearch, setBuildSearch] = useState('');
  const [buildElement, setBuildElement] = useState('All elements');
  const [mobileNav, setMobileNav] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  useEffect(() => { setBuildVariantId(''); setBuildPlaystyleId(''); }, [buildCharacterId]);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [toast, setToast] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncClock, setSyncClock] = useState(Date.now());
  const [syncError, setSyncError] = useState('');
  const [akashaSyncLoading, setAkashaSyncLoading] = useState(false);
  const [akashaSyncError, setAkashaSyncError] = useState('');
  const [akashaArtifactLoadingId, setAkashaArtifactLoadingId] = useState('');
  const [goodImportMessage, setGoodImportMessage] = useState('');
  const [optimizerCharacterId, setOptimizerCharacterId] = useState('skirk');
  const [optimizerTeamId, setOptimizerTeamId] = useState('');
  const [optimizerResult, setOptimizerResult] = useState(null);
  const [optimizerError, setOptimizerError] = useState('');
  const [dataNotice, setDataNotice] = useState('');
  const [characterFilter, setCharacterFilter] = useState({ search:'', element:'All elements', status:'All characters', role:'All roles' });
  const [materialFilter, setMaterialFilter] = useState('All materials');
  const [newMaterial, setNewMaterial] = useState({ name:'', category:'Other', required:0, owned:0 });
  const [newGoal, setNewGoal] = useState({ title:'', character:'', target:'Level 90', due:'' });
  const [newTeam, setNewTeam] = useState({ name:'My team', slot1:'', slot2:'', slot3:'', slot4:'' });
  const [newMarker, setNewMarker] = useState({ name:'', region:'Mondstadt', type:'Local specialty', note:'' });
  const [mapType, setMapType] = useState('All resources');
  const [mapRegion, setMapRegion] = useState('Mondstadt');
  const [mapCollected, setMapCollected] = useState([]);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [advisorQuestion, setAdvisorQuestion] = useState('');
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [characterDataLoadingId, setCharacterDataLoadingId] = useState('');
  const [characterDataError, setCharacterDataError] = useState('');
  const gameMaterialLookupRef = useRef({});
  const uploadRef = useRef(null);
  const goodUploadRef = useRef(null);

  const characters = persisted.characters;
  const ownedCharacters = characters.filter(c => c.owned);
  const syncNextFetchAt = Number(persisted.enkaNextFetchAt || persisted.enkaSnapshot?.nextFetchAt || 0);
  const syncWaitMs = Math.max(0, syncNextFetchAt - syncClock);
  const progressionPlan = useMemo(() => buildProgressionPlan({ characters, goals: persisted.goals, materials: persisted.materials, goodInventory: persisted.goodInventory }), [characters, persisted.goals, persisted.materials, persisted.goodInventory]);
  const topImportedArtifacts = useMemo(() => [...(persisted.goodInventory?.artifacts || [])].filter(item => Number(item.rarity) === 5).sort((a,b) => Number(b.critValue || 0) - Number(a.critValue || 0)).slice(0,6), [persisted.goodInventory]);
  const optimizerCharacter = characters.find(character => character.id === optimizerCharacterId) || ownedCharacters[0] || characters[0] || null;
  const optimizerTeam = persisted.teams.find(team => team.id === optimizerTeamId) || null;
  const optimizerTeamContainsCharacter = Boolean(optimizerTeam?.characters?.includes(optimizerCharacter?.id));
  const optimizerTeamCharacters = optimizerTeamContainsCharacter ? optimizerTeam.characters.map(id => characters.find(character => character.id === id)).filter(Boolean) : [];
  const saveState = (updater) => setPersisted(prev => typeof updater === 'function' ? updater(prev) : updater);
  useEffect(() => {
    try {
      const characterMap = Object.fromEntries(persisted.characters.map(c => [c.id, c]));
      const standardIds = new Set(STARTER_CHARACTERS.map(c => c.id));
      const extraCharacters = persisted.characters.filter(c => !standardIds.has(c.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({...persisted, characters: characterMap, extraCharacters, lastUpdated: new Date().toISOString()}));
    } catch (e) { console.warn('Local save failed', e); }
  }, [persisted]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const nextFetchAt = Number(persisted.enkaNextFetchAt || persisted.enkaSnapshot?.nextFetchAt || 0);
    const delay = nextFetchAt - Date.now();
    if (!nextFetchAt || delay <= 0) { setSyncClock(Date.now()); return; }
    const timer = setTimeout(() => setSyncClock(Date.now()), delay + 50);
    return () => clearTimeout(timer);
  }, [persisted.enkaNextFetchAt, persisted.enkaSnapshot?.nextFetchAt]);

  const updateCharacter = (id, changes) => saveState(prev => ({...prev, characters:prev.characters.map(c => c.id === id ? {...c,...changes} : c)}));
  const updateAccount = (field, value) => saveState(prev => ({...prev, account:{...prev.account,[field]:value}}));
  const toggleTask = id => saveState(prev => ({...prev, tasks:prev.tasks.map(t => t.id === id ? {...t,done:!t.done} : t)}));
  const openCharacter = async character => {
    setActiveCharacter(character);
    setCharacterDataError('');
    if (character.gameData) return;
    setCharacterDataLoadingId(character.id);
    try {
      let rawDetail;
      if (String(character.id || '').startsWith('traveler-') && !character.apiId) {
        const response = await fetch('https://genshin.jmp.blue/characters/' + encodeURIComponent(character.id) + '?lang=en');
        if (!response.ok) throw new Error('Traveler detail source returned ' + response.status);
        rawDetail = await response.json();
      } else if (character.apiId) {
        rawDetail = await fetchAmbrData('avatar/' + encodeURIComponent(character.apiId));
      } else {
        throw new Error('No detailed API record is available for this character yet.');
      }
      const detail = normalizeAmbrDetail(rawDetail);
      const hasAscension = Object.keys(detail?.ascension_materials || {}).length > 0 || (detail?.upgrade?.promotes || []).length > 0;
      if (!detail || (!hasAscension && !(detail?.talents || []).length)) throw new Error('No talent or ascension details were included.');
      const enriched = { ...character, gameData: detail, gameDataFetchedAt: new Date().toISOString() };
      saveState(prev => ({ ...prev, characters: prev.characters.map(c => c.id === character.id ? { ...c, gameData: detail, gameDataFetchedAt: enriched.gameDataFetchedAt } : c) }));
      setActiveCharacter(prev => prev?.id === character.id ? enriched : prev);
    } catch (error) {
      setCharacterDataError('Could not load detailed game data: ' + error.message + '. Guide links remain available; try again after refreshing the catalogue.');
    } finally {
      setCharacterDataLoadingId(current => current === character.id ? '' : current);
    }
  };
  const navigate = id => { setPage(id); setMobileNav(false); setGlobalSearch(''); };
  const openBuildPage = character => {
    if (!character?.id) return;
    setBuildCharacterId(character.id);
    setActiveCharacter(null);
    setPage('character-build-detail');
    setMobileNav(false);
    setGlobalSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const visibleCharacters = useMemo(() => {
    const search = (characterFilter.search || globalSearch).toLowerCase().trim();
    return characters.filter(c => {
      const searchOk = !search || [c.name,c.element,c.weapon,c.role,c.region].join(' ').toLowerCase().includes(search);
      const elementOk = characterFilter.element === 'All elements' || c.element === characterFilter.element;
      const statusOk = characterFilter.status === 'All characters' || (characterFilter.status === 'Owned' ? c.owned : !c.owned);
      const roleOk = characterFilter.role === 'All roles' || c.role === characterFilter.role;
      return searchOk && elementOk && statusOk && roleOk;
    });
  }, [characters, characterFilter, globalSearch]);

  const buildCatalogCharacters = useMemo(() => {
    const query = buildSearch.toLowerCase().trim();
    return characters.filter(c => {
      const textMatch = !query || [c.name, c.element, c.weapon, c.role].join(' ').toLowerCase().includes(query);
      const elementMatch = buildElement === 'All elements' || c.element === buildElement;
      return textMatch && elementMatch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [characters, buildSearch, buildElement]);
  const buildCharacter = characters.find(c => c.id === buildCharacterId) || null;
  const enkaSavedBuildsForCharacter = buildCharacter ? (persisted.enkaSnapshot?.savedBuilds || []).filter(build => build.characterId === buildCharacter.id) : [];
  const akashaProfilesForCharacter = buildCharacter ? (persisted.akashaSnapshot?.profiles || []).filter(profile => profile.characterId === buildCharacter.id) : [];
  const activeBuildBaseProfile = findCharacterBuildGuide(buildCharacter);
  const buildRoleOptions = getCharacterBuildRoleOptions(activeBuildBaseProfile, buildCharacter);
  const defaultBuildRoleOption = buildRoleOptions.find(option => option.buildCategory === activeBuildBaseProfile?.buildCategory) || buildRoleOptions[0] || null;
  const selectedBuildRoleId = buildVariantId || defaultBuildRoleOption?.id || 'role-main-dps';
  const selectedBuildRoleOption = buildRoleOptions.find(option => option.id === selectedBuildRoleId) || defaultBuildRoleOption;
  const selectedUnreviewedRole = selectedBuildRoleOption?.status === 'adapted' ? selectedBuildRoleOption : null;
  const selectedBuildPlaystyleId = buildPlaystyleId || selectedBuildRoleOption?.playstyles?.[0]?.id || '';
  const selectedBuildPlaystyleOption = selectedBuildRoleOption?.playstyles?.find(style => style.id === selectedBuildPlaystyleId) || selectedBuildRoleOption?.playstyles?.[0] || null;
  const activeBuildProfile = selectedBuildPlaystyleOption?.profile || selectedBuildRoleOption?.profile || activeBuildBaseProfile;
  const activeBuildStats = activeBuildProfile?.stats || null;
  const activeBuildArtifacts = activeBuildProfile?.artifacts?.length ? activeBuildProfile.artifacts : (buildCharacter?.artifact ? [{ name: buildCharacter.artifact, note: 'Saved tracker value only — this is not a ranked or source-verified recommendation.' }] : []);
  const activeBuildWeapons = activeBuildProfile?.weapons?.length ? activeBuildProfile.weapons : (buildCharacter?.weaponName ? [{ name: buildCharacter.weaponName, note: 'Saved tracker value only — check the creator guides for weapon rankings.' }] : []);
  const activeBuildVideo = activeBuildProfile?.featuredVideo || null;
  const goodCharacterRecord = persisted.goodInventory?.characters?.find(item => item.characterId && item.characterId === buildCharacter?.id) || null;
  const goodEquippedWeapons = (persisted.goodInventory?.weapons || []).filter(item => item.characterId && item.characterId === buildCharacter?.id);
  const goodEquippedArtifacts = (persisted.goodInventory?.artifacts || []).filter(item => item.characterId && item.characterId === buildCharacter?.id);

  const materialStats = useMemo(() => persisted.materials.reduce((acc,m) => {
    acc.required += Math.max(0, Number(m.required)||0); acc.owned += Math.max(0, Number(m.owned)||0); acc.missing += Math.max(0,(Number(m.required)||0)-(Number(m.owned)||0)); return acc;
  }, {required:0,owned:0,missing:0}), [persisted.materials]);

  const completeGoals = persisted.goals.filter(g => g.done).length;
  const completedTasks = persisted.tasks.filter(t => t.done).length;
  const advisorOpenGoals = persisted.goals.filter(g => !g.done);
  const advisorMissingMaterials = persisted.materials.filter(m => Number(m.required || 0) > Number(m.owned || 0));
  const advisorTrackedMaterials = persisted.materials.filter(m => Number(m.required || 0) > 0);
  const advisorUnderLevelled = ownedCharacters.filter(c => Number(c.level || 1) < 80).sort((a,b) => Number(a.level || 1) - Number(b.level || 1));

  const addMaterial = (e) => {
    e.preventDefault();
    if (!newMaterial.name.trim()) return;
    const material = { id:`mat-${Date.now()}`, name:newMaterial.name.trim(), category:newMaterial.category, required:Math.max(0,Number(newMaterial.required)||0), owned:Math.max(0,Number(newMaterial.owned)||0), note:'Manually added to your planner' };
    saveState(prev => ({...prev,materials:[...prev.materials,material]})); setNewMaterial({name:'',category:'Other',required:0,owned:0}); setToast('Material added to your inventory');
  };
  const updateMaterial = (id, changes) => saveState(prev => ({...prev, materials:prev.materials.map(m => m.id===id ? {...m,...changes} : m)}));
  const removeMaterial = id => saveState(prev => ({...prev, materials:prev.materials.filter(m => m.id!==id)}));

  const addGoal = (e) => {
    e.preventDefault(); if (!newGoal.title.trim()) return;
    const goal = { id:`goal-${Date.now()}`, title:newGoal.title.trim(), character:newGoal.character, target:newGoal.target, due:newGoal.due, done:false };
    saveState(prev => ({...prev, goals:[goal,...prev.goals]})); setNewGoal({title:'',character:'',target:'Level 90',due:''}); setToast('Progress goal added');
  };
  const addTeam = (e) => {
    e.preventDefault();
    const ids = [newTeam.slot1,newTeam.slot2,newTeam.slot3,newTeam.slot4].filter(Boolean);
    if (!newTeam.name.trim() || ids.length < 2) { setToast('Add a team name and at least two characters'); return; }
    const team = {id:`team-${Date.now()}`,name:newTeam.name.trim(),characters:ids,description:'Custom team saved from your current roster.'};
    saveState(prev => ({...prev, teams:[team,...prev.teams]})); setNewTeam({name:'My team',slot1:'',slot2:'',slot3:'',slot4:''}); setToast('Team saved');
  };
  const deleteTeam = id => saveState(prev => ({...prev, teams:prev.teams.filter(t=>t.id!==id)}));
  const addGoalForCharacter = c => { saveState(prev=>({...prev,goals:[{id:`goal-${Date.now()}`,title:`Build ${c.name}`,character:c.id,target:'Level 90',done:false},...prev.goals]})); setActiveCharacter(null); setToast(`${c.name} added to goals`); };
  const addCharacterMaterialsToPlan = c => {
    const newRows = [
      {id:`mat-${Date.now()}-1`,name:`${c.name} ascension materials`,category:'Character ascension',required:0,owned:0,note:'Enter your exact remaining requirement from the in-game character screen.'},
      {id:`mat-${Date.now()}-2`,name:`${c.name} talent materials`,category:'Talent',required:0,owned:0,note:'Add the specific talent book and boss drops you still need.'},
    ];
    saveState(prev=>({...prev,materials:[...prev.materials,...newRows]})); setActiveCharacter(null); setPage('materials'); setToast('Material checklist created — fill in exact quantities');
  };
  const addMarker = e => {
    e.preventDefault(); if (!newMarker.name.trim()) return;
    const marker = {id:`marker-${Date.now()}`,...newMarker, collected:false};
    saveState(prev=>({...prev,mapMarkers:[marker,...prev.mapMarkers]})); setNewMarker({name:'',region:mapRegion,type:'Local specialty',note:''}); setToast('Personal map marker added');
  };


  async function loadPublicCharacterData() {
    setIsLoadingData(true);
    setDataNotice('');
    try {
      let records = [];
      let source = 'Project Amber';
      let materialPayload = null;
      try {
        const avatarPayload = await fetchAmbrData('avatar');
        materialPayload = await fetchAmbrData('material').catch(() => null);
        const items = avatarPayload?.items || avatarPayload?.data?.items || {};
        records = Object.entries(items).map(([key, item]) => ({ ...item, id: item?.id ?? key }));
        records = records.filter(item => item?.name && Number(item?.rank ?? item?.rarity ?? 0) >= 4 && (item?.weaponType || item?.weapon_type || item?.weapon));
        if (records.length < 70) throw new Error(`The character index returned only ${records.length} usable records.`);
        const itemIndex = materialPayload?.items || materialPayload?.data?.items || {};
        gameMaterialLookupRef.current = Object.fromEntries(Object.entries(itemIndex).map(([key, item]) => [
          String(item?.id ?? key),
          { name: item?.name || item?.name2 || item?.route || `Material ${key}`, icon: item?.icon || item?.iconPath || '' },
        ]));
      } catch (primaryError) {
        const response = await fetch('https://genshin.jmp.blue/characters/all?lang=en');
        if (!response.ok) throw new Error(`Primary character data unavailable (${primaryError.message}) and fallback returned ${response.status}`);
        const raw = await response.json();
        records = (Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([id, value]) => ({ id, ...value })))
          .filter(item => item?.name || item?.title || item?.id);
        source = 'genshin.dev fallback (coverage may be incomplete)';
      }

      // Traveler's element variants are often modelled as separate records by Genshin data providers.
      // Supplement the Project Amber index with public variant entries when missing.
      let travelerSupplement = [];
      try {
        const variantResponse = await fetch('https://genshin.jmp.blue/characters/all?lang=en');
        if (variantResponse.ok) {
          const rawVariants = await variantResponse.json();
          travelerSupplement = (Array.isArray(rawVariants) ? rawVariants : Object.entries(rawVariants || {}).map(([id, value]) => ({ id, ...value })));
        }
      } catch (error) {
        console.warn('Traveler variant supplement unavailable', error);
      }
      const isTravelerRecord = record => {
        const route = slugify(record?.route || record?.id || record?.name);
        const label = String(record?.name || '').trim().toLowerCase();
        return /^(traveler|aether|lumine|playerboy|playergirl)(-|$)/i.test(route) || ['traveler','aether','lumine'].includes(label);
      };
      const travelerIcon = records.find(isTravelerRecord)?.icon || records.find(isTravelerRecord)?.image || '';

      const materialAssociationSources = {};
      const materialSourceTypes = ['talent-book','talent-boss','common-ascension','local-specialties','boss-material'];
      await Promise.all(materialSourceTypes.map(async type => {
        try {
          const response = await fetch('https://genshin.jmp.blue/materials/' + type + '?lang=en');
          if (response.ok) materialAssociationSources[type] = await response.json();
        } catch (error) {
          console.warn('Material reference source unavailable: ' + type, error);
        }
      }));
      const materialGuidesFor = (record, routeKey, displayName) => {
        const ids = new Set([routeKey, slugify(record?.id), slugify(record?.route), slugify(record?.name), slugify(displayName)].filter(Boolean));
        const belongsToCharacter = row => asRecordArray(row?.characters).some(id => ids.has(slugify(id)));
        const guides = [];
        for (const [key, row] of Object.entries(materialAssociationSources['talent-book'] || {})) {
          if (belongsToCharacter(row)) guides.push({ category:'Talent books', name:key, items:asRecordArray(row.items).map(item=>item.name).filter(Boolean), availability:asRecordArray(row.availability).join(', '), domain:row.source || '' });
        }
        for (const [key, row] of Object.entries(materialAssociationSources['talent-boss'] || {})) {
          if (belongsToCharacter(row)) guides.push({ category:'Weekly boss material', name:row.name || key, items:[row.name || key], source:row.source || '' });
        }
        for (const [key, row] of Object.entries(materialAssociationSources['common-ascension'] || {})) {
          if (belongsToCharacter(row)) guides.push({ category:'Common enemy drops', name:key, items:asRecordArray(row.items).map(item=>item.name).filter(Boolean), source:asRecordArray(row.sources).join(', ') });
        }
        for (const [key, row] of Object.entries(materialAssociationSources['boss-material'] || {})) {
          if (belongsToCharacter(row)) guides.push({ category:'Normal boss material', name:row.name || key, items:[row.name || key], source:row.source || '' });
        }
        for (const [region, rows] of Object.entries(materialAssociationSources['local-specialties'] || {})) {
          for (const row of asRecordArray(rows)) if (belongsToCharacter(row)) guides.push({ category:'Local specialty', name:row.name || row.id, items:[row.name || row.id], source:region });
        }
        const seen = new Set();
        return guides.filter(row => {
          const key = row.category + ':' + row.name;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };
      const travelerForms = ['Anemo','Geo','Electro','Dendro','Hydro','Pyro'];
      for (const elementName of travelerForms) {
        const exists = records.some(record => isTravelerRecord(record) && normalizeElement(record.element || record.vision || record.visionType || record.vision_key) === elementName);
        if (exists) continue;
        const variant = travelerSupplement.find(record => {
          const route = slugify(record?.id || record?.route || record?.name);
          return route === 'traveler-' + elementName.toLowerCase();
        });
        if (variant) {
          records.push({
            ...variant,
            id: 'traveler-' + elementName.toLowerCase(),
            route: 'traveler-' + elementName.toLowerCase(),
            name: 'Traveler',
            element: elementName,
            vision: elementName,
            weapon: 'Sword',
            weaponType: 'Sword',
            rarity: 5,
            icon: variant.icon || travelerIcon,
            _catalogSource: 'genshin.dev Traveler variant supplement',
          });
        } else {
          // Keep the element selectable even if the upstream detail record is absent.
          // No unverified talent/material numbers are fabricated for this placeholder.
          records.push({
            id: 'traveler-' + elementName.toLowerCase(),
            route: 'traveler-' + elementName.toLowerCase(),
            name: 'Traveler',
            element: elementName,
            vision: elementName,
            weapon: 'Sword',
            weaponType: 'Sword',
            rarity: 5,
            icon: travelerIcon,
            _catalogSource: 'Traveler variant placeholder — detailed data unavailable',
          });
        }
      }

      if (!records.length) throw new Error('The data source returned no characters.');
      const knownCharacters = characters;
      const mappedRecords = records.map((item, i) => {
        const name = item.name || item.title || item.route || item.id || `Character ${i + 1}`;
        const routeId = item.route || item.id || name;
        const routeKey = slugify(routeId);
        const rawElement = item.element || item.vision || item.visionType || item.vision_key || '';
        const sourceElement = normalizeElement(rawElement);
        const isTraveler = /^(traveler|aether|lumine|playerboy|playergirl)(-|$)/i.test(routeKey) || /^(traveler|aether|lumine)$/i.test(String(name).trim());
        const travelerElement = isTraveler && sourceElement ? sourceElement : '';
        const id = travelerElement ? 'traveler-' + travelerElement.toLowerCase() : routeKey;
        const displayName = travelerElement ? 'Traveler (' + travelerElement + ')' : name;
        const normalizedName = String(displayName).toLowerCase().replace(/[^a-z0-9]/g, '');
        const existing = knownCharacters.find(c =>
          (item.id != null && c.apiId != null && String(c.apiId) === String(item.id)) ||
          c.id === id ||
          (!isTraveler && String(c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName)
        );
        const element = sourceElement || existing?.element || 'Unknown';
        const rawWeapon = item.weaponType || item.weapon_type || item.weapon || '';
        const weapon = normalizeWeapon(rawWeapon) || existing?.weapon || 'Unknown';
        const rawRarity = Number(item.rank ?? item.rarity ?? item.stars ?? 0);
        const rarity = rawRarity === 4 || rawRarity === 5 ? rawRarity : (existing?.rarity || 0);
        const icon = item.icon || item.img?.icon || item.image || '';
        const iconImage = String(icon).startsWith('http') ? String(icon) : ambrAssetUrl(icon);
        const gachaImage = gachaArtworkFromIcon(icon);
        const image = gachaImage || existing?.image || iconImage || `https://genshin.jmp.blue/characters/${id}/portrait`;
        const apiIdValue = String(item.id ?? existing?.apiId ?? '');
        const apiId = apiIdValue.length > 0 && [...apiIdValue].every(char => char >= '0' && char <= '9') ? apiIdValue : (existing?.apiId || '');
        const gameData = existing?.gameData || (item.upgrade || item.skillTalents || item.ascension_materials ? normalizeAmbrDetail(item) : null);
        const materialGuides = materialGuidesFor(item, routeKey, displayName);
        return {
          ...existing,
          id,
          apiId,
          apiSlug: String(item.route || item.id || routeKey),
          name: displayName,
          rawName: name,
          title: item.title || existing?.title || '',
          element,
          weapon,
          rarity,
          role: existing?.role || 'Unassigned',
          region: item.region || item.nation || item.native || existing?.region || 'Unknown',
          owned: existing?.owned ?? false,
          level: existing?.level ?? 1,
          talents: existing?.talents || [1,1,1],
          constellation: existing?.constellation ?? 0,
          image,
          iconImage: iconImage || existing?.iconImage || '',
          portraitImage: existing?.portraitImage || '',
          imageType: gachaImage ? 'gacha-splash' : (iconImage ? 'character-icon-fallback' : 'portrait-fallback'),
          gameData,
          materialGuides: materialGuides.length ? materialGuides : (existing?.materialGuides || []),
          source: item._catalogSource || source,
        };
      });
      const mapped = [...new Map(mappedRecords.map(record => [record.id, record])).values()];
      saveState(prev => ({ ...prev, characters: mergeCharacterCatalogue(prev.characters, mapped) }));
      setDataNotice(`Loaded ${mapped.length} character records from ${source}. Detailed talent and ascension costs load when you open a character profile. Existing owned status, levels, team presets, goals, and inventory were kept.`);
      setToast(`Character catalogue refreshed · ${mapped.length} records`);
    } catch (error) {
      setDataNotice(`Could not refresh the full character catalogue: ${error.message}. Your local records remain available; retry from Settings when the data source is reachable.`);
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    const needsCatalogRefresh = characters.length < 100 || characters.some(c => c.apiId && (!c.imageType || (c.element === 'Unknown') || ![4,5].includes(Number(c.rarity))));
    if (needsCatalogRefresh) loadPublicCharacterData();
  }, []);

  async function syncPublicShowcase() {
    const uid = String(persisted.account.uid || '').trim();
    if (!isValidGenshinUid(uid)) { setSyncError('Enter a valid 9–10 digit Genshin UID first.'); return; }
    if (syncNextFetchAt > Date.now()) {
      setSyncError('Enka.Network asks us to wait until ' + new Date(syncNextFetchAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + ' before requesting this UID again. Your saved data is unchanged.');
      return;
    }
    setSyncLoading(true); setSyncError('');
    try {
      const response = await fetch('/api/enka?uid=' + encodeURIComponent(uid) + '&includeBuilds=1', { headers: { Accept: 'application/json' } });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('The sync endpoint returned a non-JSON response. Confirm the latest Vercel deployment includes the /api/enka function.'); }
      if (!response.ok) throw new Error(data?.error || ('Showcase sync failed with HTTP ' + response.status + '.'));
      if (!data || typeof data !== 'object') throw new Error('The sync endpoint returned an empty response.');
      const ttlSeconds = enkaTtlSeconds(data?.ttl);
      const nextFetchAt = Date.now() + ttlSeconds * 1000;
      saveState(prev => ({...prev, enkaNextFetchAt: nextFetchAt}));
      const info = data.playerInfo || {};
      const rawShowcase = Array.isArray(data.avatarInfoList) ? data.avatarInfoList : [];
      const publicRoster = parseEnkaPublicRoster(info, rawShowcase, characters);
      if (!publicRoster.length) throw new Error('The profile responded, but no public character display-list entries or detailed showcase records were returned. Add characters to your in-game profile display list; enable Character Details if you also want equipped weapons, artifacts and talents.');

      const toNumber = value => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const readLevel = avatar => toNumber(avatar?.propMap?.['4001']?.val ?? avatar?.propMap?.['4001']?.ival ?? avatar?.level);
      const readGear = avatar => {
        const gear = Array.isArray(avatar?.equipList) ? avatar.equipList : [];
        const weapon = gear.find(item => String(item?.flat?.itemType || '').toLowerCase().includes('weapon') || item?.weaponStats || item?.weaponAffixMap);
        const artifacts = gear.filter(item => String(item?.flat?.itemType || '').toLowerCase().includes('reliquary') || item?.reliquaryMainstat || item?.reliquarySubstats);
        const artifactNames = [...new Set(artifacts.map(item => item?.flat?.setName || item?.flat?.name).filter(Boolean))];
        return {
          weapon: weapon?.flat?.name || '',
          weaponLevel: toNumber(weapon?.weapon?.level ?? weapon?.level),
          artifacts: artifacts.map(item => ({
            name: item?.flat?.name || item?.flat?.setName || 'Artifact',
            setName: item?.flat?.setName || '',
            rarity: toNumber(item?.flat?.rankLevel),
            level: Number.isFinite(Number(item?.reliquary?.level)) ? Number(item.reliquary.level) : null,
            mainStat: item?.reliquaryMainstat?.name || '',
            substats: (item?.reliquarySubstats || []).map(stat => ({name:stat?.name || '', value:stat?.statValue ?? stat?.value ?? null})),
          })),
          artifactSummary: artifactNames.join(' / '),
          equipmentCount: gear.length,
        };
      };

      const showcase = rawShowcase.map(avatar => {
        const avatarId = String(avatar?.avatarId ?? avatar?.avatarID ?? '');
        const match = characters.find(character => avatarId && String(character.apiId || '') === avatarId)
          || characters.find(character => avatarId && String(character.id || '') === avatarId);
        const gear = readGear(avatar);
        const talentIds = Array.isArray(avatar?.talentIdList) ? avatar.talentIdList : [];
        const skillLevelMap = avatar?.skillLevelMap && typeof avatar.skillLevelMap === 'object' ? avatar.skillLevelMap : {};
        const talentLevels = Object.entries(skillLevelMap).sort((a,b) => Number(a[0])-Number(b[0])).map(([,value]) => Number(value)).filter(value => Number.isFinite(value) && value > 0);
        return {
          avatarId,
          characterId: match?.id || '',
          name: match?.name || ('Character ID ' + (avatarId || 'unknown')),
          level: readLevel(avatar),
          constellation: Math.min(6, talentIds.length),
          friendship: toNumber(avatar?.fetterInfo?.expLevel),
          talents: talentLevels,
          weapon: gear.weapon,
          weaponLevel: gear.weaponLevel,
          artifacts: gear.artifacts,
          artifactSummary: gear.artifactSummary,
          equipmentCount: gear.equipmentCount,
        };
      });

      const savedBuilds = flattenEnkaSavedBuilds(data.savedBuilds, characters).map(build => {
        // Enka's saved-build payload can wrap game-specific character data under
        // "genshin"; also accept the direct avatar-info shape used by older snapshots.
        const avatar = build.avatarData?.genshin
          || build.avatarData?.avatarInfo
          || build.avatarData?.avatar_info
          || build.avatarData?.avatarData?.genshin
          || build.avatarData
          || {};
        const gear = readGear(avatar);
        const talentIds = Array.isArray(avatar?.talentIdList) ? avatar.talentIdList : [];
        const skillLevelMap = avatar?.skillLevelMap && typeof avatar.skillLevelMap === 'object' ? avatar.skillLevelMap : {};
        const talentLevels = Object.entries(skillLevelMap).sort((a,b) => Number(a[0])-Number(b[0]))
          .map(([,value]) => Number(value)).filter(value => Number.isFinite(value) && value > 0);
        return {
          ...build,
          level: readLevel(avatar),
          constellation: Math.min(6, talentIds.length),
          talents: talentLevels,
          weapon: gear.weapon,
          weaponLevel: gear.weaponLevel,
          artifacts: gear.artifacts,
          artifactSummary: gear.artifactSummary,
          detailsAvailable: Boolean(avatar?.equipList || avatar?.skillLevelMap || avatar?.propMap),
        };
      });

      const snapshot = {
        uid,
        fetchedAt: new Date().toISOString(),
        ttlSeconds,
        nextFetchAt,
        nickname: info.nickname || '',
        level: toNumber(info.level),
        worldLevel: Number.isFinite(Number(info.worldLevel)) ? Number(info.worldLevel) : null,
        achievements: toNumber(info.finishAchievementNum),
        abyssFloor: toNumber(info.towerFloorIndex),
        abyssChamber: toNumber(info.towerLevelIndex),
        profilePictureId: info.profilePicture?.avatarId ?? null,
        signature: String(info.signature || ''),
        namecardId: info.namecardId ?? null,
        showNameCardIds: Array.isArray(info.showNameCardIdList) ? info.showNameCardIdList : [],
        rosterEntries: publicRoster,
        showcase,
        savedBuilds,
        savedBuildsStatus: data.savedBuildsStatus || 'not-requested',
        savedBuildsFetchedAt: data.savedBuildsStatus === 'loaded' ? new Date().toISOString() : null,
        dataSource: 'Enka.Network public Character Showcase and optional public Enka profile builds',
        scope: 'Public display-list entries plus any detailed showcase records enabled by the player; not a complete owned roster or private inventory',
      };

      saveState(prev => {
        const updatedCharacters = prev.characters.map(character => {
          const publicEntry = publicRoster.find(item => item.characterId && item.characterId === character.id);
          const imported = showcase.find(item => item.characterId && item.characterId === character.id);
          let updated = character;
          if (publicEntry) {
            updated = {
              ...updated,
              owned: true,
              ...(publicEntry.level != null ? { level: publicEntry.level } : {}),
            };
          }
          // Only detailed records update the separate live-build snapshot. Basic display-list
          // entries still sync public ownership/level without erasing previously imported gear.
          if (imported) updated = mergeEnkaShowcaseCharacter(updated, imported, snapshot.fetchedAt);
          return updated;
        });
        return {
          ...prev,
          characters: updatedCharacters,
          enkaSnapshot: snapshot,
          account: {
            ...prev.account,
            nickname: info.nickname || prev.account.nickname,
            ar: toNumber(info.level) ?? prev.account.ar,
            worldLevel: Number.isFinite(Number(info.worldLevel)) ? Number(info.worldLevel) : prev.account.worldLevel,
            abyss: snapshot.abyssFloor ? String(snapshot.abyssFloor) + '-' + String(snapshot.abyssChamber || 0) : prev.account.abyss,
          },
        };
      });
      const matched = publicRoster.filter(item => item.characterId).length;
      const detailedCount = showcase.length;
      setToast('Public roster synced · ' + publicRoster.length + ' display-list entries (' + detailedCount + ' detailed), ' + matched + ' matched to your catalogue');
    } catch (e) {
      setSyncError((e?.message || 'Could not fetch the public showcase.') + ' Your saved tracker was not cleared.');
    } finally {
      setSyncLoading(false);
    }
  }

  async function syncAkashaProfile() {
    const uid = String(persisted.account.uid || '').trim();
    if (!isValidGenshinUid(uid)) {
      setAkashaSyncError('Enter a valid 9–10 digit Genshin UID in Account Tracker first.');
      return;
    }
    setAkashaSyncLoading(true);
    setAkashaSyncError('');
    try {
      const response = await fetch('/api/akasha?uid=' + encodeURIComponent(uid), {
        headers: { Accept: 'application/json' },
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('AKASHA returned a non-JSON response. Check that the latest deployment includes /api/akasha.'); }
      if (!response.ok) throw new Error(data?.error || ('AKASHA profile sync failed with HTTP ' + response.status + '.'));
      const profiles = normalizeAkashaProfiles(data?.profiles, uid, characters);
      if (!Array.isArray(data?.profiles)) throw new Error('AKASHA returned an unrecognized profile format. Your previous snapshot was kept.');

      saveState(prev => ({
        ...prev,
        akashaSnapshot: {
          uid,
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          source: data.source || 'AKASHA System public calculation endpoint',
          note: data.note || '',
          profiles,
          artifactsByBuild: prev.akashaSnapshot?.uid === uid ? (prev.akashaSnapshot.artifactsByBuild || {}) : {},
        },
      }));
      setAkashaSyncError('');
      setToast('AKASHA synced · ' + profiles.length + ' character calculation profiles');
    } catch (error) {
      setAkashaSyncError((error?.message || 'Could not sync AKASHA data.') + ' Your existing snapshot and tracker data were not changed.');
    } finally {
      setAkashaSyncLoading(false);
    }
  }

  async function loadAkashaArtifacts(profile) {
    const uid = String(persisted.akashaSnapshot?.uid || '').trim();
    const md5 = String(profile?.md5 || '').trim();
    if (!isValidGenshinUid(uid)) {
      setAkashaSyncError('Sync the AKASHA profile first so artifact lookups use the correct UID.');
      return;
    }
    if (!/^[a-fA-F0-9]{32}$/.test(md5)) {
      setAkashaSyncError('AKASHA did not return a valid build hash for this entry. Refresh the profile and try again.');
      return;
    }
    setAkashaArtifactLoadingId(md5);
    setAkashaSyncError('');
    try {
      const response = await fetch('/api/akasha?uid=' + encodeURIComponent(uid) + '&md5=' + encodeURIComponent(md5), {
        headers: { Accept: 'application/json' },
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('AKASHA returned a non-JSON artifact response.'); }
      if (!response.ok) throw new Error(data?.error || ('AKASHA artifact lookup failed with HTTP ' + response.status + '.'));
      if (!Array.isArray(data?.artifacts)) throw new Error('AKASHA returned an unrecognized artifact format. Your previous artifact data was kept.');
      const artifacts = normalizeAkashaArtifacts(data.artifacts);
      saveState(prev => {
        if (prev.akashaSnapshot?.uid !== uid) return prev;
        return {
          ...prev,
          akashaSnapshot: {
            ...prev.akashaSnapshot,
            artifactsByBuild: {
              ...(prev.akashaSnapshot.artifactsByBuild || {}),
              [md5]: { fetchedAt: data.fetchedAt || new Date().toISOString(), artifacts },
            },
          },
        };
      });
      setToast('AKASHA artifacts synced · ' + artifacts.length + ' pieces');
    } catch (error) {
      setAkashaSyncError((error?.message || 'Could not load AKASHA artifacts.') + ' Previously synced artifact details remain saved.');
    } finally {
      setAkashaArtifactLoadingId('');
    }
  }

  function exportTracker() {
    const payload = {...persisted, exportedAt:new Date().toISOString(), format:'teyvat-companion-backup-v1'};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`teyvat-companion-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setToast('Backup exported');
  }
  function importTrackerObject(obj) {
    if (!obj || typeof obj !== 'object' || (!obj.characters && !obj.account)) { setToast('That file does not look like a Teyvat Companion backup'); return; }
    const importedCharacters = Array.isArray(obj.characters) ? obj.characters : Object.values(obj.characters || {});
    const merged = new Map(STARTER_CHARACTERS.map(c=>[c.id,{...c}]));
    importedCharacters.forEach(c=> { if (c?.id) merged.set(c.id,{...merged.get(c.id),...c}); });
    const base = loadInitial();
    saveState({...base,...obj,characters:[...merged.values()],account:{...base.account,...obj.account},materials:obj.materials || base.materials,teams:obj.teams || base.teams,goals:obj.goals || [],mapMarkers:obj.mapMarkers || [],tasks:obj.tasks || base.tasks});
    setShowImport(false); setImportText(''); setToast('Tracker backup imported');
  }
  function importFromText(e) {
    e.preventDefault(); try { importTrackerObject(JSON.parse(importText)); } catch { setToast('Could not parse JSON. Paste a valid backup file.'); }
  }
  async function importGoodFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setGoodImportMessage('');
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('This file is larger than 15 MB. Export a smaller GOOD inventory file and retry.');
      const imported = parseGoodInventory(await file.text());
      const matchedCharacters = imported.characters.map(item => ({
        ...item,
        characterId: matchGoodCharacterKey(item.key, characters)?.id || '',
      }));
      const matchedWeapons = imported.weapons.map(item => ({
        ...item,
        characterId: item.location ? (matchGoodCharacterKey(item.location, characters)?.id || '') : '',
      }));
      const matchedArtifacts = imported.artifacts.map(item => ({
        ...item,
        characterId: item.location ? (matchGoodCharacterKey(item.location, characters)?.id || '') : '',
      }));
      const inventory = {
        ...imported,
        characters: matchedCharacters,
        weapons: matchedWeapons,
        artifacts: matchedArtifacts,
        summary: { ...imported.summary, matchedCharacters: matchedCharacters.filter(item => item.characterId).length },
      };
      saveState(prev => ({
        ...prev,
        goodInventory: inventory,
        characters: prev.characters.map(character => {
          const item = matchedCharacters.find(entry => entry.characterId && entry.characterId === character.id);
          if (!item) return character;
          return {
            ...character,
            owned: true,
            level: item.level,
            constellation: item.constellation,
            talents: [item.talent.auto, item.talent.skill, item.talent.burst],
            goodInventorySyncedAt: inventory.importedAt,
          };
        }),
      }));
      setGoodImportMessage('Imported GOOD v' + inventory.version + ': ' + inventory.summary.characters + ' characters, ' + inventory.summary.weapons + ' weapons and ' + inventory.summary.artifacts + ' artifacts. Matched ' + inventory.summary.matchedCharacters + ' characters to your catalogue; your planned build fields were preserved.');
      setOptimizerResult(null); setOptimizerError('');
      setToast('GOOD inventory imported');
    } catch (error) {
      setGoodImportMessage('Import failed: ' + (error?.message || 'Could not read this GOOD file.') + ' Your existing inventory and tracker were not changed.');
    } finally {
      event.target.value = '';
    }
  }

  function runArtifactOptimizer() {
    setOptimizerError('');
    setOptimizerResult(null);
    if (!optimizerCharacter) { setOptimizerError('Choose a character first.'); return; }
    const inventory = persisted.goodInventory;
    if (!inventory?.artifacts?.length) { setOptimizerError('Import a GOOD inventory with artifacts before optimizing.'); return; }
    if (optimizerTeamId && !optimizerTeamContainsCharacter) {
      setOptimizerError('That saved team does not contain ' + optimizerCharacter.name + '. Choose a team containing this character, or choose No team context.');
      return;
    }
    const result = optimizeArtifactLoadout({
      character: optimizerCharacter,
      profile: findCharacterBuildGuide(optimizerCharacter),
      artifacts: inventory.artifacts,
      teamCharacters: optimizerTeamCharacters,
      allCharacters: characters,
      topN: 3,
    });
    if (result.error) { setOptimizerError(result.error); return; }
    if (!result.recommendations?.length) { setOptimizerError('No complete five-piece loadout could be found. Check that the imported GOOD file includes all five artifact slots.'); return; }
    setOptimizerResult(result);
  }

  function saveOptimizedPlan(build) {
    const targetId = build?.characterId;
    if (!targetId || !build?.pieces?.length) return;
    const setSummary = build.setBreakdown.map(set => set.count >= 4 ? '4-piece ' + set.label : set.count + '-piece ' + set.label);
    const mainStats = build.pieces.filter(piece => ['sands','goblet','circlet'].includes(piece.slot)).map(piece => formatArtifactStat(piece.mainStatKey)).join(' / ');
    const plannedData = {
      score: build.score,
      calculatedAt: new Date().toISOString(),
      pieces: build.pieces.map(piece => ({
        optimizerId: piece.optimizerId,
        setKey: piece.setKey,
        slotKey: piece.slot,
        mainStatKey: piece.mainStatKey,
        level: piece.level,
        rarity: piece.rarity,
        location: piece.location,
        lock: piece.lock,
        critValue: piece.critValue,
        score: piece.score,
      })),
      setBreakdown: build.setBreakdown,
      teamName: build.teamName,
    };
    saveState(prev => ({
      ...prev,
      characters: prev.characters.map(character => character.id === targetId ? {
        ...character,
        artifact: setSummary.join(' + ') || 'Optimizer-selected artifacts',
        mainStats: mainStats || character.mainStats || '',
        optimizerPlan: plannedData,
      } : character),
    }));
    setToast('Optimized loadout saved as planned build');
  }

  const sidebar = <>
    <div className="brand-lockup"><div className="brand-mark"><Compass size={22}/><span className="brand-spark">✦</span></div><div className="brand-text"><strong>TEYVAT<span> COMPANION</span></strong><small>YOUR ADVENTURE, OPTIMIZED</small></div></div>
    <div className="side-caption">WORKSPACE</div>
    <nav className="primary-nav">{NAV_ITEMS.map(item=>{const Icon=ICONS[item.icon] || Compass;return <button key={item.id} className={`nav-item ${item.id==='builds'?'build-nav':''} ${(page===item.id || (item.id==='builds' && page==='character-build-detail'))?'active':''}`} onClick={()=>navigate(item.id)}><Icon size={18}/><span>{item.label}</span>{item.id==='builds'&&<i className="build-nav-badge">BUILD LAB</i>}{item.id==='materials' && materialStats.missing>0 && <i className="nav-count">{Math.min(99,materialStats.missing)}</i>}</button>;})}</nav>
    <div className="sidebar-spacer"/>
    <div className="side-quest-card"><div className="quest-top"><span className="quest-gem"><Gem size={17}/></span><span className="eyebrow">YOUR NEXT MILESTONE</span></div><strong>{persisted.goals.length ? persisted.goals[0].title : 'Set your next goal'}</strong><p>{persisted.goals.length ? `${persisted.goals.filter(g=>g.done).length} of ${persisted.goals.length} goals complete` : 'Turn your roster into a clear upgrade plan.'}</p><button className="text-action" onClick={()=>navigate('account')}>View progression <ArrowRight size={14}/></button></div>
    <div className="sidebar-bottom"><div className="local-badge"><span className="live-dot"/> <span>Local tracker active</span></div><button className="user-mini" onClick={()=>navigate('settings')}><div className="user-avatar">{(persisted.account.nickname || 'T').slice(0,1).toUpperCase()}</div><div><strong>{persisted.account.nickname || 'Traveler'}</strong><small>Personal workspace</small></div><MoreHorizontal size={18}/></button></div>
  </>;

  const dashboardPage = <div className="page-content">
    <SectionHeader eyebrow={`${new Date().toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()} · ADVENTURE OVERVIEW`} title={`Welcome back${persisted.account.nickname ? `, ${persisted.account.nickname}` : ', Traveler'}.`} subtitle="A little progress each day goes a long way across Teyvat." actions={<><button className="button primary" onClick={()=>navigate('builds')}><BookOpen size={15}/> Character Builds</button><button className="button secondary" onClick={()=>navigate('materials')}><Plus size={16}/> Plan an upgrade</button></>}/>
    <div className="hero-banner">
      <div className="hero-text"><div className="hero-kicker"><Sparkles size={14}/> YOUR ADVENTURE AT A GLANCE</div><h2>Make every resin<br/><em>count.</em></h2><p>See your next best step, keep materials organized, and build a roster that works for you.</p><div className="hero-actions"><button className="button gold" onClick={()=>navigate('account')}>Review account <ArrowRight size={15}/></button><button className="button glass" onClick={()=>navigate('characters')}>Explore characters</button></div></div>
      <div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="hero-ring ring-one"/><div className="hero-ring ring-two"/><div className="hero-symbol">✦</div><div className="hero-landscape"><span/><span/><span/><span/></div><div className="hero-label label-top">ADVENTURE RANK <b>{persisted.account.ar}</b></div><div className="hero-label label-bottom">WORLD LEVEL <b>{persisted.account.worldLevel}</b></div></div>
      <div className="hero-corner">✧</div>
    </div>
    <div className="stats-grid">
      <StatCard icon={Users} label="Characters owned" value={`${ownedCharacters.length} / ${characters.length}`} note="Tracked in your roster" color="violet"/>
      <StatCard icon={PackageOpen} label="Materials missing" value={formatNumber(materialStats.missing)} note={materialStats.required ? `${formatNumber(materialStats.owned)} / ${formatNumber(materialStats.required)} accounted for` : 'Add exact requirements to calculate'} color="blue"/>
      <StatCard icon={Target} label="Active goals" value={persisted.goals.filter(g=>!g.done).length} note={`${completeGoals} completed so far`} color="green"/>
      <StatCard icon={Flame} label="Daily checklist" value={`${completedTasks}/${persisted.tasks.length}`} note="Tasks marked complete" color="orange"/>
    </div>
    <div className="dashboard-grid">
      <div className="panel daily-panel"><div className="panel-head"><div><div className="eyebrow">TODAY'S ROUTE</div><h3>What should I do today?</h3></div><span className="pill muted"><CalendarDays size={13}/> Personal plan</span></div><div className="task-list">{persisted.tasks.map(task=><button key={task.id} className={`task-row ${task.done?'done':''}`} onClick={()=>toggleTask(task.id)}><span className="task-check">{task.done && <Check size={14}/>}</span><span className="task-text"><strong>{task.title}</strong><small>{task.detail}</small></span><ChevronRight size={16} className="task-arrow"/></button>)}</div><button className="button secondary full-width" onClick={()=>navigate('materials')}>Open farming planner <ArrowRight size={15}/></button></div>
      <div className="panel roster-panel"><div className="panel-head"><div><div className="eyebrow">YOUR ROSTER</div><h3>Characters in focus</h3></div><button className="icon-button" aria-label="All characters" onClick={()=>navigate('characters')}><ArrowRight size={17}/></button></div>{ownedCharacters.length ? <div className="mini-roster">{ownedCharacters.slice(0,5).map(c=><button key={c.id} className="mini-character" onClick={()=>openCharacter(c)}><CharacterAvatar character={c}/><span><b>{c.name}</b><small>{c.role || 'Role not set'}</small></span><ChevronRight size={14}/></button>)}</div> : <EmptyState icon={Users} title="Your roster is waiting" description="Mark characters as owned to personalize your dashboard." action={<button className="button secondary" onClick={()=>navigate('characters')}>Add characters</button>}/>}<button className="text-action roster-link" onClick={()=>navigate('characters')}>Manage all characters <ArrowRight size={14}/></button></div>
      <div className="panel material-panel"><div className="panel-head"><div><div className="eyebrow">FARMING SNAPSHOT</div><h3>Material progress</h3></div><button className="icon-button" onClick={()=>navigate('materials')}><ArrowRight size={17}/></button></div><div className="material-progress-copy"><div><strong>{materialStats.required ? `${Math.round(Math.min(1,materialStats.owned/materialStats.required)*100)}%` : '—'}</strong><span>of your entered requirements collected</span></div><span className="material-spark">✧</span></div><ProgressBar value={materialStats.owned} max={materialStats.required || 1}/><div className="material-summary"><div><span className="summary-dot have"/> Owned <strong>{formatNumber(materialStats.owned)}</strong></div><div><span className="summary-dot missing"/> Remaining <strong>{formatNumber(materialStats.missing)}</strong></div></div><p className="helper-note"><Info size={13}/> Quantities are only as accurate as the numbers you enter. This tracker does not guess missing costs.</p></div>
      <div className="panel goal-panel"><div className="panel-head"><div><div className="eyebrow">LONG-TERM PROGRESS</div><h3>Upgrade goals</h3></div><button className="button compact secondary" onClick={()=>navigate('account')}><Plus size={14}/> Add goal</button></div>{persisted.goals.length ? <div className="goal-list">{persisted.goals.slice(0,3).map(g=>{const c=characters.find(ch=>ch.id===g.character);return <div className={`goal-row ${g.done?'done':''}`} key={g.id}><button className="goal-toggle" onClick={()=>saveState(p=>({...p,goals:p.goals.map(x=>x.id===g.id?{...x,done:!x.done}:x)}))}>{g.done&&<Check size={12}/>}</button><div className="goal-info"><strong>{g.title}</strong><small>{c ? c.name+' · ' : ''}{g.target}{g.due ? ' · Due '+g.due : ''}</small></div><span className={`goal-status ${g.done?'complete':''}`}>{g.done?'Done':'In progress'}</span></div>;})}</div> : <EmptyState icon={Target} title="Choose a goal" description="Add a character build, talent target, or weapon upgrade." action={<button className="button secondary" onClick={()=>navigate('account')}>Create first goal</button>}/>}</div>
    </div>
    <div className="footer-note">Teyvat Companion is an unofficial fan-made tracker. Game data and community build advice should be checked against the current game version.</div>
  </div>;

  const charactersPage = <div className="page-content">
    <SectionHeader eyebrow="ROSTER DATABASE" title="Characters" subtitle="Find a character, track their investment, and keep build details in one place." actions={<button className="button secondary" onClick={loadPublicCharacterData} disabled={isLoadingData}>{isLoadingData?<><RefreshCw size={15}/> Refreshing roster…</>:<><RefreshCw size={15}/> Refresh full roster</>}</button>}/>
    {dataNotice && <div className={`notice ${dataNotice.startsWith('Could not')?'warning':'success'}`}><Info size={16}/><span>{dataNotice}</span><button onClick={()=>setDataNotice('')}><X size={15}/></button></div>}
    <div className="filter-toolbar"><div className="search-field"><Search size={16}/><input value={characterFilter.search} onChange={e=>setCharacterFilter(p=>({...p,search:e.target.value}))} placeholder="Search characters, element, role…" /></div><div className="filter-controls"><select aria-label="Filter element" value={characterFilter.element} onChange={e=>setCharacterFilter(p=>({...p,element:e.target.value}))}>{ELEMENTS.map(el=><option key={el}>{el}</option>)}</select><select aria-label="Filter ownership" value={characterFilter.status} onChange={e=>setCharacterFilter(p=>({...p,status:e.target.value}))}><option>All characters</option><option>Owned</option><option>Not owned</option></select><select aria-label="Filter role" value={characterFilter.role} onChange={e=>setCharacterFilter(p=>({...p,role:e.target.value}))}><option>All roles</option>{['Main DPS','Sub DPS','Support','Healer','Shielder'].map(r=><option key={r}>{r}</option>)}</select></div></div>
    <div className="catalogue-meta"><span><strong>{visibleCharacters.length}</strong> characters in view</span><span className="pill muted"><Database size={13}/> {characters.length === STARTER_CHARACTERS.length ? 'Starter catalogue' : 'Expanded catalogue'}</span></div>
    <div className="character-grid">{visibleCharacters.map(c=><button key={c.id} className={`character-card ${c.owned?'is-owned':''}`} onClick={()=>openCharacter(c)}><CharacterAvatar character={c} size="card"/><div className="character-info"><div className="character-topline"><span className="element-label" style={{color:(ELEMENT_META[c.element]||{}).color}}><ElementGlyph element={c.element} size="small"/>{c.element}</span><span className="rarity-stars" aria-label={[4,5].includes(Number(c.rarity)) ? Number(c.rarity)+' star rarity' : 'Rarity data unavailable'}>{[4,5].includes(Number(c.rarity)) ? '★'.repeat(Number(c.rarity)) : 'Rarity N/A'}</span></div><h3>{c.name}</h3><p>{c.weapon || 'Weapon not set'} <span>·</span> {c.role || 'Role not set'}</p><div className="character-bottom"><span className={c.owned?'owned-label':'not-owned-label'}>{c.owned ? <><CheckCircle2 size={12}/> Owned · Lv. {c.level || 1}</> : 'Not owned'}</span><ChevronRight size={15}/></div></div></button>)}</div>
    {visibleCharacters.length===0 && <EmptyState icon={Search} title="No matching characters" description="Try another search term or clear your filters." action={<button className="button secondary" onClick={()=>setCharacterFilter({search:'',element:'All elements',status:'All characters',role:'All roles'})}>Clear filters</button>}/>}
    <div className="source-footnote"><Info size={14}/> The catalogue refreshes from community game-data sources and adds separate Traveler rows for Anemo, Geo, Electro, Dendro, Hydro, and Pyro. Cards use full gacha splash artwork when available, with icon/portrait fallbacks. Elements and rarity are sourced fields; verify material totals in-game if an upstream record is incomplete or behind a patch.</div>
  </div>;


  const characterBuildsPage = <div className="page-content">
    <SectionHeader eyebrow="CHARACTER BUILD LIBRARY" title="Character Builds" subtitle="A dedicated build sheet for every character in your catalogue, with artifact sets, main stats, weapons, talent priorities and creator guides." actions={<><a className="button secondary link-button" href="https://genshin.gg/builds/" target="_blank" rel="noreferrer"><ExternalLink size={15}/> Genshin.gg builds</a><button className="button secondary" onClick={() => navigate('characters')}><Users size={15}/> Manage roster</button></>}/>
    <div className="build-library-intro"><span className="build-library-icon"><BookOpen size={21}/></span><div><strong>Build around the character, not just the weapon.</strong><p>Open any character for a structured quick-reference sheet. IWinToLose Gaming and Zy0x links are included on each page; older reference videos are labelled.</p></div></div>
    <div className="build-catalog-toolbar">
      <label className="build-search-field"><Search size={16}/><input value={buildSearch} onChange={e => setBuildSearch(e.target.value)} placeholder="Search a character, element or role…"/></label>
      <label className="build-element-filter"><Filter size={14}/><select aria-label="Filter build catalogue by element" value={buildElement} onChange={e => setBuildElement(e.target.value)}>{ELEMENTS.map(element => <option key={element}>{element}</option>)}</select></label>
    </div>
    <div className="build-catalogue-meta"><span><strong>{buildCatalogCharacters.length}</strong> build pages</span><span className="pill muted">All catalogue characters</span><span className="build-catalogue-note">Some newer/dynamic entries need a manually reviewed guide profile.</span></div>
    {buildCatalogCharacters.length ? <div className="build-catalog-grid">{buildCatalogCharacters.map(c => {
      const guide = findCharacterBuildGuide(c);
      const artifactName = guide?.artifacts?.[0]?.name || c.artifact || 'Open creator guides for details';
      return <button type="button" key={c.id} className="build-catalog-card" onClick={() => openBuildPage(c)}>
        <CharacterAvatar character={c} size="small"/>
        <div className="build-catalog-card-copy">
          <div className="build-catalog-topline"><span className="element-label" style={{color:(ELEMENT_META[c.element]||{}).color}}><ElementGlyph element={c.element} size="small"/>{c.element || 'Element unknown'}</span><span className="rarity-stars">{[4,5].includes(Number(c.rarity)) ? '★'.repeat(Number(c.rarity)) : 'Rarity N/A'}</span></div>
          <h3>{c.name}</h3><p>{guide?.role || c.role || 'Role not set'} · {c.weapon || 'Weapon unknown'}</p>
          <div className="build-catalog-set"><Layers3 size={13}/><span>{artifactName}</span></div>
          <div className="build-catalog-footer"><span>{guide ? 'Quick reference available' : 'Creator-source lookup'}</span><ArrowRight size={15}/></div>
        </div>
      </button>;
    })}</div> : <EmptyState icon={Search} title="No build pages match" description="Try a different name or element filter." action={<button className="button secondary" onClick={() => {setBuildSearch('');setBuildElement('All elements');}}>Clear filters</button>}/>}
    <p className="source-footnote"><Info size={14}/> The layout is inspired by character build databases. Build profiles are quick-reference notes, not a claim that every weapon is best-in-slot for every team or the latest patch. Use the linked creator guides for current comparisons and rotations.</p>
  </div>;

  const characterBuildDetailPage = <div className="page-content">
    {!buildCharacter ? <EmptyState icon={BookOpen} title="Choose a character" description="Open the Character Builds library to choose a character build page." action={<button className="button primary" onClick={() => navigate('builds')}>Browse character builds <ArrowRight size={15}/></button>}/> : <>
      <button className="build-back-link" onClick={() => navigate('builds')}><ArrowLeft size={15}/> All character builds</button>
      <section className="build-character-hero" style={{'--el-color':(ELEMENT_META[buildCharacter.element]||{}).color || '#d9bd76','--el-soft':(ELEMENT_META[buildCharacter.element]||{}).soft || 'rgba(217,189,118,.15)'}}>
        <div className="build-character-art"><CharacterAvatar character={buildCharacter} size="modal"/></div>
        <div className="build-character-hero-copy">
          <div className="eyebrow">CHARACTER BUILD SHEET</div>
          <div className="build-character-tags"><span className="element-label"><ElementGlyph element={buildCharacter.element}/>{buildCharacter.element || 'Element unknown'}</span><span>{buildCharacter.weapon || 'Weapon unknown'}</span><span>{[4,5].includes(Number(buildCharacter.rarity)) ? '★'.repeat(Number(buildCharacter.rarity)) : 'Rarity N/A'}</span></div>
          <h1>{buildCharacter.name}</h1>
          <p><strong>{activeBuildProfile?.buildCategory || 'Role not reviewed'}</strong>{selectedUnreviewedRole ? ' · experimental role-adapted template' : (activeBuildProfile?.role && activeBuildProfile.role !== activeBuildProfile.buildCategory ? ' · ' + activeBuildProfile.role : '')} · {buildCharacter.region || 'Region not set'}</p>
          <div className="build-hero-status"><span className={activeBuildProfile ? 'build-status-pill' : 'build-status-pill needs-review'}>{activeBuildProfile ? 'Quick reference available' : 'Needs a reviewed build profile'}</span><span>{buildCharacter.owned ? 'Owned · Lv. ' + (buildCharacter.level || 1) : 'Not marked as owned'}</span></div>
          <div className="build-hero-actions"><button className="button primary" onClick={() => {setOptimizerCharacterId(buildCharacter.id);setOptimizerTeamId('');setOptimizerResult(null);setOptimizerError('');navigate('optimizer');}}><Layers3 size={15}/> Optimize artifacts</button><button className="button secondary" onClick={() => addGoalForCharacter(buildCharacter)}><Target size={15}/> Add build goal</button><button className="button secondary" onClick={() => openCharacter(buildCharacter)}><Pencil size={15}/> Edit tracker data</button></div>
        </div>
      </section>

      <div className="build-detail-layout">
        <main className="build-detail-main">
          {selectedUnreviewedRole ? <div className="notice warning build-profile-warning role-adaptation-warning"><Info size={16}/><span><strong>This is a role-adapted template.</strong> It fills the {selectedUnreviewedRole.buildCategory} section so no character is missing a role. The set/stat/talent suggestions are a starting point, not a verified best-in-slot ranking; check the character’s kit and source guide before spending resources.</span></div> : null}
          <section className="panel build-section-panel">
            <div className="build-panel-heading"><div><div className="eyebrow">START HERE</div><h2>{activeBuildProfile?.buildCategory ? activeBuildProfile.buildCategory + ' build' : 'Recommended build'}</h2><p>Recommended role and stats for this character; adjust for your weapon, team and rotation.</p></div><span className="pill muted">Quick reference</span></div>
            {buildCharacter ? <div className="build-role-picker">
              <div className="build-role-picker-heading">
                <span>CHOOSE HOW TO PLAY {buildCharacter.name.toUpperCase()}</span>
                <small>All three roles are available for every character</small>
              </div>
              <div className="build-role-tabs" role="group" aria-label={buildCharacter.name + ' build role'}>
                {buildRoleOptions.map(option => <button
                  type="button"
                  key={option.id}
                  className={selectedBuildRoleId === option.id ? 'build-role-tab active' : 'build-role-tab'}
                  aria-pressed={selectedBuildRoleId === option.id}
                  onClick={() => { setBuildVariantId(option.id); setBuildPlaystyleId(option.playstyles?.[0]?.id || ''); }}
                >
                  <strong>{option.buildCategory}</strong>
                  <small>{option.status === 'adapted' ? 'Experimental template' : option.buildCategory === activeBuildBaseProfile?.buildCategory ? 'Recommended role' : 'Alternate build'}</small>
                </button>)}
              </div>
              {selectedBuildRoleOption?.playstyles?.length > 1 ? <label htmlFor="build-playstyle-select">BUILD VARIANT / PLAYSTYLE
                <select id="build-playstyle-select" value={selectedBuildPlaystyleId} onChange={e => setBuildPlaystyleId(e.target.value)}>
                  {selectedBuildRoleOption.playstyles.map(style => <option value={style.id} key={style.id}>{style.label}</option>)}
                </select>
              </label> : null}
              {activeBuildProfile?.sourceNote ? <p>{activeBuildProfile.sourceNote}</p> : null}
            </div> : null}
            {activeBuildStats ? <div className="build-mainstats-grid">{[['Sands', activeBuildStats.sands], ['Goblet', activeBuildStats.goblet], ['Circlet', activeBuildStats.circlet]].map(([label, value]) => <div className="build-mainstat-tile" key={label}><span>{label}</span><strong>{value || 'Check current creator guide'}</strong></div>)}</div> : <div className="build-unavailable"><Info size={16}/><span>Main-stat recommendations are not curated for this character yet. Check the character-specific creator guide before farming.</span></div>}
            {activeBuildProfile?.substats?.length ? <div className="build-substats"><span className="build-section-label">SUBSTAT PRIORITY</span><div className="build-chip-row">{activeBuildProfile.substats.map((stat, index) => <span key={stat} className="build-priority-chip"><b>{index + 1}</b>{stat}</span>)}</div></div> : null}
            {activeBuildProfile?.playstyle && <div className="build-tip-box"><Sparkles size={17}/><p>{activeBuildProfile.playstyle}</p></div>}
          </section>

          <div className="build-two-col">
            <section className="panel build-section-panel">
              <div className="build-panel-heading"><div><div className="eyebrow">ARTIFACTS</div><h2>Artifact sets</h2></div><Layers3 size={18}/></div>
              {activeBuildArtifacts.length ? <div className="build-option-list">{activeBuildArtifacts.map((item, index) => <div className="build-option-row" key={item.name}><span className="build-option-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><p>{item.note || 'Compare this set with the character’s linked creator guides.'}</p></div></div>)}</div> : <p className="build-empty-copy">No artifact set has been saved or reviewed for this character yet.</p>}
            </section>
            <section className="panel build-section-panel">
              <div className="build-panel-heading"><div><div className="eyebrow">WEAPON OPTIONS</div><h2>Weapons to compare</h2></div><Gem size={18}/></div>
              {activeBuildWeapons.length ? <div className="build-option-list">{activeBuildWeapons.map((item, index) => <div className="build-option-row" key={item.name}><span className="build-option-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><p>{item.note || 'Compare ranking, passive uptime and team energy needs in the current creator guide.'}</p></div></div>)}</div> : <p className="build-empty-copy">Weapon rankings have not been reviewed for this character. Avoid treating an empty list as a sign that there are no good options.</p>}
            </section>
          </div>

          <section className="panel build-section-panel">
            <div className="build-panel-heading"><div><div className="eyebrow">TALENT INVESTMENT</div><h2>Talent priority</h2></div><Activity size={18}/></div>
            {activeBuildProfile?.talentOrder?.length ? <div className="build-talent-priority">{activeBuildProfile.talentOrder.map((talent, index) => <div className="build-talent-step" key={talent}><span>{index + 1}</span><strong>{talent}</strong>{index < activeBuildProfile.talentOrder.length - 1 && <ChevronRight size={15}/>}</div>)}</div> : <p className="build-empty-copy">Talent priority has not been reviewed for this character. Use the latest creator guide and consider which talent deals most of your actual team’s damage.</p>}
            {activeBuildProfile?.teamFocus && <div className="build-team-focus"><div className="eyebrow">TEAM-BUILDING NOTE</div><p>{activeBuildProfile.teamFocus}</p><button className="text-action" onClick={() => navigate('teams')}>Open team builder <ArrowRight size={13}/></button></div>}
          </section>

          {buildCharacter.enkaBuild && <section className="panel build-section-panel build-synced-profile">
            <div className="build-panel-heading"><div><div className="eyebrow">PUBLIC ACCOUNT SYNC</div><h2>Currently equipped showcase build</h2><p>Imported from Enka.Network; separate from your manually planned build.</p></div><span className="pill muted"><RefreshCw size={12}/> Synced</span></div>
            <div className="build-synced-grid">
              <div><span>Showcase level</span><strong>{buildCharacter.enkaBuild.level || 'Not returned'}</strong></div>
              <div><span>Constellation</span><strong>{buildCharacter.enkaBuild.constellation == null ? 'Not returned' : 'C' + buildCharacter.enkaBuild.constellation}</strong></div>
              <div><span>Equipped weapon</span><strong>{buildCharacter.enkaBuild.weapon || 'Not returned'}</strong>{buildCharacter.enkaBuild.weaponLevel ? <small>Lv. {buildCharacter.enkaBuild.weaponLevel}</small> : null}</div>
              <div><span>Friendship</span><strong>{buildCharacter.enkaBuild.friendship ?? 'Not returned'}</strong></div>
            </div>
            {buildCharacter.enkaBuild.artifacts?.length ? <div className="build-synced-artifacts"><div className="build-section-label">EQUIPPED ARTIFACTS</div>{buildCharacter.enkaBuild.artifacts.map((artifact, index) => <div className="build-synced-artifact" key={artifact.name + '-' + index}><div><strong>{artifact.name}</strong><small>{artifact.rarity ? artifact.rarity + '★' : 'Rarity unknown'}{artifact.level != null ? ' · +' + artifact.level : ''}</small></div>{artifact.mainStat ? <span>{artifact.mainStat}</span> : null}{artifact.substats?.length ? <small>{artifact.substats.map(stat => stat.name + (stat.value != null ? ' ' + stat.value : '')).join(' · ')}</small> : null}</div>)}</div> : <p className="build-empty-copy">Artifact details were not returned by the public source for this character.</p>}
            {buildCharacter.enkaBuild.talentLevels?.length ? <p className="helper-note"><Info size={13}/> Raw talent level values from the showcase: {buildCharacter.enkaBuild.talentLevels.join(' / ')}. The source order is preserved rather than guessed into Normal / Skill / Burst.</p> : null}
            {buildCharacter.enkaBuild.syncedAt ? <p className="build-video-note">Last synced {new Date(buildCharacter.enkaBuild.syncedAt).toLocaleString()}</p> : null}
          </section>}
          {enkaSavedBuildsForCharacter.length > 0 && <section className="panel build-section-panel build-synced-profile enka-saved-builds-panel">
            <div className="build-panel-heading"><div><div className="eyebrow">PUBLIC ENKA PROFILE SYNC</div><h2>Saved builds from Enka.Network</h2><p>These are profile snapshots supplied by the public Enka account, separate from your live showcase gear and planned build.</p></div><span className="pill muted"><Database size={12}/> {enkaSavedBuildsForCharacter.length} build(s)</span></div>
            <div className="showcase-id-list">{enkaSavedBuildsForCharacter.map((build,index)=><details key={build.id+'-'+index} className="showcase-character-detail">
              <summary>{build.name} · {build.live ? 'Live snapshot' : 'Saved build'}{build.level ? ' · Lv. '+build.level : ''}</summary>
              <div className="showcase-detail-content">
                {build.weapon && <p><strong>Weapon:</strong> {build.weapon}{build.weaponLevel ? ' · Lv. '+build.weaponLevel : ''}</p>}
                {build.artifacts?.length > 0 && <div><strong>Artifacts</strong>{build.artifacts.map((artifact,j)=><div key={j} className="showcase-artifact-row"><span>{artifact.name}{artifact.level != null ? ' · +'+artifact.level : ''}{artifact.rarity ? ' · '+artifact.rarity+'★' : ''}</span>{artifact.mainStat && <small>Main stat: {artifact.mainStat}</small>}{artifact.substats?.length > 0 && <small>Substats: {artifact.substats.map(stat=>stat.name+(stat.value!=null?' '+stat.value:'')).join(' · ')}</small>}</div>)}</div>}
                {build.talents?.length > 0 && <p><strong>Raw talent levels:</strong> {build.talents.join(' / ')} <small>(source skill order retained)</small></p>}
                {!build.detailsAvailable && <p>The saved build is listed by name, but its character data was not in a shape this version could parse into equipped gear. Account Tracker preserves the provider payload in your local snapshot and JSON backup.</p>}
                {build.image && <p><a href={build.image} target="_blank" rel="noreferrer">Open saved-build image <ExternalLink size={12}/></a></p>}
              </div>
            </details>)}</div>
            <p className="helper-note"><Info size={13}/> A Live snapshot reflects the last refresh performed by the Enka profile owner and may be stale. Only publicly available builds are imported; this does not connect to a HoYoverse login.</p>
          </section>}
          {akashaProfilesForCharacter.length > 0 && <section className="panel build-section-panel build-synced-profile akasha-character-panel">
            <div className="build-panel-heading"><div><div className="eyebrow">AKASHA SYSTEM · PUBLIC DATA</div><h2>Leaderboard & artifact snapshot</h2><p>Rankings available for this character from your last AKASHA sync.</p></div><span className="pill muted">{akashaProfilesForCharacter.length} profile record(s)</span></div>
            {akashaProfilesForCharacter.map((profile,index) => {
              const artifactBundle = persisted.akashaSnapshot?.artifactsByBuild?.[profile.md5];
              return <div className="akasha-character-build" key={profile.id + '-' + index}>
                <h3>{profile.name}</h3>
                {profile.artifactSets.length > 0 && <p className="build-video-note">Artifact sets: {profile.artifactSets.map(set => set.name + (set.count != null ? ' (' + set.count + ' pc)' : '')).join(' · ')}</p>}
                <div className="akasha-calculation-list">{profile.calculations.map(calc=><div className="akasha-calculation-row" key={calc.id}><div><strong>{calc.name}</strong><p>{calc.weapon.name || 'Weapon data unavailable'}{calc.weapon.rarity ? ' · ' + calc.weapon.rarity + '★' : ''}</p></div><div className="akasha-rank-metrics">{calc.topPercent != null && <strong>Top {calc.topPercent.toFixed(2)}%</strong>}{calc.ranking != null && calc.outOf != null && <small>#{calc.ranking.toLocaleString()} / {calc.outOf.toLocaleString()}</small>}{calc.result != null && <small>Score / result: {Math.round(calc.result).toLocaleString()}</small>}</div>{calc.id > 0 && <a href={'https://akasha.cv/leaderboards/' + calc.id} target="_blank" rel="noreferrer" className="text-action">Leaderboard <ExternalLink size={12}/></a>}</div>)}</div>
                <button type="button" className="button secondary compact" disabled={!/^[a-fA-F0-9]{32}$/.test(profile.md5) || akashaArtifactLoadingId === profile.md5} onClick={() => loadAkashaArtifacts(profile)}>{akashaArtifactLoadingId === profile.md5 ? <><RefreshCw className="spin" size={13}/> Loading artifacts…</> : <><Layers3 size={14}/>{artifactBundle ? 'Refresh artifact details' : 'Load artifact details'}</>}</button>
                {artifactBundle && <AkashaArtifactList artifacts={artifactBundle.artifacts}/>}
              </div>;
            })}
            <p className="helper-note"><Info size={13}/> AKASHA build data is imported as a public snapshot and does not replace your planned build or Enka showcase equipment.</p>
          </section>}
          {(goodCharacterRecord || goodEquippedWeapons.length || goodEquippedArtifacts.length) && <section className="panel build-section-panel build-synced-profile good-character-inventory-panel">
            <div className="build-panel-heading"><div><div className="eyebrow">GOOD INVENTORY IMPORT</div><h2>Imported account gear</h2><p>From your latest GOOD file, not scraped or guessed.</p></div><span className="pill muted"><Database size={12}/> Local import</span></div>
            {goodCharacterRecord && <div className="build-synced-grid"><div><span>Imported character level</span><strong>Lv. {goodCharacterRecord.level}</strong></div><div><span>Constellation</span><strong>C{goodCharacterRecord.constellation}</strong></div><div><span>Talents (A / E / Q)</span><strong>{goodCharacterRecord.talent.auto} / {goodCharacterRecord.talent.skill} / {goodCharacterRecord.talent.burst}</strong></div><div><span>GOOD ascension stage</span><strong>{goodCharacterRecord.ascension}</strong></div></div>}
            {goodEquippedWeapons.length>0&&<div className="build-synced-artifacts"><div className="build-section-label">WEAPONS ASSIGNED IN IMPORT</div>{goodEquippedWeapons.map((weapon,index)=><div className="good-artifact-row" key={weapon.key+'-'+index}><div className="build-option-index">{index+1}</div><div className="good-artifact-copy"><strong>{humanizeGameKey(weapon.key)}</strong><small>Lv. {weapon.level} · Refinement {weapon.refinement}{weapon.lock?' · Locked':''}</small></div></div>)}</div>}
            {goodEquippedArtifacts.length>0&&<div className="build-synced-artifacts"><div className="build-section-label">ARTIFACTS ASSIGNED IN IMPORT</div>{goodEquippedArtifacts.map((artifact,index)=><div className="good-artifact-row" key={artifact.setKey+'-'+artifact.slotKey+'-'+index}><div className="build-option-index">{index+1}</div><div className="good-artifact-copy"><strong>{humanizeGameKey(artifact.setKey)} · {humanizeGameKey(artifact.slotKey)}</strong><small>{humanizeGameKey(artifact.mainStatKey)} main stat · +{artifact.level} · {artifact.rarity}★{artifact.lock?' · Locked':''}</small><small>{artifact.substats.map(stat=>humanizeGameKey(stat.key)+': '+stat.value).join(' · ')}</small></div><span className="good-artifact-cv">{Number(artifact.critValue||0).toFixed(1)} CV</span></div>)}</div>}
            <p className="helper-note"><Info size={13}/> GOOD import shows gear that the export associates with this character. Generic CRIT Value helps sort pieces but is not a team-aware optimizer score. Re-import after scanning for the latest inventory.</p>
          </section>}
          {buildCharacter.optimizerPlan && <section className="panel build-section-panel saved-optimizer-plan">
            <div className="build-panel-heading"><div><div className="eyebrow">SAVED OPTIMIZER RESULT</div><h2>Planned artifact loadout</h2><p>{buildCharacter.optimizerPlan.teamName ? 'Team context: '+buildCharacter.optimizerPlan.teamName : 'General character build'} · Saved {buildCharacter.optimizerPlan.calculatedAt ? new Date(buildCharacter.optimizerPlan.calculatedAt).toLocaleString() : 'previously'}</p></div><span className="optimizer-saved-score">{Number(buildCharacter.optimizerPlan.score || 0).toFixed(1)}<small>FIT</small></span></div>
            <div className="optimizer-saved-piece-grid">{(buildCharacter.optimizerPlan.pieces || []).map(piece=><div className="optimizer-saved-piece" key={piece.optimizerId}><span>{humanizeGameKey(piece.slotKey)}</span><strong>{humanizeGameKey(piece.setKey)}</strong><small>{formatArtifactStat(piece.mainStatKey)} · +{piece.level} · {piece.rarity}★</small>{piece.location && piece.location!==buildCharacter.name && <em>Imported location: {piece.location}</em>}</div>)}</div>
            {buildCharacter.optimizerPlan.setBreakdown?.length>0 && <div className="optimizer-saved-set-notes">{buildCharacter.optimizerPlan.setBreakdown.map(set=><span key={set.key}>{set.count} pc {set.label}</span>)}</div>}
            <p className="helper-note"><Info size={13}/> This is the loadout you saved from the optimizer. It has not equipped items in-game or changed artifact locks. Re-run the optimizer after importing a newer inventory.</p>
            <button className="button secondary" onClick={() => {setOptimizerCharacterId(buildCharacter.id);setOptimizerTeamId('');setOptimizerResult(null);setOptimizerError('');navigate('optimizer');}}><RefreshCw size={14}/> Recalculate for this character</button>
          </section>}
          <section className="panel build-section-panel build-saved-profile">
            <div className="build-panel-heading"><div><div className="eyebrow">YOUR ACCOUNT</div><h2>Saved tracker values</h2></div><button className="text-action" onClick={() => openCharacter(buildCharacter)}>Edit <Pencil size={12}/></button></div>
            <div className="build-saved-grid"><div><span>Weapon</span><strong>{buildCharacter.weaponName || 'Not set'}</strong></div><div><span>Artifact set</span><strong>{buildCharacter.artifact || 'Not set'}</strong></div><div><span>Saved main stats</span><strong>{buildCharacter.mainStats || 'Not set'}</strong></div><div><span>Personal notes</span><strong>{buildCharacter.notes || 'No notes saved'}</strong></div></div>
            <p className="helper-note"><Info size={13}/> These are your local tracker values and are separate from the quick-reference recommendations above.</p>
          </section>
        </main>

        <aside className="build-detail-side">
          <section className="panel build-video-panel">
            <div className="build-panel-heading"><div><div className="eyebrow">WATCH & VERIFY</div><h2>Creator guide</h2></div><PlayCircle size={19}/></div>
            {activeBuildVideo ? <><div className="build-video-frame"><iframe title={activeBuildVideo.title} src={'https://www.youtube-nocookie.com/embed/' + activeBuildVideo.id + (activeBuildVideo.start ? '?start=' + activeBuildVideo.start + '&rel=0' : '?rel=0')} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div><h3 className="build-video-title">{activeBuildVideo.title}</h3><div className="build-video-meta">{activeBuildVideo.creator} · {activeBuildVideo.era}</div><a className="build-watch-link" href={'https://www.youtube.com/watch?v=' + activeBuildVideo.id + (activeBuildVideo.start ? '&t=' + activeBuildVideo.start + 's' : '')} target="_blank" rel="noreferrer">Open video on YouTube <ExternalLink size={13}/></a><span className="build-video-caveat">Video date: {activeBuildVideo.era}. Treat older guides as historical references and verify modern characters, weapons and artifact options.</span></> : <div className="build-video-search-empty"><span className="build-play-icon"><PlayCircle size={27}/></span><strong>No direct video is mapped for this character yet.</strong><p>Use the creator-specific search below to find a relevant guide without inventing a video link.</p></div>}
            <div className="build-creator-searches">{CREATOR_CHANNELS.map(channel => <a key={channel.handle} href={youtubeSearch(buildCharacter.name + ' build artifacts weapons teams', channel.name)} target="_blank" rel="noreferrer"><span className="build-creator-avatar">{channel.name === 'Zy0x' ? 'Z' : 'IW'}</span><span><strong>{channel.name}</strong><small>Find this character’s build guide</small></span><ExternalLink size={14}/></a>)}<a className="build-database-link" href="https://genshin.gg/builds/" target="_blank" rel="noreferrer"><span className="build-creator-avatar">G</span><span><strong>Genshin.gg build database</strong><small>Compare weapon, artifact and main-stat baseline</small></span><ExternalLink size={14}/></a><a className="build-database-link" href={persisted.account.uid ? 'https://akasha.cv/profile/' + encodeURIComponent(persisted.account.uid) : 'https://akasha.cv/profiles'} target="_blank" rel="noreferrer"><span className="build-creator-avatar">A</span><span><strong>AKASHA profile & ranking</strong><small>Compare this character if it appears on your public profile</small></span><ExternalLink size={14}/></a></div>
            <p className="build-video-note"><Info size={13}/> Some linked videos are older references. Check the upload date and current patch, then compare weapons, team rotations and Energy Recharge needs before spending resources.</p>
          </section>
          <section className="panel build-source-panel">
            <div className="eyebrow">DATA CONFIDENCE</div><h3>{selectedUnreviewedRole ? 'Role-adapted starting template' : 'Character-specific build profile'}</h3>
            <p>{selectedUnreviewedRole ? 'This section ensures every character has Main DPS, Sub DPS and Support options. The template is labeled experimental because this role is not individually curated for this character; verify its scaling, artifact effects, weapon passive and talent order before farming.' : 'This is a character-specific quick-reference profile, not a universal best-in-slot ranking. Compare it against current Zy0x / IWTL content and the linked character guide before spending resources.'}</p>
            <div className="build-source-mini"><span><Database size={13}/> Game catalogue</span><span><BookOpen size={13}/> Build reference</span><span><PlayCircle size={13}/> Creator video/search</span><a href={activeBuildProfile?.sourceUrl || activeBuildBaseProfile?.sourceUrl || 'https://genshin.gg/builds/'} target="_blank" rel="noreferrer"><ExternalLink size={13}/> {activeBuildProfile?.sourceName || 'Genshin.gg / source reference'}</a></div>
          </section>
        </aside>
      </div>
    </>}
  </div>;

  const teamsPage = <div className="page-content">
    <SectionHeader eyebrow="SYNERGY WORKSHOP" title="Builds & Teams" subtitle="Save team presets and compare recommendations against the characters you actually own." actions={<a className="button secondary link-button" href="https://keqingmains.com/" target="_blank" rel="noreferrer"><ExternalLink size={15}/> KeqingMains guides</a>}/>
    <div className="team-builder-layout"><div className="panel builder-panel"><div className="panel-head"><div><div className="eyebrow">TEAM COMPOSER</div><h3>Create a team preset</h3></div><span className="pill muted">Up to 4 slots</span></div><form onSubmit={addTeam} className="team-form"><label className="field-label">Team name<input value={newTeam.name} onChange={e=>setNewTeam(p=>({...p,name:e.target.value}))} placeholder="e.g. Abyss second half" required/></label><div className="team-slots">{[1,2,3,4].map(n=><div className="team-slot" key={n}><span className="slot-number">0{n}</span><label>{n===1?'Main carry':n===2?'Sub-DPS':'Support / flex'}<select value={newTeam[`slot${n}`]} onChange={e=>setNewTeam(p=>({...p,[`slot${n}`]:e.target.value}))}><option value="">Choose character</option>{characters.map(c=><option value={c.id} key={c.id}>{c.name}{c.owned?' · Owned':''}</option>)}</select></label></div>)}</div><p className="helper-note"><Info size={13}/> Include at least two characters. The builder saves your lineup; it does not calculate exact damage or guarantee an optimal rotation.</p><button className="button primary full-width" type="submit"><Plus size={16}/> Save team preset</button></form></div><div className="panel synergy-panel"><div className="eyebrow">TEAM CHECK</div><h3>Build with intention</h3><div className="synergy-tip"><span className="tip-icon hydro"><Zap size={17}/></span><div><strong>Elemental reactions</strong><p>Check whether your elements can trigger the reaction your main damage dealer wants.</p></div></div><div className="synergy-tip"><span className="tip-icon violet"><Activity size={17}/></span><div><strong>Energy & rotation</strong><p>Make sure teammates can charge expensive Bursts in the order you plan to use them.</p></div></div><div className="synergy-tip"><span className="tip-icon green"><ShieldCheck size={17}/></span><div><strong>Comfort counts</strong><p>A healer, shield, or interruption-resistance option can outperform a paper-DPS upgrade in real play.</p></div></div><div className="synergy-disclaimer"><Info size={13}/> These are checklist principles, not live team-ranking calculations.</div></div></div>
    <div className="team-section-head"><div><div className="eyebrow">SAVED LINEUPS</div><h2>Your teams</h2></div><span className="pill muted">{persisted.teams.length} presets</span></div>
    <div className="saved-team-grid">{persisted.teams.map(team=>{const lineup=team.characters.map(id=>characters.find(c=>c.id===id)).filter(Boolean);return <div className="saved-team-card" key={team.id}><div className="saved-team-header"><div><span className="team-label">TEAM PRESET</span><h3>{team.name}</h3></div><button className="icon-button danger" onClick={()=>deleteTeam(team.id)} title="Delete team"><Trash2 size={15}/></button></div><div className="team-lineup">{lineup.map(c=><button key={c.id} title={c.name} onClick={()=>openCharacter(c)}><CharacterAvatar character={c} size="small"/><span>{c.name}</span></button>)}{lineup.length<4&&Array.from({length:4-lineup.length}).map((_,i)=><div key={i} className="empty-slot"><Plus size={17}/><span>Open slot</span></div>)}</div><p>{team.description}</p><div className="team-card-bottom"><span>{lineup.filter(c=>c.owned).length} / {lineup.length} owned</span><button className="text-action" onClick={()=>{setNewTeam({name:team.name+' copy',slot1:team.characters[0]||'',slot2:team.characters[1]||'',slot3:team.characters[2]||'',slot4:team.characters[3]||''});window.scrollTo({top:0,behavior:'smooth'});}}>Duplicate <ArrowRight size={13}/></button></div></div>;})}</div>
  </div>;

  const materialsPage = <div className="page-content">
    <SectionHeader eyebrow="INVENTORY & RESIN PLANNING" title="Materials & Farming" subtitle="Track exact required and owned amounts, then work through your missing materials." actions={<button className="button secondary" onClick={exportTracker}><Download size={15}/> Export tracker</button>}/>
    <div className="material-hero-strip"><div className="material-hero-icon"><PackageOpen size={24}/></div><div className="material-hero-copy"><h3>Your farming board</h3><p>Enter quantities from the in-game upgrade screen. Missing amounts and completion update automatically.</p></div><div className="material-hero-total"><small>TOTAL TO COLLECT</small><strong>{formatNumber(materialStats.missing)}</strong><span>units remaining</span></div></div>
    <div className="material-stats-row"><div className="material-stat"><span>Tracked materials</span><strong>{persisted.materials.length}</strong></div><div className="material-stat"><span>Total owned</span><strong>{formatNumber(materialStats.owned)}</strong></div><div className="material-stat"><span>Total required</span><strong>{formatNumber(materialStats.required)}</strong></div><div className="material-stat"><span>Checklist progress</span><strong>{materialStats.required?`${Math.round(Math.min(1,materialStats.owned/materialStats.required)*100)}%`:'—'}</strong></div></div>
    <div className="panel material-table-panel"><div className="panel-head"><div><div className="eyebrow">YOUR INVENTORY</div><h3>Material checklist</h3></div><div className="table-tools"><div className="select-with-icon"><Filter size={14}/><select value={materialFilter} onChange={e=>setMaterialFilter(e.target.value)}><option>All materials</option>{[...new Set(persisted.materials.map(m=>m.category))].map(cat=><option key={cat}>{cat}</option>)}</select></div></div></div><div className="material-table-wrap"><table className="material-table"><thead><tr><th>Material</th><th>Category</th><th>Required</th><th>Owned</th><th>Missing</th><th>Progress</th><th></th></tr></thead><tbody>{persisted.materials.filter(m=>materialFilter==='All materials'||m.category===materialFilter).map(m=>{const req=Number(m.required)||0, have=Number(m.owned)||0, missing=Math.max(0,req-have);return <tr key={m.id}><td><div className="material-name-cell"><span className={`material-token ${slugify(m.category)}`}><Gem size={15}/></span><div><strong>{m.name}</strong><small>{m.note || 'Custom inventory item'}</small></div></div></td><td><span className="category-chip">{m.category}</span></td><td><input className="quantity-input" type="number" min="0" value={m.required} onChange={e=>updateMaterial(m.id,{required:Math.max(0,Number(e.target.value)||0)})} aria-label={`${m.name} required`}/></td><td><input className="quantity-input" type="number" min="0" value={m.owned} onChange={e=>updateMaterial(m.id,{owned:Math.max(0,Number(e.target.value)||0)})} aria-label={`${m.name} owned`}/></td><td><strong className={missing?'missing-number':'complete-number'}>{formatNumber(missing)}</strong></td><td><div className="table-progress"><ProgressBar value={have} max={req || 1} color={missing===0&&req>0?'green':'gold'}/><small>{req>0?`${Math.round(Math.min(1,have/req)*100)}%`:'Set required'}</small></div></td><td><button className="icon-button danger tiny" onClick={()=>removeMaterial(m.id)} title="Remove material"><Trash2 size={14}/></button></td></tr>;})}</tbody></table>{persisted.materials.filter(m=>materialFilter==='All materials'||m.category===materialFilter).length===0&&<EmptyState icon={PackageOpen} title="No materials in this category" description="Add one below or choose another category."/>}</div><div className="table-footer"><span><Info size={13}/> Empty requirement quantities intentionally stay at zero until you enter verified costs.</span><span>{persisted.materials.length} rows</span></div></div>
    <div className="panel add-material-panel"><div className="panel-head"><div><div className="eyebrow">CUSTOM ITEM</div><h3>Add material to track</h3></div><span className="pill muted"><Plus size={12}/> Manual entry</span></div><form className="add-material-form" onSubmit={addMaterial}><label>Material name<input value={newMaterial.name} onChange={e=>setNewMaterial(p=>({...p,name:e.target.value}))} placeholder="e.g. Teachings of Justice" required/></label><label>Category<select value={newMaterial.category} onChange={e=>setNewMaterial(p=>({...p,category:e.target.value}))}>{['Character ascension','Talent','Weapon ascension','Boss','Weekly boss','Local specialty','Enemy','Gemstone','EXP','Currency','Artifact','Other'].map(c=><option key={c}>{c}</option>)}</select></label><label>Required<input type="number" min="0" value={newMaterial.required} onChange={e=>setNewMaterial(p=>({...p,required:e.target.value}))}/></label><label>Already owned<input type="number" min="0" value={newMaterial.owned} onChange={e=>setNewMaterial(p=>({...p,owned:e.target.value}))}/></label><button className="button primary" type="submit"><Plus size={15}/> Add material</button></form></div>
    <div className="panel farming-checklist"><div className="panel-head"><div><div className="eyebrow">DAILY ROUTINE</div><h3>Farming checklist</h3></div><button className="text-action" onClick={()=>saveState(p=>({...p,tasks:TASK_STARTER.map(t=>({...t,id:`${t.id}-${Date.now()}`}))}))}>Reset tasks <RefreshCw size={13}/></button></div><div className="farming-task-grid">{persisted.tasks.map(task=><button className={`farming-task ${task.done?'done':''}`} key={task.id} onClick={()=>toggleTask(task.id)}><span className="task-check">{task.done&&<Check size={13}/>}</span><div><strong>{task.title}</strong><p>{task.detail}</p></div><ChevronRight size={15}/></button>)}</div><p className="helper-note"><Info size={13}/> Domain material days can change with the regional schedule and game updates. Verify the in-game handbook before spending Resin; this version does not assume today's domain rotation.</p></div>
  </div>;

  const mapPage = <div className="page-content">
    <SectionHeader eyebrow="EXPLORATION PLANNER" title="Teyvat Map & Routes" subtitle="Explore the real world map above, then manage your personal regional notes and collection checklist below." actions={<a className="button primary link-button" href="https://act.hoyolab.com/ys/app/interactive-map/index.html" target="_blank" rel="noreferrer"><Globe2 size={15}/> Open official interactive map <ExternalLink size={13}/></a>}/>

    <section className="panel official-map-connect"><div className="official-map-emblem"><Globe2 size={23}/></div><div className="official-map-copy"><div className="eyebrow">OFFICIAL HOYOLAB TOOL</div><h2>Genshin Impact Interactive Map</h2><p>Open the real HoYoLAB map for official pins, underground layers, and its own account-linked map tools. It opens in a new tab so HoYoLAB sign-in and map controls can work normally.</p><small>Your HoYoLAB map progress stays with HoYoLAB; it does not automatically merge into this app's personal markers.</small></div><a className="button primary link-button" href="https://act.hoyolab.com/ys/app/interactive-map/index.html?lang=en-us" target="_blank" rel="noreferrer"><Globe2 size={15}/> Open official map <ExternalLink size={13}/></a></section>
    <div className="map-warning"><Info size={16}/><span>The embedded map below is a community map with an official embed guide. HoYoLAB provides its own interactive service, but no official iframe embed interface is documented here, so the official map opens directly in a separate tab rather than showing a potentially blocked blank frame.</span></div>
    <section className="panel real-map-panel">
      <div className="real-map-heading">
        <div><div className="eyebrow">TEYVAT · REAL WORLD MAP</div><h3>Explore every region</h3><p>Pan, zoom, switch resource layers, and use the community map's own collection and route tools.</p></div>
        <div className="real-map-actions"><a className="button primary link-button" href="https://genshin-impact-map.appsample.com/" target="_blank" rel="noreferrer"><Globe2 size={15}/> Open community map <ExternalLink size={13}/></a><a className="button secondary link-button" href="https://act.hoyolab.com/ys/app/interactive-map/index.html" target="_blank" rel="noreferrer">Official HoYoLAB map <ExternalLink size={13}/></a></div>
      </div>
      <div className="real-map-frame"><iframe title="Interactive Genshin Impact Teyvat map" src="https://genshin-impact-map.appsample.com/location?no_heading=1" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
      <div className="real-map-note"><Info size={14}/><span>If this embedded map is blocked by the provider or your browser, use <a href="https://genshin-map-beta.netlify.app/" target="_blank" rel="noreferrer">Open community map</a> above. This map is community-maintained and its marker coverage may differ from the official HoYoLAB map.</span></div>
    </section>

    <div className="map-layout"><div className="panel map-canvas-panel"><div className="map-canvas-header"><div><div className="eyebrow">PERSONAL PLANNING SCHEMATIC · NOT TO SCALE</div><h3>{mapRegion} marker notes</h3></div><div className="map-controls"><button className="icon-button" onClick={()=>setMapRegion(REGIONS[Math.max(0,REGIONS.indexOf(mapRegion)-1)])} title="Previous region"><ArrowLeft size={16}/></button><button className="icon-button" onClick={()=>setMapRegion(REGIONS[Math.min(REGIONS.length-1,REGIONS.indexOf(mapRegion)+1)])} title="Next region"><ArrowRight size={16}/></button></div></div><div className="schematic-map"><div className="map-grid-lines"/><div className="map-continent continent-a"/><div className="map-continent continent-b"/><div className="map-continent continent-c"/><div className="map-continent continent-d"/><div className="map-lake lake-a"/><div className="map-lake lake-b"/><div className="map-land-label label-mond">WINDRISE</div><div className="map-land-label label-mtn">HIGHLANDS</div><div className="map-land-label label-forest">WILDS</div><div className="map-compass">N<br/><span>✦</span></div>{persisted.mapMarkers.filter(m=>m.region===mapRegion&&(mapType==='All resources'||m.type===mapType)).map((m,i)=><button key={m.id} className={`map-pin pin-${i%7} ${m.collected?'collected':''}`} title={`${m.name}${m.collected?' · collected':''}`} onClick={()=>saveState(p=>({...p,mapMarkers:p.mapMarkers.map(x=>x.id===m.id?{...x,collected:!x.collected}:x)}))}><MapPinned size={14}/><span>{m.name}</span></button>)}<div className="map-compass-legend"><span className="map-legend-dot gold-dot"/>Personal markers <span className="map-legend-dot green-dot"/>Collected</div></div><div className="region-selector">{REGIONS.map(region=><button key={region} className={mapRegion===region?'active':''} onClick={()=>setMapRegion(region)}>{region}</button>)}</div></div><div className="panel marker-panel"><div className="panel-head"><div><div className="eyebrow">PERSONAL ROUTE DATA</div><h3>Saved markers</h3></div><span className="pill muted">{persisted.mapMarkers.length} markers</span></div><form className="marker-form" onSubmit={addMarker}><label>Resource / location<input value={newMarker.name} onChange={e=>setNewMarker(p=>({...p,name:e.target.value}))} placeholder="e.g. Cor Lapis route stop" required/></label><div className="marker-field-row"><label>Region<select value={newMarker.region} onChange={e=>setNewMarker(p=>({...p,region:e.target.value}))}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></label><label>Type<select value={newMarker.type} onChange={e=>setNewMarker(p=>({...p,type:e.target.value}))}>{['Local specialty','Boss','Enemy drops','Ore','Fishing','Domain','Chest','Route note','Other'].map(t=><option key={t}>{t}</option>)}</select></label></div><label>Route notes<textarea rows="2" value={newMarker.note} onChange={e=>setNewMarker(p=>({...p,note:e.target.value}))} placeholder="Optional reminder or farming order"/></label><button className="button primary full-width" type="submit"><Plus size={15}/> Save personal marker</button></form><div className="marker-list-head"><span>Markers in {mapRegion}</span><select value={mapType} onChange={e=>setMapType(e.target.value)}><option>All resources</option>{['Local specialty','Boss','Enemy drops','Ore','Fishing','Domain','Chest','Route note','Other'].map(t=><option key={t}>{t}</option>)}</select></div><div className="marker-list">{persisted.mapMarkers.filter(m=>m.region===mapRegion&&(mapType==='All resources'||m.type===mapType)).map(m=><div className={`marker-row ${m.collected?'collected':''}`} key={m.id}><button className="marker-complete" onClick={()=>saveState(p=>({...p,mapMarkers:p.map(x=>x.id===m.id?{...x,collected:!x.collected}:x)}))}>{m.collected&&<Check size={12}/>}</button><div><strong>{m.name}</strong><small>{m.type}{m.note?` · ${m.note}`:''}</small></div><button className="icon-button danger tiny" onClick={()=>saveState(p=>({...p,mapMarkers:p.mapMarkers.filter(x=>x.id!==m.id)}))}><Trash2 size={13}/></button></div>)}{persisted.mapMarkers.filter(m=>m.region===mapRegion&&(mapType==='All resources'||m.type===mapType)).length===0&&<p className="empty-inline">No markers for this filter yet. Add a personal one above.</p>}</div></div></div>
    <div className="external-map-strip"><div className="external-map-icon"><Globe2 size={20}/></div><div><strong>Need exact coordinates and live resource layers?</strong><p>Community maps provide location-specific pins and routes that this personal schematic does not contain.</p></div><a href="https://act.hoyolab.com/ys/app/interactive-map/index.html" target="_blank" rel="noreferrer">HoYoLAB interactive map <ExternalLink size={13}/></a></div>
  </div>;

  const accountPage = <div className="page-content">
    <SectionHeader eyebrow="PROFILE & PROGRESSION" title="Account Tracker" subtitle="Keep your account snapshot, targets, and resources organized in one place." actions={<button className="button secondary" onClick={exportTracker}><Download size={15}/> Export backup</button>}/>
    <div className="account-overview-grid"><div className="account-profile-card"><div className="profile-emblem"><Compass size={28}/></div><div className="eyebrow">TRAVELER PROFILE</div><h2>{persisted.account.nickname || 'Your Traveler'}</h2><p>Personal account record</p><div className="profile-stats"><div><strong>{persisted.account.ar}</strong><small>Adventure Rank</small></div><div><strong>{persisted.account.worldLevel}</strong><small>World Level</small></div><div><strong>{ownedCharacters.length}</strong><small>Owned</small></div></div><div className="profile-footer"><span><span className="live-dot"/> Saved on this device</span><button className="text-action" onClick={()=>navigate('settings')}>Connection settings <ArrowRight size={13}/></button></div></div><div className="account-form-panel panel"><div className="panel-head"><div><div className="eyebrow">MANUAL ACCOUNT DETAILS</div><h3>Edit your snapshot</h3></div><span className="pill muted"><Pencil size={12}/> Editable</span></div><div className="account-input-grid"><label>In-game nickname<input value={persisted.account.nickname} onChange={e=>updateAccount('nickname',e.target.value)} placeholder="Optional nickname"/></label><label>Adventure Rank<input type="number" min="1" max="60" value={persisted.account.ar} onChange={e=>updateAccount('ar',Math.max(1,Math.min(60,Number(e.target.value)||1)))}/></label><label>World Level<input type="number" min="0" max="9" value={persisted.account.worldLevel} onChange={e=>updateAccount('worldLevel',Math.max(0,Math.min(9,Number(e.target.value)||0)))}/></label><label>Spiral Abyss progress<input value={persisted.account.abyss} onChange={e=>updateAccount('abyss',e.target.value)} placeholder="e.g. 12-3 / not attempted"/></label><label>Primogems (manual)<input type="number" min="0" value={persisted.account.primogems} onChange={e=>updateAccount('primogems',Math.max(0,Number(e.target.value)||0))}/></label><label>Wishes available (manual)<input type="number" min="0" value={persisted.account.wishes} onChange={e=>updateAccount('wishes',Math.max(0,Number(e.target.value)||0))}/></label><label>Current pity (manual)<input type="number" min="0" max="90" value={persisted.account.pity} onChange={e=>updateAccount('pity',Math.max(0,Math.min(90,Number(e.target.value)||0)))}/></label><label>Genshin UID (Enka + AKASHA public data)<input inputMode="numeric" value={persisted.account.uid} onChange={e=>updateAccount('uid',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="9–10 digit UID"/></label></div><div className="profile-warning"><ShieldCheck size={15}/><span>Never enter your HoYoverse password, verification code, session cookie, or authentication token here.</span></div></div></div>
    <div className="panel sync-panel"><div className="panel-head"><div><div className="eyebrow">OPTIONAL PUBLIC DATA</div><h3>Sync character showcase</h3></div><span className={`sync-status ${persisted.enkaSnapshot?'connected':''}`}><span className="live-dot"/>{persisted.enkaSnapshot?'Connected snapshot':'Not connected'}</span></div><p className="panel-description">Sync public Enka account data: display-list characters and levels, detailed showcase equipment when enabled, public profile statistics, and saved build snapshots when the UID is linked to a verified public Enka profile. The app honors Enka's UID cooldown and saves the last snapshot locally. It is not a HoYoverse login and cannot read hidden characters, Resin, Primogems, full inventory, wish history or the entire owned roster.</p><button className="button primary" onClick={syncPublicShowcase} disabled={syncLoading||syncWaitMs>0}>{syncLoading?<><RefreshCw className="spin" size={15}/> Connecting…</>:syncWaitMs>0?<><Clock size={15}/> Refresh available at {new Date(syncNextFetchAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</>:<><Link2 size={15}/> Sync public showcase</>}</button>{syncError&&<div className="notice warning sync-message"><Info size={15}/><span>{syncError}</span><button className="text-action" onClick={()=>setSyncError('')} aria-label="Dismiss sync message"><X size={13}/></button></div>}{syncNextFetchAt>syncClock&&<p className="sync-cooldown-note"><Clock size={13}/> Next public refresh is available at {new Date(syncNextFetchAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}, following Enka.Network's returned cache TTL.</p>}{persisted.enkaSnapshot&&<div className="sync-result"><div className="sync-result-top"><div><strong>Public snapshot loaded</strong><small>UID {persisted.enkaSnapshot.uid} · {new Date(persisted.enkaSnapshot.fetchedAt).toLocaleString()}</small></div><button className="text-action" onClick={syncPublicShowcase}><RefreshCw size={13}/> Refresh</button></div><div className="sync-facts"><div><small>Nickname</small><strong>{persisted.enkaSnapshot.nickname || 'Not public'}</strong></div><div><small>Adventure Rank</small><strong>{persisted.enkaSnapshot.level ?? 'Not public'}</strong></div><div><small>World Level</small><strong>{persisted.enkaSnapshot.worldLevel ?? 'Not public'}</strong></div><div><small>Profile signature</small><strong>{persisted.enkaSnapshot.signature || 'Blank / not public'}</strong></div><div><small>Public roster entries</small><strong>{persisted.enkaSnapshot.rosterEntries?.length ?? persisted.enkaSnapshot.showcase?.length ?? 0}</strong></div><div><small>Achievements</small><strong>{persisted.enkaSnapshot.achievements ?? 'Not public'}</strong></div><div><small>Abyss floor</small><strong>{persisted.enkaSnapshot.abyssFloor ? String(persisted.enkaSnapshot.abyssFloor)+'-'+String(persisted.enkaSnapshot.abyssChamber || 0) : 'Not public'}</strong></div></div>{persisted.enkaSnapshot.savedBuildsStatus && <div className="showcase-id-list"><span>Public Enka profile builds · {(persisted.enkaSnapshot.savedBuilds || []).length}</span>{persisted.enkaSnapshot.savedBuilds?.length ? persisted.enkaSnapshot.savedBuilds.map((build,i)=><details key={`${build.id}-${i}`} className="showcase-character-detail"><summary>{build.characterName} · {build.name} · {build.live ? 'Live snapshot' : 'Saved build'}</summary><div className="showcase-detail-content"><p><strong>Order:</strong> {build.order + 1}{build.isPublic === true ? ' · Public' : ''}</p>{build.weapon && <p><strong>Weapon:</strong> {build.weapon}{build.weaponLevel ? ` · Lv. ${build.weaponLevel}` : ''}</p>}{build.artifacts?.length > 0 && <div><strong>Artifacts</strong>{build.artifacts.map((artifact,j)=><div key={j} className="showcase-artifact-row"><span>{artifact.name}{artifact.level != null ? ` · +${artifact.level}` : ''}{artifact.rarity ? ` · ${artifact.rarity}★` : ''}</span>{artifact.mainStat && <small>Main stat: {artifact.mainStat}</small>}{artifact.substats?.length > 0 && <small>Substats: {artifact.substats.map(stat=>stat.name+(stat.value!=null?' '+stat.value:'')).join(' · ')}</small>}</div>)}</div>}{build.talents?.length > 0 && <p><strong>Raw talent levels:</strong> {build.talents.join(' / ')}</p>}{!build.detailsAvailable && <p>The saved-build record was imported, but this entry did not contain a character-data payload the app could read as structured equipment. Its source data is preserved in the exported tracker backup.</p>}{build.image && <p><a href={build.image} target="_blank" rel="noreferrer">Open Enka build image <ExternalLink size={12}/></a></p>}</div></details>) : <p>{persisted.enkaSnapshot.savedBuildsStatus === 'no-public-Enka-profile' ? 'No verified public Enka profile is connected to this UID. Public saved-build import requires an Enka profile with a verified, public game account.' : persisted.enkaSnapshot.savedBuildsStatus === 'no-public-saved-builds' ? 'The public Enka profile does not currently expose saved builds.' : persisted.enkaSnapshot.savedBuildsStatus === 'loaded' ? 'No public saved builds were found.' : 'Saved builds were not available on this request (' + persisted.enkaSnapshot.savedBuildsStatus + '). The showcase and public roster sync still succeeded.'}</p>}<p className="helper-note"><Info size={13}/> Enka saved builds are user-published snapshots, not a direct HoYoverse inventory API. Entries marked Live may be stale until the profile owner refreshes them. Explicitly private entries are excluded.</p></div>}{((persisted.enkaSnapshot.rosterEntries?.length || 0) > 0 || (persisted.enkaSnapshot.showcase?.length || 0) > 0)&&<div className="showcase-id-list"><span>Public display list · this is not the full owned roster</span>{(persisted.enkaSnapshot.rosterEntries || persisted.enkaSnapshot.showcase || []).map((a,i)=>{const detail=persisted.enkaSnapshot.showcase?.find(entry=>entry.avatarId===a.avatarId)||null;return <details key={`${a.avatarId}-${i}`} className="showcase-character-detail"><summary>{a.name}{a.level? ` · Lv. ${a.level}`:''}{detail?.constellation? ` · C${detail.constellation}`:''}{detail?.weapon? ` · ${detail.weapon}`:''}{!detail?' · detailed data hidden':''}</summary><div className="showcase-detail-content">{detail?.weapon&&<p><strong>Weapon:</strong> {detail.weapon}{detail.weaponLevel? ` · Lv. ${detail.weaponLevel}`:''}</p>}{detail?.artifacts?.length>0&&<div><strong>Artifacts</strong>{detail.artifacts.map((artifact,j)=><div key={j} className="showcase-artifact-row"><span>{artifact.name}{artifact.level!=null? ` · +${artifact.level}`:''}{artifact.rarity? ` · ${artifact.rarity}★`:''}</span>{artifact.mainStat&&<small>Main stat: {artifact.mainStat}</small>}{artifact.substats?.length>0&&<small>Substats: {artifact.substats.map(stat=>stat.name+(stat.value!=null?' '+stat.value:'')).join(' · ')}</small>}</div>)}</div>}{detail?.talents?.length>0&&<p><strong>Raw talent level values:</strong> {detail.talents.join(' / ')} <small>(provider order; not relabeled as Normal / Skill / Burst)</small></p>}{detail?.friendship!=null&&<p><strong>Friendship:</strong> {detail.friendship}</p>}{!detail&&<p>Only the public display-list entry was available. Enable Character Details in-game to expose detailed equipment for displayed characters.</p>}{detail&&!detail.weapon&&!detail.artifacts?.length&&!detail.talents?.length&&<p>Detailed equipment was not returned for this character.</p>}</div></details>})}</div>}<p className="helper-note"><Info size={13}/> Matched public display-list characters are marked owned and their level is updated when it is available. Constellations and equipped weapons/artifacts sync only when Enka returns detailed character data; these remain separate from your planned build notes. Other characters, goals, teams, local markers and material quantities are preserved. This is not the full owned roster or private account inventory.</p></div>}</div>
    <section className="panel akasha-sync-panel">
      <div className="panel-head">
        <div><div className="eyebrow">PUBLIC LEADERBOARD & ARTIFACT DATA</div><h3>AKASHA profile sync</h3></div>
        <span className={persisted.akashaSnapshot?.uid === persisted.account.uid && persisted.akashaSnapshot?.profiles ? 'sync-status connected' : 'sync-status'}><span className="live-dot"/>{persisted.akashaSnapshot?.uid === persisted.account.uid && persisted.akashaSnapshot?.profiles ? 'Profile snapshot saved' : 'Not synced'}</span>
      </div>
      <p className="panel-description">Sync public AKASHA character calculations, ranking percentiles, weapon choices and artifact-set information for the UID above. Load each character build’s artifact pieces on demand to inspect set, slot, level, main stat, substats and Crit Value. This uses AKASHA’s community API; it is not an official HoYoverse integration and does not need your password.</p>
      <div className="akasha-sync-actions">
        <button className="button primary" onClick={syncAkashaProfile} disabled={akashaSyncLoading}>{akashaSyncLoading ? <><RefreshCw className="spin" size={15}/> Syncing AKASHA…</> : <><RefreshCw size={15}/> Sync AKASHA profile</>}</button>
        <a className="button secondary link-button" href={persisted.account.uid ? 'https://akasha.cv/profile/' + encodeURIComponent(persisted.account.uid) : 'https://akasha.cv/profiles'} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open AKASHA</a>
      </div>
      {akashaSyncError && <div className="notice warning sync-message"><Info size={15}/><span>{akashaSyncError}</span><button className="text-action" onClick={() => setAkashaSyncError('')} aria-label="Dismiss AKASHA message"><X size={13}/></button></div>}
      {persisted.akashaSnapshot?.uid === persisted.account.uid && <div className="sync-result">
        <div className="sync-result-top"><div><strong>AKASHA snapshot</strong><small>UID {persisted.akashaSnapshot.uid} · {new Date(persisted.akashaSnapshot.fetchedAt).toLocaleString()}</small></div><span className="pill muted">{persisted.akashaSnapshot.profiles.length} character profiles</span></div>
        {persisted.akashaSnapshot.profiles.length === 0 ? <p className="helper-note">AKASHA returned no eligible character calculations for this UID. The profile may not be indexed yet, details may be hidden, or no supported leaderboard calculations may exist for the displayed characters.</p> :
          <div className="akasha-profile-list">{persisted.akashaSnapshot.profiles.map((profile,index) => {
            const artifactBundle = persisted.akashaSnapshot?.artifactsByBuild?.[profile.md5];
            const isArtifactLoading = akashaArtifactLoadingId === profile.md5;
            return <details key={profile.id + '-' + index} className="showcase-character-detail akasha-profile-entry">
              <summary><span>{profile.characterName}</span><small>{profile.constellation != null ? ' · C' + profile.constellation : ''} · {profile.calculations.length} ranking calculation(s)</small></summary>
              <div className="showcase-detail-content">
                {profile.artifactSets.length > 0 && <div className="akasha-artifact-set-list"><strong>Reported artifact sets</strong>{profile.artifactSets.map(set=><span key={set.name}>{set.name}{set.count != null && Number.isFinite(Number(set.count)) ? ' · ' + set.count + ' pc' : ''}</span>)}</div>}
                {profile.calculations.length > 0 && <div className="akasha-calculation-list">{profile.calculations.map(calc=><div className="akasha-calculation-row" key={calc.id}>
                  <div><strong>{calc.name}</strong>{calc.variant?.displayName && <small>{calc.variant.displayName}</small>}<p>{calc.weapon.name || 'Weapon data unavailable'}{calc.weapon.rarity ? ' · ' + calc.weapon.rarity + '★' : ''}{calc.weapon.refinement ? ' · R' + calc.weapon.refinement : ''}</p></div>
                  <div className="akasha-rank-metrics">{calc.topPercent != null && <strong>Top {calc.topPercent.toFixed(2)}%</strong>}{calc.ranking != null && calc.outOf != null && <small>#{calc.ranking.toLocaleString()} / {calc.outOf.toLocaleString()}</small>}{calc.result != null && <small>Score / result: {Math.round(calc.result).toLocaleString()}</small>}</div>
                  {calc.id > 0 && <a href={'https://akasha.cv/leaderboards/' + calc.id} target="_blank" rel="noreferrer" className="text-action">Leaderboard <ExternalLink size={12}/></a>}
                </div>)}</div>}
                <button type="button" className="button secondary compact" disabled={!/^[a-fA-F0-9]{32}$/.test(profile.md5) || isArtifactLoading} onClick={() => loadAkashaArtifacts(profile)}>{isArtifactLoading ? <><RefreshCw className="spin" size={13}/> Loading artifacts…</> : <><Layers3 size={14}/>{artifactBundle ? 'Refresh artifact details' : 'Load artifact details'}</>}</button>
                {artifactBundle && <><p className="build-video-note">Artifact data last loaded {new Date(artifactBundle.fetchedAt).toLocaleString()} · {artifactBundle.artifacts.length} pieces</p><AkashaArtifactList artifacts={artifactBundle.artifacts}/></>}
                {!/^[a-fA-F0-9]{32}$/.test(profile.md5) && <p className="helper-note">AKASHA did not provide an artifact lookup hash for this record. Ranking details above are still available.</p>}
              </div>
            </details>;
          })}</div>}
        <p className="helper-note"><Info size={13}/> AKASHA rankings are based on the calculation types and variants it supports—not an overall ranking of every artifact or team. Artifact Crit Value is a quick comparison metric, not a complete build score. The public API may change without notice.</p>
      </div>}
    </section>
    <div className="inventory-progression-grid">
      <section className="panel good-import-panel">
        <div className="panel-head"><div><div className="eyebrow">FULL INVENTORY IMPORT</div><h3>Artifacts, weapons & owned characters</h3></div><span className={persisted.goodInventory?'pill success':'pill muted'}>{persisted.goodInventory?'GOOD inventory loaded':'Not imported'}</span></div>
        <p className="panel-description">Import a GOOD JSON export to bring in the inventory that UID showcase syncing cannot see. The file is read in your browser; no HoYoverse password, session cookie or account login is needed.</p>
        <input ref={goodUploadRef} className="hidden-input" type="file" accept="application/json,.json" onChange={importGoodFile}/>
        <div className="good-import-actions"><button className="button primary" onClick={()=>goodUploadRef.current?.click()}><Upload size={15}/> Import GOOD JSON</button>{persisted.goodInventory&&<button className="button secondary" onClick={()=>{if(window.confirm('Remove the imported GOOD inventory from this browser? Your other tracker data will be kept.')){saveState(prev=>({...prev,goodInventory:null}));setGoodImportMessage('Imported inventory cleared. Your characters, goals and materials were kept.');}}}><Trash2 size={14}/> Clear import</button>}<a className="button secondary link-button" href="https://frzyc.github.io/genshin-optimizer/" target="_blank" rel="noreferrer"><ExternalLink size={14}/> Genshin Optimizer</a></div>
        {goodImportMessage&&<div className={'notice '+(goodImportMessage.startsWith('Import failed')?'warning':'success')}><Info size={15}/><span>{goodImportMessage}</span></div>}
        {persisted.goodInventory&&<><div className="good-inventory-stats"><div><span>Characters</span><strong>{persisted.goodInventory.summary?.characters ?? persisted.goodInventory.characters?.length ?? 0}</strong></div><div><span>Weapons</span><strong>{persisted.goodInventory.summary?.weapons ?? persisted.goodInventory.weapons?.length ?? 0}</strong></div><div><span>Artifacts</span><strong>{persisted.goodInventory.summary?.artifacts ?? persisted.goodInventory.artifacts?.length ?? 0}</strong></div><div><span>Locked artifacts</span><strong>{persisted.goodInventory.summary?.lockedArtifacts ?? 0}</strong></div></div>
        <div className="good-import-meta"><span>GOOD v{persisted.goodInventory.version} · {persisted.goodInventory.source || 'Inventory import'}</span><span>Imported {new Date(persisted.goodInventory.importedAt).toLocaleString()}</span></div>
        {topImportedArtifacts.length>0&&<div className="good-artifact-preview"><div className="eyebrow">TOP GENERIC CRIT VALUE · NOT A FULL OPTIMIZER</div>{topImportedArtifacts.map((artifact,index)=><div className="good-artifact-row" key={artifact.setKey+'-'+artifact.slotKey+'-'+index}><div className="good-artifact-rank">{index+1}</div><div className="good-artifact-copy"><strong>{humanizeGameKey(artifact.setKey)} · {humanizeGameKey(artifact.slotKey)}</strong><small>{humanizeGameKey(artifact.mainStatKey)} main stat · +{artifact.level} · {artifact.location?('Equipped: '+humanizeGameKey(artifact.location)):'Unequipped'}</small><small>{artifact.substats.map(stat=>humanizeGameKey(stat.key)+': '+stat.value).join(' · ')}</small></div><span className="good-artifact-cv">{Number(artifact.critValue||0).toFixed(1)} CV</span></div>)}</div>}</>}
        <p className="helper-note"><Info size={13}/> Inventory uploads stay in this browser's local storage. CRIT Value is just CRIT Rate × 2 + CRIT DMG; it cannot tell whether an artifact is best for a character, reaction team or support build.</p>
      </section>
      <section className="panel progression-planner-panel">
        <div className="panel-head"><div><div className="eyebrow">PROGRESSION & RESIN</div><h3>Your next best steps</h3></div><Target size={18} className="panel-heading-icon"/></div>
        <label className="resin-budget-field">Current resin available<input type="number" min="0" max="200" value={persisted.account.resinAvailable ?? 0} onChange={e=>updateAccount('resinAvailable',Math.max(0,Math.min(200,Number(e.target.value)||0)))}/></label>
        <div className="resin-budget-summary"><span>Manual resin budget</span><strong>{Number(persisted.account.resinAvailable||0)} / 200</strong></div><ProgressBar value={Number(persisted.account.resinAvailable||0)} max={200} color="blue"/>
        <div className="progression-action-list">{progressionPlan.map((action,index)=>{const ActionIcon=action.kind==='goal'?Target:action.kind==='material'?PackageOpen:action.kind==='artifacts'?Layers3:action.kind==='character'?Users:Compass;return <div className="progression-action" key={action.kind+'-'+index}><span className="progression-action-icon"><ActionIcon size={16}/></span><div><strong>{action.title}</strong><p>{action.detail}</p><small>{action.reason}</small>{action.kind==='material'&&<button className="text-action" onClick={()=>navigate('materials')}>Open material tracker <ArrowRight size={12}/></button>}{action.kind==='goal'&&<button className="text-action" onClick={()=>navigate('account')}>Review goals <ArrowRight size={12}/></button>}</div></div>})}</div>
        <div className="resin-planner-note"><Info size={14}/><p>Spend resin toward a specific active goal first: confirm the exact boss/domain that drops your missing material and check today's rotation in-game. Once character, weapon and talent needs are covered, use leftover resin on artifacts. The current planner does not invent run counts or drop yields it cannot verify.</p></div>
        <div className="inventory-research-links"><a href={persisted.account.uid ? 'https://akasha.cv/profile/' + encodeURIComponent(persisted.account.uid) : 'https://akasha.cv/profiles'} target="_blank" rel="noreferrer"><span><strong>AKASHA · profile comparison</strong><small>{persisted.account.uid ? 'Open the profile for UID ' + persisted.account.uid : 'Search for your UID to compare eligible character builds and rankings'}</small></span><ExternalLink size={14}/></a><a href="https://frzyc.github.io/genshin-optimizer/" target="_blank" rel="noreferrer"><span><strong>Genshin Optimizer</strong><small>Generate or manage optimizer inventory data</small></span><ExternalLink size={14}/></a></div>
      </section>
    </div>
    <div className="progress-goals-layout"><div className="panel goals-panel"><div className="panel-head"><div><div className="eyebrow">YOUR OBJECTIVES</div><h3>Upgrade goals</h3></div><span className="pill muted">{persisted.goals.length} goals</span></div><form className="goal-form" onSubmit={addGoal}><label>Goal name<input value={newGoal.title} onChange={e=>setNewGoal(p=>({...p,title:e.target.value}))} placeholder="e.g. Finish Skirk talents" required/></label><label>Character (optional)<select value={newGoal.character} onChange={e=>setNewGoal(p=>({...p,character:e.target.value}))}><option value="">Select character</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="goal-form-row"><label>Target<select value={newGoal.target} onChange={e=>setNewGoal(p=>({...p,target:e.target.value}))}>{['Level 90','Level 80/90','Talent level 9','Triple crown','Weapon level 90','Artifact build','Custom target'].map(t=><option key={t}>{t}</option>)}</select></label><label>Due date<input type="date" value={newGoal.due} onChange={e=>setNewGoal(p=>({...p,due:e.target.value}))}/></label></div><button className="button primary full-width" type="submit"><Plus size={15}/> Add upgrade goal</button></form><div className="goal-list detailed">{persisted.goals.map(g=>{const c=characters.find(ch=>ch.id===g.character);return <div className={`goal-row ${g.done?'done':''}`} key={g.id}><button className="goal-toggle" onClick={()=>saveState(p=>({...p,goals:p.goals.map(x=>x.id===g.id?{...x,done:!x.done}:x)}))}>{g.done&&<Check size={12}/>}</button><div className="goal-info"><strong>{g.title}</strong><small>{c?`${c.name} · `:''}{g.target}{g.due?` · Due ${g.due}`:''}</small></div><button className="icon-button danger tiny" onClick={()=>saveState(p=>({...p,goals:p.goals.filter(x=>x.id!==g.id)}))}><Trash2 size={13}/></button></div>;})}</div>{persisted.goals.length===0&&<p className="empty-inline">Your goals will appear here once you add them.</p>}</div><div className="panel resources-panel"><div className="panel-head"><div><div className="eyebrow">RESOURCE TRACKING</div><h3>Wish resources</h3></div><span className="pill muted">Manual</span></div><div className="resource-display"><div className="resource-emblem primogem">✧</div><div><span>Primogems</span><strong>{formatNumber(persisted.account.primogems)}</strong></div></div><ProgressBar value={persisted.account.wishes} max={180}/><div className="resource-foot"><span>{formatNumber(persisted.account.wishes)} wishes available</span><span>Pity: {persisted.account.pity}</span></div><p className="helper-note"><Info size={13}/> These values are optional manual notes, not an automated pull tracker. Update them after wishing or spending currency.</p><button className="button secondary full-width" onClick={()=>navigate('materials')}>Review upgrade materials <ArrowRight size={15}/></button></div></div>
  </div>;


  const askLocalAdvisor = (e) => {
    e.preventDefault();
    const question = advisorQuestion.trim().toLowerCase();
    if (!question) {
      setAdvisorAnswer('Type a question first, then I can use your saved tracker information to suggest a next step.');
      return;
    }
    const owned = persisted.characters.filter(c => c.owned);
    const missing = persisted.materials.filter(m => Number(m.required || 0) > Number(m.owned || 0));
    const openGoals = persisted.goals.filter(g => !g.done);
    const underLevelled = owned.filter(c => Number(c.level || 1) < 80).sort((a,b) => Number(a.level || 1) - Number(b.level || 1));
    let answer = '';
    if (/farm|material|ascen|talent|boss|mora|resin|book|weapon material/.test(question)) {
      if (missing.length) {
        const topGaps = missing.slice(0,3).map(m => `${m.name}: ${Math.max(0, Number(m.required || 0) - Number(m.owned || 0))} still needed`).join('; ');
        answer = `Start with the gaps you have actually tracked: ${topGaps}. Check the in-game upgrade screen for exact costs before spending Resin; the planner only knows the quantities you entered.`;
      } else if (!advisorTrackedMaterials.length) {
        answer = 'Your planner has no quantified material requirements yet. Open Materials & Farming, add exact material names and required/owned amounts from the in-game screens, then ask again and I can summarize what is missing.';
      } else {
        answer = 'All material rows with a required quantity are currently covered in your tracker. Before farming something new, verify the planned character or talent target in-game and update any rows that are still estimates.';
      }
    } else if (/team|comp|squad|party|synerg/.test(question)) {
      if (owned.length < 2) {
        answer = `You have ${owned.length} character${owned.length === 1 ? '' : 's'} marked as owned. Update your roster in Characters first; team suggestions are only as useful as the ownership and role information you track.`;
      } else {
        const names = owned.slice(0,8).map(c => c.name).join(', ');
        answer = `Your saved roster includes ${owned.length} owned characters, including ${names}${owned.length > 8 ? ', and more' : ''}. Open Builds & Teams to compare lineups. I won't label a team "best" from roster data alone: reactions, enemy, investment, and current guide data all matter.`;
      }
    } else if (/level|build|upgrade|priorit|who|focus|next/.test(question)) {
      if (openGoals.length) {
        answer = `You have ${openGoals.length} active goal${openGoals.length === 1 ? '' : 's'}. Start with "${openGoals[0].title}", then check its associated character and material requirements so you don't spread resources across too many targets.`;
      } else if (underLevelled.length) {
        const c = underLevelled[0];
        answer = `${c.name} is one of your lowest-level owned characters at level ${Number(c.level || 1)}. If they are part of a team you use often, review their role, weapon, talents, and artifacts before committing to a level-90 target. Otherwise, choose a character you actively use and add a goal in Account Tracker.`;
      } else {
        answer = 'You have no active upgrade goals saved, and none of your owned characters is below level 80 in the tracker. Pick the character you use most, add a goal in Account Tracker, and record its real material costs to create a focused plan.';
      }
    } else if (/account|sync|login|cloud|password|device/.test(question)) {
      answer = 'This version saves progress in this browser with local storage, so it does not yet sync between devices. Do not enter your HoYoverse password, verification codes, cookies, or tokens. Secure login and cloud saves are a separate upgrade and are not active yet.';
    } else if (/map|location|route|specialty|ore|chest|collect/.test(question)) {
      answer = 'Use Interactive Map for your personal region/category markers and collection notes, then open the official HoYoLAB map for geographic locations. Your current personal markers are planning notes, not verified in-game coordinates.';
    } else {
      answer = `I can currently summarize the data saved in this browser: ${owned.length} owned characters, ${openGoals.length} active goals, and ${missing.length} material rows with a recorded shortage. Try asking what to farm, which goal to do next, how to approach teams, or how account syncing works. This is a local rules-based preview, not a connected generative AI model yet.`;
    }
    setAdvisorAnswer(answer);
  };

  const advisorPage = <div className="page-content">
    <SectionHeader eyebrow="STRATEGY DESK" title="Teyvat Advisor" subtitle="Turn the roster and tracker information you have saved into a clearer next step." actions={<button className="button secondary" onClick={()=>navigate('materials')}><PackageOpen size={15}/> Plan materials</button>}/>
    <div className="advisor-hero">
      <div className="advisor-hero-copy">
        <div className="hero-kicker"><Sparkles size={14}/> YOUR PERSONAL PLANNING DESK</div>
        <h2>Make your next upgrade<br/><em>count.</em></h2>
        <p>Get a practical starting point from your saved roster, goals, and material counts. The assistant is deliberately transparent about what it knows and what still needs verified game data.</p>
        <span className="advisor-status"><span className="live-dot"/> Local planner active <span className="advisor-status-separator">·</span> Generative AI not connected yet</span>
      </div>
      <div className="advisor-hero-emblem"><Bot size={58}/><span className="advisor-emblem-orbit orbit-a"/><span className="advisor-emblem-orbit orbit-b"/><span className="advisor-emblem-star">✦</span></div>
    </div>
    <div className="advisor-stats-grid">
      <div className="advisor-stat-card"><span className="advisor-stat-icon gold"><Users size={17}/></span><div><small>Owned roster</small><strong>{ownedCharacters.length}</strong><span>characters tracked</span></div></div>
      <div className="advisor-stat-card"><span className="advisor-stat-icon blue"><Target size={17}/></span><div><small>Active goals</small><strong>{advisorOpenGoals.length}</strong><span>{advisorOpenGoals.length ? 'keep one as your main focus' : 'no active goal saved'}</span></div></div>
      <div className="advisor-stat-card"><span className="advisor-stat-icon red"><PackageOpen size={17}/></span><div><small>Material gaps</small><strong>{advisorMissingMaterials.length}</strong><span>{advisorTrackedMaterials.length ? 'tracked rows with shortages' : 'enter exact quantities to calculate'}</span></div></div>
      <div className="advisor-stat-card"><span className="advisor-stat-icon green"><Activity size={17}/></span><div><small>Below level 80</small><strong>{advisorUnderLevelled.length}</strong><span>owned characters in your tracker</span></div></div>
    </div>
    <div className="advisor-workspace">
      <section className="panel advisor-chat-panel">
        <div className="panel-heading"><div><div className="eyebrow">ASK YOUR ADVISOR</div><h3>What should I work on?</h3></div><span className="pill muted">Local preview</span></div>
        <p className="helper-note"><Info size={13}/> Answers are based on your browser's saved tracker data. This is not yet a connected generative AI model, and it does not invent character costs or claim unverified builds are optimal.</p>
        <div className="advisor-prompt-chips">
          <button type="button" onClick={()=>setAdvisorQuestion('What should I farm next?')}>What should I farm?</button>
          <button type="button" onClick={()=>setAdvisorQuestion('What should I upgrade next?')}>What should I upgrade?</button>
          <button type="button" onClick={()=>setAdvisorQuestion('How should I approach teams?')}>Help with teams</button>
          <button type="button" onClick={()=>setAdvisorQuestion('Can my progress sync between devices?')}>Cloud saves</button>
        </div>
        <form className="advisor-question-form" onSubmit={askLocalAdvisor}>
          <label className="field-label">Ask about your tracked account<textarea rows="3" value={advisorQuestion} onChange={e=>setAdvisorQuestion(e.target.value)} placeholder="e.g. What should I focus on before building another character?"/></label>
          <button className="button primary" type="submit"><Sparkles size={15}/> Get recommendation</button>
        </form>
        {advisorAnswer && <div className="advisor-answer" role="status"><span className="advisor-answer-icon"><Bot size={17}/></span><p>{advisorAnswer}</p></div>}
      </section>
      <section className="panel advisor-next-panel">
        <div className="panel-heading"><div><div className="eyebrow">SUGGESTED NEXT STEPS</div><h3>Clear your biggest blockers</h3></div><Target size={18} className="panel-heading-icon"/></div>
        <div className="advisor-priority-list">
          {[
            {icon:PackageOpen,title:'Close a tracked material gap',detail:advisorMissingMaterials.length ? `${advisorMissingMaterials.length} material row(s) show a shortage. Start with the exact missing counts.` : advisorTrackedMaterials.length ? 'Your quantified material rows are covered. Verify your next target before farming.' : 'Add exact material requirements and owned amounts so shortages can be calculated.',action:'Open materials',page:'materials'},
            {icon:Target,title:'Choose one upgrade goal',detail:advisorOpenGoals.length ? `${advisorOpenGoals.length} active goal(s) saved. Work on "${advisorOpenGoals[0].title}" before adding more targets.` : 'No active goal is saved yet. Pick a character or talent you regularly use.',action:'Open account tracker',page:'account'},
            {icon:Users,title:'Review your roster',detail:ownedCharacters.length ? `${ownedCharacters.length} characters are marked owned. Keep levels, roles, and build notes current.` : 'Mark the characters you own so team planning can use your real roster.',action:'Open characters',page:'characters'},
          ].map(item=>{const PriorityIcon=item.icon;return <div className="advisor-priority" key={item.title}><span className="advisor-priority-icon"><PriorityIcon size={17}/></span><div className="advisor-priority-copy"><strong>{item.title}</strong><p>{item.detail}</p><button className="text-action" onClick={()=>navigate(item.page)}>{item.action} <ArrowUpRight size={13}/></button></div></div>;})}
        </div>
      </section>
    </div>
    <div className="advisor-bottom-grid">
      <section className="panel advisor-roster-panel"><div className="panel-heading"><div><div className="eyebrow">ROSTER SNAPSHOT</div><h3>Use what you already own</h3></div><Users size={17} className="panel-heading-icon"/></div><p>{ownedCharacters.length ? ownedCharacters.slice(0,8).map(c=>c.name).join(' · ') + (ownedCharacters.length>8 ? ' · and more' : '') : 'No owned characters are marked yet. Open Characters and update ownership to personalize this section.'}</p><button className="button secondary" onClick={()=>navigate('teams')}><Swords size={15}/> Compare teams</button></section>
      <section className="panel advisor-trust-panel"><div className="panel-heading"><div><div className="eyebrow">DATA HONESTY</div><h3>Know what is verified</h3></div><ShieldCheck size={17} className="panel-heading-icon"/></div><p>Roster counts and material shortages come from your saved entries. Build recommendations and costs still need patch-aware, sourced game data before they can be treated as authoritative.</p><a className="text-action" href="https://keqingmains.com/" target="_blank" rel="noreferrer">Compare with community guides <ExternalLink size={13}/></a></section>
    </div>
  </div>;


  const guidesPage = <div className="page-content">
    <SectionHeader eyebrow="COMMUNITY KNOWLEDGE" title="Guides & Videos" subtitle="Use targeted searches to find relevant community guides. Links open YouTube search, not invented or unverified videos." actions={<a className="button secondary link-button" href="https://www.youtube.com/@Zy0x" target="_blank" rel="noreferrer"><PlayCircle size={15}/> Zy0x channel <ExternalLink size={13}/></a>}/>
    <div className="guide-feature"><div className="guide-feature-art"><div className="guide-star star-a">✦</div><div className="guide-star star-b">✧</div><div className="guide-feature-orb"><BookOpen size={32}/></div><div className="guide-ribbon">FIELD NOTES · VOL. 01</div></div><div className="guide-feature-copy"><div className="eyebrow">A BETTER WAY TO LEARN</div><h2>Build knowledge,<br/><em>not just numbers.</em></h2><p>Character guides change with versions, teams, weapons, and account investment. Search by the exact character and question you want to solve, and compare more than one source.</p><button className="button gold" onClick={()=>window.open(youtubeSearch('character build guide','Zy0x'),'_blank','noopener,noreferrer')}>Explore build guides <ArrowRight size={15}/></button></div></div>
    <div className="guide-search-row"><div><div className="eyebrow">QUICK SEARCH</div><h2>What are you building?</h2><p>Choose a topic to open current community videos for your roster.</p></div><div className="guide-search-actions"><button className="button secondary" onClick={()=>window.open(youtubeSearch('character build guide'),'_blank','noopener,noreferrer')}><Users size={15}/> Character builds</button><button className="button secondary" onClick={()=>window.open(youtubeSearch('best team rotations'),'_blank','noopener,noreferrer')}><Swords size={15}/> Team rotations</button><button className="button secondary" onClick={()=>window.open(youtubeSearch('artifact guide substats'),'_blank','noopener,noreferrer')}><Layers3 size={15}/> Artifacts</button><button className="button secondary" onClick={()=>window.open(youtubeSearch('F2P weapon comparison'),'_blank','noopener,noreferrer')}><Gem size={15}/> Weapons</button></div></div>
    <div className="guide-section-head"><div><div className="eyebrow">PERSONALIZED SEARCHES</div><h2>For your characters</h2></div><span className="pill muted">Based on tracked roster</span></div><div className="guide-character-grid">{(ownedCharacters.length?ownedCharacters:characters.slice(0,4)).slice(0,8).map(c=><div className="guide-character-card" key={c.id}><CharacterAvatar character={c}/><div className="guide-char-copy"><strong>{c.name}</strong><span>{c.element} · {c.role}</span><div className="guide-link-list"><button onClick={()=>openBuildPage(c)}>Full build <ArrowRight size={12}/></button><button onClick={()=>window.open(youtubeSearch(`${c.name} best teams rotation`),'_blank','noopener,noreferrer')}>Teams <ArrowUpRight size={12}/></button></div></div></div>)}</div>
    <div className="creator-cards"><a href="https://www.youtube.com/@Zy0x" target="_blank" rel="noreferrer" className="creator-card"><span className="creator-logo zyox">Z</span><span><strong>Zy0x</strong><small>Builds, rotations & character guides</small></span><ExternalLink size={15}/></a><a href="https://www.youtube.com/@IWinToLoseGaming" target="_blank" rel="noreferrer" className="creator-card"><span className="creator-logo iwintolose">IW</span><span><strong>IWinToLose Gaming</strong><small>Testing, comparisons & analysis</small></span><ExternalLink size={15}/></a><a href="https://keqingmains.com/" target="_blank" rel="noreferrer" className="creator-card"><span className="creator-logo kqm">K</span><span><strong>KeqingMains</strong><small>Written theorycrafting guides</small></span><ExternalLink size={15}/></a></div>
    <p className="source-footnote"><Info size={14}/> Recommendations are community-created, not official HoYoverse advice. Structured quick references are available for selected characters; use the linked Genshin.gg builds index and character-specific Zy0x / IWinToLose Gaming searches for additional or newer characters. Search links are used when a direct, verified video is not mapped.</p>
  </div>;

  const settingsPage = <div className="page-content">
    <SectionHeader eyebrow="PREFERENCES & DATA SOURCES" title="Settings" subtitle="Manage your local data, public data connections, and tracker setup."/>
    <div className="settings-grid"><div className="panel settings-card"><div className="settings-icon gold"><Database size={20}/></div><div className="eyebrow">CHARACTER CATALOGUE</div><h3>Refresh public game data</h3><p>Try loading a broader static character catalogue from the community genshin.dev API. Character data availability and image formats can vary; imported builds and materials are not treated as verified.</p>{dataNotice&&<div className={`notice compact-notice ${dataNotice.startsWith('Could not')?'warning':'success'}`}><Info size={14}/><span>{dataNotice}</span></div>}<button className="button primary" onClick={loadPublicCharacterData} disabled={isLoadingData}>{isLoadingData?<><RefreshCw className="spin" size={15}/> Loading catalogue…</>:<><RefreshCw size={15}/> Refresh characters</>}</button><a className="source-link" href="https://github.com/genshindev/api" target="_blank" rel="noreferrer">Dataset docs & license <ExternalLink size={12}/></a></div><div className="panel settings-card"><div className="settings-icon blue"><Link2 size={20}/></div><div className="eyebrow">PUBLIC ACCOUNT DATA</div><h3>Enka.Network showcase</h3><p>Use your UID to sync the public display list, detailed showcase gear when enabled, and optional saved builds from a verified public Enka profile. It remains a public-data integration, not a HoYoverse login. Respect provider refresh limits.</p><button className="button secondary" onClick={()=>navigate('account')}>Manage account connection <ArrowRight size={14}/></button><a className="source-link" href="https://github.com/EnkaNetwork/API-docs" target="_blank" rel="noreferrer">API usage rules <ExternalLink size={12}/></a></div><div className="panel settings-card"><div className="settings-icon green"><FileJson size={20}/></div><div className="eyebrow">BACKUP & PORTABILITY</div><h3>Your data belongs to you</h3><p>Export everything to a JSON backup file and import it on another browser/device. This version stores tracker data in this browser's local storage; no cloud account is configured.</p><div className="settings-button-row"><button className="button primary" onClick={exportTracker}><Download size={15}/> Export backup</button><button className="button secondary" onClick={()=>setShowImport(true)}><Upload size={15}/> Import backup</button></div></div><div className="panel settings-card"><div className="settings-icon violet"><ShieldCheck size={20}/></div><div className="eyebrow">PRIVACY & LIMITATIONS</div><h3>Safe by design</h3><p>No HoYoverse password or login token is requested. Account showcase sync is public-data only. Live material coordinates, exact upgrade calculator data, cloud sync, and authenticated accounts are not configured in this build.</p><ul className="settings-bullets"><li><Check size={14}/> Local persistent tracker</li><li><Check size={14}/> Editable quantities and goals</li><li><Check size={14}/> JSON export/import</li><li><Info size={14}/> No cloud authentication yet</li></ul></div></div>
    <div className="panel data-health-panel"><div className="panel-head"><div><div className="eyebrow">WORKSPACE STATUS</div><h3>Data health</h3></div><span className="pill success"><span className="live-dot"/> Local storage available</span></div><div className="data-health-grid"><div><span>Tracked characters</span><strong>{characters.length}</strong></div><div><span>Materials</span><strong>{persisted.materials.length}</strong></div><div><span>Saved teams</span><strong>{persisted.teams.length}</strong></div><div><span>Personal map markers</span><strong>{persisted.mapMarkers.length}</strong></div><div><span>Goals</span><strong>{persisted.goals.length}</strong></div><div><span>Enka snapshot</span><strong>{persisted.enkaSnapshot?'Available':'Not connected'}</strong></div></div></div>
    <div className="reset-zone"><div><strong>Reset local workspace</strong><p>Remove all custom progress and return to the starter example. Export a backup first if you want to keep your data.</p></div><button className="button danger-outline" onClick={()=>{if(window.confirm('Reset your Teyvat Companion data in this browser? Export a backup first if you want to keep it.')){localStorage.removeItem(STORAGE_KEY);setPersisted({characters:STARTER_CHARACTERS.map(c=>({...c})),materials:MATERIAL_STARTER.map(m=>({...m})),teams:STARTER_TEAMS.map(t=>({...t})),goals:[],mapMarkers:[],account:{ar:58,worldLevel:8,abyss:'Not set',primogems:0,wishes:0,pity:0,uid:'',nickname:'',resinAvailable:0},tasks:TASK_STARTER.map(t=>({...t})),enkaSnapshot:null,enkaNextFetchAt:0,goodInventory:null,akashaSnapshot:null,lastUpdated:null});setToast('Workspace reset');}}}><Trash2 size={14}/> Reset workspace</button></div>
  </div>;


  const artifactOptimizerPage = <div className="page-content">
    <SectionHeader eyebrow="ARTIFACT WORKSHOP" title="Artifact Optimizer" subtitle="Find the strongest five-piece loadout from the artifacts in your imported inventory—not just what is equipped right now." actions={<button className="button secondary" onClick={() => navigate('account')}><Database size={15}/> Account & inventory</button>}/>
    <div className="optimizer-hero-strip">
      <span className="optimizer-hero-icon"><Layers3 size={23}/></span>
      <div><strong>Use what you already own before spending resin.</strong><p>The optimizer compares compatible main stats, weighted substats, relevant 2-piece/4-piece set fit and optional saved-team context. It ranks alternatives and explains the trade-offs.</p></div>
      <div className="optimizer-hero-count"><strong>{persisted.goodInventory?.artifacts?.length || 0}</strong><span>imported artifacts</span></div>
    </div>
    <section className="panel optimizer-controls-panel">
      <div className="panel-head"><div><div className="eyebrow">BUILD TARGET</div><h3>Choose a character</h3></div><span className={persisted.goodInventory?.artifacts?.length ? 'pill success' : 'pill muted'}>{persisted.goodInventory?.artifacts?.length ? 'Inventory ready' : 'Inventory needed'}</span></div>
      <div className="optimizer-controls-grid">
        <label>Character to optimize<select value={optimizerCharacter?.id || ''} onChange={e=>{setOptimizerCharacterId(e.target.value);setOptimizerResult(null);setOptimizerError('');}}>{characters.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(character=><option key={character.id} value={character.id}>{character.name}{character.owned?' · Owned':''} · {character.element || 'Unknown'}</option>)}</select></label>
        <label>Team context (optional)<select value={optimizerTeamId} onChange={e=>{setOptimizerTeamId(e.target.value);setOptimizerResult(null);setOptimizerError('');}}><option value="">No team context</option>{persisted.teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      </div>
      {optimizerTeamId && !optimizerTeamContainsCharacter && <div className="notice warning optimizer-inline-notice"><Info size={14}/><span>The selected team does not contain {optimizerCharacter?.name || 'this character'}. Pick a team that includes the target, or select “No team context”.</span></div>}
      {persisted.goodInventory?.artifacts?.length ? <div className="optimizer-inventory-ready"><div><CheckCircle2 size={17}/><span><strong>{persisted.goodInventory.artifacts.length.toLocaleString()} artifacts loaded</strong><small>{persisted.goodInventory.summary?.lockedArtifacts || 0} locked · {persisted.goodInventory.summary?.highCritValueArtifacts || 0} pieces with 30+ generic CV · GOOD v{persisted.goodInventory.version}</small></span></div><button className="button secondary compact" onClick={()=>goodUploadRef.current?.click()}><Upload size={14}/> Replace import</button></div> : <div className="optimizer-no-inventory"><div className="optimizer-empty-icon"><Upload size={21}/></div><div><strong>Import a GOOD inventory to begin</strong><p>Export a GOOD JSON file with artifacts from a compatible tool, then import it here. Public UID sync alone cannot provide your unequipped pieces.</p><div className="optimizer-empty-actions"><input ref={goodUploadRef} className="hidden-input" type="file" accept="application/json,.json" onChange={importGoodFile}/><button className="button primary" onClick={()=>goodUploadRef.current?.click()}><Upload size={15}/> Import GOOD JSON</button><a className="button secondary link-button" href="https://frzyc.github.io/genshin-optimizer/" target="_blank" rel="noreferrer"><ExternalLink size={14}/> Genshin Optimizer</a></div></div></div>}
      {goodImportMessage && <div className={'notice '+(goodImportMessage.startsWith('Import failed')?'warning':'success')}><Info size={15}/><span>{goodImportMessage}</span></div>}
      <div className="optimizer-run-row"><div><span className="eyebrow">HOW THE SCORE WORKS</span><p>Main stat fit + stat-priority-weighted substats + role/team-aware set-bonus fit. This is a ranking heuristic, not an exact damage simulator.</p></div><button className="button primary optimizer-run-button" disabled={!persisted.goodInventory?.artifacts?.length || !optimizerCharacter} onClick={runArtifactOptimizer}><Sparkles size={15}/> Find best loadouts</button></div>
    </section>
    {optimizerError && <div className="notice warning optimizer-error"><Info size={16}/><span>{optimizerError}</span></div>}
    {optimizerResult && <section className="optimizer-results-section">
      <div className="optimizer-results-heading"><div><div className="eyebrow">RESULTS · {optimizerResult.combinationsSearched.toLocaleString()} COMBINATIONS CHECKED</div><h2>Recommended loadouts for {optimizerResult.characterName}</h2><p>{optimizerResult.scoringSummary}</p></div><button className="button secondary compact" onClick={runArtifactOptimizer}><RefreshCw size={14}/> Recalculate</button></div>
      {optimizerResult.excludedForTeam>0 && <div className="notice warning optimizer-inline-notice"><Info size={14}/><span>{optimizerResult.excludedForTeam} artifact(s) assigned to other members of the selected team were excluded so the same piece is not suggested for two active teammates.</span></div>}
      {!optimizerResult.profileAvailable && <div className="notice warning optimizer-inline-notice"><Info size={14}/><span>No curated in-app build profile exists for this character yet. The optimizer uses a broader role/element heuristic; verify recommended main stats and sets against a current creator guide.</span></div>}
      <div className="optimizer-result-cards">{optimizerResult.recommendations.map((build,index)=><details key={build.signature} className={'optimizer-loadout-card '+(index===0?'top-loadout':'')} open={index===0}>
        <summary className="optimizer-loadout-summary"><span className="optimizer-result-rank">{index+1}</span><span className="optimizer-result-title"><strong>{index===0?'Best available loadout':'Alternative loadout '+(index+1)}</strong><small>{build.score.toFixed(1)} build-fit points · {build.teamName ? 'Team: '+build.teamName : 'General character build'}</small></span><span className="optimizer-result-score">{build.score.toFixed(1)}<small>FIT</small></span><ChevronDown size={17}/></summary>
        <div className="optimizer-loadout-body">
          <div className="optimizer-piece-grid">{build.pieces.map(piece=><article className="optimizer-piece-card" key={piece.optimizerId}><div className="optimizer-piece-head"><span>{piece.slotLabel}</span><span>{piece.rarity}★{piece.lock?' · LOCKED':''}</span></div><strong className="optimizer-piece-set">{humanizeGameKey(piece.setKey)}</strong><div className={'optimizer-main-stat '+(piece.mainStatMatches?'matched':'')}>{formatArtifactStat(piece.mainStatKey)}</div><div className="optimizer-piece-level">+{piece.level} · {piece.score.toFixed(1)} piece-fit points</div><div className="optimizer-piece-substats">{(piece.substats||[]).map((stat,subIndex)=><span key={piece.optimizerId+'-'+subIndex}>{formatArtifactStat(stat.key)} <b>{stat.value}</b></span>)}</div><ul className="optimizer-piece-reasons">{piece.reasons.map((reason,reasonIndex)=><li key={reasonIndex}>{reason}</li>)}</ul>{piece.location && piece.characterId && piece.characterId!==optimizerCharacter?.id && <div className="optimizer-reassign-warning"><Info size={12}/> Currently assigned to {characters.find(character=>character.id===piece.characterId)?.name || piece.location}</div>}</article>)}</div>
          {build.setBreakdown.length>0 && <div className="optimizer-set-breakdown"><div className="eyebrow">SET BONUS FIT INCLUDED IN SCORE</div>{build.setBreakdown.map(set=><div className="optimizer-set-row" key={set.key}><span className="optimizer-set-count">{set.count} pc</span><div><strong>{set.label}</strong><small>{set.explanation}</small></div><b>+{set.points.toFixed(1)}</b></div>)}</div>}
          <div className="optimizer-loadout-footer"><p><Info size={14}/>{build.caution}</p><button className="button primary" onClick={()=>saveOptimizedPlan(build)}><Check size={15}/> Save as planned build</button></div>
        </div>
      </details>)}</div>
      <div className="optimizer-disclaimer"><ShieldCheck size={15}/><span>Suggestions never equip items in-game, delete items, or change lock states. Pieces already assigned to another character are flagged. Save a recommendation only when you are happy with it.</span></div>
    </section>}
  </div>;

  const pageContent = {'dashboard':dashboardPage,'characters':charactersPage,'builds':characterBuildsPage,'character-build-detail':characterBuildDetailPage,'optimizer':artifactOptimizerPage,'teams':teamsPage,'materials':materialsPage,'map':mapPage,'account':accountPage,'advisor':advisorPage,'guides':guidesPage,'settings':settingsPage}[page] || dashboardPage;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'mobile-open':''}`}>{sidebar}</aside>
    {mobileNav&&<button className="mobile-backdrop" aria-label="Close menu" onClick={()=>setMobileNav(false)}/>}
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb"><span>TEYVAT</span><ChevronRight size={14}/><strong>{page==='character-build-detail' ? (buildCharacter ? buildCharacter.name + ' Build' : 'Character Build') : (NAV_ITEMS.find(n=>n.id===page)?.label || 'Dashboard')}</strong></div></div><div className="topbar-actions"><div className="global-search"><Search size={16}/><input value={globalSearch} onChange={e=>{setGlobalSearch(e.target.value);if(e.target.value) setPage('characters');}} placeholder="Find characters…"/><kbd>⌘ K</kbd></div><button className="button secondary topbar-build-shortcut" onClick={()=>navigate('builds')} title="Open Character Builds"><BookOpen size={15}/><span>Builds</span></button><div className="topbar-divider"/><button className="icon-button quick-settings" title="Settings" onClick={()=>navigate('settings')}><Settings2 size={18}/></button><button className="topbar-profile" title="Account tracker" onClick={()=>navigate('account')}><span className="user-avatar">{(persisted.account.nickname || 'T').slice(0,1).toUpperCase()}</span><span className="rank-chip">AR {persisted.account.ar}</span><ChevronDown size={14}/></button></div></header><div key={page} className="page-animate">{pageContent}</div><footer className="global-footer"><span>✦ Teyvat Companion</span><span>Unofficial fan-made companion · Not affiliated with HoYoverse</span><span>Made for Travelers <span className="footer-heart">♡</span></span></footer></main>
    {activeCharacter && <CharacterModal character={characters.find(c=>c.id===activeCharacter.id)||activeCharacter} onClose={()=>setActiveCharacter(null)} onUpdate={updateCharacter} onGoal={addGoalForCharacter} onMaterials={addCharacterMaterialsToPlan} onToast={setToast} detailsLoading={characterDataLoadingId===activeCharacter.id} detailsError={characterDataError} materialLookup={gameMaterialLookupRef.current} onRetryDetails={openCharacter} onOpenBuild={openBuildPage}/>}
    {showImport && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setShowImport(false)}><div className="import-modal panel"><button className="modal-close icon-button" onClick={()=>setShowImport(false)}><X size={18}/></button><div className="modal-icon"><FileJson size={21}/></div><div className="eyebrow">RESTORE WORKSPACE</div><h2>Import a backup</h2><p>Paste the contents of a Teyvat Companion JSON backup, or select a file below.</p><button className="button secondary full-width" onClick={()=>uploadRef.current?.click()}><Upload size={15}/> Choose JSON backup file</button><input ref={uploadRef} className="hidden-input" type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{importTrackerObject(JSON.parse(await file.text()));}catch{setToast('Could not read that JSON backup.');}e.target.value='';}}/><div className="import-divider"><span>OR PASTE JSON</span></div><form onSubmit={importFromText}><textarea value={importText} onChange={e=>setImportText(e.target.value)} rows="7" placeholder={'{\n  "format": "teyvat-companion-backup-v1", ...\n}'} required/><button className="button primary full-width" type="submit"><Upload size={15}/> Import tracker data</button></form><p className="modal-footnote"><Info size={13}/> Import replaces the current tracker state. Export your current data first if needed.</p></div></div>}
    {toast&&<div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
  </div>;
}

function akashaStatDisplay(key, value) {
  if (value == null || value === '') return String(key || 'Unknown');
  const rawKey = String(key || 'Unknown').replace(/^FIGHT_PROP_/, '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  const keyLower = rawKey.toLowerCase();
  const percentage = /%|crit|critical|damage bonus|energy recharge|rate|efficiency|hp percent|atk percent|def percent/.test(keyLower);
  const number = Number(value);
  if (!Number.isFinite(number)) return rawKey + ' ' + value;
  const shown = percentage && Math.abs(number) <= 1.5 ? number * 100 : number;
  return rawKey + ' ' + (percentage ? shown.toFixed(1) + '%' : Number.isInteger(shown) ? shown.toLocaleString() : shown.toFixed(1));
}

function AkashaArtifactList({ artifacts = [] }) {
  if (!artifacts.length) return <p className="helper-note">AKASHA returned no artifact pieces for this build.</p>;
  return <div className="akasha-artifact-grid">{artifacts.map((artifact,index)=><article className="akasha-artifact-card" key={artifact.id + '-' + index}>
    <div className="akasha-artifact-top">{artifact.icon && /^https?:\/\//i.test(artifact.icon) ? <img src={artifact.icon} alt="" loading="lazy"/> : <span className="akasha-artifact-token"><Layers3 size={16}/></span>}<div><small>{artifact.slot}{artifact.rarity ? ' · ' + artifact.rarity + '★' : ''}{artifact.level != null ? ' · +' + artifact.level : ''}</small><strong>{artifact.name}</strong><span>{artifact.setName}</span></div></div>
    <div className="akasha-artifact-mainstat"><small>MAIN STAT</small><strong>{akashaStatDisplay(artifact.mainStat?.key, artifact.mainStat?.value)}</strong></div>
    <div className="akasha-artifact-substats"><small>SUBSTATS</small>{artifact.substats.map((stat,i)=><span key={stat.key + '-' + i}>{akashaStatDisplay(stat.key,stat.value)}</span>)}</div>
    {artifact.critValue != null && <div className="akasha-artifact-cv"><span>Crit Value</span><strong>{Number(artifact.critValue).toFixed(1)}</strong></div>}
  </article>)}</div>;
}

function CharacterModal({ character, onClose, onUpdate, onGoal, onMaterials, onToast, detailsLoading = false, detailsError = '', materialLookup = {}, onRetryDetails, onOpenBuild }) {
  const c=character;
  const [tab,setTab]=useState('overview');
  const [level,setLevel]=useState(Number(c.level)||1);
  const [talents,setTalents]=useState(c.talents||[1,1,1]);
  const [constellation,setConstellation]=useState(Number(c.constellation)||0);
  const [weaponName,setWeaponName]=useState(c.weaponName||'');
  const [artifact,setArtifact]=useState(c.artifact||'');
  const [mainStats,setMainStats]=useState(c.mainStats||'');
  const [role,setRole]=useState(c.role||'Unassigned');
  const [notes,setNotes]=useState(c.notes||'');
  const [owned,setOwned]=useState(!!c.owned);
  const meta=ELEMENT_META[c.element]||ELEMENT_META.Geo;
  const gameData=c.gameData;
  const ascensionPhases=gameData?.upgrade?.promotes || [];
  const fallbackAscensionGroups=Object.entries(gameData?.ascension_materials || {}).filter(([key,value])=>key.startsWith('level_')&&Array.isArray(value));
  const talentDetails=gameData?.talents || [];
  const materialGuides=c.materialGuides || gameData?.materialGuides || [];
  const wikiUrl='https://genshin-impact.fandom.com/wiki/'+encodeURIComponent(String(c.name||'').replace(/ /g,'_'));
  const kqmUrl='https://keqingmains.com/?s='+encodeURIComponent(c.name||'');
  const videoUrl=youtubeSearch(String(c.name||'')+' build guide artifacts weapons talents');
  const save=()=>{onUpdate(c.id,{level:Number(level)||1,talents:talents.map(t=>Math.max(1,Math.min(10,Number(t)||1))),constellation:Number(constellation)||0,weaponName,artifact,mainStats,role,notes,owned});onToast('Character tracker updated');onClose();};
  return <div className="modal-backdrop character-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="character-modal panel" style={{'--el-color':meta.color,'--el-soft':meta.soft}}><button className="modal-close icon-button" onClick={onClose}><X size={18}/></button><div className="character-modal-hero"><CharacterAvatar character={c} size="modal"/><div className="character-modal-heading"><div className="element-label" style={{color:meta.color}}><ElementGlyph element={c.element}/>{c.element} · {c.weapon}</div><h2>{c.name}</h2><div className="modal-subline"><span className="rarity-stars" aria-label={[4,5].includes(Number(c.rarity)) ? Number(c.rarity)+' star rarity' : 'Rarity data unavailable'}>{[4,5].includes(Number(c.rarity)) ? '★'.repeat(Number(c.rarity)) : 'Rarity N/A'}</span><span>{c.region||'Region not set'}</span><span>·</span><span>{c.owned?'In your roster':'Not owned yet'}</span></div><label className="toggle-owned"><input type="checkbox" checked={owned} onChange={e=>setOwned(e.target.checked)}/><span className="toggle-track"><i/></span><span>{owned?'Owned by you':'Mark as owned'}</span></label></div></div><div className="character-modal-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Overview</button><button className={tab==='build'?'active':''} onClick={()=>setTab('build')}>Build details</button><button className={tab==='gameData'?'active':''} onClick={()=>setTab('gameData')}>Talents & mats</button><button className={tab==='notes'?'active':''} onClick={()=>setTab('notes')}>Notes</button></div><div className="character-modal-body">{tab==='overview'&&<><div className="modal-section-intro"><div><div className="eyebrow">PERSONAL PROGRESSION</div><h3>Current investment</h3></div><span className="pill muted">Manual tracker</span></div><div className="character-level-control"><div><label className="field-label">Character level</label><div className="level-display"><strong>{level}</strong><span>/ 90</span></div></div><input type="range" min="1" max="90" value={level} onChange={e=>setLevel(Number(e.target.value))} aria-label="Character level"/><div className="level-markers"><span>Lv. 1</span><span>Lv. 90</span></div></div><div className="talent-levels"><label className="field-label">Talent levels <small>(manual)</small></label>{['Normal attack','Elemental skill','Elemental burst'].map((name,i)=><div className="talent-row" key={name}><span>{name}</span><div className="talent-input-wrap"><button onClick={()=>setTalents(p=>p.map((t,j)=>j===i?Math.max(1,Number(t)-1):t))} disabled={Number(talents[i])<=1}>−</button><strong>{talents[i]}</strong><button onClick={()=>setTalents(p=>p.map((t,j)=>j===i?Math.min(10,Number(t)+1):t))} disabled={Number(talents[i])>=10}>+</button></div></div>)}</div><div className="form-two-col"><label className="field-label">Constellation<select value={constellation} onChange={e=>setConstellation(e.target.value)}>{[0,1,2,3,4,5,6].map(v=><option key={v} value={v}>C{v}{v===0?' · C0': ''}</option>)}</select></label><label className="field-label">Combat role<select value={role} onChange={e=>setRole(e.target.value)}>{['Unassigned','Main DPS','Sub DPS','Support','Healer','Shielder','Off-field DPS','Driver'].map(v=><option key={v}>{v}</option>)}</select></label></div></>}{tab==='build'&&<><div className="modal-section-intro"><div><div className="eyebrow">YOUR BUILD</div><h3>Weapons & artifacts</h3></div><span className="pill muted">Editable notes</span></div><p className="helper-note"><Info size={13}/> These fields store your build notes. This starter version does not claim these are the currently optimal options for every team or patch.</p><label className="field-label">Equipped / planned weapon<input value={weaponName} onChange={e=>setWeaponName(e.target.value)} placeholder="Weapon name"/></label><label className="field-label">Artifact set<input value={artifact} onChange={e=>setArtifact(e.target.value)} placeholder="Artifact set or mixed pieces"/></label><label className="field-label">Main stats & substats<input value={mainStats} onChange={e=>setMainStats(e.target.value)} placeholder="Sands / Goblet / Circlet · priority substats"/></label><div className="build-note-card"><BookOpen size={16}/><div><strong>Need a verified build guide?</strong><p>Open community guides for the current character and compare weapon, artifact, and rotation advice.</p><button className="text-action" onClick={()=>window.open(youtubeSearch(`${c.name} build guide artifacts weapons`),'_blank','noopener,noreferrer')}>Search current guides <ArrowUpRight size={13}/></button><button className="button secondary" onClick={()=>onOpenBuild?.(c)}><BookOpen size={14}/> Open full build page</button></div></div></>}{tab==='gameData'&&<div className="game-data-tab"><div className="character-guide-links"><a className="button secondary" href={kqmUrl} target="_blank" rel="noreferrer"><BookOpen size={14}/> KeqingMains <ExternalLink size={12}/></a><a className="button secondary" href={youtubeSearch(String(c.name||'')+' Genshin Impact guide')} target="_blank" rel="noreferrer"><PlayCircle size={14}/> Video guides <ExternalLink size={12}/></a><a className="button secondary" href={wikiUrl} target="_blank" rel="noreferrer">Character wiki <ExternalLink size={12}/></a></div>{detailsLoading&&!gameData&&<p>Loading character data...</p>}{!detailsLoading&&!gameData&&<div><p>{detailsError||'Detailed game data has not loaded yet.'}</p>{c.apiId && <button className="text-action" onClick={()=>onRetryDetails?.(c)}>Try again <ArrowRight size={13}/></button>}</div>}{gameData&&<><h3>Ascension requirements</h3>{ascensionPhases.length?ascensionPhases.map((phase,i)=><div className="game-cost-group" key={phase.promoteLevel||phase.promote_level||i}><strong>Ascension {i+1}</strong><div>{normalizeCostItems(phase.costItems||phase.cost_items||phase.materials).map(item=><span className="game-material-chip" key={item.id+'-'+item.count}>{materialNameFor(item.id,materialLookup)} ×{item.count}</span>)}</div></div>):fallbackAscensionGroups.map(([stage,rows])=><div className="game-cost-group" key={stage}><strong>{stage.replace('level_','Up to Lv. ')}</strong><div className="game-material-chips">{rows.map((row,i)=><span className="game-material-chip" key={(row.name||'material')+'-'+i}>{row.name||'Material'} ×{row.value??row.count??0}</span>)}</div></div>)}{!ascensionPhases.length&&!fallbackAscensionGroups.length&&<p className="game-data-muted">Ascension requirements are unavailable in this source record. Use the linked reference and verify in-game.</p>}<h3>Talents & upgrade materials</h3>{talentDetails.map((talent,i)=>{const materialUpgrades=(talent.upgrades||[]).filter(up=>normalizeCostItems(up.costItems||up.cost_items||up.materials).length>0);return <details key={i}><summary>{talent.name||talent.type||('Talent '+(i+1))}</summary><p>{talent.description||''}</p>{materialUpgrades.map((up,j)=><div className="game-talent-upgrade" key={j}><strong>Level {up.level||up.lv||j+2}</strong><div className="game-material-chips">{normalizeCostItems(up.costItems||up.cost_items||up.materials).map(item=><span className="game-material-chip" key={item.id+'-'+item.count}>{materialNameFor(item.id,materialLookup)} ×{item.count}</span>)}</div></div>)}{!materialUpgrades.length&&<p className="game-data-muted">This source doesn't include per-level material costs for this talent. Check the character guide and verify in-game.</p>}</details>})}{materialGuides.length>0&&<section className="game-material-reference"><h3>Related farming materials</h3>{materialGuides.map((guide,i)=><div className="game-cost-group" key={guide.category+':'+guide.name+i}><strong>{guide.category}: {guide.name}</strong>{guide.items?.length>0&&<p>{guide.items.join(' · ')}</p>}{guide.availability&&<small>Domain days: {guide.availability}</small>}{guide.domain&&<small>Domain: {guide.domain}</small>}{guide.source&&<small>Source: {guide.source}</small>}</div>)}</section>}<h3>Constellations</h3>{(gameData.constellations||[]).map((node,i)=><details key={i}><summary>C{i+1} · {node.name||'Constellation'}</summary><p>{node.description||''}</p></details>)}</>}</div>}{tab==='notes'&&<><div className="modal-section-intro"><div><div className="eyebrow">PERSONAL NOTES</div><h3>What to remember</h3></div></div><label className="field-label">Build notes / team considerations<textarea rows="6" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add rotation reminders, teammate options, or what you want to improve…"/></label><div className="modal-quick-actions"><button className="button secondary" onClick={()=>onGoal(c)}><Target size={15}/> Add build goal</button><button className="button secondary" onClick={()=>onMaterials(c)}><PackageOpen size={15}/> Create material checklist</button></div></>}</div><div className="character-modal-footer"><div><span className="source-status"><Database size={13}/> Local tracker record</span><small>Save your edits to this browser</small></div><button className="button primary" onClick={save}><Check size={15}/> Save character</button></div></div></div>;
}
