import { system } from '@minecraft/server';
import { FX, PARTICLE, SOUND } from '../ids.js';
import { rt } from '../state.js';
import { add, effect, eyes, fx, heal, rgb, sound, v3 } from '../util.js';
import { ally, register } from './core.js';

const MEDIC = rgb('#7fff9a');
const SAKURA = rgb('#ff8ad8');
const HARMFUL = [FX.poison, FX.wither, FX.weakness, FX.slowness, FX.blindness, FX.nausea, FX.hunger, FX.miningFatigue, FX.darkness];

register([
  {
    id: 'mystical_palm', name: 'Mystical Palm Technique', school: 'Medical', rank: 1, cost: 20, cd: 4, seals: ['Ram'],
    desc: 'Heal the ally you look at, or yourself if nobody is in front of you.',
    cast(c) {
      const t = ally(c, 5) ?? c.p;
      heal(t, (5 + c.rank) * Math.min(2, c.pow));
      fx(c.dim, PARTICLE.aura, t.location, MEDIC);
      fx(c.dim, PARTICLE.burst, eyes(t), MEDIC);
      sound(c.dim, SOUND.heal, t.location, 1.4, 0.7);
    },
  },
  {
    id: 'cherry_blossom_impact', name: 'Cherry Blossom Impact', school: 'Medical', rank: 2, cost: 35, cd: 10, seals: [],
    requires: ['mystical_palm'],
    desc: 'Gather chakra in your fist with perfect control: your next hit craters the ground around the target.',
    cast(c) {
      rt(c.p).charged = { kind: 'sakura', until: system.currentTick + 120, hits: 1 };
      fx(c.dim, PARTICLE.aura, c.p.location, SAKURA);
      sound(c.dim, SOUND.charge, c.p.location, 1.6);
    },
  },
  {
    id: 'hundred_healings', name: 'Strength of a Hundred Seal', school: 'Medical', rank: 3, cost: 40, cd: 30, seals: [],
    requires: ['mystical_palm'],
    desc: 'Release years of stored chakra: rapid regeneration that also purges poisons and curses.',
    toggle: {
      upkeep: 6,
      onStart(c) {
        fx(c.dim, PARTICLE.mark, add(eyes(c.p), v3(0, 0.4, 0)), rgb('#b46cf0'));
        sound(c.dim, SOUND.beacon, c.p.location, 1.4);
      },
      onSecond(c) {
        effect(c.p, FX.regeneration, 2, 2, false);
        for (const id of HARMFUL) {
          try {
            c.p.removeEffect(id);
          } catch {}
        }
        fx(c.dim, PARTICLE.aura, c.p.location, MEDIC);
      },
    },
  },
]);
