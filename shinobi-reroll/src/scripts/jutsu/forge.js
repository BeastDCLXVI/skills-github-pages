// The jutsu forge (v2.0): techniques described as data.
//
// A spec is a technique's identity (id, name, school, rank, cost, cooldown, seals, requirements)
// plus one archetype `kind` and its numbers. forge() turns a spec into a registered Jutsu, so the
// catalogue (catalog.js) and third-party add-ons (extend.js) describe techniques instead of coding
// them. Every archetype draws its own chakra shape: rings for bursts, helixes for buffs, spheres for
// Rasengan-type energy, and element impacts (flame, splash, gust, arcs, debris...).
import { EntityDamageCause, system } from '@minecraft/server';
import { BLOCK, ENTITY, FX, PARTICLE, SOUND } from '../ids.js';
import { IMPACT, elementColor, spawnOrb } from '../projectiles.js';
import { rt } from '../state.js';
import { addChakra, getChakra, setChakra } from '../store.js';
import { placeTemp } from '../terrain.js';
import {
  add, dash, dist, effect, enemiesAround, eyes, flatDir, floor, fx, heal, hurt, isPlayer, knock, later, lookPoint, mul,
  pull, repeat, rgb, sound, stun, sub, title, v3, valid, yaw,
} from '../util.js';
import { ally, cone, fail, fan, ground, line, register, summon, target, wall } from './core.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('./core.js').Ctx} Ctx */
/** @typedef {import('./core.js').Jutsu} Jutsu */

/**
 * @typedef {[string, number, number]} FxSpec  effect (FX key or minecraft id), seconds, amplifier
 *
 * @typedef {{
 *   id: string, name: string, school: string, rank: number, cost: number, cd: number, desc: string, kind: string,
 *   seals?: string[], nature?: string, natures?: string[], clan?: string, kekkei?: string, eyes?: string[],
 *   requires?: string[], flag?: Jutsu['flag'], contract?: Jutsu['contract'], beast?: string, active?: string,
 *   minSync?: number, jp?: number, strain?: number, ext?: boolean,
 *   element?: string, color?: string, sound?: string,
 *   damage?: number, effects?: FxSpec[], self?: FxSpec[], knock?: number, up?: number, fire?: number, stun?: number,
 *   drain?: number, lifesteal?: number, health?: number, chakra?: number, heal?: number, dot?: number,
 *   count?: number, spread?: number, speed?: number, size?: number, radius?: number, explode?: number,
 *   gravity?: number, homing?: boolean, life?: number, pulses?: number, waves?: number, interval?: number,
 *   range?: number, angle?: number, at?: 'self' | 'look' | 'target', delay?: number, pull?: boolean,
 *   length?: number, width?: number, jumps?: number, power?: number, upkeep?: number, entity?: string,
 *   block?: string, shape?: string, height?: number, duration?: number, allies?: boolean, behind?: boolean,
 *   magic?: boolean, run?: (c: Ctx, s: JutsuSpec) => boolean | void,
 * }} JutsuSpec
 */

/** Extra jutsu power granted while a forged toggle is active (read by progression.power). @type {Map<string, number>} */
export const TOGGLE_POWER = new Map();

/** Archetypes the forge understands. `custom` is internal (code), the rest are pure data. */
export const KIND_NAMES = [
  'bolt', 'barrage', 'cone', 'burst', 'beam', 'chain', 'strike', 'dash', 'buff', 'aura', 'heal', 'summon', 'terrain',
  'bind', 'field', 'mark', 'cleanse', 'custom',
];

const ELEMENT_SOUND = {
  fire: SOUND.fire, lava: SOUND.blaze, water: SOUND.water, wind: SOUND.wind, rasenshuriken: SOUND.wind,
  lightning: SOUND.zap, earth: SOUND.stone, ice: SOUND.glass, sand: SOUND.stone, wood: SOUND.wood, ink: SOUND.bubble,
};
const NEGATIVE = [FX.slowness, FX.weakness, FX.poison, FX.wither, FX.nausea, FX.blindness, FX.darkness, FX.miningFatigue,
  FX.hunger, FX.levitation];

