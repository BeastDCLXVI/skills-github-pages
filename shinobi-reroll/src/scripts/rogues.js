import { world } from '@minecraft/server';
import { absorbing, aim, memory, prey, ready } from './ai.js';
import { ENTITY, FX, PARTICLE, SOUND } from './ids.js';
import { fan, ring } from './jutsu/core.js';
import { spawnOrb } from './projectiles.js';
import {
  add, dash, dist, effect, enemiesAround, eyes, flatDir, fx, heal, health, healthFraction, hurt, isPlayer, knock, later,
  mul, rand, rgb, sound, stun, title, v3, valid,
} from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Player} Player */

const BLACK_FLAME = rgb('#140818');
const SUSANOO = rgb('#8a3ad8');
const WHITE_KARMA = rgb('#f4f0e8');
const OTSUTSUKI = rgb('#9a7ad8');

/** Step behind the target. @param {Entity} boss @param {Player} t */
function behind(boss, t, distance = 2) {
  const to = add(t.location, mul(flatDir(v3(0, 0, 0), t.getViewDirection()), -distance));
  fx(boss.dimension, PARTICLE.smoke, boss.location);
  boss.tryTeleport(to, { checkForBlocks: true, facingLocation: t.location });
}

/** @param {Entity} boss */
function itachi(boss) {
  const t = prey(boss, 28);
  if (!t) return;
  const dim = boss.dimension;
  if (healthFraction(boss) < 0.4 && ready(boss, 'susanoo', 400)) {
    title(t, '§5Susanoo', '§7Itachi\'s ethereal warrior rises', 30);
    effect(boss, FX.resistance, 6, 1, false);
    for (const p of ring(boss.location, 1.6, 10)) fx(dim, PARTICLE.aura, p, SUSANOO);
    later(20, () => {
      if (!valid(boss)) return;
      fx(dim, PARTICLE.shockwave, boss.location, SUSANOO);
      for (const e of enemiesAround(boss, boss.location, 6)) {
        hurt(e, 12, boss);
        knock(e, boss.location, 2.5, 0.6);
      }
    });
    return;
  }
  if (!ready(boss, 'act', 50)) return;
  const roll = Math.random();
  if (roll < 0.25 && dist(boss.location, t.location) < 14) {
    stun(t, 3);
    effect(t, FX.nausea, 5);
    if (isPlayer(t)) title(t, '§4Genjutsu', '§7You are caught in Itachi\'s Sharingan', 30);
    fx(dim, PARTICLE.tomoe, eyes(boss), rgb('#d01020'));
  } else if (roll < 0.5) {
    sound(dim, SOUND.curse, t.location, 1.4, 0.6);
    for (let i = 0; i < 6; i++) {
      later(i * 10, () => {
        if (!valid(t) || !valid(boss)) return;
        try {
          t.setOnFire(2, true);
        } catch {}
        hurt(t, 2.5, boss);
        fx(dim, PARTICLE.blackFlame, t.location, BLACK_FLAME);
      });
    }
  } else if (roll < 0.75) {
    for (let i = 0; i < 6; i++) fx(dim, PARTICLE.burst, add(boss.location, v3(Math.random() * 2 - 1, 1 + Math.random(), Math.random() * 2 - 1)), rgb('#101010'));
    sound(dim, SOUND.crow, boss.location, 0.8, 1.5);
    effect(boss, FX.invisibility, 3, 0, false);
    behind(boss, t, 3);
  } else {
    spawnOrb(boss, { element: 'fire', size: 3, speed: 1.4, damage: 9, radius: 2.5, fire: 5, dir: aim(boss, t), sound: SOUND.fire });
  }
}

