import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronDown,
  ChevronRight, Compass, Download, ExternalLink, FileJson, Filter, Flame, Gem, Globe2, Info,
  Layers3, Link2, MapPinned, Menu, MoreHorizontal, PackageOpen, Pencil, PlayCircle, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Swords, Target, Trash2, Upload, Users,
  X, Zap, LayoutDashboard, ChartNoAxesCombined, CalendarDays, Database, Bot,
} from 'lucide-react';
import { ELEMENTS, ELEMENT_META, MATERIAL_STARTER, NAV_ITEMS, STARTER_CHARACTERS, STARTER_TEAMS } from './data';

const ICONS = { LayoutDashboard, Users, Swords, PackageOpen, MapPinned, ChartNoAxesCombined, PlayCircle, Settings2, Bot };
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
        account: { ar: saved.account?.ar ?? 58, worldLevel: saved.account?.worldLevel ?? 8, abyss: saved.account?.abyss || 'Not set', primogems: saved.account?.primogems ?? 0, wishes: saved.account?.wishes ?? 0, pity: saved.account?.pity ?? 0, uid: saved.account?.uid || '', nickname: saved.account?.nickname || '' },
        tasks: saved.tasks || TASK_STARTER,
        enkaSnapshot: saved.enkaSnapshot || null,
        lastUpdated: saved.lastUpdated || null,
      };
    }
  } catch (e) { console.warn('Could not read local tracker data', e); }
  return {
    characters: STARTER_CHARACTERS.map(c => ({...c})), materials: MATERIAL_STARTER.map(m => ({...m})), teams: STARTER_TEAMS.map(t => ({...t})), goals: [], mapMarkers: [],
    account: { ar: 58, worldLevel: 8, abyss: 'Not set', primogems: 0, wishes: 0, pity: 0, uid: '', nickname: '' }, tasks: TASK_STARTER.map(t => ({...t})), enkaSnapshot: null, lastUpdated: null,
  };
}

