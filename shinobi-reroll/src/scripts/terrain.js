import { system, world } from '@minecraft/server';
import { BLOCK } from './ids.js';
import { floor } from './util.js';

/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */

// Jutsu walls, timber and ice are placed only into air and removed again when
// they expire. Pending reverts are persisted so a restart never leaves them behind.

/** @type {Set<string>} */
const TEMP_TYPES = new Set(Object.values(BLOCK));
const KEY_PREFIX = 'sr:temp';
const CHUNK = 30000;
const MAX_ENTRIES = 4000;

/** @type {{ d: string, x: number, y: number, z: number, t: string, at: number }[]} */
let pending = [];
let dirtySince = 0;
let loaded = false;

function load() {
  pending = [];
  let raw = '';
  for (let i = 0; i < 16; i++) {
    const part = world.getDynamicProperty(`${KEY_PREFIX}${i}`);
    if (typeof part !== 'string') break;
    raw += part;
  }
  if (raw) {
    try {
      const now = system.currentTick;
      // stored as relative remaining ticks so the clock restart after reload is harmless
      for (const e of JSON.parse(raw)) pending.push({ ...e, at: now + Math.max(20, e.at) });
    } catch {
      pending = [];
    }
  }
  loaded = true;
}

function persist() {
  const now = system.currentTick;
  const raw = JSON.stringify(pending.map((e) => ({ ...e, at: e.at - now })));
  let i = 0;
  for (; i * CHUNK < raw.length && i < 16; i++) {
    world.setDynamicProperty(`${KEY_PREFIX}${i}`, raw.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  for (; i < 16; i++) {
    if (world.getDynamicProperty(`${KEY_PREFIX}${i}`) === undefined) break;
    world.setDynamicProperty(`${KEY_PREFIX}${i}`, undefined);
  }
  dirtySince = 0;
}

/**
 * Place a temporary block type at each position that is currently air.
 * @param {Dimension} dim @param {Vector3[]} positions @param {string} type @param {number} ticks
 * @returns {number} blocks placed
 */
export function placeTemp(dim, positions, type, ticks) {
  if (!loaded) load();
  let placed = 0;
  for (const raw of positions) {
    if (pending.length >= MAX_ENTRIES) break;
    const pos = floor(raw);
    try {
      const block = dim.getBlock(pos);
      if (!block || !block.isAir) continue;
      block.setType(type);
      pending.push({ d: dim.id, x: pos.x, y: pos.y, z: pos.z, t: type, at: system.currentTick + ticks + Math.floor(Math.random() * 20) });
      placed++;
    } catch {}
  }
  if (placed && !dirtySince) dirtySince = system.currentTick;
  return placed;
}

function tick() {
  if (!loaded) load();
  const now = system.currentTick;
  const keep = [];
  let changed = false;
  for (const e of pending) {
    if (e.at > now) {
      keep.push(e);
      continue;
    }
    try {
      const block = world.getDimension(e.d).getBlock({ x: e.x, y: e.y, z: e.z });
      if (!block) {
        keep.push({ ...e, at: now + 100 }); // chunk unloaded: retry later
        continue;
      }
      if (block.typeId === e.t && TEMP_TYPES.has(e.t)) block.setType('minecraft:air');
    } catch {
      keep.push({ ...e, at: now + 100 });
      continue;
    }
    changed = true;
  }
  pending = keep;
  if (changed && !dirtySince) dirtySince = now;
  if (dirtySince && now - dirtySince > 100) persist();
}

/** Persisted state is loaded lazily on the first tick: world storage is unavailable during early execution. */
export function startTerrain() {
  system.runInterval(tick, 10);
}

/** Remove every pending temporary block right now (admin cleanup). */
export function clearTemp() {
  for (const e of pending) e.at = 0;
  tick();
  persist();
}