/** @param {JutsuSpec} s */
const colorOf = (s) => (s.color ? rgb(s.color) : elementColor(s.element ?? 'rasengan'));
/** @param {JutsuSpec} s */
const impactOf = (s) => IMPACT[s.element ?? ''] ?? PARTICLE.burst;
/** @param {JutsuSpec} s */
const soundOf = (s) => (s.sound && SOUND[s.sound]) || ELEMENT_SOUND[s.element ?? ''] || SOUND.cast;
/** @param {FxSpec[] | undefined} list @returns {Array<[string, number, number]>} */
const fxList = (list) => (list ?? []).map(([k, secs, amp]) => [FX[k] ?? k, secs, amp]);
/** @param {JutsuSpec} s */
function causeOf(s) {
  if (s.element === 'lightning') return EntityDamageCause.lightning;
  if (s.magic) return EntityDamageCause.magic;
  return EntityDamageCause.entityAttack;
}

/** Distance from a point to a segment. @param {Vector3} p @param {Vector3} a @param {Vector3} b */
function segDist(p, a, b) {
  const ab = sub(b, a);
  const len2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / len2));
  return dist(p, add(a, mul(ab, t)));
}

/** Everything a hit does: damage, effects, control, chakra theft, and the element's impact shape. */
function strike(/** @type {Ctx} */ c, /** @type {JutsuSpec} */ s, /** @type {Entity} */ e, mult = 1) {
  if (!valid(e)) return;
  const dmg = (s.damage ?? 0) * c.pow * mult;
  if (dmg > 0) hurt(e, dmg, c.p, causeOf(s));
  for (const [id, secs, amp] of fxList(s.effects)) effect(e, id, secs, amp);
  if (s.stun) stun(e, s.stun);
  if (s.fire) {
    try {
      e.setOnFire(s.fire, true);
    } catch {}
  }
  if (s.knock) knock(e, c.p.location, s.knock, s.up ?? 0.4);
  if (s.pull) pull(e, c.p.location, 1.4);
  if (s.drain) {
    if (isPlayer(e)) setChakra(e, getChakra(e) - s.drain);
    addChakra(c.p, s.drain * 0.5);
  }
  if (s.lifesteal && dmg > 0) heal(c.p, dmg * s.lifesteal);
  fx(c.dim, impactOf(s), eyes(e), colorOf(s));
}

/** @param {Ctx} c @param {JutsuSpec} s @param {Vector3} dir @param {Entity} [homing] */
function orbOpts(c, s, dir, homing) {
  return {
    element: s.element ?? 'rasengan', color: s.color, damage: s.damage ?? 8, speed: s.speed ?? 1.6, size: s.size ?? 2,
    radius: s.radius ?? 0, explode: s.explode ?? 0, gravity: s.gravity ?? 0, life: s.life ?? 60, fire: s.fire,
    knock: s.knock, effects: fxList(s.effects), pulses: s.pulses, dir, homing, power: c.pow,
  };
}

/** Where an area technique lands. @param {Ctx} c @param {JutsuSpec} s @returns {Vector3 | undefined} */
function centerOf(c, s) {
  if (s.at === 'self') return c.p.location;
  if (s.at === 'target') return target(c, s.range ?? 20)?.location;
  const pt = lookPoint(c.p, s.range ?? 20);
  return ground(c.dim, pt) ?? pt;
}

/** @param {Ctx} c @param {JutsuSpec} s */
function selfFx(c, s, seconds = 0) {
  for (const [id, secs, amp] of fxList(s.self)) effect(c.p, id, seconds || secs, amp, !seconds);
}

