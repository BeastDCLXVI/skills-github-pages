// The Inner Path (v1.2): a shinobi's Nindo, the Resolve it builds, the bonds forged in battle,
// a private daily journal, and the Waterfall of Truth, where the only way to win is not to fight.
import { Player, system, world } from '@minecraft/server';
import { BOND_TIERS, FOCI, MIXED, MOODS, NINDO, TAIJUTSU_SCHOOLS, bondTier } from './data.js';
import { flash } from './casting.js';
import { ENTITY, EVENT, FX, ITEM, PARTICLE, SOUND } from './ids.js';
import { addXp } from './progression.js';
import { cooldownLeft, rt, setCooldown } from './state.js';
import { addChakra, getData, maxChakra, touch } from './store.js';
import {
  add, clamp, dist, effect, floor, fx, heal, health, healthFraction, heldItem, ownerId, ping, rgb, sound, tell, title,
  v3, valid,
} from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('./store.js').ShinobiData} ShinobiData */
/** @typedef {import('./state.js').Runtime} Runtime */
/** @typedef {import('./jutsu/core.js').Jutsu} Jutsu */

export const RESOLVE_MAX = 100;
const NINDO_LOCK_DAYS = 3;
const MAX_BONDS = 16;
const TRIAL_CALM = 20; // seconds of calm that end the trial
const TRIAL_LIMIT = 90; // seconds before the waterfall falls silent
const TRIAL_STRIKES = 5; // strikes before hatred wins
const WATER = new Set(['minecraft:water', 'minecraft:flowing_water']);
const BOSS_FAMILIES = ['shinobi_boss', 'akatsuki_boss', 'otsutsuki'];
const LIGHT = rgb('#fff4d6');
const DARK = rgb('#6a3a8a');

const TAUNTS = [
  'Why protect people who never looked your way?',
  'You smile so nobody sees how alone you were.',
  'Hatred is easier. Let me carry it for you.',
  'Strike me. That is all you have ever known.',
  'Push me away, and I only grow stronger.',
  'Who are you, without me?',
];