const formatNumber = n => Number(n || 0).toLocaleString('en-US');
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const youtubeSearch = (topic, creator = '') => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${creator} Genshin Impact ${topic}`)}`;

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
  const rawTalents = detail?.talent || detail?.talents || [];
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
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [character?.image]);
  return <div className={`character-avatar ${size}`} style={{'--el-color':(ELEMENT_META[character?.element] || {}).color || '#d9bd76', '--el-soft':(ELEMENT_META[character?.element] || {}).soft || 'rgba(217,189,118,.15)'}}>
    {!failed && character?.image ? <img src={character.image} alt="" loading="lazy" onError={() => setFailed(true)} /> : <div className="avatar-fallback"><ElementGlyph element={character?.element} size="large"/><span>{(character?.name || '?').slice(0,1)}</span></div>}
    <div className="avatar-shade" />
    <div className="avatar-stars">{'★'.repeat(Math.max(0, Math.min(5, character?.rarity || 4)))}</div>
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
  const [mobileNav, setMobileNav] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [toast, setToast] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
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

  const characters = persisted.characters;
  const ownedCharacters = characters.filter(c => c.owned);
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

  const updateCharacter = (id, changes) => saveState(prev => ({...prev, characters:prev.characters.map(c => c.id === id ? {...c,...changes} : c)}));
  const updateAccount = (field, value) => saveState(prev => ({...prev, account:{...prev.account,[field]:value}}));
  const toggleTask = id => saveState(prev => ({...prev, tasks:prev.tasks.map(t => t.id === id ? {...t,done:!t.done} : t)}));
  const openCharacter = async character => {
    setActiveCharacter(character);
    setCharacterDataError('');
    if (!character.apiId || character.gameData) return;
    setCharacterDataLoadingId(character.id);
    try {
      const detail = normalizeAmbrDetail(await fetchAmbrData(`avatar/${encodeURIComponent(character.apiId)}`));
      if (!detail || (!detail.upgrade?.promotes?.length && !detail.talents?.length)) throw new Error('No talent or ascension details were included.');
      const enriched = { ...character, gameData: detail, gameDataFetchedAt: new Date().toISOString() };
      saveState(prev => ({ ...prev, characters: prev.characters.map(c => c.id === character.id ? { ...c, gameData: detail, gameDataFetchedAt: enriched.gameDataFetchedAt } : c) }));
      setActiveCharacter(prev => prev?.id === character.id ? enriched : prev);
    } catch (error) {
      setCharacterDataError(`Could not load detailed game data: ${error.message}. You can still use the guide links below or try again after refreshing the catalogue.`);
    } finally {
      setCharacterDataLoadingId(current => current === character.id ? '' : current);
    }
  };
  const navigate = id => { setPage(id); setMobileNav(false); setGlobalSearch(''); };

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
      if (!records.length) throw new Error('The data source returned no characters.');
      const knownCharacters = characters;
      const mapped = records.map((item, i) => {
        const name = item.name || item.title || item.route || item.id || `Character ${i + 1}`;
        const routeId = item.route || item.id || name;
        const id = slugify(routeId);
        const normalizedName = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
        const existing = knownCharacters.find(c =>
          (item.id != null && c.apiId != null && String(c.apiId) === String(item.id)) ||
          c.id === id ||
          String(c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName
        );
        const rawElement = item.element || item.vision || item.visionType || item.vision_key || '';
        const elementKey = String(rawElement).toLowerCase();
        const element = ['Pyro','Hydro','Anemo','Electro','Dendro','Cryo','Geo'].find(el => elementKey.includes(el.toLowerCase())) || existing?.element || 'Unknown';
        const rawWeapon = item.weaponType || item.weapon_type || item.weapon || 'Unknown';
        const weaponMap = { sword:'Sword', claymore:'Claymore', polearm:'Polearm', catalyst:'Catalyst', bow:'Bow' };
        const weapon = weaponMap[String(rawWeapon).toLowerCase()] || rawWeapon;
        const rarity = Number(item.rank || item.rarity || item.stars || existing?.rarity || 4);
        const icon = item.icon || item.image || '';
        const image = existing?.image || (String(icon).startsWith('http') ? icon : icon ? `https://gi.yatta.moe/assets/UI/${icon}.png` : `https://genshin.jmp.blue/characters/${id}/portrait`);
        const gameData = existing?.gameData || (item.upgrade || item.skillTalents || item.ascension_materials ? normalizeAmbrDetail(item) : null);
        return {
          ...existing,
          id,
          apiId: String(item.id ?? existing?.apiId ?? ''),
          name,
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
          gameData,
          source,
        };
      });
      saveState(prev => {
        const byId = new Map(prev.characters.map(c => [c.id, c]));
        for (const fresh of mapped) {
          const existing = byId.get(fresh.id) || prev.characters.find(c =>
            (fresh.apiId && c.apiId && String(c.apiId) === String(fresh.apiId)) ||
            String(c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === String(fresh.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          byId.set(fresh.id, {
            ...fresh,
            ...(existing || {}),
            id: fresh.id,
            apiId: fresh.apiId || existing?.apiId || '',
            name: fresh.name,
            title: fresh.title || existing?.title || '',
            element: fresh.element || existing?.element || 'Unknown',
            weapon: fresh.weapon || existing?.weapon || 'Unknown',
            rarity: fresh.rarity || existing?.rarity || 4,
            region: fresh.region || existing?.region || 'Unknown',
            image: fresh.image || existing?.image || '',
            source: fresh.source,
            owned: existing?.owned ?? false,
            level: existing?.level ?? 1,
            talents: existing?.talents || [1,1,1],
            constellation: existing?.constellation ?? 0,
            weaponName: existing?.weaponName || '',
            artifact: existing?.artifact || '',
            mainStats: existing?.mainStats || '',
            role: existing?.role || fresh.role || 'Unassigned',
            gameData: existing?.gameData || fresh.gameData || null,
          });
        }
        return { ...prev, characters: [...byId.values()] };
      });
      setDataNotice(`Loaded ${mapped.length} character records from ${source}. Detailed talent and ascension costs load when you open a character profile. Existing owned status, levels, team presets, goals, and inventory were kept.`);
      setToast(`Character catalogue refreshed · ${mapped.length} records`);
    } catch (error) {
      setDataNotice(`Could not refresh the full character catalogue: ${error.message}. Your local records remain available; retry from Settings when the data source is reachable.`);
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    if (characters.length < 100) loadPublicCharacterData();
  }, []);

  async function syncPublicShowcase() {
    const uid = String(persisted.account.uid || '').trim();
    if (!/^\d{9,10}$/.test(uid)) { setSyncError('Enter a valid 9–10 digit Genshin UID first.'); return; }
    setSyncLoading(true); setSyncError('');
    try {
      const response = await fetch(`https://enka.network/api/uid/${uid}/`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('No public showcase found for that UID. Check that your in-game Character Showcase is public.');
        if (response.status === 429) throw new Error('Enka is rate-limiting requests right now. Wait before trying again.');
        throw new Error(`Enka returned ${response.status}. Try again later.`);
      }
      const data = await response.json();
      const info = data.playerInfo || {};
      const showcase = Array.isArray(data.avatarInfoList) ? data.avatarInfoList : [];
      const snapshot = {uid, fetchedAt:new Date().toISOString(), nickname:info.nickname || '', level:info.level ?? null, worldLevel:info.worldLevel ?? null, finishTime:info.finishTime ?? null, showcase:showcase.map(a=>({avatarId:a.avatarId, level:a.propMap?.['4001']?.val || a.level || null, fetter:a.fetterInfo?.expLevel || null, equipmentCount:(a.equipList || []).length})), rawFields:Object.keys(data)};
      saveState(prev=>({...prev, enkaSnapshot:snapshot, account:{...prev.account, nickname:info.nickname || prev.account.nickname, ar:info.level ?? prev.account.ar, worldLevel:info.worldLevel ?? prev.account.worldLevel}}));
      setToast(`Public showcase loaded · ${showcase.length} displayed character(s)`);
    } catch (e) { setSyncError(`${e.message} The manual tracker still works without account access.`); }
    finally { setSyncLoading(false); }
  }

  function exportTracker() {
    const payload = {...persisted, exportedAt:new Date().toISOString(), format:'teyvat-companion-backup-v1'};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`teyvat-companion-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); setToast('Backup exported');
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

  const sidebar = <>
    <div className="brand-lockup"><div className="brand-mark"><Compass size={22}/><span className="brand-spark">✦</span></div><div className="brand-text"><strong>TEYVAT<span> COMPANION</span></strong><small>YOUR ADVENTURE, OPTIMIZED</small></div></div>
    <div className="side-caption">WORKSPACE</div>
    <nav className="primary-nav">{NAV_ITEMS.map(item=>{const Icon=ICONS[item.icon] || Compass;return <button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>navigate(item.id)}><Icon size={18}/><span>{item.label}</span>{item.id==='materials' && materialStats.missing>0 && <i className="nav-count">{Math.min(99,materialStats.missing)}</i>}</button>;})}</nav>
    <div className="sidebar-spacer"/>
    <div className="side-quest-card"><div className="quest-top"><span className="quest-gem"><Gem size={17}/></span><span className="eyebrow">YOUR NEXT MILESTONE</span></div><strong>{persisted.goals.length ? persisted.goals[0].title : 'Set your next goal'}</strong><p>{persisted.goals.length ? `${persisted.goals.filter(g=>g.done).length} of ${persisted.goals.length} goals complete` : 'Turn your roster into a clear upgrade plan.'}</p><button className="text-action" onClick={()=>navigate('account')}>View progression <ArrowRight size={14}/></button></div>
    <div className="sidebar-bottom"><div className="local-badge"><span className="live-dot"/> <span>Local tracker active</span></div><button className="user-mini" onClick={()=>navigate('settings')}><div className="user-avatar">{(persisted.account.nickname || 'T').slice(0,1).toUpperCase()}</div><div><strong>{persisted.account.nickname || 'Traveler'}</strong><small>Personal workspace</small></div><MoreHorizontal size={18}/></button></div>
  </>;

  const dashboardPage = <div className="page-content">
    <SectionHeader eyebrow={`${new Date().toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()} · ADVENTURE OVERVIEW`} title={`Welcome back${persisted.account.nickname ? `, ${persisted.account.nickname}` : ', Traveler'}.`} subtitle="A little progress each day goes a long way across Teyvat." actions={<button className="button primary" onClick={()=>navigate('materials')}><Plus size={16}/> Plan an upgrade</button>}/>
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
    <SectionHeader eyebrow="ROSTER DATABASE" title="Characters" subtitle="Find a character, track their investment, and keep build details in one place." actions={<button className="button secondary" onClick={()=>navigate('settings')}><RefreshCw size={15}/> Refresh game data</button>}/>
    {dataNotice && <div className={`notice ${dataNotice.startsWith('Could not')?'warning':'success'}`}><Info size={16}/><span>{dataNotice}</span><button onClick={()=>setDataNotice('')}><X size={15}/></button></div>}
    <div className="filter-toolbar"><div className="search-field"><Search size={16}/><input value={characterFilter.search} onChange={e=>setCharacterFilter(p=>({...p,search:e.target.value}))} placeholder="Search characters, element, role…" /></div><div className="filter-controls"><select aria-label="Filter element" value={characterFilter.element} onChange={e=>setCharacterFilter(p=>({...p,element:e.target.value}))}>{ELEMENTS.map(el=><option key={el}>{el}</option>)}</select><select aria-label="Filter ownership" value={characterFilter.status} onChange={e=>setCharacterFilter(p=>({...p,status:e.target.value}))}><option>All characters</option><option>Owned</option><option>Not owned</option></select><select aria-label="Filter role" value={characterFilter.role} onChange={e=>setCharacterFilter(p=>({...p,role:e.target.value}))}><option>All roles</option>{['Main DPS','Sub DPS','Support','Healer','Shielder'].map(r=><option key={r}>{r}</option>)}</select></div></div>
    <div className="catalogue-meta"><span><strong>{visibleCharacters.length}</strong> characters in view</span><span className="pill muted"><Database size={13}/> {characters.length === STARTER_CHARACTERS.length ? 'Starter catalogue' : 'Expanded catalogue'}</span></div>
    <div className="character-grid">{visibleCharacters.map(c=><button key={c.id} className={`character-card ${c.owned?'is-owned':''}`} onClick={()=>openCharacter(c)}><CharacterAvatar character={c} size="card"/><div className="character-info"><div className="character-topline"><span className="element-label" style={{color:(ELEMENT_META[c.element]||{}).color}}><ElementGlyph element={c.element} size="small"/>{c.element}</span><span className="rarity-stars">{'★'.repeat(Math.max(0,Math.min(5,c.rarity||4)))}</span></div><h3>{c.name}</h3><p>{c.weapon || 'Weapon not set'} <span>·</span> {c.role || 'Role not set'}</p><div className="character-bottom"><span className={c.owned?'owned-label':'not-owned-label'}>{c.owned ? <><CheckCircle2 size={12}/> Owned · Lv. {c.level || 1}</> : 'Not owned'}</span><ChevronRight size={15}/></div></div></button>)}</div>
    {visibleCharacters.length===0 && <EmptyState icon={Search} title="No matching characters" description="Try another search term or clear your filters." action={<button className="button secondary" onClick={()=>setCharacterFilter({search:'',element:'All elements',status:'All characters',role:'All roles'})}>Clear filters</button>}/>}
    <div className="source-footnote"><Info size={14}/> This bundled catalogue is a starter workspace, not a claim that every current character is included. Settings can query the public static dataset; validate returned fields and current builds before relying on them.</div>
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

    <div className="map-warning"><Info size={16}/><span>The interactive world map below is provided by a separate community project. Your personal markers and checklists remain in Teyvat Companion; the embedded map may keep its own progress separately.</span></div>
    <section className="panel real-map-panel">
      <div className="real-map-heading">
        <div><div className="eyebrow">TEYVAT · REAL WORLD MAP</div><h3>Explore every region</h3><p>Pan, zoom, switch resource layers, and use the community map's own collection and route tools.</p></div>
        <div className="real-map-actions"><a className="button primary link-button" href="https://genshin-map-beta.netlify.app/" target="_blank" rel="noreferrer"><Globe2 size={15}/> Open community map <ExternalLink size={13}/></a><a className="button secondary link-button" href="https://act.hoyolab.com/ys/app/interactive-map/index.html" target="_blank" rel="noreferrer">Official HoYoLAB map <ExternalLink size={13}/></a></div>
      </div>
      <div className="real-map-frame"><iframe title="Interactive Genshin Impact Teyvat map" src="https://genshin-map-beta.netlify.app/" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
      <div className="real-map-note"><Info size={14}/><span>If this embedded map is blocked by the provider or your browser, use <a href="https://genshin-map-beta.netlify.app/" target="_blank" rel="noreferrer">Open community map</a> above. This map is community-maintained and its marker coverage may differ from the official HoYoLAB map.</span></div>
    </section>

    <div className="map-layout"><div className="panel map-canvas-panel"><div className="map-canvas-header"><div><div className="eyebrow">PERSONAL PLANNING SCHEMATIC · NOT TO SCALE</div><h3>{mapRegion} marker notes</h3></div><div className="map-controls"><button className="icon-button" onClick={()=>setMapRegion(REGIONS[Math.max(0,REGIONS.indexOf(mapRegion)-1)])} title="Previous region"><ArrowLeft size={16}/></button><button className="icon-button" onClick={()=>setMapRegion(REGIONS[Math.min(REGIONS.length-1,REGIONS.indexOf(mapRegion)+1)])} title="Next region"><ArrowRight size={16}/></button></div></div><div className="schematic-map"><div className="map-grid-lines"/><div className="map-continent continent-a"/><div className="map-continent continent-b"/><div className="map-continent continent-c"/><div className="map-continent continent-d"/><div className="map-lake lake-a"/><div className="map-lake lake-b"/><div className="map-land-label label-mond">WINDRISE</div><div className="map-land-label label-mtn">HIGHLANDS</div><div className="map-land-label label-forest">WILDS</div><div className="map-compass">N<br/><span>✦</span></div>{persisted.mapMarkers.filter(m=>m.region===mapRegion&&(mapType==='All resources'||m.type===mapType)).map((m,i)=><button key={m.id} className={`map-pin pin-${i%7} ${m.collected?'collected':''}`} title={`${m.name}${m.collected?' · collected':''}`} onClick={()=>saveState(p=>({...p,mapMarkers:p.mapMarkers.map(x=>x.id===m.id?{...x,collected:!x.collected}:x)}))}><MapPinned size={14}/><span>{m.name}</span></button>)}<div className="map-compass-legend"><span className="map-legend-dot gold-dot"/>Personal markers <span className="map-legend-dot green-dot"/>Collected</div></div><div className="region-selector">{REGIONS.map(region=><button key={region} className={mapRegion===region?'active':''} onClick={()=>setMapRegion(region)}>{region}</button>)}</div></div><div className="panel marker-panel"><div className="panel-head"><div><div className="eyebrow">PERSONAL ROUTE DATA</div><h3>Saved markers</h3></div><span className="pill muted">{persisted.mapMarkers.length} markers</span></div><form className="marker-form" onSubmit={addMarker}><label>Resource / location<input value={newMarker.name} onChange={e=>setNewMarker(p=>({...p,name:e.target.value}))} placeholder="e.g. Cor Lapis route stop" required/></label><div className="marker-field-row"><label>Region<select value={newMarker.region} onChange={e=>setNewMarker(p=>({...p,region:e.target.value}))}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></label><label>Type<select value={newMarker.type} onChange={e=>setNewMarker(p=>({...p,type:e.target.value}))}>{['Local specialty','Boss','Enemy drops','Ore','Fishing','Domain','Chest','Route note','Other'].map(t=><option key={t}>{t}</option>)}</select></label></div><label>Route notes<textarea rows="2" value={newMarker.note} onChange={e=>setNewMarker(p=>({...p,note:e.target.value}))} placeholder="Optional reminder or farming order"/></label><button className="button primary full-width" type="submit"><Plus size={15}/> Save personal marker</button></form><div className="marker-list-head"><span>Markers in {mapRegion}</span><select value={mapType} onChange={e=>setMapType(e.target.value)}><option>All resources</option>{['Local specialty','Boss','Enemy drops','Ore','Fishing','Domain','Chest','Route note','Other'].map(t=><option key={t}>{t}</option>)}</select></div><div className="marker-list">{persisted.mapMarkers.filter(m=>m.region===mapRegion&&(mapType==='All resources'||m.type===mapType)).map(m=><div className={`marker-row ${m.collected?'collected':''}`} key={m.id}><button className="marker-complete" onClick={()=>saveState(p=>({...p,mapMarkers:p.map(x=>x.id===m.id?{...x,collected:!x.collected}:x)}))}>{m.collected&&<Check size={12}/>}</button><div><strong>{m.name}</strong><small>{m.type}{m.note?` · ${m.note}`:''}</small></div><button className="icon-button danger tiny" onClick={()=>saveState(p=>({...p,mapMarkers:p.mapMarkers.filter(x=>x.id!==m.id)}))}><Trash2 size={13}/></button></div>)}{persisted.mapMarkers.filter(m=>m.region===mapRegion&&(mapType==='All resources'||m.type===mapType)).length===0&&<p className="empty-inline">No markers for this filter yet. Add a personal one above.</p>}</div></div></div>
    <div className="external-map-strip"><div className="external-map-icon"><Globe2 size={20}/></div><div><strong>Need exact coordinates and live resource layers?</strong><p>Community maps provide location-specific pins and routes that this personal schematic does not contain.</p></div><a href="https://act.hoyolab.com/ys/app/interactive-map/index.html" target="_blank" rel="noreferrer">HoYoLAB interactive map <ExternalLink size={13}/></a></div>
  </div>;

  const accountPage = <div className="page-content">
    <SectionHeader eyebrow="PROFILE & PROGRESSION" title="Account Tracker" subtitle="Keep your account snapshot, targets, and resources organized in one place." actions={<button className="button secondary" onClick={exportTracker}><Download size={15}/> Export backup</button>}/>
    <div className="account-overview-grid"><div className="account-profile-card"><div className="profile-emblem"><Compass size={28}/></div><div className="eyebrow">TRAVELER PROFILE</div><h2>{persisted.account.nickname || 'Your Traveler'}</h2><p>Personal account record</p><div className="profile-stats"><div><strong>{persisted.account.ar}</strong><small>Adventure Rank</small></div><div><strong>{persisted.account.worldLevel}</strong><small>World Level</small></div><div><strong>{ownedCharacters.length}</strong><small>Owned</small></div></div><div className="profile-footer"><span><span className="live-dot"/> Saved on this device</span><button className="text-action" onClick={()=>navigate('settings')}>Connection settings <ArrowRight size={13}/></button></div></div><div className="account-form-panel panel"><div className="panel-head"><div><div className="eyebrow">MANUAL ACCOUNT DETAILS</div><h3>Edit your snapshot</h3></div><span className="pill muted"><Pencil size={12}/> Editable</span></div><div className="account-input-grid"><label>In-game nickname<input value={persisted.account.nickname} onChange={e=>updateAccount('nickname',e.target.value)} placeholder="Optional nickname"/></label><label>Adventure Rank<input type="number" min="1" max="60" value={persisted.account.ar} onChange={e=>updateAccount('ar',Math.max(1,Math.min(60,Number(e.target.value)||1)))}/></label><label>World Level<input type="number" min="0" max="9" value={persisted.account.worldLevel} onChange={e=>updateAccount('worldLevel',Math.max(0,Math.min(9,Number(e.target.value)||0)))}/></label><label>Spiral Abyss progress<input value={persisted.account.abyss} onChange={e=>updateAccount('abyss',e.target.value)} placeholder="e.g. 12-3 / not attempted"/></label><label>Primogems (manual)<input type="number" min="0" value={persisted.account.primogems} onChange={e=>updateAccount('primogems',Math.max(0,Number(e.target.value)||0))}/></label><label>Wishes available (manual)<input type="number" min="0" value={persisted.account.wishes} onChange={e=>updateAccount('wishes',Math.max(0,Number(e.target.value)||0))}/></label><label>Current pity (manual)<input type="number" min="0" max="90" value={persisted.account.pity} onChange={e=>updateAccount('pity',Math.max(0,Math.min(90,Number(e.target.value)||0)))}/></label><label>Genshin UID (public showcase only)<input inputMode="numeric" value={persisted.account.uid} onChange={e=>updateAccount('uid',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="9–10 digit UID"/></label></div><div className="profile-warning"><ShieldCheck size={15}/><span>Never enter your HoYoverse password, verification code, session cookie, or authentication token here.</span></div></div></div>
    <div className="panel sync-panel"><div className="panel-head"><div><div className="eyebrow">OPTIONAL PUBLIC DATA</div><h3>Sync character showcase</h3></div><span className={`sync-status ${persisted.enkaSnapshot?'connected':''}`}><span className="live-dot"/>{persisted.enkaSnapshot?'Connected snapshot':'Not connected'}</span></div><p className="panel-description">Fetch only what your public in-game Character Showcase exposes through Enka.Network. This will not reveal private inventory, exact material counts, Resin, or wish history. A UID lookup is not a login.</p><button className="button primary" onClick={syncPublicShowcase} disabled={syncLoading}>{syncLoading?<><RefreshCw className="spin" size={15}/> Connecting…</>:<><Link2 size={15}/> Fetch public showcase</>}</button>{syncError&&<div className="notice warning sync-message"><Info size={15}/><span>{syncError}</span></div>}{persisted.enkaSnapshot&&<div className="sync-result"><div className="sync-result-top"><div><strong>Public snapshot loaded</strong><small>UID {persisted.enkaSnapshot.uid} · {new Date(persisted.enkaSnapshot.fetchedAt).toLocaleString()}</small></div><button className="text-action" onClick={syncPublicShowcase}><RefreshCw size={13}/> Refresh</button></div><div className="sync-facts"><div><small>Nickname</small><strong>{persisted.enkaSnapshot.nickname || 'Not public'}</strong></div><div><small>Adventure Rank</small><strong>{persisted.enkaSnapshot.level ?? 'Not public'}</strong></div><div><small>World Level</small><strong>{persisted.enkaSnapshot.worldLevel ?? 'Not public'}</strong></div><div><small>Showcase entries</small><strong>{persisted.enkaSnapshot.showcase?.length ?? 0}</strong></div></div>{persisted.enkaSnapshot.showcase?.length>0&&<div className="showcase-id-list"><span>Returned avatar IDs</span>{persisted.enkaSnapshot.showcase.map((a,i)=><span key={`${a.avatarId}-${i}`} className="avatar-id-chip">ID {a.avatarId}{a.level?` · Lv. ${a.level}`:''}{a.equipmentCount?` · ${a.equipmentCount} gear entries`:''}</span>)}</div>}<p className="helper-note"><Info size={13}/> This MVP safely records the showcase snapshot and IDs. It does not yet translate every game-internal avatar ID into a fully enriched character build, so this is not a full roster import.</p></div>}</div>
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
    <div className="guide-section-head"><div><div className="eyebrow">PERSONALIZED SEARCHES</div><h2>For your characters</h2></div><span className="pill muted">Based on tracked roster</span></div><div className="guide-character-grid">{(ownedCharacters.length?ownedCharacters:characters.slice(0,4)).slice(0,8).map(c=><div className="guide-character-card" key={c.id}><CharacterAvatar character={c}/><div className="guide-char-copy"><strong>{c.name}</strong><span>{c.element} · {c.role}</span><div className="guide-link-list"><button onClick={()=>window.open(youtubeSearch(`${c.name} build artifacts weapons`),'_blank','noopener,noreferrer')}>Build <ArrowUpRight size={12}/></button><button onClick={()=>window.open(youtubeSearch(`${c.name} best teams rotation`),'_blank','noopener,noreferrer')}>Teams <ArrowUpRight size={12}/></button></div></div></div>)}</div>
    <div className="creator-cards"><a href="https://www.youtube.com/@Zy0x" target="_blank" rel="noreferrer" className="creator-card"><span className="creator-logo zyox">Z</span><span><strong>Zy0x</strong><small>Builds, rotations & character guides</small></span><ExternalLink size={15}/></a><a href="https://www.youtube.com/@IWinToLoseGaming" target="_blank" rel="noreferrer" className="creator-card"><span className="creator-logo iwintolose">IW</span><span><strong>IWinToLose Gaming</strong><small>Testing, comparisons & analysis</small></span><ExternalLink size={15}/></a><a href="https://keqingmains.com/" target="_blank" rel="noreferrer" className="creator-card"><span className="creator-logo kqm">K</span><span><strong>KeqingMains</strong><small>Written theorycrafting guides</small></span><ExternalLink size={15}/></a></div>
    <p className="source-footnote"><Info size={14}/> Recommendations are community-created, not official HoYoverse advice. This page intentionally uses search results and creator homepages until a YouTube API key and verified video metadata source are configured.</p>
  </div>;

  const settingsPage = <div className="page-content">
    <SectionHeader eyebrow="PREFERENCES & DATA SOURCES" title="Settings" subtitle="Manage your local data, public data connections, and tracker setup."/>
    <div className="settings-grid"><div className="panel settings-card"><div className="settings-icon gold"><Database size={20}/></div><div className="eyebrow">CHARACTER CATALOGUE</div><h3>Refresh public game data</h3><p>Try loading a broader static character catalogue from the community genshin.dev API. Character data availability and image formats can vary; imported builds and materials are not treated as verified.</p>{dataNotice&&<div className={`notice compact-notice ${dataNotice.startsWith('Could not')?'warning':'success'}`}><Info size={14}/><span>{dataNotice}</span></div>}<button className="button primary" onClick={loadPublicCharacterData} disabled={isLoadingData}>{isLoadingData?<><RefreshCw className="spin" size={15}/> Loading catalogue…</>:<><RefreshCw size={15}/> Refresh characters</>}</button><a className="source-link" href="https://github.com/genshindev/api" target="_blank" rel="noreferrer">Dataset docs & license <ExternalLink size={12}/></a></div><div className="panel settings-card"><div className="settings-icon blue"><Link2 size={20}/></div><div className="eyebrow">PUBLIC ACCOUNT DATA</div><h3>Enka.Network showcase</h3><p>Use your UID to request public showcase details. Only displayed characters are exposed. Be mindful of rate limits; the manual tracker is always available.</p><button className="button secondary" onClick={()=>navigate('account')}>Manage account connection <ArrowRight size={14}/></button><a className="source-link" href="https://github.com/EnkaNetwork/API-docs" target="_blank" rel="noreferrer">API usage rules <ExternalLink size={12}/></a></div><div className="panel settings-card"><div className="settings-icon green"><FileJson size={20}/></div><div className="eyebrow">BACKUP & PORTABILITY</div><h3>Your data belongs to you</h3><p>Export everything to a JSON backup file and import it on another browser/device. This version stores tracker data in this browser's local storage; no cloud account is configured.</p><div className="settings-button-row"><button className="button primary" onClick={exportTracker}><Download size={15}/> Export backup</button><button className="button secondary" onClick={()=>setShowImport(true)}><Upload size={15}/> Import backup</button></div></div><div className="panel settings-card"><div className="settings-icon violet"><ShieldCheck size={20}/></div><div className="eyebrow">PRIVACY & LIMITATIONS</div><h3>Safe by design</h3><p>No HoYoverse password or login token is requested. Account showcase sync is public-data only. Live material coordinates, exact upgrade calculator data, cloud sync, and authenticated accounts are not configured in this build.</p><ul className="settings-bullets"><li><Check size={14}/> Local persistent tracker</li><li><Check size={14}/> Editable quantities and goals</li><li><Check size={14}/> JSON export/import</li><li><Info size={14}/> No cloud authentication yet</li></ul></div></div>
    <div className="panel data-health-panel"><div className="panel-head"><div><div className="eyebrow">WORKSPACE STATUS</div><h3>Data health</h3></div><span className="pill success"><span className="live-dot"/> Local storage available</span></div><div className="data-health-grid"><div><span>Tracked characters</span><strong>{characters.length}</strong></div><div><span>Materials</span><strong>{persisted.materials.length}</strong></div><div><span>Saved teams</span><strong>{persisted.teams.length}</strong></div><div><span>Personal map markers</span><strong>{persisted.mapMarkers.length}</strong></div><div><span>Goals</span><strong>{persisted.goals.length}</strong></div><div><span>Enka snapshot</span><strong>{persisted.enkaSnapshot?'Available':'Not connected'}</strong></div></div></div>
    <div className="reset-zone"><div><strong>Reset local workspace</strong><p>Remove all custom progress and return to the starter example. Export a backup first if you want to keep your data.</p></div><button className="button danger-outline" onClick={()=>{if(window.confirm('Reset your Teyvat Companion data in this browser? Export a backup first if you want to keep it.')){localStorage.removeItem(STORAGE_KEY);setPersisted({characters:STARTER_CHARACTERS.map(c=>({...c})),materials:MATERIAL_STARTER.map(m=>({...m})),teams:STARTER_TEAMS.map(t=>({...t})),goals:[],mapMarkers:[],account:{ar:58,worldLevel:8,abyss:'Not set',primogems:0,wishes:0,pity:0,uid:'',nickname:''},tasks:TASK_STARTER.map(t=>({...t})),enkaSnapshot:null,lastUpdated:null});setToast('Workspace reset');}}}><Trash2 size={14}/> Reset workspace</button></div>
  </div>;


  const pageContent = {'dashboard':dashboardPage,'characters':charactersPage,'teams':teamsPage,'materials':materialsPage,'map':mapPage,'account':accountPage,'advisor':advisorPage,'guides':guidesPage,'settings':settingsPage}[page] || dashboardPage;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'mobile-open':''}`}>{sidebar}</aside>
    {mobileNav&&<button className="mobile-backdrop" aria-label="Close menu" onClick={()=>setMobileNav(false)}/>}
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb"><span>TEYVAT</span><ChevronRight size={14}/><strong>{NAV_ITEMS.find(n=>n.id===page)?.label || 'Dashboard'}</strong></div></div><div className="topbar-actions"><div className="global-search"><Search size={16}/><input value={globalSearch} onChange={e=>{setGlobalSearch(e.target.value);if(e.target.value) setPage('characters');}} placeholder="Find characters…"/><kbd>⌘ K</kbd></div><div className="topbar-divider"/><button className="icon-button quick-settings" title="Settings" onClick={()=>navigate('settings')}><Settings2 size={18}/></button><button className="topbar-profile" title="Account tracker" onClick={()=>navigate('account')}><span className="user-avatar">{(persisted.account.nickname || 'T').slice(0,1).toUpperCase()}</span><span className="rank-chip">AR {persisted.account.ar}</span><ChevronDown size={14}/></button></div></header><div key={page} className="page-animate">{pageContent}</div><footer className="global-footer"><span>✦ Teyvat Companion</span><span>Unofficial fan-made companion · Not affiliated with HoYoverse</span><span>Made for Travelers <span className="footer-heart">♡</span></span></footer></main>
    {activeCharacter && <CharacterModal character={characters.find(c=>c.id===activeCharacter.id)||activeCharacter} onClose={()=>setActiveCharacter(null)} onUpdate={updateCharacter} onGoal={addGoalForCharacter} onMaterials={addCharacterMaterialsToPlan} onToast={setToast} detailsLoading={characterDataLoadingId===activeCharacter.id} detailsError={characterDataError} materialLookup={gameMaterialLookupRef.current} onRetryDetails={openCharacter}/>}
    {showImport && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setShowImport(false)}><div className="import-modal panel"><button className="modal-close icon-button" onClick={()=>setShowImport(false)}><X size={18}/></button><div className="modal-icon"><FileJson size={21}/></div><div className="eyebrow">RESTORE WORKSPACE</div><h2>Import a backup</h2><p>Paste the contents of a Teyvat Companion JSON backup, or select a file below.</p><button className="button secondary full-width" onClick={()=>uploadRef.current?.click()}><Upload size={15}/> Choose JSON backup file</button><input ref={uploadRef} className="hidden-input" type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{importTrackerObject(JSON.parse(await file.text()));}catch{setToast('Could not read that JSON backup.');}e.target.value='';}}/><div className="import-divider"><span>OR PASTE JSON</span></div><form onSubmit={importFromText}><textarea value={importText} onChange={e=>setImportText(e.target.value)} rows="7" placeholder={'{\n  "format": "teyvat-companion-backup-v1", ...\n}'} required/><button className="button primary full-width" type="submit"><Upload size={15}/> Import tracker data</button></form><p className="modal-footnote"><Info size={13}/> Import replaces the current tracker state. Export your current data first if needed.</p></div></div>}
    {toast&&<div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
  </div>;
}

