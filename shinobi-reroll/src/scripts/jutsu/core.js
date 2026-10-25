import { system, world } from '@minecraft/server';
import { KEKKEI, NATURES, RANKS } from '../data.js';
import { ENTITY, PARTICLE, SOUND } from '../ids.js';
import {
  add, angleBetween, enemiesAround, eyes, flatDir, fx, isFriendly, mul, norm, ping, sub, tell, v3, valid, yaw,
} from '../util.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('../store.js').ShinobiData} ShinobiData */

/**
 * @typedef {{ p: Player, d: ShinobiData, dim: Dimension, pow: number, dir: Vector3, head: Vector3, rank: number }} Ctx
 *
 * @typedef {{
 *   id: string, name: string, desc: string, rank: number, cost: number, cd: number, seals: string[],
 *   school: string,
 *   nature?: string, clan?: string, kekkei?: string, eyes?: string[], requires?: string[],
 *   flag?: 'contract' | 'jinchuriki' | 'karma' | 'ascended',
 *   auto?: boolean, jp?: number, strain?: number,
 *   toggle?: { upkeep: number, onSecond?: (ctx: Ctx) => void, onStart?: (ctx: Ctx) => boolean | void, onEnd?: (p: Player) => void },
 *   cast?: (ctx: Ctx) => boolean | void,
 * }} Jutsu
 */

/** @type {Map<string, Jutsu>} */
export const JUTSU = new Map();

/** @param {Jutsu[]} list */
export function register(list) {
  for (const j of list) {
    if (JUTSU.has(j.id)) throw new Error(`duplicate jutsu ${j.id}`);
    JUTSU.set(j.id, j);
  }
}

const KEKKEI_CLAN = { wood: 'senju', ice: 'yuki', lava: 'terumi', bone: 'kaguya' };

/**
 * Whether a shinobi satisfies a jutsu's requirements.
 * @param {ShinobiData} d @param {Jutsu} j
 * @returns {{ ok: boolean, why: string }}
 */
export function meets(d, j) {
  if (d.rank < j.rank) return { ok: false, why: `requires ${RANKS[j.rank].name}` };
  if (j.nature && !d.natures.includes(j.nature)) return { ok: false, why: `requires ${NATURES[j.nature].name} nature` };
  if (j.clan && d.clan !== j.clan) return { ok: false, why: `${j.clan} clan secret technique` };
  if (j.kekkei) {
    const has = d.clan === KEKKEI_CLAN[j.kekkei] || (j.kekkei === 'wood' && d.wood);
    if (!has) return { ok: false, why: `requires ${KEKKEI[j.kekkei].name}` };
  }
  if (j.eyes && !(d.eye && j.eyes.includes(d.eye))) return { ok: false, why: 'requires a stronger dojutsu' };
  if (j.flag === 'contract' && !d.contract) return { ok: false, why: 'requires a summoning contract' };
  if (j.flag === 'jinchuriki' && !d.bijuu) return { ok: false, why: 'requires a tailed beast' };
  if (j.flag === 'karma' && !d.karma) return { ok: false, why: 'requires the Karma seal' };
  if (j.flag === 'ascended' && !d.ascended) return { ok: false, why: 'requires Otsutsuki ascension' };
  for (const r of j.requires ?? []) {
    if (!d.learned.includes(r)) return { ok: false, why: `learn ${JUTSU.get(r)?.name ?? r} first` };
  }
  return { ok: true, why: '' };
}

/** @param {Jutsu} j */
export const learnCost = (j) => j.jp ?? j.rank + 1;

// ------------------------------------------------------------ shared helpers

/** Enemies within a horizontal cone in front of the caster. @param {Ctx} c @param {number} range @param {number} angle */
export function cone(c, range, angle) {
  const dir = v3(c.dir.x, 0, c.dir.z);
  return enemiesAround(c.p, c.p.location, range).filter(
    (e) => angleBetween(dir, sub(v3(e.location.x, 0, e.location.z), v3(c.p.location.x, 0, c.p.location.z))) <= angle / 2,
  );
}

/** Particles along a straight line. @param {Dimension} dim @param {Vector3} a @param {Vector3} b @param {string} id */
export function line(dim, a, b, id, color, step = 0.8) {
  const d = sub(b, a);
  const n = Math.max(1, Math.floor(Math.hypot(d.x, d.y, d.z) / step));
  for (let i = 0; i <= n; i++) fx(dim, id, add(a, mul(d, i / n)), color);
}

/** Positions of a wall perpendicular to dir. @param {Vector3} center @param {Vector3} dir */
export function wall(center, dir, width, height) {
  const flat = norm(v3(dir.x, 0, dir.z));
  const side = v3(-flat.z, 0, flat.x);
  const out = [];
  for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
    for (let h = 0; h < height; h++) out.push(add(add(center, mul(side, w)), v3(0, h, 0)));
  }
  return out;
}

/** Points evenly spaced on a horizontal circle. @param {Vector3} center */
export function ring(center, radius, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push(add(center, v3(Math.cos(a) * radius, 0, Math.sin(a) * radius)));
  }
  return out;
}

