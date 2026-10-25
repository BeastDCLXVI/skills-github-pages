import { system, world } from '@minecraft/server';
import { CLANS, FOCI, NATURES, NATURE_SLOTS, NINDO, RANKS } from './data.js';
import { clamp, pick, settings, weighted } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

/**
 * Everything the add-on remembers about a shinobi. Persisted as JSON in the
 * player's `sr:data` dynamic property; current chakra lives in `sr:chakra`.
 * @typedef {{
 *   v: number, clan: string, natures: string[], rank: number, xp: number, jp: number,
 *   learned: string[], slots: string[], sel: number,
 *   eye: string | null, eyeStage: number, eyeXp: number, eyeOn: boolean, strain: number,
 *   bijuu: string | null, sync: number,
 *   karma: boolean, karmaEnergy: number, contracts: string[], unlocks: string[], wood: boolean, ascended: boolean,
 *   eternal: boolean, sageEnergy: number, rerolls: number, pity: number, kills: number, casts: number,
 *   mission: Mission | null, board: Mission[], boardDay: number, missionsDone: number,
 *   nindo: string | null, motto: string, nindoDay: number, resolve: number, bonds: Record<string, Bond>,
 *   journalDay: number, journalDays: number, focus: string | null, focus2: string | null, mood: number,
 *   intention: string, innerPeace: boolean, trialDay: number, trials: number,
 *   hud: boolean, joined: number
 * }} ShinobiData
 *
 * A bond with another player (`p:<id>`) or one of your companions (`c:<id>`).
 * @typedef {{ name: string, pts: number, gone?: boolean }} Bond
 *
 * @typedef {{
 *   id: string, grade: string, kind: 'hunt' | 'gather' | 'cast' | 'train', target: string, label: string,
 *   need: number, have: number, ryo: number, xp: number, jp: number
 * }} Mission
 */

const VERSION = 3;
const KEY = 'sr:data';
const CHAKRA_KEY = 'sr:chakra';

/** @type {Map<string, ShinobiData>} */
const cache = new Map();
/** @type {Set<string>} */
const dirty = new Set();

/** Weighted clan roll. @param {boolean} [allowLegendary] */
export function rollClan(allowLegendary = true) {
  /** @type {Array<[string, number]>} */
  const entries = Object.entries(CLANS)
    .filter(([, c]) => allowLegendary || c.rarity !== 'Legendary')
    .map(([id, c]) => [id, c.weight]);
  return weighted(entries);
}

/** @param {string} clan */
export function rollNature(clan) {
  return pick(CLANS[clan]?.natures ?? Object.keys(NATURES));
}

/** @returns {ShinobiData} */
function fresh() {
  const clan = rollClan(false);
  return {
    v: VERSION, clan, natures: [rollNature(clan)], rank: 0, xp: 0, jp: 3,
    learned: ['substitution', 'body_flicker', 'transformation'],
    slots: ['substitution', 'body_flicker', 'transformation'], sel: 0,
    eye: null, eyeStage: 0, eyeXp: 0, eyeOn: false, strain: 0,
    bijuu: null, sync: 0,
    karma: false, karmaEnergy: 0, contracts: [], unlocks: [], wood: false, ascended: false, eternal: false,
    sageEnergy: 0, rerolls: 0, pity: 0, kills: 0, casts: 0,
    mission: null, board: [], boardDay: -1, missionsDone: 0,
    nindo: null, motto: '', nindoDay: -1, resolve: 0, bonds: {},
    journalDay: -1, journalDays: 0, focus: null, focus2: null, mood: 1, intention: '',
    innerPeace: false, trialDay: -1, trials: 0,
    hud: settings().hudDefault, joined: Date.now(),
  };
}

