import { system } from '@minecraft/server';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */

/**
 * Per-player runtime state that does not need to survive a restart.
 * @typedef {{
 *   cooldowns: Map<string, number>,
 *   weavingUntil: number,
 *   toggles: Set<string>,
 *   charged: { kind: string, until: number, hits: number } | null,
 *   absorbUntil: number,
 *   intangibleUntil: number,
 *   gatherTicks: number,
 *   lastPos: Vector3 | null,
 *   lastTrain: number,
 *   lastThrow: number,
 *   lastGunbai: number,
 *   koteMode: number,
 *   bladeCharge: number,
 *   seals: string,
 *   sealsUntil: number,
 * }} Runtime
 */

/** @type {Map<string, Runtime>} */
const runtime = new Map();

/** @param {{ id: string }} p @returns {Runtime} */
export function rt(p) {
  let r = runtime.get(p.id);
  if (!r) {
    r = {
      cooldowns: new Map(), weavingUntil: 0, toggles: new Set(), charged: null, absorbUntil: 0, intangibleUntil: 0,
      gatherTicks: 0, lastPos: null, lastTrain: 0, lastThrow: 0, lastGunbai: 0, koteMode: 0, bladeCharge: 0, seals: '',
      sealsUntil: 0,
    };
    runtime.set(p.id, r);
  }
  return r;
}

/** @param {string} id */
export const dropRuntime = (id) => runtime.delete(id);

/** @param {{ id: string }} p @param {string} key @returns {number} ticks remaining */
export function cooldownLeft(p, key) {
  const until = rt(p).cooldowns.get(key) ?? 0;
  return Math.max(0, until - system.currentTick);
}

/** @param {{ id: string }} p @param {string} key @param {number} ticks */
export function setCooldown(p, key, ticks) {
  rt(p).cooldowns.set(key, system.currentTick + Math.round(ticks));
}
