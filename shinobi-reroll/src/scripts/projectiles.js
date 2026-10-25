import { system, world } from '@minecraft/server';
import { ENTITY, ORB_ELEMENTS, PARTICLE, PROP, SOUND } from './ids.js';
import { rt } from './state.js';
import { addChakra } from './store.js';
import {
  add, effect, enemiesAround, eyes, fx, heal, hurt, isFriendly, isPlayer, knock, mul, norm, rgb, settings, sound, sub,
  valid, v3,
} from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */

/**
 * @typedef {{
 *   element: string, damage: number, speed?: number, size?: number, radius?: number, gravity?: number,
 *   life?: number, fire?: number, knock?: number, effects?: Array<[string, number, number]>,
 *   hidden?: [number, number], explode?: number, color?: string, pulses?: number, pulseRadius?: number,
 *   homing?: Entity, dir?: Vector3, from?: Vector3, sound?: string, onHit?: (meta: OrbMeta, loc: Vector3, hit?: Entity) => void,
 *   fizzleBoom?: boolean, power?: number
 * }} OrbOptions
 * @typedef {{ entity: Entity, caster: Entity, opts: OrbOptions, born: number, done: boolean }} OrbMeta
 */

/** @type {Map<string, OrbMeta>} */
const orbs = new Map();

const ELEMENT_COLORS = {
  fire: '#ff7a2a', water: '#3a8cff', wind: '#c8ffe8', lightning: '#cfe4ff', earth: '#a0784a', rasengan: '#6fc8ff',
  rasenshuriken: '#e8f8ff', ice: '#bfefff', lava: '#ff5a1f', bone: '#f4efe0', ash_bone: '#9a9a9a', truth: '#30263f',
  bijuu_bomb: '#7a1b8e', karma: '#9a4ad0', wood: '#5aa04a', boil: '#d8e86a', amaterasu: '#1a0820', sand: '#d8b56a',
  ink: '#1c1828', hidden: '#ffffff',
};

/** @param {string} element */
export const elementColor = (element) => rgb(ELEMENT_COLORS[element] ?? '#ffffff');

/** The particle shape each element leaves where it lands. */
export const IMPACT = {
  fire: PARTICLE.flame, lava: PARTICLE.flame, boil: PARTICLE.wisp, water: PARTICLE.splash, wind: PARTICLE.gust,
  rasenshuriken: PARTICLE.gust, lightning: PARTICLE.arc, earth: PARTICLE.debris, sand: PARTICLE.grains, ink: PARTICLE.ink,
  wood: PARTICLE.leaves, ice: PARTICLE.shards, bone: PARTICLE.shards, ash_bone: PARTICLE.shards, amaterasu: PARTICLE.blackFlame,
  rasengan: PARTICLE.sphere, karma: PARTICLE.sphere, truth: PARTICLE.ring, bijuu_bomb: PARTICLE.ring,
};

/**
 * Launch a scripted jutsu projectile.
 * @param {Entity} caster @param {OrbOptions} opts
 */
export function spawnOrb(caster, opts) {
  const dim = caster.dimension;
  const dir = norm(opts.dir ?? caster.getViewDirection());
  const from = opts.from ?? add(eyes(caster), mul(dir, 1.3));
  let orb;
  try {
    orb = dim.spawnEntity(ENTITY.orb, from);
  } catch {
    return undefined;
  }
  const idx = Math.max(0, ORB_ELEMENTS.indexOf(opts.element));
  try {
    orb.setProperty(PROP.element, idx);
    orb.setProperty(PROP.size, Math.max(1, Math.min(8, Math.round(opts.size ?? 2))));
  } catch {}
  const proj = orb.getComponent('minecraft:projectile');
  if (proj) {
    proj.owner = caster;
    proj.gravity = opts.gravity ?? 0;
    proj.shoot(mul(dir, opts.speed ?? 1.6), { uncertainty: 0 });
  }
  orbs.set(orb.id, { entity: orb, caster, opts, born: system.currentTick, done: false });
  if (opts.sound) sound(dim, opts.sound, from, 1.0, 1.0);
  return orb;
}