function CharacterModal({ character, onClose, onUpdate, onGoal, onMaterials, onToast, detailsLoading = false, detailsError = '', materialLookup = {}, onRetryDetails }) {
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
  const talentDetails=gameData?.talents || [];
  const wikiUrl='https://genshin-impact.fandom.com/wiki/'+encodeURIComponent(String(c.name||'').replace(/ /g,'_'));
  const kqmUrl='https://keqingmains.com/?s='+encodeURIComponent(c.name||'');
  const videoUrl=youtubeSearch(String(c.name||'')+' build guide artifacts weapons talents');
  const save=()=>{onUpdate(c.id,{level:Number(level)||1,talents:talents.map(t=>Math.max(1,Math.min(10,Number(t)||1))),constellation:Number(constellation)||0,weaponName,artifact,mainStats,role,notes,owned});onToast('Character tracker updated');onClose();};
  return <div className="modal-backdrop character-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="character-modal panel" style={{'--el-color':meta.color,'--el-soft':meta.soft}}><button className="modal-close icon-button" onClick={onClose}><X size={18}/></button><div className="character-modal-hero"><CharacterAvatar character={c} size="modal"/><div className="character-modal-heading"><div className="element-label" style={{color:meta.color}}><ElementGlyph element={c.element}/>{c.element} · {c.weapon}</div><h2>{c.name}</h2><div className="modal-subline"><span className="rarity-stars">{'★'.repeat(c.rarity||4)}</span><span>{c.region||'Region not set'}</span><span>·</span><span>{c.owned?'In your roster':'Not owned yet'}</span></div><label className="toggle-owned"><input type="checkbox" checked={owned} onChange={e=>setOwned(e.target.checked)}/><span className="toggle-track"><i/></span><span>{owned?'Owned by you':'Mark as owned'}</span></label></div></div><div className="character-modal-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Overview</button><button className={tab==='build'?'active':''} onClick={()=>setTab('build')}>Build details</button><button className={tab==='gameData'?'active':''} onClick={()=>setTab('gameData')}>Talents & mats</button><button className={tab==='notes'?'active':''} onClick={()=>setTab('notes')}>Notes</button></div><div className="character-modal-body">{tab==='overview'&&<><div className="modal-section-intro"><div><div className="eyebrow">PERSONAL PROGRESSION</div><h3>Current investment</h3></div><span className="pill muted">Manual tracker</span></div><div className="character-level-control"><div><label className="field-label">Character level</label><div className="level-display"><strong>{level}</strong><span>/ 90</span></div></div><input type="range" min="1" max="90" value={level} onChange={e=>setLevel(Number(e.target.value))} aria-label="Character level"/><div className="level-markers"><span>Lv. 1</span><span>Lv. 90</span></div></div><div className="talent-levels"><label className="field-label">Talent levels <small>(manual)</small></label>{['Normal attack','Elemental skill','Elemental burst'].map((name,i)=><div className="talent-row" key={name}><span>{name}</span><div className="talent-input-wrap"><button onClick={()=>setTalents(p=>p.map((t,j)=>j===i?Math.max(1,Number(t)-1):t))} disabled={Number(talents[i])<=1}>−</button><strong>{talents[i]}</strong><button onClick={()=>setTalents(p=>p.map((t,j)=>j===i?Math.min(10,Number(t)+1):t))} disabled={Number(talents[i])>=10}>+</button></div></div>)}</div><div className="form-two-col"><label className="field-label">Constellation<select value={constellation} onChange={e=>setConstellation(e.target.value)}>{[0,1,2,3,4,5,6].map(v=><option key={v} value={v}>C{v}{v===0?' · C0': ''}</option>)}</select></label><label className="field-label">Combat role<select value={role} onChange={e=>setRole(e.target.value)}>{['Unassigned','Main DPS','Sub DPS','Support','Healer','Shielder','Off-field DPS','Driver'].map(v=><option key={v}>{v}</option>)}</select></label></div></>}{tab==='build'&&<><div className="modal-section-intro"><div><div className="eyebrow">YOUR BUILD</div><h3>Weapons & artifacts</h3></div><span className="pill muted">Editable notes</span></div><p className="helper-note"><Info size={13}/> These fields store your build notes. This starter version does not claim these are the currently optimal options for every team or patch.</p><label className="field-label">Equipped / planned weapon<input value={weaponName} onChange={e=>setWeaponName(e.target.value)} placeholder="Weapon name"/></label><label className="field-label">Artifact set<input value={artifact} onChange={e=>setArtifact(e.target.value)} placeholder="Artifact set or mixed pieces"/></label><label className="field-label">Main stats & substats<input value={mainStats} onChange={e=>setMainStats(e.target.value)} placeholder="Sands / Goblet / Circlet · priority substats"/></label><div className="build-note-card"><BookOpen size={16}/><div><strong>Need a verified build guide?</strong><p>Open community guides for the current character and compare weapon, artifact, and rotation advice.</p><button className="text-action" onClick={()=>window.open(youtubeSearch(`${c.name} build guide artifacts weapons`),'_blank','noopener,noreferrer')}>Search current guides <ArrowUpRight size={13}/></button></div></div></>}{tab==='gameData'&&<div className="game-data-tab"><div className="character-guide-links"><a className="button secondary" href={kqmUrl} target="_blank" rel="noreferrer"><BookOpen size={14}/> KeqingMains <ExternalLink size={12}/></a><a className="button secondary" href={youtubeSearch(String(c.name||'')+' Genshin Impact guide')} target="_blank" rel="noreferrer"><PlayCircle size={14}/> Video guides <ExternalLink size={12}/></a><a className="button secondary" href={wikiUrl} target="_blank" rel="noreferrer">Character wiki <ExternalLink size={12}/></a></div>{detailsLoading&&!gameData&&<p>Loading character data...</p>}{!detailsLoading&&!gameData&&<div><p>{detailsError||'Detailed game data has not loaded yet.'}</p><button className="text-action" onClick={()=>onRetryDetails?.(c)}>Try again <ArrowRight size={13}/></button></div>}{gameData&&<><h3>Ascension requirements</h3>{ascensionPhases.map((phase,i)=><div className="game-cost-group" key={i}><strong>Ascension {i+1}</strong><div>{normalizeCostItems(phase.costItems||phase.cost_items||phase.materials).map(item=><span className="game-material-chip" key={item.id+'-'+item.count}>{materialNameFor(item.id,materialLookup)} ×{item.count} </span>)}</div></div>)}<h3>Talents & upgrade materials</h3>{talentDetails.map((talent,i)=><details key={i}><summary>{talent.name||talent.type||('Talent '+(i+1))}</summary><p>{talent.description||''}</p>{(talent.upgrades||[]).map((up,j)=><div key={j}><strong>Level {up.level||up.lv||j+2}</strong><div>{normalizeCostItems(up.costItems||up.cost_items||up.materials).map(item=><span className="game-material-chip" key={item.id+'-'+item.count}>{materialNameFor(item.id,materialLookup)} ×{item.count} </span>)}</div></div>)}</details>)}<h3>Constellations</h3>{(gameData.constellations||[]).map((node,i)=><details key={i}><summary>C{i+1} · {node.name||'Constellation'}</summary><p>{node.description||''}</p></details>)}</>}</div>}{tab==='notes'&&<><div className="modal-section-intro"><div><div className="eyebrow">PERSONAL NOTES</div><h3>What to remember</h3></div></div><label className="field-label">Build notes / team considerations<textarea rows="6" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add rotation reminders, teammate options, or what you want to improve…"/></label><div className="modal-quick-actions"><button className="button secondary" onClick={()=>onGoal(c)}><Target size={15}/> Add build goal</button><button className="button secondary" onClick={()=>onMaterials(c)}><PackageOpen size={15}/> Create material checklist</button></div></>}</div><div className="character-modal-footer"><div><span className="source-status"><Database size={13}/> Local tracker record</span><small>Save your edits to this browser</small></div><button className="button primary" onClick={save}><Check size={15}/> Save character</button></div></div></div>;
}
