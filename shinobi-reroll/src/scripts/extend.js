// Extension API (v2.0): other add-ons and operators can add jutsu without touching this pack.
//
//   From another behavior pack's script:  system.sendScriptEvent('shinobi:jutsu', JSON.stringify(spec))
//   From chat (operators):                /scriptevent shinobi:jutsu {"id":"my_jutsu", ...}
//   Remove one:                           /scriptevent shinobi:jutsu_remove my_jutsu
//
// A spec uses the same archetypes as the built-in catalogue (see docs/EXTENDING.md). Every field is
// validated and clamped, only data archetypes are accepted (no code), and registrations are kept in a
// world dynamic property so they survive restarts. Learned external jutsu persist like any other.
import { Player, system, world } from '@minecraft/server';
import { CLANS, DOJUTSU, NATURES, SEALS } from './data.js';
import { FX, ORB_ELEMENTS, SOUND } from './ids.js';
import { KIND_NAMES, SHAPE_NAMES, TERRAIN_BLOCKS, forge } from './jutsu/forge.js';
import { JUTSU } from './jutsu/index.js';
import { tell } from './util.js';

/** @typedef {import('./jutsu/forge.js').JutsuSpec} JutsuSpec */

const KEY = 'sr:ext';
const MAX_EXTERNAL = 64;
/** Archetypes accepted from outside: everything except `custom` (which runs code). */
const DATA_KINDS = new Set(KIND_NAMES.filter((k) => k !== 'custom'));
/** Entities an external summon may call (allies only). */
const SUMMONABLE = ['clone', 'toad', 'snake', 'slug', 'clawGrime', 'puppet', 'wolf'];
/** @type {Map<string, JutsuSpec>} */
const external = new Map();

const NUM = {
  rank: [0, 5], cost: [0, 400], cd: [0, 600], jp: [1, 12], damage: [0, 120], dot: [0, 30], knock: [0, 4], up: [0, 1.5],
  fire: [0, 10], stun: [0, 10], drain: [0, 60], lifesteal: [0, 1], health: [0, 10], chakra: [0, 200], heal: [0, 40],
  count: [1, 12], spread: [0, 60], speed: [0.3, 4], size: [1, 8], radius: [0, 12], explode: [0, 4], gravity: [0, 0.2],
  life: [5, 200], pulses: [0, 8], waves: [1, 20], interval: [2, 40], range: [1, 48], angle: [10, 180], delay: [0, 60],
  length: [2, 40], width: [0.5, 4], jumps: [0, 6], power: [0, 1], upkeep: [0, 50], height: [1, 8], duration: [1, 60],
  minSync: [0, 100],
};
const BOOL = ['homing', 'pull', 'allies', 'behind', 'magic'];

/** @param {unknown} v @param {number} max */
const text = (v, max) => String(v ?? '').replace(/§.?/g, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
/** @param {unknown} v */
const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);

/** @param {unknown} list @returns {Array<[string, number, number]> | undefined} */
function effects(list) {
  if (!Array.isArray(list)) return undefined;
  /** @type {Array<[string, number, number]>} */
  const out = [];
  for (const e of list.slice(0, 6)) {
    if (!Array.isArray(e) || typeof e[0] !== 'string' || !(e[0] in FX)) continue;
    out.push([e[0], Math.max(1, Math.min(60, Number(e[1]) || 1)), Math.max(0, Math.min(4, Math.floor(Number(e[2]) || 0)))]);
  }
  return out;
}

/**
 * Validate and clamp an untrusted spec.
 * @param {any} raw @returns {{ spec?: JutsuSpec, error?: string }}
 */
