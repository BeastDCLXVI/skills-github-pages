import { system, world } from '@minecraft/server';
import { BIJUU, bijuuByKey } from './data.js';
import { BLOCK, ENTITY, FX, PARTICLE, SOUND } from './ids.js';
import { dropToggles } from './casting.js';
import { syncAutoJutsu } from './progression.js';
import { spawnOrb } from './projectiles.js';
import { absorbing, aim, prey, ready, timers } from './ai.js';
import { ROGUE_BRAINS } from './rogues.js';
import { getData, touch } from './store.js';
import { placeTemp } from './terrain.js';
import {
  add, dash, dist, effect, enemiesAround, eyes, flatDir, fx, give, healthFraction, hurt, knock, later, mul,
  rgb, sound, tell, title, v3, valid,
} from './util.js';
import { fan, ground, ring } from './jutsu/core.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Entity} Entity */

// ------------------------------------------------------------------- jinchuriki

/** @param {Player} p @param {string} key */
export function becomeJinchuriki(p, key) {
  const d = getData(p);
  const b = bijuuByKey(key);
  if (!b) return false;
  if (d.bijuu) {
    tell(p, `§cYou already host ${bijuuByKey(d.bijuu)?.name}. Sneak and use a Sealing Scroll to release it first.`);
    return false;
  }
  d.bijuu = key;
  d.sync = 0;
  syncAutoJutsu(p);
  title(p, `§6${b.name}`, `§eYou are now the ${b.title} Jinchuriki`, 80);
  world.sendMessage(`§6${p.name} became the Jinchuriki of ${b.name}, the ${b.title}.`);
  sound(p.dimension, SOUND.roar, p.location, 0.8, 1.5);
  fx(p.dimension, PARTICLE.aura, p.location, rgb(b.hex));
  touch(p);
  return true;
}

/** Release the sealed beast back into an orb. @param {Player} p */
export function releaseBijuu(p) {
  const d = getData(p);
  if (!d.bijuu) return false;
  const b = bijuuByKey(d.bijuu);
  dropToggles(p);
  give(p, `shinobi:${d.bijuu}_chakra`, 1);
  d.bijuu = null;
  d.sync = 0;
  syncAutoJutsu(p);
  tell(p, `§7${b?.name ?? 'The beast'} was sealed back into its chakra orb.`);
  touch(p);
  return true;
}

/** Seal a weakened tailed beast with a Sealing Scroll. @param {Player} p */
export function trySeal(p) {
  let hits = [];
  try {
    hits = p.getEntitiesFromViewDirection({ maxDistance: 14, families: ['bijuu'] });
  } catch {}
  const beast = hits.find((h) => valid(h.entity))?.entity;
  if (!beast) {
    tell(p, '§7Look at a tailed beast to seal it (it must be below 30% health).');
    return false;
  }
  if (healthFraction(beast) > 0.3) {
    tell(p, '§cIt is still too strong. Weaken it below 30% health first.');
    return false;
  }
  const key = beast.typeId.split(':')[1];
  const at = beast.location;
  for (const pt of ring(at, 2, 12)) fx(beast.dimension, PARTICLE.burst, add(pt, v3(0, 1, 0)), rgb('#ffd36a'));
  sound(beast.dimension, SOUND.chain, at, 0.6, 2);
  try {
    beast.remove();
  } catch {}
  give(p, `shinobi:${key}_chakra`, 1);
  world.sendMessage(`§e${p.name} sealed ${bijuuByKey(key)?.name ?? 'a tailed beast'}!`);
  return true;
}

/** @param {Player} p @param {string} typeId @param {number} distance */
export function summonBoss(p, typeId, distance = 14) {
  const near = p.dimension.getEntities({ location: p.location, maxDistance: 96, families: ['shinobi_boss'] });
  if (near.length) {
    tell(p, '§cAnother great beast is already rampaging nearby.');
    return false;
  }
  const dir = flatDir(v3(0, 0, 0), p.getViewDirection());
  const at = ground(p.dimension, add(p.location, mul(dir, distance))) ?? add(p.location, mul(dir, distance));
  for (let i = 0; i < 6; i++) fx(p.dimension, PARTICLE.smoke, add(at, v3(Math.random() * 4 - 2, i, Math.random() * 4 - 2)));
  sound(p.dimension, SOUND.witherSpawn, at, 0.8, 2);
  try {
    p.dimension.spawnEntity(typeId, at);
  } catch {
    tell(p, '§cThe summoning failed here.');
    return false;
  }
  return true;
}

// ------------------------------------------------------------------- boss AI