/** @param {Entity} boss */
function kisame(boss) {
  const t = prey(boss, 28);
  if (!t) return;
  const dim = boss.dimension;
  const mem = memory(boss);
  if (!mem.fused && healthFraction(boss) < 0.5) {
    mem.fused = 1;
    effect(boss, FX.regeneration, 10, 1);
    effect(boss, FX.strength, 20, 1);
    title(t, '§9Kisame', '§7fuses with Samehada!', 30);
  }
  if (dist(boss.location, t.location) < 3.5 && ready(boss, 'drain', 40)) {
    hurt(t, 4, boss);
    heal(boss, 4);
    fx(dim, PARTICLE.burst, eyes(t), rgb('#5d7e99'));
  }
  if (!ready(boss, 'act', 60)) return;
  if (Math.random() < 0.55) {
    for (const d of fan(aim(boss, t), 3, 14)) {
      spawnOrb(boss, { element: 'water', size: 3, speed: 1.5, damage: 9, radius: 2, knock: 1.8, dir: d, sound: SOUND.water });
    }
  } else {
    stun(t, 3);
    sound(dim, SOUND.water, t.location);
    for (let i = 0; i < 3; i++) {
      later(i * 20, () => {
        if (!valid(t) || !valid(boss)) return;
        hurt(t, 3, boss);
        fx(dim, PARTICLE.burst, eyes(t), rgb('#3a8cff'));
      });
    }
  }
}

/** @param {Entity} boss */
function deidara(boss) {
  const dim = boss.dimension;
  const mem = memory(boss);
  if (!mem.c0 && healthFraction(boss) < 0.2) {
    mem.c0 = 1;
    for (const p of dim.getPlayers({ location: boss.location, maxDistance: 32 })) title(p, '§cKatsu!', '§6Art is an explosion! RUN!', 50);
    sound(dim, SOUND.fizz, boss.location, 0.5, 3);
    effect(boss, FX.slowness, 5, 9, false);
    for (let i = 0; i < 6; i++) later(i * 10, () => valid(boss) && fx(dim, PARTICLE.sparks, eyes(boss), rgb('#ffb43a')));
    later(60, () => {
      if (!valid(boss)) return;
      const at = boss.location;
      fx(dim, PARTICLE.explosion, at);
      fx(dim, PARTICLE.shockwave, at, rgb('#f4efe0'));
      sound(dim, SOUND.explode, at, 0.6, 3);
      for (const e of enemiesAround(boss, at, 8)) hurt(e, 30, boss);
      hurt(boss, 9999);
    });
    return;
  }
  const t = prey(boss, 30);
  if (!t || mem.c0 || !ready(boss, 'act', 55)) return;
  if (dist(boss.location, t.location) < 5) {
    try {
      boss.applyKnockback({ x: -aim(boss, t).x * 2, z: -aim(boss, t).z * 2 }, 0.8);
    } catch {}
    effect(boss, FX.slowFalling, 2, 0, false);
  }
  if (Math.random() < 0.6) {
    for (const d of fan(aim(boss, t), 3, 25)) {
      spawnOrb(boss, { element: 'earth', color: '#f4efe0', size: 1, speed: 1.0, damage: 7, radius: 2.5, explode: 1, dir: d, homing: t, life: 80, fizzleBoom: true });
    }
    sound(dim, SOUND.crow, boss.location, 1.2);
  } else {
    spawnOrb(boss, { element: 'earth', color: '#f4efe0', size: 4, speed: 1.1, damage: 14, radius: 4, explode: 3, dir: aim(boss, t), fizzleBoom: true, life: 60, sound: SOUND.roar });
  }
}

/** @param {Entity} boss */
function orochimaru(boss) {
  const t = prey(boss, 30);
  if (!t) return;
  const dim = boss.dimension;
  const mem = memory(boss);
  if (!mem.shed && healthFraction(boss) < 0.5) {
    mem.shed = 1;
    heal(boss, 100);
    fx(dim, PARTICLE.smoke, boss.location);
    title(t, '§5Orochimaru', '§7sheds his skin...', 30);
    const away = add(boss.location, mul(flatDir(t.location, boss.location), 8));
    boss.tryTeleport(away, { checkForBlocks: true, facingLocation: t.location });
  }
  if (!ready(boss, 'act', 55)) return;
  const roll = Math.random();
  if (roll < 0.3) {
    const snakes = dim.getEntities({ location: boss.location, maxDistance: 24, type: ENTITY.snake }).length;
    if (snakes < 2) {
      for (const p of ring(boss.location, 2.5, 2)) {
        try {
          dim.spawnEntity(ENTITY.snake, add(p, v3(0, 0.5, 0)));
        } catch {}
      }
      fx(dim, PARTICLE.smoke, boss.location);
      sound(dim, SOUND.hiss, boss.location, 0.6, 1.5);
      return;
    }
  }
  if (roll < 0.6 && dist(boss.location, t.location) < 8) {
    dash(boss, flatDir(boss.location, t.location), 3, 0.2);
    later(6, () => {
      if (!valid(boss) || !valid(t)) return;
      if (dist(boss.location, t.location) < 4) hurt(t, 10, boss);
      fx(dim, PARTICLE.sparks, eyes(t), rgb('#e8eef2'));
    });
  } else {
    for (const d of fan(aim(boss, t), 3, 12)) {
      spawnOrb(boss, { element: 'ink', color: '#6b4a8f', size: 2, speed: 1.6, damage: 7, effects: [[FX.poison, 4, 0]], dir: d });
    }
  }
}

