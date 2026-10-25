import { system } from '@minecraft/server';
import { ENTITY, FX, ITEM, PARTICLE, SOUND } from '../ids.js';
import { spawnOrb, throwTool } from '../projectiles.js';
import { rt } from '../state.js';
import { getData } from '../store.js';
import {
  add, dash, effect, enemiesAround, eyes, fx, hurt, knock, mul, norm, repeat, rgb, sound, takeItem, title, v3,
} from '../util.js';
import { ahead, fail, fan, register, ring, summon, summonsOf } from './core.js';

const SPIRAL = rgb('#6fc8ff');
const SAGE = rgb('#ff9a2a');

register([
  // ------------------------------------------------------------- academy
  {
    id: 'substitution', name: 'Substitution Jutsu', school: 'Ninjutsu', rank: 0, cost: 15, cd: 8,
    seals: ['Ram', 'Boar', 'Ox', 'Dog', 'Snake'],
    desc: 'Swap places with a log and vanish backwards, briefly untouchable.',
    cast(c) {
      const from = c.p.location;
      try {
        c.dim.spawnEntity(ENTITY.log, from);
      } catch {}
      fx(c.dim, PARTICLE.smoke, add(from, v3(0, 1, 0)));
      sound(c.dim, SOUND.poof, from);
      const back = norm(v3(-c.dir.x, 0, -c.dir.z));
      for (const dist of [7, 5, 3]) {
        if (c.p.tryTeleport(add(add(from, mul(back, dist)), v3(0, 0.5, 0)), { checkForBlocks: true, keepVelocity: false })) break;
      }
      effect(c.p, FX.resistance, 1.2, 4, false);
      effect(c.p, FX.invisibility, 1.5, 0, false);
    },
  },
  {
    id: 'body_flicker', name: 'Body Flicker Technique', school: 'Ninjutsu', rank: 0, cost: 10, cd: 3, seals: ['Tiger'],
    desc: 'A burst of chakra-enhanced speed in the direction you look.',
    cast(c) {
      fx(c.dim, PARTICLE.leaves, c.p.location);
      sound(c.dim, SOUND.whoosh, c.p.location, 1.6, 0.6);
      dash(c.p, c.dir, 3.4, 0.25);
    },
  },
  {
    id: 'transformation', name: 'Transformation Jutsu', school: 'Ninjutsu', rank: 0, cost: 20, cd: 25,
    seals: ['Dog', 'Boar', 'Ram'],
    desc: 'Vanish from sight for 15 seconds.',
    cast(c) {
      fx(c.dim, PARTICLE.smoke, add(c.p.location, v3(0, 1, 0)));
      sound(c.dim, SOUND.poof, c.p.location);
      effect(c.p, FX.invisibility, 15, 0, false);
      effect(c.p, FX.speed, 15, 0, false);
    },
  },
  {
    id: 'leaf_hurricane', name: 'Leaf Hurricane', school: 'Taijutsu', rank: 0, cost: 6, cd: 5, seals: [],
    desc: 'A spinning kick that blasts away everything around you.',
    cast(c) {
      fx(c.dim, PARTICLE.leaves, c.p.location);
      sound(c.dim, SOUND.whoosh, c.p.location, 0.8);
      for (const e of enemiesAround(c.p, c.p.location, 3.5)) {
        hurt(e, 5 * c.pow, c.p);
        knock(e, c.p.location, 1.6, 0.5);
      }
    },
  },
  // ------------------------------------------------------------- genin ninjutsu
  {
    id: 'shadow_clone', name: 'Shadow Clone Jutsu', school: 'Ninjutsu', rank: 1, cost: 40, cd: 25, seals: ['Ram', 'Snake', 'Tiger'],
    desc: 'Create solid clones that fight beside you. When they vanish, their experience returns to you.',
    cast(c) {
      const existing = summonsOf(c.p.id, ENTITY.clone).length;
      const count = Math.min(8 - existing, 2 + Math.max(0, c.rank - 1) + (c.d.clan === 'uzumaki' ? 2 : 0));
      if (count <= 0) return fail(c, 'You cannot maintain more clones.');
      const life = (c.d.clan === 'uzumaki' ? 60 : 45) * 20;
      for (const at of ring(c.p.location, 1.6, count)) summon(c, ENTITY.clone, add(at, v3(0, 0.2, 0)), life);
      sound(c.dim, SOUND.poof, c.p.location, 0.8);
      title(c.p, '', '§6Kage Bunshin no Jutsu!', 25);
    },
  },
  {
    id: 'shuriken_shadow_clone', name: 'Shuriken Shadow Clone Jutsu', school: 'Ninjutsu', rank: 1, cost: 18, cd: 6,
    seals: ['Ram', 'Tiger'], desc: 'Throw one shuriken and multiply it into a deadly fan. Consumes a shuriken.',
    cast(c) {
      if (!takeItem(c.p, ITEM.shuriken, 1)) return fail(c, 'You need a shuriken.');
      for (const d of fan(c.dir, 9, 30)) throwTool(c.p, ENTITY.shuriken, d);
      sound(c.dim, SOUND.throw, c.p.location, 1.3);
    },
  },
  {
    id: 'rasengan', name: 'Rasengan', school: 'Ninjutsu', rank: 1, cost: 30, cd: 6, seals: [],
    desc: 'Compress spinning chakra in your palm; your next hit within 5s detonates it.',
    cast(c) {
      charge(c, 'rasengan', 100, 1);
      sound(c.dim, SOUND.charge, c.p.location, 1.4);
    },
  },
  {
    id: 'big_ball_rasengan', name: 'Big Ball Rasengan', school: 'Ninjutsu', rank: 2, cost: 50, cd: 10, seals: [],
    requires: ['rasengan'], desc: 'A Rasengan the size of a boulder; the hit explodes in an area.',
    cast(c) {
      charge(c, 'oodama', 120, 1);
      sound(c.dim, SOUND.charge, c.p.location, 1.0);
    },
  },
  {
    id: 'vanishing_rasengan', name: 'Vanishing Rasengan', school: 'Ninjutsu', rank: 2, cost: 45, cd: 8, seals: [],
    requires: ['rasengan'],
    desc: 'Boruto\'s thrown Rasengan: it disappears mid-flight and reappears at the target.',
    cast(c) {
      spawnOrb(c.p, { element: 'rasengan', size: 2, speed: 1.4, damage: 14, radius: 2, knock: 1.5, hidden: [6, 16], power: c.pow, life: 50 });
      sound(c.dim, SOUND.whoosh, c.p.location, 1.8);
    },
  },
  {
    id: 'rasenshuriken', name: 'Wind Style: Rasenshuriken', school: 'Ninjutsu', rank: 3, cost: 90, cd: 20, seals: [],
    nature: 'wind', requires: ['rasengan'],
    desc: 'A Rasengan laced with wind blades. On impact it becomes a sphere that shreds everything inside.',
    cast(c) {
      spawnOrb(c.p, {
        element: 'rasenshuriken', size: 4, speed: 1.25, damage: 14, radius: 4, pulses: 8, pulseRadius: 4.5,
        fizzleBoom: true, life: 40, power: c.pow, sound: SOUND.wind,
      });
    },
  },
  // ------------------------------------------------------------- summoning / senjutsu
  {
    id: 'summoning_toad', name: 'Summoning Jutsu: Toad', school: 'Ninjutsu', rank: 2, cost: 70, cd: 90, flag: 'contract',
    seals: ['Boar', 'Dog', 'Bird', 'Monkey', 'Ram'], desc: 'Summon a giant battle toad from Mount Myoboku.',
    cast(c) {
      hurt(c.p, 1);
      const at = add(ahead(c, 3), v3(0, 0.5, 0));
      summon(c, ENTITY.toad, at, (rt(c.p).toggles.has('sage_mode') ? 120 : 75) * 20);
      for (let i = 0; i < 4; i++) fx(c.dim, PARTICLE.smoke, add(at, v3(Math.random() * 2 - 1, i * 0.6, Math.random() * 2 - 1)));
      sound(c.dim, SOUND.summon, at, 0.8);
      title(c.p, '', '§6Kuchiyose no Jutsu!', 25);
    },
  },
  {
    id: 'sage_mode', name: 'Sage Mode', school: 'Senjutsu', rank: 3, cost: 0, cd: 10, seals: [], flag: 'contract',
    requires: ['summoning_toad'],
    desc: 'Channel natural energy (sneak still with the Chakra Focus to gather it). Greatly empowers everything you do.',
    toggle: {
      upkeep: 0,
      onStart(c) {
        if (c.d.sageEnergy < 100) {
          fail(c, `Not enough natural energy (${Math.floor(c.d.sageEnergy)}%). Sneak still while holding the Chakra Focus.`);
          return false;
        }
        title(c.p, '§6Sage Mode', '§eNatural energy flows through you');
        sound(c.dim, SOUND.beacon, c.p.location, 1.2);
      },
      onSecond(c) {
        c.d.sageEnergy = Math.max(0, c.d.sageEnergy - 1.7);
        effect(c.p, FX.strength, 2, 1, false);
        effect(c.p, FX.speed, 2, 0, false);
        effect(c.p, FX.resistance, 2, 0, false);
        effect(c.p, FX.regeneration, 2, 0, false);
        fx(c.dim, PARTICLE.aura, c.p.location, SAGE);
        if (c.d.sageEnergy <= 0) rt(c.p).toggles.delete('sage_mode');
      },
    },
  },
]);