/** @param {Entity} boss @param {Entity} target @param {number} tails */
function bomb(boss, target, tails, size = 5) {
  const color = rgb(BIJUU[Math.max(0, Math.min(8, tails - 1))]?.hex ?? '#7a1b8e');
  const mouth = add(eyes(boss), mul(boss.getViewDirection(), 2));
  sound(boss.dimension, SOUND.charge, mouth, 0.4, 3);
  let i = 0;
  const run = system.runInterval(() => {
    if (!valid(boss) || !valid(target)) {
      system.clearRun(run);
      return;
    }
    fx(boss.dimension, PARTICLE.spiral, add(eyes(boss), mul(boss.getViewDirection(), 2)), color);
    if (++i >= 8) {
      system.clearRun(run);
      spawnOrb(boss, {
        element: 'bijuu_bomb', size, speed: 1.15, damage: 14 + tails * 1.5, radius: 4.5, explode: 3, fizzleBoom: true,
        life: 70, dir: aim(boss, target), sound: SOUND.boom,
      });
    }
  }, 4);
}

/** Signature abilities of each tailed beast. @param {Entity} boss @param {Player} t @param {string} ability @param {number} tails */
function signature(boss, t, ability, tails) {
  const dim = boss.dimension;
  const b = BIJUU.find((x) => x.ability === ability);
  const color = rgb(b?.hex ?? '#ffffff');
  switch (ability) {
    case 'sand':
      for (const pt of ring(t.location, 3, 10)) fx(dim, PARTICLE.burst, pt, rgb('#d8b56a'));
      for (const e of enemiesAround(boss, t.location, 8)) {
        effect(e, FX.slowness, 5, 1);
        effect(e, FX.blindness, 3);
        hurt(e, 5, boss);
      }
      sound(dim, SOUND.fizz, t.location, 0.4, 2);
      break;
    case 'blue_fire':
      for (const d of fan(aim(boss, t), 3, 12)) {
        spawnOrb(boss, { element: 'fire', size: 3, speed: 1.4, damage: 8, radius: 2, fire: 6, dir: d, color: '#3a6fe0' });
      }
      break;
    case 'coral': {
      fx(dim, PARTICLE.shockwave, boss.location, rgb('#3a8cff'));
      for (const e of enemiesAround(boss, boss.location, 10)) {
        hurt(e, 7, boss);
        knock(e, boss.location, 2.2, 0.6);
      }
      for (const pt of ring(t.location, 3, 8)) {
        const g = ground(dim, pt);
        if (g) placeTemp(dim, [g, add(g, v3(0, 1, 0))], BLOCK.ice, 120);
      }
      break;
    }
    case 'lava':
      for (const d of fan(aim(boss, t), 4, 15)) {
        spawnOrb(boss, { element: 'lava', size: 3, speed: 1.3, gravity: 0.03, damage: 8, fire: 6, radius: 2, dir: d });
      }
      break;
    case 'charge':
      dash(boss, flatDir(boss.location, t.location), 4, 0.3);
      later(12, () => {
        if (!valid(boss)) return;
        fx(dim, PARTICLE.shockwave, boss.location, color);
        for (const e of enemiesAround(boss, boss.location, 4)) {
          hurt(e, 12, boss);
          knock(e, boss.location, 2.5, 0.8);
        }
      });
      break;
    case 'acid':
      for (const e of enemiesAround(boss, boss.location, 9)) {
        effect(e, FX.poison, 6, 1);
        hurt(e, 4, boss);
      }
      for (const pt of ring(boss.location, 4, 10)) fx(dim, PARTICLE.smoke, pt, rgb('#d8e86a'));
      break;
    case 'scales':
      for (const e of enemiesAround(boss, boss.location, 12)) {
        effect(e, FX.blindness, 4);
        effect(e, FX.slowness, 4, 1);
      }
      fx(dim, PARTICLE.burst, eyes(boss), color);
      try {
        boss.applyKnockback({ x: 0, z: 0 }, 1.0);
      } catch {}
      break;
    case 'ink':
      for (const d of fan(aim(boss, t), 3, 10)) {
        spawnOrb(boss, { element: 'ink', size: 2, speed: 1.6, damage: 7, effects: [[FX.blindness, 4, 0]], dir: d });
      }
      break;
    case 'roar':
    default:
      sound(dim, SOUND.bigRoar, boss.location, 0.8, 3);
      fx(dim, PARTICLE.shockwave, boss.location, color);
      for (const e of enemiesAround(boss, boss.location, 10)) {
        hurt(e, 6 + tails * 0.5, boss);
        knock(e, boss.location, 3, 0.7);
      }
      for (const d of fan(aim(boss, t), 2, 15)) spawnOrb(boss, { element: 'fire', size: 3, speed: 1.4, damage: 10, fire: 6, dir: d });
      break;
  }
}

/** @param {Entity} boss */
function bijuuBrain(boss) {
  const key = boss.typeId.split(':')[1];
  const b = bijuuByKey(key);
  if (!b) return;
  const t = prey(boss, 44);
  if (!t) return;
  if (dist(boss.location, t.location) > 6 && ready(boss, 'bomb', 220 - b.tails * 6)) bomb(boss, t, b.tails);
  else if (ready(boss, 'sig', 140)) signature(boss, t, b.ability, b.tails);
}

