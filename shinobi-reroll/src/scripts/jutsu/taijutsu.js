import { EntityDamageCause } from '@minecraft/server';
import { FX, PARTICLE, SOUND } from '../ids.js';
import { gateMult } from '../innerpath.js';
import { spawnOrb } from '../projectiles.js';
import { rt } from '../state.js';
import {
  add, effect, enemiesAround, eyes, fx, hurt, knock, later, mul, repeat, rgb, sound, v3, valid,
} from '../util.js';
import { cone, fail, fan, line, register, target } from './core.js';

const STEAM = rgb('#f0f0f0');
const GREEN = rgb('#58d858');
const BLOOD = rgb('#d02020');

/** The Gates tear the body: health instead of chakra (Clanless taijutsu specialists pay half). */
function strain(c, amount) {
  const cost = (c.d.clan === 'none' ? amount / 2 : amount) * gateMult(c.d);
  hurt(c.p, cost, undefined, EntityDamageCause.magic);
}

register([
  {
    id: 'gate_of_opening', name: 'Eight Gates: Gate of Opening', school: 'Eight Gates', rank: 1, cost: 0, cd: 5, seals: [],
    desc: 'Force open the first chakra gates: strength and speed, paid with your own body.',
    toggle: {
      upkeep: 0,
      onStart(c) {
        sound(c.dim, SOUND.gate, c.p.location, 1.2);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 0, false);
        effect(c.p, FX.speed, 2, 0, false);
        strain(c, 0.5);
        fx(c.dim, PARTICLE.aura, c.p.location, GREEN);
      },
    },
  },
  {
    id: 'primary_lotus', name: 'Front Lotus', school: 'Eight Gates', rank: 1, cost: 10, cd: 10, seals: [],
    active: 'gate_of_opening', desc: 'Kick a foe skyward, wrap it in bandages and piledrive it into the ground.',
    cast(c) {
      const t = target(c, 6);
      if (!t) return fail(c, 'Get within reach of your target.');
      try {
        t.applyKnockback({ x: 0, z: 0 }, 1.3);
      } catch {}
      fx(c.dim, PARTICLE.leaves, t.location, GREEN);
      later(12, () => {
        if (!valid(t)) return;
        hurt(t, 16 * c.pow, c.p);
        try {
          t.applyKnockback({ x: 0, z: 0 }, -2);
        } catch {}
        fx(c.dim, PARTICLE.shockwave, t.location, STEAM);
        sound(c.dim, SOUND.stone, t.location, 0.6, 1.5);
      });
    },
  },
  {
    id: 'gate_of_view', name: 'Eight Gates: Gate of View', school: 'Eight Gates', rank: 3, cost: 0, cd: 10, seals: [],
    requires: ['gate_of_opening'], desc: 'Six gates open: your skin turns red and steam pours off you.',
    toggle: {
      upkeep: 0,
      onStart(c) {
        sound(c.dim, SOUND.gate, c.p.location, 0.9, 1.5);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 2, false);
        effect(c.p, FX.speed, 2, 1, false);
        effect(c.p, FX.resistance, 2, 0, false);
        strain(c, 1);
        fx(c.dim, PARTICLE.smoke, add(c.p.location, v3(0, 1, 0)), STEAM);
      },
    },
  },
  {
    id: 'morning_peacock', name: 'Morning Peacock', school: 'Eight Gates', rank: 3, cost: 20, cd: 12, seals: [],
    active: 'gate_of_view', desc: 'Punches so fast they ignite the air: a fan of fire fists.',
    cast(c) {
      for (const d of fan(c.dir, 7, 30)) spawnOrb(c.p, { element: 'fire', size: 1, speed: 2.4, damage: 6, fire: 4, dir: d, power: c.pow });
      sound(c.dim, SOUND.blaze, c.p.location, 1.6);
    },
  },
  {
    id: 'daytime_tiger', name: 'Daytime Tiger', school: 'Eight Gates', rank: 4, cost: 30, cd: 18, seals: [],
    active: 'gate_of_view', desc: 'A single punch compresses the air into a tiger-shaped cannon.',
    cast(c) {
      spawnOrb(c.p, { element: 'wind', size: 5, speed: 1.6, damage: 22, radius: 4, knock: 3, explode: 2, power: c.pow, sound: SOUND.boom });
    },
  },
  {
    id: 'gate_of_death', name: 'Eight Gates: Gate of Death', school: 'Eight Gates', rank: 5, cost: 0, cd: 120, seals: [],
    requires: ['gate_of_view'], desc: 'The eighth gate: godlike power that burns your life away. Leaves you crippled afterwards.',
    toggle: {
      upkeep: 0,
      onStart(c) {
        sound(c.dim, SOUND.roar, c.p.location, 0.6, 2);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 4, false);
        effect(c.p, FX.speed, 2, 2, false);
        effect(c.p, FX.resistance, 2, 2, false);
        effect(c.p, FX.jumpBoost, 2, 1, false);
        strain(c, 2);
        fx(c.dim, PARTICLE.aura, c.p.location, BLOOD);
        fx(c.dim, PARTICLE.smoke, add(c.p.location, v3(0, 1.2, 0)), BLOOD);
      },
      onEnd(p) {
        effect(p, FX.weakness, 60, 2);
        effect(p, FX.slowness, 30, 1);
        effect(p, FX.wither, 8, 0);
      },
    },
  },
  {
    id: 'evening_elephant', name: 'Evening Elephant', school: 'Eight Gates', rank: 5, cost: 30, cd: 15, seals: [],
    active: 'gate_of_death', desc: 'Five air-crushing kicks, each one a pillar of pressure.',
    cast(c) {
      repeat(5, 5, (i) => {
        if (!valid(c.p)) return false;
        fx(c.dim, PARTICLE.shockwave, add(eyes(c.p), mul(c.p.getViewDirection(), 3 + i)), STEAM);
        sound(c.dim, SOUND.boom, c.p.location, 1.2 + i * 0.1, 0.5);
        for (const e of cone(c, 12, 60)) {
          hurt(e, 10 * c.pow, c.p);
          knock(e, c.p.location, 2.5, 0.6);
        }
      });
    },
  },
  {
    id: 'night_guy', name: 'Night Guy', school: 'Eight Gates', rank: 5, cost: 50, cd: 120, seals: [],
    active: 'gate_of_death', desc: 'The final kick of the Eight Gates. Bends space as you dash through your target.',
    cast(c) {
      const t = target(c, 24);
      if (!t) return fail(c, 'Night Guy needs a target in sight.');
      const from = c.p.location;
      line(c.dim, eyes(c.p), eyes(t), PARTICLE.burst, BLOOD, 0.6);
      c.p.tryTeleport(add(t.location, mul(c.dir, 2)), { checkForBlocks: true, facingLocation: from });
      hurt(t, 60 * c.pow, c.p);
      fx(c.dim, PARTICLE.explosion, eyes(t));
      sound(c.dim, SOUND.bigRoar, t.location, 0.5, 3);
      for (const e of enemiesAround(c.p, t.location, 5)) if (e.id !== t.id) hurt(e, 20 * c.pow, c.p);
      const r = rt(c.p);
      r.toggles.delete('gate_of_death');
      later(1, () => {
        effect(c.p, FX.weakness, 60, 2);
        effect(c.p, FX.slowness, 30, 1);
        effect(c.p, FX.wither, 8, 0);
      });
    },
  },
]);