/** Detonate a jutsu at a location: damage, effects, particles. @param {OrbMeta} meta @param {Vector3} loc @param {Entity} [hit] */
function resolve(meta, loc, hit) {
  if (meta.done) return;
  meta.done = true;
  orbs.delete(meta.entity.id);
  const { caster, opts } = meta;
  if (!valid(caster)) return;
  const dim = caster.dimension;
  const color = opts.color ? rgb(opts.color) : elementColor(opts.element);
  const power = opts.power ?? 1;
  const dmg = opts.damage * power;
  /** @param {Entity} e @param {number} amount */
  const strike = (e, amount) => {
    if (!valid(e) || isFriendly(caster, e)) return;
    if (absorbs(e)) {
      heal(e, amount * 0.5);
      if (isPlayer(e)) addChakra(e, amount * 2);
      fx(dim, PARTICLE.burst, add(e.location, v3(0, 1, 0)), rgb('#b46cf0'));
      return;
    }
    hurt(e, amount, caster);
    if (opts.fire) {
      try {
        e.setOnFire(opts.fire, true);
      } catch {}
    }
    for (const [id, secs, amp] of opts.effects ?? []) effect(e, id, secs, amp);
    if (opts.knock) knock(e, loc, opts.knock, 0.45);
  };
  if (hit) strike(hit, dmg);
  const radius = opts.radius ?? 0;
  if (radius > 0) {
    for (const e of enemiesAround(caster, loc, radius)) if (e.id !== hit?.id) strike(e, dmg * 0.7);
  }
  fx(dim, PARTICLE.burst, loc, color);
  const impact = IMPACT[opts.element];
  if (impact) fx(dim, impact, loc, color);
  if (opts.element === 'lightning') fx(dim, PARTICLE.sparks, loc, color);
  if (radius >= 3 || opts.explode) fx(dim, PARTICLE.ring, loc, color);
  if (opts.explode) {
    fx(dim, PARTICLE.explosion, loc);
    sound(dim, SOUND.explode, loc, 1.1, 1.2);
    if (settings().griefing) {
      try {
        dim.createExplosion(loc, opts.explode, { breaksBlocks: true, causesFire: opts.element === 'fire', source: caster });
      } catch {}
    }
  }
  if (opts.pulses) {
    let i = 0;
    const r = opts.pulseRadius ?? radius ?? 3;
    const run = system.runInterval(() => {
      if (!valid(caster) || i++ >= (opts.pulses ?? 0)) {
        system.clearRun(run);
        return;
      }
      fx(dim, PARTICLE.shockwave, loc, color);
      fx(dim, PARTICLE.spiral, loc, color);
      sound(dim, SOUND.wind, loc, 1.4, 0.6);
      for (const e of enemiesAround(caster, loc, r)) strike(e, dmg * 0.35);
    }, 4);
  }
  opts.onHit?.(meta, loc, hit);
  try {
    if (valid(meta.entity)) meta.entity.remove();
  } catch {}
}

/** Momoshiki's palms and the Otsutsuki Chakra Absorption swallow jutsu. @param {Entity} e */
function absorbs(e) {
  if (e.hasTag('sr_absorbing')) return true;
  return isPlayer(e) && rt(e).absorbUntil > system.currentTick;
}

/** Orbs fly on their own; this keeps trails, homing, invisibility windows and lifetime. */
function tick() {
  const now = system.currentTick;
  for (const [id, meta] of orbs) {
    const e = meta.entity;
    if (!valid(e)) {
      orbs.delete(id);
      continue;
    }
    const age = now - meta.born;
    let loc;
    try {
      loc = e.location;
    } catch {
      orbs.delete(id);
      continue;
    }
    const { opts } = meta;
    if (age % 2 === 0) fx(e.dimension, PARTICLE.trail, loc, opts.color ? rgb(opts.color) : elementColor(opts.element));
    if (opts.element === 'rasengan' || opts.element === 'rasenshuriken') {
      if (age % 3 === 0) fx(e.dimension, PARTICLE.sphere, loc, elementColor('rasengan'));
    } else if (age % 4 === 0 && (opts.element === 'fire' || opts.element === 'lightning')) {
      fx(e.dimension, opts.element === 'fire' ? PARTICLE.flame : PARTICLE.arc, loc, elementColor(opts.element));
    }
    if (opts.hidden) {
      const hide = age >= opts.hidden[0] && age < opts.hidden[1];
      try {
        if (e.getProperty(PROP.hidden) !== hide) e.setProperty(PROP.hidden, hide);
      } catch {}
    }
    if (opts.homing && valid(opts.homing) && age > 3) {
      try {
        const want = norm(sub(add(opts.homing.location, v3(0, 1, 0)), loc));
        const speed = opts.speed ?? 1.2;
        e.clearVelocity();
        e.applyImpulse(mul(want, speed));
      } catch {}
    }
    if (age > (opts.life ?? 60)) {
      if (opts.fizzleBoom) resolve(meta, loc);
      else {
        meta.done = true;
        orbs.delete(id);
        fx(e.dimension, PARTICLE.burst, loc, opts.color ? rgb(opts.color) : elementColor(opts.element));
        try {
          e.remove();
        } catch {}
      }
    }
  }
}

// ------------------------------------------------------------- thrown ninja tools
const THROWN = {
  [ENTITY.kunai]: { speed: 2.0 },
  [ENTITY.explosiveKunai]: { speed: 1.7 },
  [ENTITY.shuriken]: { speed: 2.2 },
  [ENTITY.fuma]: { speed: 1.6 },
  [ENTITY.senbon]: { speed: 2.6 },
  [ENTITY.smokeBomb]: { speed: 1.2 },
};