// ------------------------------------------------------------------ terrain shapes
/** @type {Record<string, (center: Vector3, dir: Vector3, size: number, height: number) => Vector3[]>} */
const SHAPES = {
  wall: (center, dir, size, height) => wall(center, dir, size, height),
  dome(center, _dir, size) {
    const out = [];
    for (let x = -size; x <= size; x++) {
      for (let y = 0; y <= size; y++) {
        for (let z = -size; z <= size; z++) {
          const r = Math.hypot(x, y, z);
          if (r <= size + 0.5 && r >= size - 0.5) out.push(add(center, v3(x, y, z)));
        }
      }
    }
    return out;
  },
  cage(center, _dir, size, height) {
    const out = [];
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) {
        const edge = Math.abs(x) === size || Math.abs(z) === size;
        for (let y = 0; y <= height; y++) if (edge || y === height) out.push(add(center, v3(x, y, z)));
      }
    }
    return out;
  },
  ring(center, _dir, size, height) {
    const out = [];
    const n = Math.max(8, Math.round(size * 7));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (let y = 0; y < height; y++) out.push(add(center, v3(Math.cos(a) * size, y, Math.sin(a) * size)));
    }
    return out;
  },
  spikes(center, _dir, size, height) {
    const out = [];
    for (let i = 0; i < size * 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * size;
      const h = 1 + Math.floor(Math.random() * height);
      for (let y = 0; y < h; y++) out.push(add(center, v3(Math.cos(a) * r, y, Math.sin(a) * r)));
    }
    return out;
  },
  pillar(center, _dir, size, height) {
    const out = [];
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) for (let y = 0; y < height; y++) out.push(add(center, v3(x, y, z)));
    }
    return out;
  },
};
export const SHAPE_NAMES = Object.keys(SHAPES);
export const TERRAIN_BLOCKS = { earthWall: BLOCK.earthWall, wood: BLOCK.wood, ice: BLOCK.ice, sand: BLOCK.sand, barrier: BLOCK.barrier };