/** @param {Entity} boss */
function kinshiki(boss) {
  const dim = boss.dimension;
  if (healthFraction(boss) < 0.3) {
    const momo = dim.getEntities({ location: boss.location, maxDistance: 24, type: ENTITY.momoshiki })[0];
    if (momo && valid(momo)) {
      heal(momo, 200);
      effect(momo, FX.strength, 30, 1);
      fx(dim, PARTICLE.spiral, eyes(boss), rgb('#e8e4d8'));
      world.sendMessage('§5Momoshiki absorbs Kinshiki and grows stronger!');
      try {
        boss.remove();
      } catch {}
      return;
    }
  }
  const t = prey(boss, 30);
  if (!t || !ready(boss, 'act', 60)) return;
  if (dist(boss.location, t.location) < 6) {
    fx(dim, PARTICLE.shockwave, boss.location, rgb('#e8e4d8'));
    sound(dim, SOUND.anvil, boss.location, 0.6, 1.5);
    for (const e of enemiesAround(boss, boss.location, 5)) {
      hurt(e, 14, boss);
      knock(e, boss.location, 2.4, 0.6);
    }
  } else {
    for (const d of fan(aim(boss, t), 5, 15)) spawnOrb(boss, { element: 'ash_bone', color: '#f4efe0', size: 1, speed: 2.2, damage: 7, dir: d });
  }
}

/** @param {Entity} boss */
function jigen(boss) {
  absorbing(boss);
  const mem = memory(boss);
  const dim = boss.dimension;
  // Phase two: the vessel cracks and Isshiki Otsutsuki himself takes over
  if (!mem.isshiki && healthFraction(boss) < 0.3) {
    mem.isshiki = 1;
    heal(boss, (health(boss)?.effectiveMax ?? 520) * 0.4);
    try {
      boss.nameTag = 'Isshiki Otsutsuki';
    } catch {}
    effect(boss, FX.strength, 600, 1, false);
    effect(boss, FX.speed, 600, 0, false);
    fx(dim, PARTICLE.shockwave, boss.location, OTSUTSUKI);
    sound(dim, SOUND.witherSpawn, boss.location, 0.7, 2);
    world.sendMessage('§5Jigen\'s vessel cracks... §lIsshiki Otsutsuki§r§5 awakens!');
    return;
  }
  const t = prey(boss, 36);
  if (!t) {
    if (boss.hasTag('sr_absorbing')) boss.removeTag('sr_absorbing');
    return;
  }
  if (!ready(boss, 'act', mem.isshiki ? 35 : healthFraction(boss) < 0.5 ? 45 : 65)) return;
  const roll = Math.random();
  if (mem.isshiki && roll < 0.35) {
    // Sukunahikona: shrunken stakes that swell back to full size on impact
    for (const d of fan(aim(boss, t), 5, 14)) {
      spawnOrb(boss, { element: 'bone', color: '#2a2430', size: 1, speed: 2.8, damage: 9, radius: 2.5, explode: 1, dir: d });
    }
    sound(dim, SOUND.witherShoot, boss.location, 1.4, 1);
    return;
  }
  if (roll < 0.25) {
    const at = t.location;
    const size = mem.isshiki ? 3 : 2;
    for (const p of ring(at, size, 12)) fx(dim, PARTICLE.mark, add(p, v3(0, 0.2, 0)), OTSUTSUKI);
    later(25, () => {
      fx(dim, PARTICLE.explosion, at);
      sound(dim, SOUND.anvil, at, 0.5, 2);
      if (valid(boss)) for (const e of enemiesAround(boss, at, size + 2)) hurt(e, mem.isshiki ? 30 : 24, boss);
    });
  } else if (roll < 0.5) {
    for (const d of fan(aim(boss, t), 3, 8)) spawnOrb(boss, { element: 'truth', size: 1, speed: 2.4, damage: 10, radius: 3, explode: 2, dir: d });
  } else if (roll < 0.75) {
    behind(boss, t, 2.5);
    effect(boss, FX.strength, 3, 2, false);
  } else {
    absorbing(boss, 70);
    fx(dim, PARTICLE.aura, boss.location, rgb('#9a4ad0'));
    if (isPlayer(t)) title(t, ' ', '§5Jigen absorbs incoming jutsu!', 30);
  }
}