export function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'spec must be a JSON object' };
  const id = String(raw.id ?? '');
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(id)) return { error: 'id must be 3-32 chars: a-z, 0-9, _' };
  if (JUTSU.has(id) && !external.has(id)) return { error: `'${id}' is a built-in jutsu` };
  if (!DATA_KINDS.has(raw.kind)) return { error: `kind must be one of ${[...DATA_KINDS].join(', ')}` };
  /** @type {any} */
  const s = {
    id, kind: raw.kind, ext: true,
    name: text(raw.name, 40) || id,
    school: text(raw.school, 24) || 'Custom',
    desc: text(raw.desc, 200) || 'A technique from another add-on.',
    rank: 0, cost: 20, cd: 5,
  };
  for (const [k, [lo, hi]] of Object.entries(NUM)) {
    if (raw[k] === undefined) continue;
    const n = Number(raw[k]);
    if (Number.isFinite(n)) s[k] = Math.max(lo, Math.min(hi, n));
  }
  s.rank = Math.floor(s.rank);
  for (const k of BOOL) if (raw[k] !== undefined) s[k] = !!raw[k];
  if (Array.isArray(raw.seals)) s.seals = raw.seals.filter((x) => SEALS.includes(x)).slice(0, 8);
  if (raw.nature && NATURES[raw.nature]) s.nature = raw.nature;
  if (Array.isArray(raw.natures)) s.natures = raw.natures.filter((n) => NATURES[n]).slice(0, 5);
  if (raw.clan && CLANS[raw.clan]) s.clan = raw.clan;
  if (Array.isArray(raw.eyes)) s.eyes = raw.eyes.filter((e) => DOJUTSU[e]);
  if (Array.isArray(raw.requires)) s.requires = raw.requires.filter((r) => typeof r === 'string' && JUTSU.has(r)).slice(0, 4);
  if (typeof raw.active === 'string' && JUTSU.get(raw.active)?.toggle) s.active = raw.active;
  if (ORB_ELEMENTS.includes(raw.element)) s.element = raw.element;
  if (hex(raw.color)) s.color = hex(raw.color);
  if (typeof raw.sound === 'string' && raw.sound in SOUND) s.sound = raw.sound;
  if (raw.at === 'self' || raw.at === 'look' || raw.at === 'target') s.at = raw.at;
  s.effects = effects(raw.effects);
  s.self = effects(raw.self);
  if (s.kind === 'summon') {
    if (!SUMMONABLE.includes(raw.entity)) return { error: `summon entity must be one of ${SUMMONABLE.join(', ')}` };
    s.entity = raw.entity;
    s.count = Math.min(s.count ?? 1, 4);
    s.life = Math.min(s.life ?? 30, 120);
  }
  if (s.kind === 'terrain') {
    s.shape = SHAPE_NAMES.includes(raw.shape) ? raw.shape : 'wall';
    s.block = raw.block in TERRAIN_BLOCKS ? raw.block : 'earthWall';
    s.size = Math.min(s.size ?? 2, 6);
  }
  return { spec: /** @type {JutsuSpec} */ (s) };
}

/**
 * Register (or replace) an external jutsu.
 * @param {any} raw @param {boolean} [persist] @returns {string | null} error
 */
export function registerExternal(raw, persist = true) {
  const { spec, error } = sanitize(raw);
  if (!spec) return error ?? 'invalid spec';
  if (!external.has(spec.id) && external.size >= MAX_EXTERNAL) return `at most ${MAX_EXTERNAL} external jutsu`;
  try {
    JUTSU.set(spec.id, forge(spec));
  } catch (err) {
    return String(err);
  }
  external.set(spec.id, spec);
  if (persist) save();
  return null;
}

/** @param {string} id */
export function removeExternal(id) {
  if (!external.has(id)) return false;
  external.delete(id);
  JUTSU.delete(id);
  save();
  return true;
}

export const externalIds = () => [...external.keys()];

function save() {
  try {
    const json = JSON.stringify([...external.values()]);
    if (json.length < 30000) world.setDynamicProperty(KEY, json);
  } catch (err) {
    console.warn(`[shinobi] could not save external jutsu: ${err}`);
  }
}

function load() {
  try {
    const raw = world.getDynamicProperty(KEY);
    if (typeof raw !== 'string') return;
    for (const spec of JSON.parse(raw)) registerExternal(spec, false);
  } catch (err) {
    console.warn(`[shinobi] could not load external jutsu: ${err}`);
  }
}

/** @param {import('@minecraft/server').Entity | undefined} who @param {string} msg */
function reply(who, msg) {
  if (who instanceof Player) tell(who, msg);
  else console.info(`[shinobi] ${msg.replace(/§./g, '')}`);
}

export function startExtensions() {
  world.afterEvents.worldLoad.subscribe(load);
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === 'shinobi:jutsu') {
      let raw;
      try {
        raw = JSON.parse(ev.message);
      } catch {
        reply(ev.sourceEntity, '§cshinobi:jutsu expects a JSON jutsu spec (see docs/EXTENDING.md).');
        return;
      }
      const err = registerExternal(raw);
      reply(ev.sourceEntity, err ? `§cJutsu rejected: ${err}` : `§aJutsu registered: ${raw.id}. It can now be learned from the Shinobi Scroll.`);
    } else if (ev.id === 'shinobi:jutsu_remove') {
      const id = ev.message.trim();
      reply(ev.sourceEntity, removeExternal(id) ? `§7Removed external jutsu ${id}.` : `§c'${id}' is not an external jutsu.`);
    }
  });
}