// ------------------------------------------------------------------ archetypes
/** @type {Record<string, (c: Ctx, s: JutsuSpec) => boolean | void>} */
const KINDS = {
  bolt(c, s) {
    const foes = s.homing ? enemiesAround(c.p, c.p.location, s.range ?? 28) : [];
    fan(c.dir, s.count ?? 1, s.spread ?? 12).forEach((d, i) => {
      spawnOrb(c.p, orbOpts(c, s, d, foes.length ? foes[i % foes.length] : undefined));
    });
  },
  barrage(c, s) {
    const foes = s.homing ? enemiesAround(c.p, c.p.location, s.range ?? 28) : [];
    let n = 0;
    repeat(s.waves ?? 5, s.interval ?? 4, () => {
      if (!valid(c.p)) return false;
      const base = yaw(c.p.getViewDirection(), (Math.random() - 0.5) * (s.spread ?? 8));
      for (const d of fan(base, s.count ?? 1, s.spread ?? 8)) {
        spawnOrb(c.p, orbOpts(c, s, d, foes.length ? foes[n++ % foes.length] : undefined));
      }
    });
  },
  cone(c, s) {
    const range = s.range ?? 8;
    const angle = s.angle ?? 60;
    for (const e of cone(c, range, angle)) strike(c, s, e);
    for (let d = 1.5; d <= range; d += 1.6) {
      for (const dir of fan(c.dir, 3, angle / 2.5)) fx(c.dim, impactOf(s), add(c.head, mul(dir, d)), colorOf(s));
    }
  },
  burst(c, s) {
    const center = centerOf(c, s);
    if (!center) return fail(c, 'No target in sight.');
    const go = () => {
      if (!valid(c.p)) return;
      for (const e of enemiesAround(c.p, center, s.radius ?? 5)) strike(c, s, e);
      fx(c.dim, PARTICLE.ring, add(center, v3(0, 0.3, 0)), colorOf(s));
      fx(c.dim, impactOf(s), add(center, v3(0, 1, 0)), colorOf(s));
      if (s.explode) fx(c.dim, PARTICLE.explosion, center);
      sound(c.dim, s.explode ? SOUND.explode : soundOf(s), center, 1, 1.2);
    };
    if (s.delay) {
      fx(c.dim, PARTICLE.mark, add(center, v3(0, 0.2, 0)), colorOf(s));
      later(s.delay, go);
    } else go();
  },
  beam(c, s) {
    const len = s.length ?? 20;
    const width = s.width ?? 1.6;
    const hit = new Set();
    repeat(s.waves ?? 1, s.interval ?? 4, () => {
      if (!valid(c.p)) return false;
      const from = eyes(c.p);
      const to = add(from, mul(c.p.getViewDirection(), len));
      line(c.dim, from, to, PARTICLE.trail, colorOf(s), 0.7);
      fx(c.dim, impactOf(s), to, colorOf(s));
      for (const e of enemiesAround(c.p, add(from, mul(c.p.getViewDirection(), len / 2)), len / 2 + width)) {
        if (segDist(eyes(e), from, to) > width) continue;
        strike(c, s, e, hit.has(e.id) ? 0.5 : 1);
        hit.add(e.id);
      }
    });
  },
  chain(c, s) {
    const first = target(c, s.range ?? 24);
    if (!first) return fail(c, 'No target in sight.');
    let from = c.head;
    /** @type {Entity | undefined} */
    let cur = first;
    const hit = new Set();
    for (let j = 0; j <= (s.jumps ?? 2) && cur; j++) {
      hit.add(cur.id);
      line(c.dim, from, eyes(cur), PARTICLE.sparks, colorOf(s), 0.6);
      strike(c, s, cur, j ? 0.65 : 1);
      from = eyes(cur);
      const at = cur.location;
      cur = enemiesAround(c.p, at, 7).find((e) => !hit.has(e.id));
    }
  },
  strike(c, s) {
    const t = target(c, s.range ?? 6);
    if (!t) return fail(c, 'No target within reach.');
    if (s.behind) {
      const back = mul(flatDir(v3(0, 0, 0), t.getViewDirection()), -1.6);
      fx(c.dim, PARTICLE.wisp, c.p.location, colorOf(s));
      c.p.tryTeleport(add(t.location, back), { checkForBlocks: true, facingLocation: t.location });
    } else {
      dash(c.p, flatDir(c.p.location, t.location), Math.min(4, dist(c.p.location, t.location) * 0.6), 0.15);
    }
    later(s.delay ?? 4, () => {
      if (!valid(t) || !valid(c.p)) return;
      strike(c, s, t);
      if (s.radius) for (const e of enemiesAround(c.p, t.location, s.radius)) if (e.id !== t.id) strike(c, s, e, 0.6);
      fx(c.dim, PARTICLE.ring, t.location, colorOf(s));
    });
  },
  dash(c, s) {
    fx(c.dim, PARTICLE.wisp, c.p.location, colorOf(s));
    dash(c.p, c.dir, s.speed ?? 3, s.up ?? 0.15);
    later(5, () => {
      if (!valid(c.p)) return;
      for (const e of enemiesAround(c.p, c.p.location, s.radius ?? 2.5)) strike(c, s, e);
    });
  },
  buff(c, s) {
    selfFx(c, s);
    if (s.heal) heal(c.p, s.heal);
    if (s.chakra) addChakra(c.p, s.chakra);
    fx(c.dim, PARTICLE.helix, c.p.location, colorOf(s));
  },
  heal(c, s) {
    /** @type {Entity[]} */
    let who = [c.p];
    if (s.at === 'target') who = [ally(c, s.range ?? 10) ?? c.p];
    else if (s.radius) who = [c.p, ...c.dim.getPlayers({ location: c.p.location, maxDistance: s.radius }).filter((x) => x.id !== c.p.id)];
    for (const e of who) {
      heal(e, (s.heal ?? 6) * (1 + c.rank * 0.1));
      for (const [id, secs, amp] of fxList(s.self)) effect(e, id, secs, amp);
      fx(c.dim, PARTICLE.helix, e.location, colorOf(s));
      fx(c.dim, PARTICLE.sparkle, eyes(e), colorOf(s));
    }
  },
  summon(c, s) {
    const type = ENTITY[s.entity ?? 'clone'] ?? s.entity ?? ENTITY.clone;
    let ok = 0;
    const n = s.count ?? 1;
    for (let i = 0; i < n; i++) {
      const side = (i - (n - 1) / 2) * 1.6;
      const front = add(c.p.location, mul(flatDir(v3(0, 0, 0), c.dir), 2.5));
      const at = add(front, v3(-c.dir.z * side, 0.2, c.dir.x * side));
      if (summon(c, type, at, (s.life ?? 30) * 20)) ok++;
    }
    if (!ok) return fail(c, 'The summoning failed here.');
  },
  terrain(c, s) {
    const center = centerOf(c, s);
    if (!center) return fail(c, 'No target in sight.');
    const shape = SHAPES[s.shape ?? 'wall'] ?? SHAPES.wall;
    const block = TERRAIN_BLOCKS[s.block ?? 'earthWall'] ?? BLOCK.earthWall;
    const base = floor(center);
    const placed = placeTemp(c.dim, shape(base, c.dir, s.size ?? 2, s.height ?? 3), block, (s.duration ?? 15) * 20);
    if (!placed) return fail(c, 'No room there.');
    if (s.damage || s.stun || s.effects) for (const e of enemiesAround(c.p, center, (s.size ?? 2) + 1)) strike(c, s, e);
    fx(c.dim, impactOf(s), add(center, v3(0, 1, 0)), colorOf(s));
  },
  bind(c, s) {
    /** @type {Entity[]} */
    let foes;
    if (s.radius) {
      const center = centerOf(c, s);
      foes = center ? enemiesAround(c.p, center, s.radius) : [];
    } else {
      const t = target(c, s.range ?? 16);
      foes = t ? [t] : [];
    }
    if (!foes.length) return fail(c, 'No one to bind.');
    for (const e of foes) {
      strike(c, s, e);
      fx(c.dim, PARTICLE.ring, e.location, colorOf(s));
    }
    if (s.dot) {
      repeat(s.duration ?? 4, 20, () => {
        if (!valid(c.p)) return false;
        for (const e of foes) {
          if (!valid(e)) continue;
          hurt(e, (s.dot ?? 0) * c.pow, c.p, causeOf(s));
          fx(c.dim, impactOf(s), eyes(e), colorOf(s));
        }
      });
    }
  },
  field(c, s) {
    const center = centerOf(c, s);
    if (!center) return fail(c, 'No target in sight.');
    const radius = s.radius ?? 5;
    repeat(s.duration ?? 6, s.interval ?? 20, (i) => {
      if (!valid(c.p)) return false;
      for (const e of enemiesAround(c.p, center, radius)) strike(c, s, e);
      if (s.allies) {
        for (const p of c.dim.getPlayers({ location: center, maxDistance: radius })) heal(p, s.heal ?? 2);
      }
      if (i % 2 === 0) fx(c.dim, PARTICLE.ring, add(center, v3(0, 0.2, 0)), colorOf(s));
      const a = Math.random() * Math.PI * 2;
      fx(c.dim, impactOf(s), add(center, v3(Math.cos(a) * radius * 0.6, 0.6, Math.sin(a) * radius * 0.6)), colorOf(s));
    });
  },
  mark(c, s) {
    const r = rt(c.p);
    const m = r.marks.get(s.id);
    if (!m || m.until < system.currentTick || m.dim !== c.dim.id) {
      const pt = lookPoint(c.p, s.range ?? 28);
      const at = ground(c.dim, pt) ?? pt;
      r.marks.set(s.id, { loc: at, dim: c.dim.id, until: system.currentTick + (s.duration ?? 60) * 20 });
      repeat(s.duration ?? 60, 20, () => {
        if (!valid(c.p) || rt(c.p).marks.get(s.id)?.loc !== at) return false;
        fx(c.dim, PARTICLE.mark, add(at, v3(0, 0.3, 0)), colorOf(s));
      });
      title(c.p, ' ', `§e${s.name}: §fmark placed. §7Cast again to flash to it.`, 40);
      return;
    }
    if (dist(c.p.location, m.loc) > 96) return fail(c, 'The mark is too far away.');
    const from = c.p.location;
    for (const e of enemiesAround(c.p, add(from, mul(sub(m.loc, from), 0.5)), dist(from, m.loc) / 2 + 2)) {
      if (segDist(e.location, from, m.loc) <= 2.5) strike(c, s, e);
    }
    if (!c.p.tryTeleport(add(m.loc, v3(0, 0.1, 0)), { checkForBlocks: true, keepVelocity: false })) {
      return fail(c, 'Something blocks the mark.');
    }
    line(c.dim, add(from, v3(0, 1, 0)), add(m.loc, v3(0, 1, 0)), PARTICLE.trail, colorOf(s), 1.2);
    r.marks.delete(s.id);
  },
  cleanse(c, s) {
    const who = s.radius ? [c.p, ...c.dim.getPlayers({ location: c.p.location, maxDistance: s.radius })] : [c.p];
    for (const e of who) {
      for (const id of NEGATIVE) {
        try {
          e.removeEffect(id);
        } catch {}
      }
      if (s.heal) heal(e, s.heal);
      fx(c.dim, PARTICLE.sparkle, eyes(e), colorOf(s));
    }
    selfFx(c, s);
  },
  custom(c, s) {
    return s.run?.(c, s);
  },
};