/** Arm a melee-delivered jutsu. @param {import('./core.js').Ctx} c */
function charge(c, kind, ticks, hits) {
  const r = rt(c.p);
  r.charged = { kind, until: system.currentTick + ticks, hits };
  repeat(Math.floor(ticks / 4), 4, () => {
    if (!r.charged || r.charged.kind !== kind) return false;
    const hand = add(eyes(c.p), add(mul(c.p.getViewDirection(), 0.8), v3(0, -0.45, 0)));
    fx(c.dim, PARTICLE.spiral, hand, SPIRAL);
  });
}

/**
 * Resolve a charged melee jutsu when the player lands a hit.
 * @param {import('@minecraft/server').Player} p @param {import('@minecraft/server').Entity} target @param {number} pow
 */
export function releaseCharged(p, target, pow) {
  const r = rt(p);
  const ch = r.charged;
  if (!ch || system.currentTick > ch.until) {
    r.charged = null;
    return false;
  }
  const dim = p.dimension;
  const at = add(target.location, v3(0, 1, 0));
  if (ch.kind === 'rasengan') {
    hurt(target, 12 * pow, p);
    knock(target, p.location, 2.4, 0.6);
    fx(dim, PARTICLE.spiral, at, SPIRAL);
    fx(dim, PARTICLE.burst, at, SPIRAL);
    sound(dim, SOUND.wind, at, 1.2);
  } else if (ch.kind === 'oodama') {
    for (const e of [target, ...enemiesAround(p, target.location, 3).filter((e) => e.id !== target.id)]) {
      hurt(e, 20 * pow, p);
      knock(e, p.location, 3.0, 0.8);
    }
    fx(dim, PARTICLE.shockwave, target.location, SPIRAL);
    fx(dim, PARTICLE.explosion, at);
    sound(dim, SOUND.explode, at, 1.3);
  } else if (ch.kind === 'gentle_fist') {
    const d = getData(p);
    const byakugan = d.eyeOn && (d.eye === 'byakugan' || d.eye === 'jogan');
    hurt(target, (byakugan ? 6 : 4) * pow, p);
    effect(target, FX.weakness, 3, 1);
    fx(dim, PARTICLE.burst, at, rgb('#e8e0ff'));
    sound(dim, SOUND.shield, at, 1.6, 0.6);
  } else {
    return false;
  }
  ch.hits -= 1;
  if (ch.hits <= 0) r.charged = null;
  return true;
}