/** Code of the Kara Inner: claw-mark ambushes, White Karma strikes, Claw Grime, and limiters that come off. @param {Entity} boss */
function code(boss) {
  const mem = memory(boss);
  const dim = boss.dimension;
  if (!mem.limiter && healthFraction(boss) < 0.5) {
    mem.limiter = 1;
    effect(boss, FX.speed, 600, 1, false);
    effect(boss, FX.strength, 600, 1, false);
    effect(boss, FX.resistance, 600, 0, false);
    fx(dim, PARTICLE.shockwave, boss.location, WHITE_KARMA);
    sound(dim, SOUND.roar, boss.location, 0.9, 2);
    world.sendMessage('§fCode tears off his limiters! §7His White Karma flares.');
    return;
  }
  const t = prey(boss, 40);
  if (!t || !ready(boss, 'act', mem.limiter ? 40 : 60)) return;
  const roll = Math.random();
  if (roll < 0.3) {
    // Claw Marks: carve marks around the target, then blink through each of them
    const marks = [0, 1, 2].map(() => add(t.location, v3(rand(-5, 5), 0, rand(-5, 5))));
    for (const m of marks) {
      for (const dx of [-0.5, 0, 0.5]) fx(dim, PARTICLE.mark, add(m, v3(dx, 1, 0)), WHITE_KARMA);
    }
    sound(dim, SOUND.fangs, t.location, 1.3, 1);
    marks.forEach((m, i) => {
      later(20 + i * 8, () => {
        if (!valid(boss)) return;
        boss.tryTeleport(m, { checkForBlocks: true });
        fx(dim, PARTICLE.mark, eyes(boss), WHITE_KARMA);
        for (const e of enemiesAround(boss, m, 2.8)) hurt(e, 10, boss);
      });
    });
  } else if (roll < 0.5) {
    let grime = [];
    try {
      grime = dim.getEntities({ location: boss.location, maxDistance: 32, type: ENTITY.clawGrime });
    } catch {}
    if (grime.length < 4) {
      for (const side of [-3, 3]) {
        const at = add(boss.location, v3(side, 0.2, rand(-2, 2)));
        try {
          dim.spawnEntity(ENTITY.clawGrime, at);
        } catch {}
        fx(dim, PARTICLE.mark, add(at, v3(0, 1, 0)), WHITE_KARMA);
      }
      if (isPlayer(t)) title(t, ' ', '§fClaw Grime crawl out of Code\'s marks!', 30);
    }
  } else if (roll < 0.8) {
    // White Karma strike: close the distance and hit like a falling mountain
    dash(boss, flatDir(boss.location, t.location), 3.5, 0.2);
    later(6, () => {
      if (!valid(boss) || !valid(t) || dist(boss.location, t.location) > 4) return;
      hurt(t, mem.limiter ? 20 : 15, boss);
      knock(t, boss.location, 2.8, 0.7);
      fx(dim, PARTICLE.shockwave, t.location, WHITE_KARMA);
      sound(dim, SOUND.anvil, t.location, 0.7, 1.5);
    });
  } else {
    for (const d of fan(aim(boss, t), 5, 16)) {
      spawnOrb(boss, { element: 'karma', color: '#f4f0e8', size: 1, speed: 2.2, damage: 8, dir: d });
    }
  }
}

/** Behaviour per mini-boss type, dispatched from the shared boss loop. */
export const ROGUE_BRAINS = {
  [ENTITY.code]: code,
  [ENTITY.itachi]: itachi,
  [ENTITY.kisame]: kisame,
  [ENTITY.deidara]: deidara,
  [ENTITY.orochimaru]: orochimaru,
  [ENTITY.kinshiki]: kinshiki,
  [ENTITY.jigen]: jigen,
};
