import { BLOCK, ENTITY, FX, PARTICLE, SOUND } from '../ids.js';
import { elementColor, spawnOrb } from '../projectiles.js';
import { placeTemp } from '../terrain.js';
import {
  add, dash, effect, enemiesAround, eyes, fx, heal, hurt, isPlayer, knock, lookPoint, mul, repeat, rgb, settings,
  sound, stun, v3, valid,
} from '../util.js';
import { addChakra } from '../store.js';
import { ahead, cone, fail, fan, ground, line, register, ring, summon, target, wall } from './core.js';

const FIRE = elementColor('fire');
const LIGHTNING = elementColor('lightning');
const WATER = elementColor('water');
const WOOD = elementColor('wood');
const ICE = elementColor('ice');
const BOIL = elementColor('boil');

register([
  // ================================================================ FIRE
  {
    id: 'great_fireball', name: 'Fire Style: Great Fireball', school: 'Fire', nature: 'fire', rank: 1, cost: 25, cd: 5,
    seals: ['Snake', 'Ram', 'Monkey', 'Boar', 'Horse', 'Tiger'],
    desc: 'The Uchiha rite of passage: a roaring ball of flame.',
    cast(c) {
      spawnOrb(c.p, { element: 'fire', size: 3, speed: 1.4, damage: 9, radius: 2.5, fire: 5, power: c.pow, sound: SOUND.fire });
    },
  },
  {
    id: 'phoenix_flower', name: 'Fire Style: Phoenix Sage Fire', school: 'Fire', nature: 'fire', rank: 1, cost: 20, cd: 4,
    seals: ['Rat', 'Tiger', 'Dog', 'Ox', 'Hare', 'Tiger'], desc: 'A spread of five small fireballs.',
    cast(c) {
      for (const d of fan(c.dir, 5, 16)) spawnOrb(c.p, { element: 'fire', size: 1, speed: 1.7, damage: 4, fire: 3, dir: d, power: c.pow });
      sound(c.dim, SOUND.blaze, c.p.location);
    },
  },
  {
    id: 'fire_dragon', name: 'Fire Style: Dragon Flame Bullet', school: 'Fire', nature: 'fire', rank: 2, cost: 40, cd: 9,
    seals: ['Snake', 'Dragon', 'Hare', 'Tiger'], desc: 'Three dragon-headed bursts of fire in quick succession.',
    cast(c) {
      repeat(3, 4, () => {
        spawnOrb(c.p, { element: 'fire', size: 3, speed: 1.6, damage: 9, radius: 2, fire: 6, power: c.pow, sound: SOUND.fire });
      });
    },
  },
  {
    id: 'great_fire_annihilation', name: 'Fire Style: Great Fire Annihilation', school: 'Fire', nature: 'fire', rank: 3,
    cost: 110, cd: 30, seals: ['Snake', 'Ram', 'Monkey', 'Boar', 'Horse', 'Tiger'],
    desc: 'Madara\'s sea of flame engulfs everything in front of you.',
    cast(c) {
      sound(c.dim, SOUND.blaze, c.p.location, 0.6, 1.5);
      repeat(10, 4, (i) => {
        if (!valid(c.p)) return false;
        for (let r = 2; r <= 4 + i; r += 2) {
          for (const d of fan(c.dir, 5, 35)) fx(c.dim, PARTICLE.burst, add(eyes(c.p), mul(d, r)), FIRE);
        }
        for (const e of cone(c, 15, 75)) {
          hurt(e, 4 * c.pow, c.p);
          e.setOnFire(5, true);
        }
      });
    },
  },
  // ================================================================ WIND
  {
    id: 'great_breakthrough', name: 'Wind Style: Great Breakthrough', school: 'Wind', nature: 'wind', rank: 1, cost: 20, cd: 5,
    seals: ['Snake', 'Ram'], desc: 'A gale that hurls enemies away.',
    cast(c) {
      for (let r = 1; r < 10; r += 1.5) fx(c.dim, PARTICLE.shockwave, add(eyes(c.p), mul(c.dir, r)), elementColor('wind'));
      sound(c.dim, SOUND.wind, c.p.location);
      for (const e of cone(c, 12, 80)) {
        hurt(e, 4 * c.pow, c.p);
        knock(e, c.p.location, 2.8, 0.6);
        try {
          e.extinguishFire(true);
        } catch {}
      }
    },
  },
  {
    id: 'vacuum_bullets', name: 'Wind Style: Vacuum Bullets', school: 'Wind', nature: 'wind', rank: 2, cost: 30, cd: 6,
    seals: ['Tiger', 'Ox'], desc: 'Three compressed air bullets.',
    cast(c) {
      repeat(3, 3, () => {
        spawnOrb(c.p, { element: 'wind', size: 1, speed: 2.4, damage: 7, power: c.pow, sound: SOUND.whoosh });
      });
    },
  },
  // ================================================================ LIGHTNING
  {
    id: 'lightning_ball', name: 'Lightning Style: Lightning Ball', school: 'Lightning', nature: 'lightning', rank: 1, cost: 20,
    cd: 4, seals: ['Ox', 'Hare'], desc: 'A crackling sphere that numbs its target.',
    cast(c) {
      spawnOrb(c.p, { element: 'lightning', size: 2, speed: 2.2, damage: 8, effects: [[FX.slowness, 2, 1]], power: c.pow, sound: SOUND.zap });
    },
  },
  {
    id: 'chidori', name: 'Chidori', school: 'Lightning', nature: 'lightning', rank: 2, cost: 40, cd: 8,
    seals: ['Ox', 'Hare', 'Monkey'], desc: 'A thousand birds chirp as you lunge through your target.',
    cast(c) {
      sound(c.dim, SOUND.zap, c.p.location, 1.6, 0.7);
      const t = target(c, 16);
      if (t) {
        const to = t.location;
        const back = mul(c.dir, -1.2);
        c.p.tryTeleport(add(to, v3(back.x, 0.1, back.z)), { checkForBlocks: true, facingLocation: to });
        line(c.dim, c.head, add(to, v3(0, 1, 0)), PARTICLE.sparks, LIGHTNING, 2);
        hurt(t, 15 * c.pow, c.p);
        knock(t, c.p.location, 1.4, 0.3);
        fx(c.dim, PARTICLE.sparks, add(to, v3(0, 1, 0)), LIGHTNING);
      } else {
        dash(c.p, c.dir, 3.6, 0.2);
        fx(c.dim, PARTICLE.sparks, c.p.location, LIGHTNING);
      }
    },
  },
  {
    id: 'lightning_armor', name: 'Lightning Release Armor', school: 'Lightning', nature: 'lightning', rank: 3, cost: 0, cd: 6,
    seals: [], desc: 'The Raikage\'s armor: blinding speed and strength while it drains chakra.',
    toggle: {
      upkeep: 4,
      onStart(c) {
        sound(c.dim, SOUND.zap, c.p.location, 1.2);
      },
      onSecond(c) {
        effect(c.p, FX.speed, 2, 1, false);
        effect(c.p, FX.strength, 2, 0, false);
        effect(c.p, FX.resistance, 2, 0, false);
        effect(c.p, FX.haste, 2, 1, false);
        fx(c.dim, PARTICLE.sparks, add(c.p.location, v3(0, 1, 0)), LIGHTNING);
      },
    },
  },
  {
    id: 'kirin', name: 'Kirin', school: 'Lightning', nature: 'lightning', rank: 4, cost: 120, cd: 45,
    seals: ['Snake', 'Ram', 'Monkey'], desc: 'Call down a dragon of natural lightning on the point you look at.',
    cast(c) {
      const at = lookPoint(c.p, 40);
      sound(c.dim, SOUND.thunder, at, 1, 3);
      repeat(3, 6, () => {
        for (let y = 0; y < 18; y += 2) fx(c.dim, PARTICLE.sparks, add(at, v3(Math.random() - 0.5, y, Math.random() - 0.5)), LIGHTNING);
        if (settings().griefing) {
          try {
            c.dim.spawnEntity(ENTITY.lightning, at);
          } catch {}
        }
        sound(c.dim, SOUND.zap, at, 0.8, 2);
        for (const e of enemiesAround(c.p, at, 4.5)) hurt(e, 8 * c.pow, c.p);
      });
    },
  },
  // ================================================================ EARTH
  {
    id: 'earth_wall', name: 'Earth Style: Earth Wall', school: 'Earth', nature: 'earth', rank: 1, cost: 25, cd: 10,
    seals: ['Tiger', 'Hare', 'Boar', 'Dog'], desc: 'Raise a wall of earth in front of you for 20 seconds.',
    cast(c) {
      const base = ground(c.dim, ahead(c, 3)) ?? ahead(c, 3);
      const placed = placeTemp(c.dim, wall(base, c.dir, 5, 3), BLOCK.earthWall, 400);
      if (!placed) return fail(c, 'No room for a wall there.');
      sound(c.dim, SOUND.stone, base, 0.6, 1.5);
    },
  },
  {
    id: 'earth_spikes', name: 'Earth Style: Earth Spear Spikes', school: 'Earth', nature: 'earth', rank: 2, cost: 35, cd: 9,
    seals: ['Ox', 'Dog'], desc: 'Spears of rock erupt beneath nearby enemies.',
    cast(c) {
      sound(c.dim, SOUND.stone, c.p.location, 0.5, 1.5);
      for (const at of ring(c.p.location, 3, 8)) {
        const g = ground(c.dim, at);
        if (g) placeTemp(c.dim, [g, add(g, v3(0, 1, 0))], BLOCK.earthWall, 120);
      }
      for (const e of enemiesAround(c.p, c.p.location, 7)) {
        hurt(e, 8 * c.pow, c.p);
        try {
          e.applyKnockback({ x: 0, z: 0 }, 1.1);
        } catch {}
        fx(c.dim, PARTICLE.burst, e.location, elementColor('earth'));
      }
    },
  },
  {
    id: 'earth_golem', name: 'Earth Style: Golem Technique', school: 'Earth', nature: 'earth', rank: 3, cost: 60, cd: 60,
    seals: ['Ram', 'Snake', 'Boar'], desc: 'Shape a stone golem that defends you for 45 seconds.',
    cast(c) {
      const at = ground(c.dim, ahead(c, 3)) ?? ahead(c, 3);
      if (!summon(c, ENTITY.ironGolem, at, 45 * 20, 'minecraft:from_player')) return fail(c, 'The ground refuses to take shape.');
      sound(c.dim, SOUND.stone, at, 0.4, 2);
    },
  },
  // ================================================================ WATER
  {
    id: 'water_prison', name: 'Water Style: Water Prison', school: 'Water', nature: 'water', rank: 1, cost: 25, cd: 12,
    seals: ['Snake', 'Ram', 'Boar'], desc: 'Trap a target in a sphere of water. You must stay still to hold it.',
    cast(c) {
      const t = target(c, 12);
      if (!t) return fail(c, 'No target in sight.');
      stun(t, 5);
      effect(c.p, FX.slowness, 5, 2, false);
      sound(c.dim, SOUND.water, t.location);
      repeat(10, 10, () => {
        if (!valid(t)) return false;
        fx(c.dim, PARTICLE.burst, add(t.location, v3(0, 1, 0)), WATER);
        hurt(t, 1.5 * c.pow, c.p);
      });
    },
  },
  {
    id: 'water_dragon', name: 'Water Style: Water Dragon Bullet', school: 'Water', nature: 'water', rank: 2, cost: 45, cd: 9,
    seals: ['Ox', 'Monkey', 'Hare', 'Rat', 'Boar', 'Bird'], desc: 'A roaring dragon of water that crashes into its foe.',
    cast(c) {
      try {
        c.p.extinguishFire(true);
      } catch {}
      spawnOrb(c.p, { element: 'water', size: 4, speed: 1.3, damage: 11, radius: 3, knock: 2.0, power: c.pow, sound: SOUND.water });
    },
  },
  // ================================================================ WOOD (Senju / Hashirama Cells)
  {
    id: 'wood_bind', name: 'Wood Style: Binding', school: 'Wood', kekkei: 'wood', rank: 1, cost: 25, cd: 10,
    seals: ['Snake', 'Dog'], desc: 'Timber erupts around a target and locks it in place.',
    cast(c) {
      const t = target(c, 16);
      if (!t) return fail(c, 'No target in sight.');
      const f = t.location;
      const cage = [];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        cage.push(add(f, v3(dx, 0, dz)), add(f, v3(dx, 1, dz)));
      }
      placeTemp(c.dim, cage, BLOCK.wood, 140);
      stun(t, 6);
      hurt(t, 4 * c.pow, c.p);
      fx(c.dim, PARTICLE.leaves, f, WOOD);
      sound(c.dim, SOUND.wood, f, 0.8);
    },
  },
  {
    id: 'deep_forest', name: 'Wood Style: Deep Forest Emergence', school: 'Wood', kekkei: 'wood', rank: 2, cost: 70, cd: 30,
    seals: ['Snake', 'Dragon', 'Tiger'], desc: 'A forest bursts from the ground, ensnaring every enemy nearby.',
    cast(c) {
      sound(c.dim, SOUND.wood, c.p.location, 0.6, 2);
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 6;
        const g = ground(c.dim, add(c.p.location, v3(Math.cos(a) * r, 0, Math.sin(a) * r)));
        if (!g) continue;
        const h = 3 + Math.floor(Math.random() * 3);
        const col = [];
        for (let y = 0; y < h; y++) col.push(add(g, v3(0, y, 0)));
        placeTemp(c.dim, col, BLOCK.wood, 300);
        fx(c.dim, PARTICLE.leaves, add(g, v3(0, h, 0)), WOOD);
      }
      for (const e of enemiesAround(c.p, c.p.location, 9)) {
        stun(e, 4);
        hurt(e, 6 * c.pow, c.p);
      }
    },
  },
  {
    id: 'wood_dragon', name: 'Wood Style: Wood Dragon', school: 'Wood', kekkei: 'wood', rank: 3, cost: 90, cd: 25,
    seals: ['Rat', 'Dragon'], desc: 'A dragon of living wood that drains the life of what it bites.',
    cast(c) {
      spawnOrb(c.p, {
        element: 'wood', size: 5, speed: 1.2, damage: 16, radius: 3, power: c.pow, sound: SOUND.wood,
        onHit: (meta) => {
          if (valid(meta.caster)) {
            heal(meta.caster, 6);
            if (isPlayer(meta.caster)) addChakra(meta.caster, 30);
          }
        },
      });
    },
  },
  // ================================================================ ICE (Yuki)
  {
    id: 'ice_needles', name: 'Ice Style: Thousand Needles', school: 'Ice', kekkei: 'ice', rank: 1, cost: 20, cd: 5,
    seals: ['Ram', 'Snake'], desc: 'A volley of ice needles that chills whatever it pierces.',
    cast(c) {
      for (const d of fan(c.dir, 7, 20)) {
        spawnOrb(c.p, { element: 'ice', size: 1, speed: 2.4, damage: 3, dir: d, effects: [[FX.slowness, 3, 1]], power: c.pow });
      }
      sound(c.dim, SOUND.glass, c.p.location, 1.6);
    },
  },
  {
    id: 'ice_mirrors', name: 'Ice Style: Demonic Mirroring Ice Crystals', school: 'Ice', kekkei: 'ice', rank: 2, cost: 60, cd: 25,
    seals: ['Ram', 'Snake', 'Tiger'], desc: 'Encase a target in mirrors of ice and strike from every one of them.',
    cast(c) {
      const t = target(c, 16);
      if (!t) return fail(c, 'No target in sight.');
      const f = t.location;
      const mirrors = [];
      for (const at of ring(f, 2.5, 10)) mirrors.push(at, add(at, v3(0, 1, 0)), add(at, v3(0, 2, 0)));
      placeTemp(c.dim, mirrors, BLOCK.ice, 160);
      stun(t, 4);
      repeat(6, 6, () => {
        if (!valid(t)) return false;
        hurt(t, 3 * c.pow, c.p);
        fx(c.dim, PARTICLE.shards, add(t.location, v3(0, 1, 0)), ICE);
        sound(c.dim, SOUND.glass, t.location, 1.8, 0.5);
      });
    },
  },
  // ================================================================ LAVA / BOIL (Terumi)
  {
    id: 'lava_globs', name: 'Lava Style: Melting Apparition', school: 'Lava', kekkei: 'lava', rank: 1, cost: 25, cd: 6,
    seals: ['Tiger', 'Snake'], desc: 'Spit three globs of molten rock.',
    cast(c) {
      for (const d of fan(c.dir, 3, 10)) {
        spawnOrb(c.p, { element: 'lava', size: 2, speed: 1.4, gravity: 0.04, damage: 6, fire: 6, radius: 1.5, dir: d, power: c.pow });
      }
      sound(c.dim, SOUND.blaze, c.p.location, 0.7);
    },
  },
  {
    id: 'boil_mist', name: 'Boil Style: Skilled Mist Technique', school: 'Lava', kekkei: 'lava', rank: 2, cost: 50, cd: 20,
    seals: ['Ram', 'Dragon'], desc: 'An acidic mist that melts everything inside it for six seconds.',
    cast(c) {
      const at = lookPoint(c.p, 16);
      sound(c.dim, SOUND.fizz, at, 0.6, 1.5);
      repeat(12, 10, () => {
        if (!valid(c.p)) return false;
        for (let i = 0; i < 3; i++) fx(c.dim, PARTICLE.smoke, add(at, v3(Math.random() * 6 - 3, Math.random() * 2, Math.random() * 6 - 3)), BOIL);
        for (const e of enemiesAround(c.p, at, 5)) {
          hurt(e, 2 * c.pow, c.p);
          effect(e, FX.weakness, 3);
        }
      });
    },
  },
  // ================================================================ BONE (Kaguya)
  {
    id: 'finger_bullets', name: 'Finger Drill Bullets', school: 'Bone', kekkei: 'bone', rank: 1, cost: 15, cd: 3,
    seals: [], desc: 'Fire your finger bones like bullets.',
    cast(c) {
      repeat(4, 2, () => {
        spawnOrb(c.p, { element: 'bone', size: 1, speed: 2.6, damage: 4, power: c.pow });
      });
      sound(c.dim, SOUND.bow, c.p.location, 1.4);
    },
  },
  {
    id: 'larch_dance', name: 'Dance of the Larch', school: 'Bone', kekkei: 'bone', rank: 2, cost: 45, cd: 15,
    seals: [], desc: 'Bone spikes burst from your whole body.',
    cast(c) {
      effect(c.p, FX.resistance, 3, 1, false);
      fx(c.dim, PARTICLE.shards, add(c.p.location, v3(0, 1, 0)), rgb('#f4efe0'));
      sound(c.dim, SOUND.fangs, c.p.location);
      for (const e of enemiesAround(c.p, c.p.location, 4.5)) {
        hurt(e, 9 * c.pow, c.p);
        knock(e, c.p.location, 1.0, 0.3);
      }
    },
  },
]);