/** @param {Entity} boss */
function juubiBrain(boss) {
  const t = prey(boss, 56);
  if (!t) return;
  const dim = boss.dimension;
  if (ready(boss, 'bomb', 160)) {
    bomb(boss, t, 10, 7);
    later(30, () => valid(boss) && valid(t) && bomb(boss, t, 10, 4));
  } else if (ready(boss, 'wood', 200)) {
    for (const pt of ring(t.location, 5, 10)) {
      const g = ground(dim, pt);
      if (g) placeTemp(dim, [g, add(g, v3(0, 1, 0)), add(g, v3(0, 2, 0))], BLOCK.wood, 200);
    }
    for (const e of enemiesAround(boss, t.location, 6)) {
      hurt(e, 10, boss);
      effect(e, FX.slowness, 4, 2);
    }
    sound(dim, SOUND.wood, t.location, 0.4, 2);
  } else if (ready(boss, 'storm', 120)) {
    for (let i = 0; i < 4; i++) {
      const at = add(t.location, v3(Math.random() * 10 - 5, 0, Math.random() * 10 - 5));
      later(i * 6, () => {
        for (let y = 0; y < 16; y += 2) fx(dim, PARTICLE.sparks, add(at, v3(0, y, 0)), rgb('#cfe4ff'));
        sound(dim, SOUND.zap, at, 0.7, 2);
        if (valid(boss)) for (const e of enemiesAround(boss, at, 3)) hurt(e, 9, boss);
      });
    }
  } else if (ready(boss, 'roar', 100)) {
    signature(boss, t, 'roar', 10);
  }
}

/** @param {Entity} boss */
function momoshikiBrain(boss) {
  const t = prey(boss, 36);
  if (!t) {
    if (boss.hasTag('sr_absorbing')) boss.removeTag('sr_absorbing');
    return;
  }
  const dim = boss.dimension;
  const enraged = healthFraction(boss) < 0.5;
  absorbing(boss);
  if (!ready(boss, 'act', enraged ? 45 : 70)) return;
  const roll = Math.random();
  if (roll < 0.25) {
    absorbing(boss, 70);
    fx(dim, PARTICLE.aura, boss.location, rgb('#9a4ad0'));
    tell(t, '§5Momoshiki raises his palms: jutsu will be absorbed!');
  } else if (roll < 0.5) {
    spawnOrb(boss, { element: 'karma', size: 5, speed: 1.3, damage: 18, radius: 4, explode: 2, dir: aim(boss, t), sound: SOUND.boom });
  } else if (roll < 0.75) {
    ['fire', 'wind', 'lightning'].forEach((el, i) => {
      later(i * 5, () => valid(boss) && valid(t) && spawnOrb(boss, { element: el, size: 3, speed: 1.6, damage: 10, radius: 2, dir: aim(boss, t) }));
    });
  } else {
    const behind = add(t.location, mul(flatDir(v3(0, 0, 0), t.getViewDirection()), -2));
    fx(dim, PARTICLE.mark, eyes(boss), rgb('#c01030'));
    boss.tryTeleport(behind, { checkForBlocks: true, facingLocation: t.location });
    effect(boss, FX.strength, 3, 2, false);
  }
  if (enraged && ready(boss, 'meteor', 200)) {
    for (let i = 0; i < 5; i++) {
      const at = add(t.location, v3(Math.random() * 8 - 4, 0, Math.random() * 8 - 4));
      fx(dim, PARTICLE.mark, add(at, v3(0, 0.2, 0)), rgb('#c01030'));
      later(20, () => {
        fx(dim, PARTICLE.explosion, at);
        if (valid(boss)) for (const e of enemiesAround(boss, at, 3)) hurt(e, 10, boss);
      });
    }
  }
}

function tick() {
  const seen = new Set();
  for (const p of world.getAllPlayers()) {
    let list;
    try {
      list = p.dimension.getEntities({ location: p.location, maxDistance: 80, families: ['shinobi_boss'] });
    } catch {
      continue;
    }
    for (const boss of list) {
      if (seen.has(boss.id) || !valid(boss)) continue;
      seen.add(boss.id);
      try {
        const rogue = ROGUE_BRAINS[boss.typeId];
        if (rogue) rogue(boss);
        else if (boss.typeId === ENTITY.juubi) juubiBrain(boss);
        else if (boss.typeId === ENTITY.momoshiki) momoshikiBrain(boss);
        else bijuuBrain(boss);
      } catch (err) {
        console.warn(`[shinobi] boss AI ${boss.typeId}: ${err}`);
      }
    }
  }
  for (const id of timers.keys()) if (!seen.has(id) && !world.getEntity(id)) timers.delete(id);
}

export function startBosses() {
  system.runInterval(tick, 20);
}

/** Item ids of every chakra orb, for the Gedo Statue recipe check and UI. */
export const ORB_ITEMS = BIJUU.map((b) => `shinobi:${b.key}_chakra`);