/** Fan of directions around the caster's view. @param {Vector3} dir */
export function fan(dir, count, spread) {
  if (count <= 1) return [dir];
  const out = [];
  for (let i = 0; i < count; i++) out.push(yaw(dir, -spread + (2 * spread * i) / (count - 1)));
  return out;
}

/** Nearest solid ground at or below a point (searches 8 blocks). @param {Dimension} dim @param {Vector3} loc */
export function ground(dim, loc) {
  const x = Math.floor(loc.x);
  const z = Math.floor(loc.z);
  for (let y = Math.floor(loc.y) + 2; y > loc.y - 8; y--) {
    try {
      const b = dim.getBlock({ x, y, z });
      const above = dim.getBlock({ x, y: y + 1, z });
      if (b && !b.isAir && !b.isLiquid && above?.isAir) return v3(x + 0.5, y + 1, z + 0.5);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ------------------------------------------------------------ summons
/** @type {Map<string, { entity: Entity, owner: string, until: number, kind: string }>} */
const summons = new Map();

/**
 * Spawn an allied summon bound to the player.
 * @param {Ctx} c @param {string} typeId @param {Vector3} loc @param {number} lifeTicks @param {string} [spawnEvent]
 */
export function summon(c, typeId, loc, lifeTicks, spawnEvent) {
  let e;
  try {
    e = c.dim.spawnEntity(typeId, loc, spawnEvent ? { spawnEvent } : undefined);
  } catch {
    return undefined;
  }
  try {
    e.setDynamicProperty('sr:owner', c.p.id);
    e.setDynamicProperty('sr:until', world.getAbsoluteTime() + lifeTicks);
    e.getComponent('minecraft:tameable')?.tame(c.p);
  } catch {}
  summons.set(e.id, { entity: e, owner: c.p.id, until: system.currentTick + lifeTicks, kind: typeId });
  fx(c.dim, PARTICLE.smoke, add(loc, v3(0, 1, 0)));
  return e;
}

/** Summons survive a world reload without the in-memory map: sweep them by their stored expiry. */
function sweepOrphans() {
  const now = world.getAbsoluteTime();
  for (const p of world.getAllPlayers()) {
    let list = [];
    try {
      list = p.dimension.getEntities({ location: p.location, maxDistance: 96, excludeTypes: ['minecraft:player', 'minecraft:item'] });
    } catch {
      continue;
    }
    for (const e of list) {
      if (summons.has(e.id)) continue;
      const until = e.getDynamicProperty('sr:until');
      if (typeof until === 'number' && until < now) {
        try {
          fx(e.dimension, PARTICLE.smoke, add(e.location, v3(0, 1, 0)));
          e.remove();
        } catch {}
      }
    }
  }
}

/**
 * Expire summons; returns ids of clones that dispelled (for experience transfer).
 * @param {(ownerId: string, kind: string) => void} onExpire
 */
export function tickSummons(onExpire) {
  if (system.currentTick % 200 < 20) sweepOrphans();
  const now = system.currentTick;
  for (const [id, s] of summons) {
    if (!valid(s.entity)) {
      summons.delete(id);
      continue;
    }
    if (now < s.until) continue;
    summons.delete(id);
    try {
      fx(s.entity.dimension, PARTICLE.smoke, add(s.entity.location, v3(0, 1, 0)));
      s.entity.remove();
    } catch {}
    onExpire(s.owner, s.kind);
  }
}

/** @param {string} ownerId @param {string} [kind] */
export function summonsOf(ownerId, kind) {
  return [...summons.values()].filter((s) => s.owner === ownerId && (!kind || s.kind === kind) && valid(s.entity));
}

/** Remove every summon belonging to a player. @param {string} ownerId */
export function dismissAll(ownerId) {
  for (const [id, s] of summons) {
    if (s.owner !== ownerId) continue;
    summons.delete(id);
    try {
      if (valid(s.entity)) {
        fx(s.entity.dimension, PARTICLE.smoke, s.entity.location);
        s.entity.remove();
      }
    } catch {}
  }
}

/** @param {Ctx} c @param {string} msg */
export function fail(c, msg) {
  tell(c.p, `§c${msg}`);
  ping(c.p, SOUND.deny, 0.6);
  return false;
}

/** Entity the caster is targeting, honouring friendliness. @param {Ctx} c @param {number} range */
export function target(c, range) {
  try {
    for (const hit of c.p.getEntitiesFromViewDirection({ maxDistance: range, excludeFamilies: ['inanimate'] })) {
      const e = hit.entity;
      if (valid(e) && !isFriendly(c.p, e) && e.typeId !== ENTITY.orb) return e;
    }
  } catch {}
  return undefined;
}

/** Point in front of the caster at distance n (ground level of caster). @param {Ctx} c */
export function ahead(c, n) {
  const f = flatDir(v3(0, 0, 0), c.dir);
  return add(c.p.location, mul(f, n));
}

export { eyes };
