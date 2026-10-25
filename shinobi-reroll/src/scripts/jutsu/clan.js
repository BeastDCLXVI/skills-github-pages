import { system } from '@minecraft/server';
import { ENTITY, FX, PARTICLE, SOUND } from '../ids.js';
import { liveOrbs, reflectOrb, spawnOrb } from '../projectiles.js';
import { rt } from '../state.js';
import { addChakra, getChakra, setChakra } from '../store.js';
import {
  add, dash, dist, effect, enemiesAround, eyes, fx, health, hurt, isPlayer, knock, later, lookBlock, lookPoint, mul,
  repeat, rgb, sound, stun, title, v3, valid,
} from '../util.js';
import { fail, fan, line, register, ring, summon, target } from './core.js';

const SHADOW = rgb('#1a1a22');
const BUG = rgb('#2a2f24');
const GENTLE = rgb('#e8e0ff');
const CHAIN = rgb('#ffd36a');
const VOID = rgb('#9a4ad0');

register([
  // ---------------------------------------------------------------- Nara
  {
    id: 'shadow_possession', name: 'Shadow Possession Jutsu', school: 'Nara', clan: 'nara', rank: 1, cost: 25, cd: 12,
    seals: ['Rat'], desc: 'Stretch your shadow to a target and freeze it in place for 6 seconds.',
    cast(c) {
      const t = target(c, 20);
      if (!t) return fail(c, 'No target in sight.');
      line(c.dim, c.p.location, t.location, PARTICLE.burst, SHADOW, 1.2);
      stun(t, 6);
      effect(c.p, FX.slowness, 6, 2, false);
      title(c.p, '', '§7Shadow Possession: success.', 30);
    },
  },
  {
    id: 'shadow_strangle', name: 'Shadow Neck Bind', school: 'Nara', clan: 'nara', rank: 2, cost: 40, cd: 18,
    requires: ['shadow_possession'], seals: ['Rat', 'Snake'], desc: 'Shadow hands crawl up the target and choke it.',
    cast(c) {
      const t = target(c, 20);
      if (!t) return fail(c, 'No target in sight.');
      stun(t, 4);
      repeat(8, 10, () => {
        if (!valid(t)) return false;
        hurt(t, 2 * c.pow, c.p);
        fx(c.dim, PARTICLE.burst, add(t.location, v3(0, 1.4, 0)), SHADOW);
      });
    },
  },
  // ---------------------------------------------------------------- Akimichi
  {
    id: 'expansion', name: 'Expansion Jutsu', school: 'Akimichi', clan: 'akimichi', rank: 1, cost: 30, cd: 25,
    seals: ['Boar'], desc: 'Swell to giant proportions: strength, armor and vitality for 20 seconds.',
    cast(c) {
      effect(c.p, FX.strength, 20, 1);
      effect(c.p, FX.resistance, 20, 0);
      effect(c.p, FX.healthBoost, 20, 1);
      effect(c.p, FX.slowness, 20, 0, false);
      fx(c.dim, PARTICLE.smoke, add(c.p.location, v3(0, 1, 0)));
      sound(c.dim, SOUND.poof, c.p.location, 0.5);
    },
  },
  {
    id: 'human_boulder', name: 'Human Bullet Tank', school: 'Akimichi', clan: 'akimichi', rank: 2, cost: 35, cd: 10,
    seals: ['Boar', 'Ram'], desc: 'Roll forward as an unstoppable boulder.',
    cast(c) {
      repeat(3, 5, () => {
        if (!valid(c.p)) return false;
        dash(c.p, c.p.getViewDirection(), 2.4, 0.1);
        fx(c.dim, PARTICLE.smoke, c.p.location);
        for (const e of enemiesAround(c.p, c.p.location, 2.6)) {
          hurt(e, 6 * c.pow, c.p);
          knock(e, c.p.location, 1.6, 0.5);
        }
      });
      sound(c.dim, SOUND.stone, c.p.location, 0.5);
    },
  },
  // ---------------------------------------------------------------- Yamanaka
  {
    id: 'mind_transfer', name: 'Mind Body Switch Technique', school: 'Yamanaka', clan: 'yamanaka', rank: 1, cost: 30, cd: 20,
    seals: ['Bird'], desc: 'Project your mind into a target for 4 seconds: you see through its eyes while both bodies freeze.',
    cast(c) {
      const t = target(c, 24);
      if (!t) return fail(c, 'No target in sight.');
      stun(t, 4);
      stun(c.p, 4);
      const view = () => {
        if (!valid(t)) return;
        const head = eyes(t);
        try {
          c.p.camera.setCamera('minecraft:free', { location: head, facingLocation: add(head, mul(t.getViewDirection(), 6)) });
        } catch {}
      };
      repeat(16, 5, () => {
        if (!valid(t) || !valid(c.p)) return false;
        view();
      });
      later(80, () => {
        try {
          if (valid(c.p)) c.p.camera.clear();
        } catch {}
        if (valid(t)) {
          hurt(t, 6 * c.pow, c.p);
          effect(t, FX.nausea, 6);
        }
      });
    },
  },
  {
    id: 'mind_destruction', name: 'Mind Destruction Technique', school: 'Yamanaka', clan: 'yamanaka', rank: 2, cost: 45, cd: 25,
    seals: ['Bird', 'Snake'], desc: 'Shatter a target\'s mind: heavy damage scaled by its vitality.',
    cast(c) {
      const t = target(c, 24);
      if (!t) return fail(c, 'No target in sight.');
      const max = health(t)?.effectiveMax ?? 20;
      hurt(t, Math.min(30, max * 0.25) * c.pow, c.p);
      effect(t, FX.nausea, 8);
      effect(t, FX.weakness, 8, 1);
      fx(c.dim, PARTICLE.mark, eyes(t), rgb('#ff8ad8'));
    },
  },
  // ---------------------------------------------------------------- Aburame
  {
    id: 'insect_swarm', name: 'Parasitic Destruction Insects', school: 'Aburame', clan: 'aburame', rank: 1, cost: 20, cd: 8,
    seals: ['Ram'], desc: 'A swarm of kikaichu poisons the target and devours its chakra.',
    cast(c) {
      const t = target(c, 16);
      if (!t) return fail(c, 'No target in sight.');
      effect(t, FX.poison, 6, 1);
      effect(t, FX.weakness, 6);
      hurt(t, 3 * c.pow, c.p);
      if (isPlayer(t)) {
        setChakra(t, getChakra(t) - 25);
        addChakra(c.p, 15);
      }
      repeat(5, 6, () => {
        if (!valid(t)) return false;
        fx(c.dim, PARTICLE.burst, add(t.location, v3(0, 1, 0)), BUG);
      });
      sound(c.dim, SOUND.bubble, t.location, 0.4);
    },
  },
  {
    id: 'insect_sphere', name: 'Insect Sphere', school: 'Aburame', clan: 'aburame', rank: 2, cost: 50, cd: 20,
    seals: ['Ram', 'Snake'], desc: 'Release your whole hive around you.',
    cast(c) {
      for (const at of ring(c.p.location, 2.5, 10)) fx(c.dim, PARTICLE.burst, add(at, v3(0, 1, 0)), BUG);
      for (const e of enemiesAround(c.p, c.p.location, 6)) {
        effect(e, FX.poison, 8, 1);
        effect(e, FX.slowness, 6);
        hurt(e, 4 * c.pow, c.p);
      }
    },
  },
  // ---------------------------------------------------------------- Inuzuka
  {
    id: 'ninken', name: 'Summoning: Ninken', school: 'Inuzuka', clan: 'inuzuka', rank: 1, cost: 25, cd: 40, seals: ['Dog'],
    desc: 'Call loyal ninken to your side for two minutes.',
    cast(c) {
      const n = c.rank >= 2 ? 2 : 1;
      for (const at of ring(c.p.location, 1.5, n)) summon(c, ENTITY.wolf, at, 120 * 20);
      sound(c.dim, SOUND.growl, c.p.location);
    },
  },
  {
    id: 'fang_over_fang', name: 'Fang Over Fang', school: 'Inuzuka', clan: 'inuzuka', rank: 2, cost: 30, cd: 8,
    seals: ['Dog', 'Boar'], desc: 'Drill through enemies in a spinning double assault.',
    cast(c) {
      repeat(2, 7, () => {
        if (!valid(c.p)) return false;
        dash(c.p, c.p.getViewDirection(), 2.8, 0.15);
        fx(c.dim, PARTICLE.shockwave, c.p.location, rgb('#c9a46a'));
        for (const e of enemiesAround(c.p, c.p.location, 2.8)) hurt(e, 7 * c.pow, c.p);
      });
    },
  },
  // ---------------------------------------------------------------- Hyuga
  {
    id: 'gentle_fist', name: 'Gentle Fist', school: 'Hyuga', clan: 'hyuga', rank: 1, cost: 15, cd: 6, seals: [],
    desc: 'Your next four hits strike chakra points: bonus damage and weakness (stronger with Byakugan).',
    cast(c) {
      rt(c.p).charged = { kind: 'gentle_fist', until: system.currentTick + 160, hits: 4 };
      fx(c.dim, PARTICLE.aura, c.p.location, GENTLE);
    },
  },
  {
    id: 'rotation', name: 'Eight Trigrams Palm Rotation', school: 'Hyuga', clan: 'hyuga', rank: 2, cost: 30, cd: 10, seals: [],
    desc: 'Spin out a dome of chakra: brief invulnerability, knockback and reflected projectiles.',
    cast(c) {
      effect(c.p, FX.resistance, 1.2, 4, false);
      fx(c.dim, PARTICLE.shockwave, c.p.location, GENTLE);
      fx(c.dim, PARTICLE.spiral, add(c.p.location, v3(0, 1, 0)), GENTLE);
      sound(c.dim, SOUND.wind, c.p.location, 1.4);
      for (const e of enemiesAround(c.p, c.p.location, 4)) {
        hurt(e, 5 * c.pow, c.p);
        knock(e, c.p.location, 2.6, 0.5);
      }
      for (const o of liveOrbs()) {
        if (o.caster.id !== c.p.id && valid(o.entity) && dist(o.entity.location, c.p.location) < 5) reflectOrb(o, c.p);
      }
    },
  },
  {
    id: 'eight_trigrams', name: 'Eight Trigrams Sixty-Four Palms', school: 'Hyuga', clan: 'hyuga', rank: 3, cost: 60, cd: 20,
    eyes: ['byakugan', 'tenseigan', 'jogan'], seals: [], desc: 'Seal all 64 chakra points of the enemy in front of you.',
    cast(c) {
      const t = target(c, 5);
      if (!t) return fail(c, 'Get closer: the target must be within reach.');
      stun(t, 3);
      repeat(8, 3, (i) => {
        if (!valid(t)) return false;
        hurt(t, 2.5 * c.pow, c.p);
        fx(c.dim, PARTICLE.burst, add(t.location, v3(0, 1.2, 0)), GENTLE);
        sound(c.dim, SOUND.shield, t.location, 1.2 + i * 0.1, 0.5);
        if (i === 7) {
          knock(t, c.p.location, 2.5, 0.5);
          effect(t, FX.weakness, 10, 1);
          if (isPlayer(t)) setChakra(t, 0);
        }
      });
    },
  },
  // ---------------------------------------------------------------- Uzumaki
  {
    id: 'sealing_chains', name: 'Adamantine Sealing Chains', school: 'Uzumaki', clan: 'uzumaki', rank: 2, cost: 40, cd: 18,
    seals: ['Ram', 'Snake'], desc: 'Chakra chains bind a target; even tailed beasts are held for a few seconds.',
    cast(c) {
      const t = target(c, 20);
      if (!t) return fail(c, 'No target in sight.');
      const boss = t.matches({ families: ['shinobi_boss'] });
      stun(t, boss ? 3 : 6);
      hurt(t, 4 * c.pow, c.p);
      line(c.dim, add(c.p.location, v3(0, 1, 0)), add(t.location, v3(0, 1, 0)), PARTICLE.burst, CHAIN, 0.7);
      sound(c.dim, SOUND.chain, t.location, 0.8, 1.5);
    },
  },
  // ---------------------------------------------------------------- Hozuki
  {
    id: 'hydrification', name: 'Hydrification Technique', school: 'Hozuki', clan: 'hozuki', rank: 1, cost: 20, cd: 18, seals: [],
    desc: 'Turn your body to water: immune to damage for 3 seconds.',
    cast(c) {
      effect(c.p, FX.resistance, 3, 4, false);
      effect(c.p, FX.speed, 3, 0, false);
      fx(c.dim, PARTICLE.burst, add(c.p.location, v3(0, 1, 0)), rgb('#3a8cff'));
      sound(c.dim, SOUND.water, c.p.location);
    },
  },
  {
    id: 'water_gun', name: 'Water Gun Technique', school: 'Hozuki', clan: 'hozuki', rank: 2, cost: 25, cd: 5, seals: [],
    desc: 'Fire four high-pressure water bullets from your fingertip.',
    cast(c) {
      repeat(4, 3, () => {
        spawnOrb(c.p, { element: 'water', size: 1, speed: 2.8, damage: 5, power: c.pow });
      });
      sound(c.dim, SOUND.water, c.p.location, 1.6);
    },
  },
  // ---------------------------------------------------------------- Otsutsuki
  {
    id: 'chakra_absorption', name: 'Chakra Absorption', school: 'Otsutsuki', clan: 'otsutsuki', rank: 1, cost: 20, cd: 15, seals: [],
    desc: 'For 4 seconds, ranged attacks and jutsu that hit you heal you and restore chakra.',
    cast(c) {
      rt(c.p).absorbUntil = system.currentTick + 80;
      fx(c.dim, PARTICLE.aura, c.p.location, VOID);
      sound(c.dim, SOUND.conduit, c.p.location, 1.4);
    },
  },
  {
    id: 'ash_bones', name: 'All-Killing Ash Bones', school: 'Otsutsuki', clan: 'otsutsuki', rank: 2, cost: 45, cd: 10, seals: [],
    desc: 'Kaguya\'s bones turn whatever they pierce to ash.',
    cast(c) {
      for (const d of fan(c.dir, 5, 8)) {
        spawnOrb(c.p, { element: 'ash_bone', size: 1, speed: 2.2, damage: 6, dir: d, effects: [[FX.wither, 4, 1]], power: c.pow });
      }
      sound(c.dim, SOUND.witherShoot, c.p.location, 1.4, 0.7);
    },
  },
  {
    id: 'yomotsu', name: 'Yomotsu Hirasaka', school: 'Otsutsuki', clan: 'otsutsuki', rank: 3, cost: 50, cd: 12, seals: [],
    desc: 'Open a portal and step to the block you are looking at (up to 48 blocks).',
    cast(c) {
      const hit = lookBlock(c.p, 48);
      if (!hit) return fail(c, 'Look at a surface to open a portal.');
      const to = add(hit.block.location, v3(0.5, 1, 0.5));
      fx(c.dim, PARTICLE.burst, add(c.p.location, v3(0, 1, 0)), VOID);
      if (!c.p.tryTeleport(to, { checkForBlocks: true })) return fail(c, 'The portal cannot open there.');
      fx(c.dim, PARTICLE.burst, add(to, v3(0, 1, 0)), VOID);
      sound(c.dim, SOUND.portal, to);
    },
  },
  {
    id: 'daikokuten', name: 'Daikokuten', school: 'Otsutsuki', clan: 'otsutsuki', rank: 4, cost: 120, cd: 40, seals: [],
    desc: 'Isshiki\'s time-frozen cube crashes down on the point you look at.',
    cast(c) {
      const at = lookPoint(c.p, 32);
      for (const p of ring(at, 2, 12)) fx(c.dim, PARTICLE.mark, add(p, v3(0, 0.2, 0)), VOID);
      later(20, () => {
        fx(c.dim, PARTICLE.explosion, at);
        fx(c.dim, PARTICLE.shockwave, at, VOID);
        sound(c.dim, SOUND.anvil, at, 0.5, 2);
        if (!valid(c.p)) return;
        for (const e of enemiesAround(c.p, at, 4)) {
          hurt(e, 28 * c.pow, c.p);
          try {
            e.applyKnockback({ x: 0, z: 0 }, -1);
          } catch {}
        }
      });
    },
  },
]);