/**
 * Throw a physical projectile (damage handled by its entity JSON).
 * @param {Entity} thrower @param {string} entityId @param {Vector3} [dir] @param {Vector3} [from]
 */
export function throwTool(thrower, entityId, dir, from) {
  const d = norm(dir ?? thrower.getViewDirection());
  const start = from ?? add(eyes(thrower), mul(d, 0.9));
  try {
    const e = thrower.dimension.spawnEntity(entityId, start);
    const proj = e.getComponent('minecraft:projectile');
    if (proj) {
      proj.owner = thrower;
      proj.shoot(mul(d, THROWN[entityId]?.speed ?? 2), { uncertainty: 0.2 });
    }
    return e;
  } catch {
    return undefined;
  }
}

/** Explosive tag / kunai detonation. @param {Entity | undefined} source @param {import('@minecraft/server').Dimension} dim @param {Vector3} loc */
export function paperBomb(source, dim, loc, damage = 9, radius = 3.5) {
  fx(dim, PARTICLE.explosion, loc);
  sound(dim, SOUND.explode, loc, 1, 1.2);
  if (settings().griefing) {
    try {
      dim.createExplosion(loc, 2.5, { breaksBlocks: true, source });
    } catch {}
    return;
  }
  if (source && valid(source)) {
    for (const e of enemiesAround(source, loc, radius)) {
      hurt(e, damage, source);
      knock(e, loc, 1.2, 0.5);
    }
  } else {
    for (const e of dim.getEntities({ location: loc, maxDistance: radius, excludeFamilies: ['inanimate', 'projectile'] })) {
      hurt(e, damage);
    }
  }
}

/** @param {Entity} source @param {import('@minecraft/server').Dimension} dim @param {Vector3} loc */
function smokeCloud(source, dim, loc) {
  let i = 0;
  const run = system.runInterval(() => {
    fx(dim, PARTICLE.smoke, add(loc, v3(Math.random() - 0.5, 0.5, Math.random() - 0.5)));
    if (++i >= 10) system.clearRun(run);
  }, 4);
  sound(dim, SOUND.fizz, loc, 0.6, 1);
  if (valid(source)) {
    for (const e of enemiesAround(source, loc, 5)) {
      effect(e, 'minecraft:blindness', 5);
      effect(e, 'minecraft:slowness', 4, 1);
    }
    try {
      if (source.typeId === 'minecraft:player' && Math.hypot(source.location.x - loc.x, source.location.z - loc.z) < 8) {
        effect(source, 'minecraft:invisibility', 6, 0, false);
      }
    } catch {}
  }
}

/** Shared hit handler for both entity and block hits. */
function onProjectileHit(projectile, source, dim, loc, hitEntity) {
  const id = projectile.id;
  const meta = orbs.get(id);
  if (meta) {
    resolve(meta, loc, hitEntity);
    return;
  }
  switch (projectile.typeId) {
    case ENTITY.explosiveKunai:
      system.runTimeout(() => paperBomb(source, dim, loc), 10);
      fx(dim, PARTICLE.sparks, loc, rgb('#ffb43a'));
      break;
    case ENTITY.senbon:
      if (hitEntity) effect(hitEntity, 'minecraft:slowness', 4, 1);
      break;
    case ENTITY.smokeBomb:
      smokeCloud(source, dim, loc);
      break;
    default:
      break;
  }
}

export function startProjectiles() {
  world.afterEvents.projectileHitEntity.subscribe((ev) => {
    const hit = ev.getEntityHit().entity;
    onProjectileHit(ev.projectile, ev.source, ev.dimension, ev.location, hit);
  });
  world.afterEvents.projectileHitBlock.subscribe((ev) => {
    onProjectileHit(ev.projectile, ev.source, ev.dimension, ev.location, undefined);
  });
  system.runInterval(tick, 1);
}

/** All live orbs (used by the Gunbai's Uchiha Return and Momoshiki's absorption). */
export function liveOrbs() {
  return [...orbs.values()];
}

/** Turn an orb around and give it to a new owner. @param {OrbMeta} meta @param {Entity} newOwner */
export function reflectOrb(meta, newOwner) {
  const e = meta.entity;
  if (!valid(e)) return;
  try {
    const v = e.getVelocity();
    e.clearVelocity();
    e.applyImpulse(mul(v, -1.2));
    const proj = e.getComponent('minecraft:projectile');
    if (proj) proj.owner = newOwner;
    meta.caster = newOwner;
    meta.born = system.currentTick;
  } catch {}
}

/** Remove an orb without detonating it. @param {OrbMeta} meta */
export function absorbOrb(meta) {
  meta.done = true;
  orbs.delete(meta.entity.id);
  try {
    if (valid(meta.entity)) {
      fx(meta.entity.dimension, PARTICLE.burst, meta.entity.location, rgb('#b46cf0'));
      meta.entity.remove();
    }
  } catch {}
}