/** @param {Partial<ShinobiData> & { contract?: boolean }} raw @returns {ShinobiData} */
function migrate(raw) {
  const base = fresh();
  const { contract, ...rest } = raw;
  const d = /** @type {ShinobiData} */ ({ ...base, ...rest, v: VERSION });
  // v1 stored a single toad contract flag
  if (contract && !d.contracts.includes('toad')) d.contracts = [...d.contracts, 'toad'];
  if (!CLANS[d.clan]) d.clan = base.clan;
  d.natures = (d.natures ?? []).filter((n) => NATURES[n]);
  if (!d.natures.length) d.natures = [rollNature(d.clan)];
  d.rank = clamp(d.rank | 0, 0, RANKS.length - 1);
  d.sel = clamp(d.sel | 0, 0, Math.max(0, d.slots.length - 1));
  // v3: The Inner Path
  if (d.nindo && !NINDO[d.nindo]) d.nindo = null;
  if (d.focus && !FOCI[d.focus]) d.focus = null;
  if (d.focus2 && !FOCI[d.focus2]) d.focus2 = null;
  d.resolve = clamp(Number(d.resolve) || 0, 0, 100);
  if (!d.bonds || typeof d.bonds !== 'object' || Array.isArray(d.bonds)) d.bonds = {};
  return d;
}

/** @param {Player} p @returns {ShinobiData} */
export function getData(p) {
  let d = cache.get(p.id);
  if (d) return d;
  const raw = p.getDynamicProperty(KEY);
  if (typeof raw === 'string') {
    try {
      d = migrate(JSON.parse(raw));
    } catch {
      d = fresh();
    }
  } else {
    d = fresh();
    dirty.add(p.id);
  }
  cache.set(p.id, d);
  return d;
}

/** @param {Player} p */
export const hasProfile = (p) => typeof p.getDynamicProperty(KEY) === 'string';

/** Mark a profile for saving on the next flush. @param {Player} p */
export function touch(p) {
  dirty.add(p.id);
}

/** @param {Player} p */
export function saveNow(p) {
  const d = cache.get(p.id);
  if (!d) return;
  try {
    p.setDynamicProperty(KEY, JSON.stringify(d));
    dirty.delete(p.id);
  } catch (err) {
    console.warn(`[shinobi] could not save ${p.name}: ${err}`);
  }
}

/** Replace a profile wholesale (admin reset). @param {Player} p */
export function resetData(p) {
  const d = fresh();
  cache.set(p.id, d);
  p.setDynamicProperty(CHAKRA_KEY, maxChakra(p));
  saveNow(p);
  return d;
}

/** @param {string} id */
export function forget(id) {
  cache.delete(id);
  dirty.delete(id);
}

/** Flush dirty profiles once per second. */
export function startAutosave() {
  system.runInterval(() => {
    if (!dirty.size) return;
    for (const p of world.getAllPlayers()) {
      if (dirty.has(p.id)) saveNow(p);
    }
  }, 20);
}

// ------------------------------------------------------------------- chakra
/** @param {Player} p */
export function maxChakra(p) {
  const d = getData(p);
  const clan = CLANS[d.clan];
  let max = 100 + d.rank * 60 + (clan?.chakra ?? 0);
  if (d.bijuu) max += 40 + d.sync;
  if (d.ascended) max += 300;
  if (d.karma) max += 60;
  return Math.round(max);
}

/** @param {Player} p */
export function getChakra(p) {
  const v = p.getDynamicProperty(CHAKRA_KEY);
  return typeof v === 'number' ? v : maxChakra(p);
}

/** @param {Player} p @param {number} value */
export function setChakra(p, value) {
  p.setDynamicProperty(CHAKRA_KEY, clamp(value, 0, maxChakra(p)));
}

/** @param {Player} p @param {number} delta */
export function addChakra(p, delta) {
  setChakra(p, getChakra(p) + delta);
}

/** @param {Player} p @param {number} cost */
export function spendChakra(p, cost) {
  const c = getChakra(p);
  if (c < cost) return false;
  setChakra(p, c - cost);
  return true;
}

/** Nature slots available at the player's rank. @param {ShinobiData} d */
export const natureSlots = (d) => NATURE_SLOTS[d.rank] + (d.ascended ? 1 : 0);

/** Equipped jutsu slots. @param {ShinobiData} d */
export const loadoutSize = (d) => Math.min(9, 4 + d.rank);