/** Strip formatting codes and control characters from text a player typed. @param {unknown} text @param {number} max */
export function clean(text, max) {
  return String(text ?? '')
    .replace(/§.?/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// ------------------------------------------------------------------ journal focus

/** Whether today's journal page is written. @param {ShinobiData} d */
const today = (d) => d.journalDay === world.getDay();

/** @param {ShinobiData} d @param {string} focus */
export const hasFocus = (d, focus) => today(d) && (d.focus === focus || d.focus2 === focus);

/** The focus a jutsu school belongs to. @param {string} school */
export const focusOf = (school) => Object.keys(FOCI).find((k) => FOCI[k].schools.includes(school));

/** Name of the mixed thought formed by today's two focuses, if any. @param {ShinobiData} d */
export function mixedThought(d) {
  if (!d.focus || !d.focus2) return undefined;
  return MIXED[[d.focus, d.focus2].sort().join('+')];
}

/** @param {ShinobiData} d */
export function focusLabel(d) {
  const f = d.focus ? FOCI[d.focus] : undefined;
  if (!f) return 'none';
  return `${f.name} (${f.art})${d.focus2 && FOCI[d.focus2] ? ` + ${FOCI[d.focus2].name}` : ''}`;
}

// ------------------------------------------------------------------ modifiers used by other systems

/** Chakra cost multiplier from the Nindo and today's focus. @param {ShinobiData} d @param {Jutsu} j */
export function innerCostMult(d, j) {
  let m = 1;
  if (d.nindo === 'limits' && TAIJUTSU_SCHOOLS.includes(j.school)) m *= 0.85;
  if (today(d)) {
    const f = focusOf(j.school);
    if (f && f === d.focus) m *= 0.9;
    else if (f && f === d.focus2) m *= 0.95;
  }
  return m;
}

/** Chakra regeneration multiplier from allies, bonds and Inner Peace. @param {Player} p @param {ShinobiData} d */
export function innerRegenMult(p, d) {
  const r = rt(p);
  let m = 1;
  if (d.nindo === 'bonds' && r.allyNear) m *= 1.25;
  if (r.bondTier >= 1) m *= 1.1;
  if (d.innerPeace) m *= 1.1;
  return m;
}

/** Extra speed when charging chakra with the Chakra Focus. @param {ShinobiData} d */
export const meditateMult = (d) => (d.nindo === 'peace' ? 4 / 3 : 1) * (hasFocus(d, 'self') ? 1.25 : 1);
/** Health cost multiplier for the Eight Gates. @param {ShinobiData} d */
export const gateMult = (d) => (d.nindo === 'limits' ? 0.75 : 1);
/** Health fraction below which a tailed beast can be sealed. @param {ShinobiData} d */
export const sealThreshold = (d) => (d.nindo === 'peace' ? 0.4 : 0.3);
/** Tailed beast sync gain multiplier. @param {ShinobiData} d */
export const syncMult = (d) => (d.innerPeace ? 2 : 1);
/** Mission reward multiplier. @param {ShinobiData} d */
export const missionMult = (d) => (d.nindo === 'word' ? 1.25 : 1) * (hasFocus(d, 'words') ? 1.15 : 1);
/** The Training Post grants XP below this rank. @param {ShinobiData} d */
export const trainingRank = (d) => (d.nindo === 'path' ? 4 : 3);
/** XP multiplier from the Nindo. @param {ShinobiData} d */
export const xpMult = (d) => (d.nindo === 'hokage' ? 1.1 : 1);

/** Night time (the hours Boruto's shadow-work happens in). */
export function isNight() {
  try {
    const t = world.getTimeOfDay();
    return t >= 13000 && t < 23000;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ Nindo & Resolve

/** @param {ShinobiData} d */
export function nindoLockedFor(d) {
  if (!d.nindo) return 0;
  return Math.max(0, NINDO_LOCK_DAYS - (world.getDay() - d.nindoDay));
}

/**
 * Swear (or re-swear) a Nindo. Changing to a different one is possible every few days and resets Resolve.
 * @param {Player} p @param {string} key @param {string} [motto]
 * @returns {string | null} an error, or null on success
 */
export function chooseNindo(p, key, motto = '') {
  const d = getData(p);
  if (!NINDO[key]) return 'Unknown nindo.';
  if (d.nindo && d.nindo !== key) {
    const wait = nindoLockedFor(d);
    if (wait > 0) return `A ninja way is not changed lightly. You may choose again in ${wait} day${wait > 1 ? 's' : ''}.`;
    d.resolve = 0;
  }
  if (d.nindo !== key) {
    d.nindo = key;
    d.nindoDay = world.getDay();
  }
  d.motto = clean(motto, 48);
  touch(p);
  return null;
}

/** @param {Player} p @param {number} amount */
export function gainResolve(p, amount) {
  const d = getData(p);
  if (!d.nindo || !amount) return;
  const before = d.resolve;
  d.resolve = clamp(d.resolve + (amount > 0 && hasFocus(d, 'self') ? amount * 1.5 : amount), 0, RESOLVE_MAX);
  touch(p);
  if (before < RESOLVE_MAX && d.resolve >= RESOLVE_MAX) {
    title(p, '§6Unbreakable Will', '§7Your Nindo is unshakeable', 50);
    tell(p, '§6Your Resolve is full.§r The next time you are about to fall, your will lifts you back up (it costs 50 Resolve).');
    ping(p, SOUND.chime, 1.2);
  }
}

/**
 * Deeds that build (or shake) Resolve, depending on the Nindo.
 * @param {Player} p @param {'mission' | 'abandon' | 'learn' | 'train' | 'seal'} kind
 */
export function deed(p, kind) {
  const n = getData(p).nindo;
  if (kind === 'mission' && n === 'word') gainResolve(p, 20);
  else if (kind === 'mission' && n === 'hokage') gainResolve(p, 8);
  else if (kind === 'abandon' && n === 'word') {
    gainResolve(p, -15);
    tell(p, '§6...but a ninja does not go back on their word. §7(-15 Resolve)');
  } else if (kind === 'learn' && n === 'path') gainResolve(p, 5);
  else if (kind === 'train' && n === 'limits') gainResolve(p, 1);
  else if (kind === 'seal' && n === 'peace') gainResolve(p, 30);
}

/** A rank-up: the future Hokage grows with every step. @param {Player} p */
export function onRankUp(p) {
  const d = getData(p);
  if (d.nindo !== 'hokage') return;
  d.jp += 1;
  gainResolve(p, 30);
  tell(p, '§4I Will Become Hokage:§r +1 extra Jutsu Point.');
}

/**
 * Someone was hurt: shinobi sworn to protect from the shadows answer if it was an ally near them.
 * @param {Entity} victim
 */
export function onAllyHurt(victim) {
  let near;
  try {
    near = victim.dimension.getPlayers({ location: victim.location, maxDistance: 16 });
  } catch {
    return;
  }
  const owner = victim instanceof Player ? undefined : ownerId(victim);
  for (const g of near) {
    if (g.id === victim.id || getData(g).nindo !== 'shadow') continue;
    if (!(victim instanceof Player) && owner !== g.id) continue;
    if (cooldownLeft(g, 'shadow_guard') > 0) continue;
    setCooldown(g, 'shadow_guard', 200);
    effect(g, FX.speed, 5, 1);
    effect(g, FX.strength, 5, 0);
    flash(g, '§9From the shadows: §fprotect them!', 40);
    gainResolve(g, 1);
  }
}

/** Called after every successful cast. @param {Player} p @param {Jutsu} j */
export function onCast(p, j) {
  const d = getData(p);
  let xp = 0;
  if (d.nindo === 'path' && d.casts % 4 === 0) xp += 1 + j.rank; // doubles the regular practice XP
  if (today(d) && d.focus && focusOf(j.school) === d.focus) xp += 1;
  if (xp) addXp(p, xp);
  if (d.nindo === 'path' && d.casts % 5 === 0) gainResolve(p, 1);
  if (d.nindo === 'limits' && TAIJUTSU_SCHOOLS.includes(j.school)) gainResolve(p, 2);
}

/** The player took damage (after dodges). @param {Player} p */
export function onHurt(p) {
  const d = getData(p);
  const f = healthFraction(p);
  if (f <= 0) return;
  if (d.nindo === 'fire' && f < 0.3 && cooldownLeft(p, 'will_of_fire') === 0) {
    setCooldown(p, 'will_of_fire', 1200);
    effect(p, FX.strength, 8, 0);
    effect(p, FX.resistance, 8, 0);
    flash(p, '§cThe Will of Fire burns within you!', 50);
    fx(p.dimension, PARTICLE.aura, p.location, rgb('#ff7a2a'));
  }
  if (d.resolve >= RESOLVE_MAX && f < 0.2 && cooldownLeft(p, 'unbreakable') === 0) {
    setCooldown(p, 'unbreakable', 2400);
    const hp = health(p);
    if (hp) heal(p, Math.max(0, hp.effectiveMax * 0.6 - hp.currentValue));
    effect(p, FX.absorption, 20, 1);
    d.resolve -= 50;
    title(p, "§6I won't give up!", '§7Unbreakable Will', 40);
    sound(p.dimension, SOUND.totem, p.location, 1.1, 0.8);
    fx(p.dimension, PARTICLE.burst, p.location, rgb('#ffd36a'));
    touch(p);
  }
}

// ------------------------------------------------------------------ bonds

/** Players and your own companions near a shinobi. @param {Player} p @param {number} radius @returns {Entity[]} */
export function alliesNear(p, radius) {
  let near;
  try {
    near = p.dimension.getEntities({ location: p.location, maxDistance: radius, excludeFamilies: ['monster', 'projectile', 'inanimate'] });
  } catch {
    return [];
  }
  return near.filter((e) => e.id !== p.id && valid(e) && (e instanceof Player || ownerId(e) === p.id));
}

/** @param {Entity} e */
const bondKey = (e) => `${e instanceof Player ? 'p' : 'c'}:${e.id}`;

/** @param {Entity} e */
function companionName(e) {
  if (e.nameTag) return clean(e.nameTag, 24);
  const id = (e.typeId.split(':')[1] ?? e.typeId).replace(/^summoned_/, '').replace(/_/g, ' ');
  return id.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** @param {Player} p @param {Entity} other @param {number} pts */
function strengthen(p, other, pts) {
  const d = getData(p);
  const key = bondKey(other);
  const name = other instanceof Player ? other.name : companionName(other);
  const b = (d.bonds[key] ??= { name, pts: 0 });
  const before = bondTier(b.pts);
  b.name = name;
  b.pts = Math.min(999, b.pts + pts * (hasFocus(d, 'others') ? 2 : 1));
  const tier = bondTier(b.pts);
  if (tier > before) {
    const t = BOND_TIERS[tier];
    tell(p, `§dBond deepened:§r ${name} is now your ${t.color}${t.name}§r.`);
    ping(p, SOUND.chime, 1 + tier * 0.1);
  }
  const keys = Object.keys(d.bonds);
  if (keys.length > MAX_BONDS) {
    keys.sort((x, y) => d.bonds[x].pts - d.bonds[y].pts);
    for (const k of keys.slice(0, keys.length - MAX_BONDS)) delete d.bonds[k];
  }
  touch(p);
}

/** Bonds, strongest first. @param {ShinobiData} d */
export function bondList(d) {
  return Object.values(d.bonds).sort((a, b) => b.pts - a.pts);
}

/** A hostile creature fell to `killer`: Nindo deeds and bonds with everyone who fought beside them. @param {Player} killer @param {Entity} dead */
export function onKill(killer, dead) {
  const d = getData(killer);
  let hostile = false;
  let great = false;
  try {
    hostile = dead.matches({ families: ['monster'] });
    great = BOSS_FAMILIES.some((f) => dead.matches({ families: [f] }));
  } catch {}
  if (!hostile && !great) return;
  if (d.nindo === 'fire') gainResolve(killer, great ? 15 : 1);
  if (d.nindo === 'shadow' && isNight()) gainResolve(killer, 2);
  const allies = alliesNear(killer, 16);
  if (d.nindo === 'bonds' && allies.length) gainResolve(killer, 3);
  for (const a of allies) {
    if (a instanceof Player) {
      strengthen(killer, a, 2);
      strengthen(a, killer, 2);
    } else {
      strengthen(killer, a, 1);
    }
  }
}

/** A companion fell: its bond becomes a memory. @param {Player} owner @param {Entity} dead */
export function onCompanionDeath(owner, dead) {
  const d = getData(owner);
  const b = d.bonds[`c:${dead.id}`];
  if (!b || b.gone) return;
  b.gone = true;
  if (bondTier(b.pts) >= 2) tell(owner, `§7${b.name} has fallen. You will carry their memory with you.`);
  touch(owner);
}

/** @param {Player} p @param {ShinobiData} d @param {Runtime} r */
function aura(p, d, r) {
  const allies = alliesNear(p, 10);
  r.allyNear = allies.length > 0;
  let best = 0;
  for (const a of allies) {
    const b = d.bonds[bondKey(a)];
    if (b) best = Math.max(best, bondTier(b.pts));
  }
  r.bondTier = best;
  if (best >= 3) effect(p, FX.resistance, 3, 0, false);
}

// ------------------------------------------------------------------ the Shinobi Journal

/**
 * Write today's journal page. Only the first page of each in-game day is rewarded; later
 * pages just update the focus. Nothing written here is ever shown to other players.
 * @param {Player} p @param {{ mood: number, focus: string, focus2?: string | null, intention?: string }} entry
 * @returns {boolean} whether this was today's first page
 */
export function checkIn(p, entry) {
  const d = getData(p);
  const day = world.getDay();
  const first = d.journalDay !== day;
  d.mood = clamp(entry.mood | 0, 0, MOODS.length - 1);
  d.focus = FOCI[entry.focus] ? entry.focus : 'body';
  d.focus2 = entry.focus2 && FOCI[entry.focus2] && entry.focus2 !== d.focus ? entry.focus2 : null;
  d.intention = clean(entry.intention, 60);
  d.journalDay = day;
  touch(p);
  ping(p, SOUND.page, 1);
  const combo = mixedThought(d);
  if (!first) {
    tell(p, `§7Journal updated. Today's focus: ${focusLabel(d)}${combo ? ` §d(${combo})` : ''}§7.`);
    return false;
  }
  d.journalDays++;
  const mood = MOODS[d.mood];
  tell(p, [
    `§3Shinobi Journal · Day ${day + 1}`,
    `${mood.color}${mood.name}:§r §7${mood.reply}`,
    `§bToday's focus:§r ${focusLabel(d)}${combo ? ` §d· mixed thought: ${combo}` : ''}`,
    d.intention ? `§7Your intention: "${d.intention}"` : '',
    d.nindo ? '' : '§8Choose a Nindo (Shinobi Scroll › Inner Path) and your reflections will build Resolve.',
  ].filter(Boolean).join('\n'));
  if (d.mood === 0) effect(p, FX.speed, 60, 0);
  else if (d.mood === 1) addChakra(p, maxChakra(p) * 0.25);
  else if (d.mood === 2) effect(p, FX.regeneration, 20, 0);
  else {
    effect(p, FX.regeneration, 40, 0);
    effect(p, FX.saturation, 1, 2);
  }
  addXp(p, 15 + 5 * d.rank);
  gainResolve(p, (combo ? 10 : 5) + (d.nindo === 'hokage' ? 3 : 0));
  return true;
}

// ------------------------------------------------------------------ the Waterfall of Truth

/**
 * Trials in progress, by player id.
 * @type {Map<string, { id: string, start: number, calm: number, struck: number, lastStrike: number, line: number }>}
 */
const trials = new Map();

/** @param {string} pid */
export const trialOf = (pid) => trials.get(pid);

/** A column of falling water taller than you, right beside you, while you are not swimming. @param {Player} p */
export function nearWaterfall(p) {
  const dim = p.dimension;
  const base = floor(p.location);
  /** @param {number} x @param {number} y @param {number} z */
  const water = (x, y, z) => {
    try {
      return WATER.has(dim.getBlock(v3(x, y, z))?.typeId ?? '');
    } catch {
      return false;
    }
  };
  if (water(base.x, base.y + 1, base.z)) return false;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const x = base.x + dx;
      const z = base.z + dz;
      if (water(x, base.y + 3, z) && water(x, base.y + 2, z) && water(x, base.y + 1, z)) return true;
    }
  }
  return false;
}

/** Your reflection steps out of the water. @param {Player} p */
export function beginTrial(p) {
  const d = getData(p);
  if (trials.has(p.id)) return false;
  const dir = p.getViewDirection();
  const flat = Math.hypot(dir.x, dir.z) || 1;
  const at = add(p.location, v3((dir.x / flat) * 3, 0, (dir.z / flat) * 3));
  let e;
  try {
    e = p.dimension.spawnEntity(ENTITY.darkReflection, at);
    e.setDynamicProperty('sr:trialOf', p.id);
  } catch {
    return false;
  }
  d.trialDay = world.getDay();
  touch(p);
  trials.set(p.id, { id: e.id, start: system.currentTick, calm: 0, struck: 0, lastStrike: -999, line: 0 });
  try {
    p.camera.fade({ fadeColor: { red: 0.18, green: 0.08, blue: 0.25 }, fadeTime: { fadeInTime: 0.4, holdTime: 0.6, fadeOutTime: 1.2 } });
  } catch {}
  title(p, '§5Waterfall of Truth', '§7Your reflection steps out of the water...', 70);
  tell(p, '§5The Waterfall of Truth shows who you really are.§7 You cannot win this fight by fighting. Stay calm, and do not strike.');
  sound(p.dimension, SOUND.whisper, at, 0.7, 1);
  fx(p.dimension, PARTICLE.smoke, at, DARK);
  return true;
}

/** @param {Player} p @param {ShinobiData} d @param {Runtime} r */
function maybeBeginTrial(p, d, r) {
  if (!nearWaterfall(p)) return;
  let hint = '';
  if (d.rank < 1) hint = 'It will speak to you once you are a Genin.';
  else if (!d.nindo) hint = 'It seems to wait for you to choose your Nindo (Shinobi Scroll › Inner Path).';
  else if (d.trialDay === world.getDay()) hint = 'It is quiet today. Return tomorrow.';
  if (!hint) {
    beginTrial(p);
    return;
  }
  if (r.hinted) return;
  r.hinted = true;
  tell(p, `§3The waterfall roars... ${hint}`);
}

/** Something tried to strike a reflection. @param {Entity} e */
function struck(e) {
  const pid = e.getDynamicProperty('sr:trialOf');
  const t = typeof pid === 'string' ? trials.get(pid) : undefined;
  if (!t || t.id !== e.id || system.currentTick - t.lastStrike < 10) return;
  t.lastStrike = system.currentTick;
  t.struck++;
  t.calm = 0;
  effect(e, FX.strength, 10, Math.min(3, t.struck - 1));
  const p = world.getAllPlayers().find((x) => x.id === pid);
  if (!p) return;
  if (t.struck >= TRIAL_STRIKES) {
    endTrial(/** @type {string} */ (pid), false, p, e, 'Your hatred feeds it, and the light fades... Return tomorrow, calmer.');
    return;
  }
  tell(p, `§5Dark Reflection: §dYes... fight me. §8(${t.struck}/${TRIAL_STRIKES}: every strike makes it stronger)`);
  ping(p, SOUND.gate, 0.6);
}

/** @param {string} pid @param {NonNullable<ReturnType<typeof trialOf>>} t */
function stepTrial(pid, t) {
  const p = world.getAllPlayers().find((x) => x.id === pid);
  const e = world.getEntity(t.id);
  if (!p || !valid(e)) {
    endTrial(pid, false, p, e, 'The reflection sank back into the water. Return tomorrow.');
    return;
  }
  const secs = Math.floor((system.currentTick - t.start) / 20);
  if (secs > TRIAL_LIMIT) {
    endTrial(pid, false, p, e, 'The waterfall falls silent. Return tomorrow.');
    return;
  }
  if (p.dimension.id !== e.dimension.id || dist(p.location, e.location) > 20) {
    endTrial(pid, false, p, e, 'You turned away from yourself. Return tomorrow.');
    return;
  }
  t.calm = system.currentTick - t.lastStrike > 60 ? t.calm + 1 : 0;
  if (t.calm >= TRIAL_CALM) {
    endTrial(pid, true, p, e);
    return;
  }
  if (t.calm === 3 && t.struck > 0) {
    try {
      e.triggerEvent(EVENT.calm);
    } catch {}
  }
  if (secs % 6 === 0) {
    tell(p, `§5Dark Reflection: §d${TAUNTS[t.line++ % TAUNTS.length]}`);
    sound(e.dimension, SOUND.whisper, e.location, 0.8, 0.6);
    effect(p, FX.darkness, 3, 0, false);
  }
  flash(p, `§5Waterfall of Truth §7· calm §f${t.calm}/${TRIAL_CALM}§7 · do not strike`, 25);
  fx(e.dimension, PARTICLE.aura, e.location, DARK);
}

/**
 * @param {string} pid @param {boolean} won @param {Player | undefined} p @param {Entity | undefined} e @param {string} [why]
 */
function endTrial(pid, won, p, e, why) {
  trials.delete(pid);
  if (e && valid(e)) {
    fx(e.dimension, won ? PARTICLE.burst : PARTICLE.smoke, add(e.location, v3(0, 1, 0)), won ? LIGHT : DARK);
    try {
      e.remove();
    } catch {}
  }
  if (!p || !valid(p)) return;
  if (!won) {
    if (why) tell(p, `§7${why}`);
    return;
  }
  const d = getData(p);
  d.trials++;
  if (!d.innerPeace) {
    d.innerPeace = true;
    d.jp += 3;
    title(p, '§fInner Peace', '§7You embraced your darkness', 80);
    tell(p, [
      '§5Dark Reflection: §d...you never struck back. Why?',
      '§fYou: §7Because you are me. Thank you for carrying all of it alone.',
      '§7The reflection smiles, and the light pours back into you.',
      '§aInner Peace:§r +3 Jutsu Points, and your chakra regenerates 10% faster.',
      d.bijuu ? '§6Your tailed beast stirs... its chakra now syncs with yours twice as fast.' : '',
    ].filter(Boolean).join('\n'));
  } else {
    title(p, '§fInner Peace', '§7The waterfall reflects you clearly', 50);
    addXp(p, 30 + 10 * d.rank);
  }
  gainResolve(p, d.trials === 1 ? 40 : 15);
  sound(p.dimension, SOUND.beacon, p.location, 1.2, 1);
  ping(p, SOUND.chime, 1.4);
  touch(p);
}

/** A player fell: any trial they were facing ends. @param {Player} p */
export function onPlayerDeath(p) {
  const t = trials.get(p.id);
  if (t) endTrial(p.id, false, p, world.getEntity(t.id), 'You fell before the waterfall. Return tomorrow.');
}

/** Remove reflections whose trial no longer exists (e.g. after a reload). @param {Player} p */
function sweepReflections(p) {
  let near = [];
  try {
    near = p.dimension.getEntities({ type: ENTITY.darkReflection, location: p.location, maxDistance: 64 });
  } catch {}
  for (const e of near) {
    const pid = e.getDynamicProperty('sr:trialOf');
    if (typeof pid === 'string' && trials.get(pid)?.id === e.id) continue;
    try {
      e.remove();
    } catch {}
  }
}

// ------------------------------------------------------------------ the loop

/** @param {boolean} slow */
function step(slow) {
  for (const p of world.getAllPlayers()) {
    const d = getData(p);
    const r = rt(p);
    if (slow) {
      aura(p, d, r);
      sweepReflections(p);
    }
    const pos = p.location;
    const still = p.isSneaking && !!r.stillAt && Math.hypot(pos.x - r.stillAt.x, pos.z - r.stillAt.z) < 0.15;
    r.stillAt = pos;
    r.stillSecs = still ? r.stillSecs + 1 : 0;
    const meditating = still && heldItem(p)?.typeId === ITEM.focus;
    r.meditateSecs = meditating ? r.meditateSecs + 1 : 0;
    if (meditating && d.nindo === 'peace' && r.meditateSecs % 5 === 0) gainResolve(p, 1);
    if (r.stillSecs === 3 && !trials.has(p.id)) maybeBeginTrial(p, d, r);
  }
  for (const [pid, t] of [...trials]) stepTrial(pid, t);
}

export function startInnerPath() {
  let beat = 0;
  system.runInterval(() => step(beat++ % 2 === 0), 20);
  world.afterEvents.dataDrivenEntityTrigger.subscribe(
    (ev) => {
      if (ev.eventId === EVENT.struck && valid(ev.entity) && ev.entity.typeId === ENTITY.darkReflection) struck(ev.entity);
    },
    { entityTypes: [ENTITY.darkReflection], eventTypes: [EVENT.struck] },
  );
  world.afterEvents.entityHitEntity.subscribe((ev) => {
    if (ev.damagingEntity instanceof Player && valid(ev.hitEntity) && ev.hitEntity.typeId === ENTITY.darkReflection) struck(ev.hitEntity);
  });
}
