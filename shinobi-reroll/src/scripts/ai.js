import { GameMode, system } from '@minecraft/server';
import { eyes, norm, sub } from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */

/** Per-boss ability timers and memory, keyed by entity id. @type {Map<string, Record<string, number>>} */
export const timers = new Map();

/** True (and re-armed) when the boss's `key` ability is off cooldown. @param {Entity} boss @param {string} key */
export function ready(boss, key, ticks) {
  const t = timers.get(boss.id) ?? {};
  timers.set(boss.id, t);
  const now = system.currentTick;
  if ((t[key] ?? 0) > now) return false;
  t[key] = now + ticks;
  return true;
}

/** Mutable memory record for a boss. @param {Entity} boss */
export function memory(boss) {
  const t = timers.get(boss.id) ?? {};
  timers.set(boss.id, t);
  return t;
}

/** Nearest valid player target. @param {Entity} boss @param {number} range */
export function prey(boss, range) {
  try {
    const list = boss.dimension.getPlayers({
      location: boss.location, maxDistance: range, excludeGameModes: [GameMode.Creative, GameMode.Spectator], closest: 1,
    });
    return list[0];
  } catch {
    return undefined;
  }
}

/** Unit vector from one entity's eyes to another's. @param {Entity} from @param {Entity} to */
export const aim = (from, to) => norm(sub(eyes(to), eyes(from)));

/** Time-boxed jutsu absorption (Momoshiki, Jigen): starts, or clears when expired. @param {Entity} boss */
export function absorbing(boss, startTicks = 0) {
  const mem = memory(boss);
  if (startTicks) {
    boss.addTag('sr_absorbing');
    mem.absorbUntil = system.currentTick + startTicks;
  } else if (boss.hasTag('sr_absorbing') && (mem.absorbUntil ?? 0) <= system.currentTick) {
    boss.removeTag('sr_absorbing');
  }
}