/** Fields copied from a spec onto the Jutsu record. */
const IDENTITY = ['id', 'name', 'school', 'rank', 'cost', 'cd', 'desc', 'nature', 'natures', 'clan', 'kekkei', 'eyes',
  'requires', 'flag', 'contract', 'beast', 'active', 'minSync', 'jp', 'strain', 'ext'];

/** Build a Jutsu from a spec. @param {JutsuSpec} s @returns {Jutsu} */
export function forge(s) {
  /** @type {any} */
  const j = { seals: s.seals ?? [] };
  for (const k of IDENTITY) if (s[k] !== undefined) j[k] = s[k];
  if (s.kind === 'aura') {
    if (s.power) TOGGLE_POWER.set(s.id, s.power);
    j.toggle = {
      upkeep: s.upkeep ?? 3,
      onStart(/** @type {Ctx} */ c) {
        title(c.p, ' ', `§e${s.name}`, 25);
        fx(c.dim, PARTICLE.helix, c.p.location, colorOf(s));
        sound(c.dim, soundOf(s), c.p.location, 1.1, 0.8);
        if (s.health) hurt(c.p, s.health, undefined, EntityDamageCause.magic);
      },
      onSecond(/** @type {Ctx} */ c) {
        selfFx(c, s, 2);
        if (s.heal) heal(c.p, s.heal);
        if (s.damage && s.radius) for (const e of enemiesAround(c.p, c.p.location, s.radius)) strike(c, s, e);
        fx(c.dim, system.currentTick % 40 < 20 ? PARTICLE.helix : PARTICLE.wisp, c.p.location, colorOf(s));
      },
    };
    return j;
  }
  const kind = KINDS[s.kind];
  if (!kind) throw new Error(`${s.id}: unknown jutsu kind '${s.kind}'`);
  j.cast = (/** @type {Ctx} */ c) => {
    const ok = kind(c, s);
    if (ok === false) return false;
    if (s.kind !== 'buff' && s.kind !== 'cleanse') selfFx(c, s);
    if (s.health) hurt(c.p, s.health, undefined, EntityDamageCause.magic);
    if (s.kind !== 'mark') sound(c.dim, soundOf(s), c.p.location, 1.1, 0.9);
    return ok;
  };
  return j;
}

/** Forge and register a list of specs. @param {JutsuSpec[]} specs */
export function forgeAll(specs) {
  register(specs.map(forge));
}
