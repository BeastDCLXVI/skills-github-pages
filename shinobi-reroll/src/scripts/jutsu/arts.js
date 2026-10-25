import { EntityDamageCause, system } from '@minecraft/server';
import { ENTITY, FX, PARTICLE, SOUND } from '../ids.js';
import { spawnOrb } from '../projectiles.js';
import { rt, setCooldown } from '../state.js';
import {
  add, effect, enemiesAround, eyes, fx, hurt, lookPoint, repeat, rgb, sound, stun, title, v3, valid,
} from '../util.js';
import { ahead, fail, fan, register, summon, target } from './core.js';

const CLAY = '#f4efe0';
const CURSE = rgb('#2a1a2a');
const BARYON = rgb('#ff6aa8');

register([
  // ================================================================ Explosion Release (Deidara)
  {
    id: 'clay_birds', name: 'Explosion Release: C1 Birds', school: 'Explosion', flag: 'clay', rank: 1, cost: 20, cd: 6,
    seals: ['Ram'], desc: 'Three clay birds hunt down the nearest enemies and detonate. Art is an explosion!',
    cast(c) {
      const foes = enemiesAround(c.p, c.p.location, 24);
      fan(c.dir, 3, 20).forEach((d, i) => {
        spawnOrb(c.p, {
          element: 'earth', color: CLAY, size: 1, speed: 1.1, damage: 8, radius: 2.5, explode: 1, dir: d,
          homing: foes[i % Math.max(1, foes.length)], life: 80, fizzleBoom: true, power: c.pow,
        });
      });
      sound(c.dim, SOUND.crow, c.p.location, 1.2);
    },
  },
  {
    id: 'c2_dragon', name: 'Explosion Release: C2 Dragon', school: 'Explosion', flag: 'clay', rank: 2, cost: 45, cd: 15,
    seals: ['Ram', 'Snake'], desc: 'A clay dragon spits a massive explosive into the battlefield.',
    cast(c) {
      spawnOrb(c.p, {
        element: 'earth', color: CLAY, size: 4, speed: 1.2, damage: 16, radius: 4, explode: 3, fizzleBoom: true, life: 60,
        power: c.pow, sound: SOUND.roar,
      });
    },
  },
  {
    id: 'c4_karura', name: 'Explosion Release: C4 Karura', school: 'Explosion', flag: 'clay', rank: 3, cost: 70, cd: 30,
    seals: ['Ram', 'Snake', 'Tiger'], desc: 'Microscopic bombs drift into the area and destroy enemies from within.',
    cast(c) {
      const at = lookPoint(c.p, 18);
      sound(c.dim, SOUND.fizz, at, 0.5, 1.5);
      repeat(8, 10, () => {
        if (!valid(c.p)) return false;
        for (let i = 0; i < 4; i++) fx(c.dim, PARTICLE.smoke, add(at, v3(Math.random() * 8 - 4, Math.random() * 2, Math.random() * 8 - 4)), rgb('#d0d0d8'));
        for (const e of enemiesAround(c.p, at, 6)) {
          hurt(e, 3 * c.pow, c.p);
          effect(e, FX.wither, 3, 0);
        }
      });
    },
  },
  // ================================================================ Puppetry (Sand)
  {
    id: 'puppet_karasu', name: 'Puppet Technique: Karasu', school: 'Puppetry', flag: 'puppet', rank: 1, cost: 30, cd: 40,
    seals: [], desc: 'Unseal Karasu, a three-eyed battle puppet with poisoned blades, for one minute.',
    cast(c) {
      if (!summon(c, ENTITY.puppet, add(ahead(c, 2), v3(0, 0.2, 0)), 60 * 20)) return fail(c, 'The puppet scroll will not open here.');
      sound(c.dim, SOUND.chain, c.p.location, 1.4);
    },
  },
  {
    id: 'iron_maiden', name: 'Black Secret Technique: Iron Maiden', school: 'Puppetry', flag: 'puppet', rank: 2, cost: 35,
    cd: 15, seals: [], desc: 'A puppet snaps shut around your target: heavy damage and deadly poison.',
    cast(c) {
      const t = target(c, 16);
      if (!t) return fail(c, 'No target in sight.');
      stun(t, 3);
      hurt(t, 12 * c.pow, c.p);
      effect(t, FX.poison, 6, 1);
      fx(c.dim, PARTICLE.shards, eyes(t), rgb('#6b4a2b'));
      sound(c.dim, SOUND.anvil, t.location, 1.4, 0.6);
    },
  },
  // ================================================================ Summoning: snake & slug
  {
    id: 'summoning_snake', name: 'Summoning Jutsu: Snake', school: 'Ninjutsu', contract: 'snake', rank: 2, cost: 60, cd: 90,
    seals: ['Boar', 'Dog', 'Bird', 'Monkey', 'Ram'], desc: 'Summon a giant serpent that crushes your enemies.',
    cast(c) {
      hurt(c.p, 1);
      if (!summon(c, ENTITY.snake, add(ahead(c, 3), v3(0, 0.5, 0)), 75 * 20)) return fail(c, 'The summoning failed.');
      sound(c.dim, SOUND.hiss, c.p.location, 0.6, 1.5);
      title(c.p, '', '§5Kuchiyose no Jutsu!', 25);
    },
  },
  {
    id: 'summoning_slug', name: 'Summoning Jutsu: Katsuyu', school: 'Ninjutsu', contract: 'slug', rank: 2, cost: 60, cd: 120,
    seals: ['Boar', 'Dog', 'Bird', 'Monkey', 'Ram'], desc: 'Summon Katsuyu, who heals you and your allies around her.',
    cast(c) {
      hurt(c.p, 1);
      if (!summon(c, ENTITY.slug, add(ahead(c, 2), v3(0, 0.5, 0)), 90 * 20)) return fail(c, 'The summoning failed.');
      sound(c.dim, SOUND.summon, c.p.location, 1.2);
      title(c.p, '', '§bKuchiyose: Katsuyu!', 25);
    },
  },
  // ================================================================ Boruto era
  {
    id: 'rasengan_uzuhiko', name: 'Rasengan Uzuhiko', school: 'Ninjutsu', nature: 'wind', rank: 3, cost: 70, cd: 18,
    seals: [], requires: ['vanishing_rasengan'], desc: 'Boruto\'s giant wind-wrapped Rasengan that keeps growing as it flies.',
    cast(c) {
      spawnOrb(c.p, {
        element: 'rasengan', size: 6, speed: 1.1, damage: 24, radius: 4.5, knock: 2.5, pulses: 3, pulseRadius: 4.5,
        fizzleBoom: true, life: 50, power: c.pow, sound: SOUND.wind,
      });
    },
  },
  {
    id: 'karma_blade', name: 'Karma: Shape Transformation', school: 'Karma', flag: 'karma', rank: 2, cost: 25, cd: 8,
    seals: [], desc: 'Kawaki\'s Karma reshapes your arm into a blade: three empowered strikes that steal life.',
    cast(c) {
      rt(c.p).charged = { kind: 'karma_blade', until: system.currentTick + 160, hits: 3 };
      fx(c.dim, PARTICLE.aura, c.p.location, rgb('#9a4ad0'));
      sound(c.dim, SOUND.curse, c.p.location, 1.8, 0.4);
    },
  },
  {
    id: 'sukunahikona', name: 'Sukunahikona', school: 'Otsutsuki', flag: 'karma', rank: 4, cost: 60, cd: 20, seals: [],
    requires: ['karma_release'], desc: 'Isshiki\'s technique: shrunken rods that regain their true size inside the target.',
    cast(c) {
      if (!c.d.ascended) return fail(c, 'Only an ascended Otsutsuki can use Sukunahikona.');
      for (const d of fan(c.dir, 4, 10)) {
        spawnOrb(c.p, { element: 'truth', size: 1, speed: 2.6, damage: 14, radius: 3.5, explode: 2, dir: d, power: c.pow });
      }
      sound(c.dim, SOUND.witherShoot, c.p.location, 1.6, 0.6);
    },
  },
  // ================================================================ Final forms
  {
    id: 'baryon_mode', name: 'Baryon Mode', school: 'Jinchuriki', flag: 'jinchuriki', beast: 'kurama', rank: 5, cost: 60,
    cd: 30, seals: [], active: 'tailed_beast_cloak', minSync: 100,
    desc: 'Fuse your chakra with Kurama\'s like nuclear fusion. Every hit burns the enemy\'s life. Ten minutes of rest afterwards.',
    toggle: {
      upkeep: 12,
      onStart(c) {
        title(c.p, '§dBaryon Mode', '§7Your life force and Kurama\'s burn together', 50);
        sound(c.dim, SOUND.bigRoar, c.p.location, 0.7, 2);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 3, false);
        effect(c.p, FX.speed, 2, 2, false);
        effect(c.p, FX.resistance, 2, 2, false);
        fx(c.dim, PARTICLE.aura, c.p.location, BARYON);
        fx(c.dim, PARTICLE.sparks, eyes(c.p), BARYON);
      },
      onEnd(p) {
        setCooldown(p, 'baryon_mode', 600 * 20);
        effect(p, FX.weakness, 60, 1);
      },
    },
  },
  {
    id: 'six_paths_sage', name: 'Six Paths Sage Mode', school: 'Senjutsu', flag: 'ascended', contract: 'toad', rank: 5,
    cost: 80, cd: 60, seals: [], requires: ['sage_mode'],
    desc: 'The Sage of Six Paths\' power: Sage Mode without gathering, plus Truth-Seeking Balls that defend you.',
    toggle: {
      upkeep: 8,
      onStart(c) {
        title(c.p, '§6Six Paths Sage Mode', '', 40);
        sound(c.dim, SOUND.beacon, c.p.location, 0.8, 2);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 2, false);
        effect(c.p, FX.speed, 2, 1, false);
        effect(c.p, FX.resistance, 2, 1, false);
        effect(c.p, FX.regeneration, 2, 1, false);
        effect(c.p, FX.slowFalling, 2, 0, false);
        fx(c.dim, PARTICLE.aura, c.p.location, rgb('#ffd36a'));
        if (system.currentTick % 60 < 20) {
          const foe = enemiesAround(c.p, c.p.location, 16)[0];
          if (foe) spawnOrb(c.p, { element: 'truth', size: 2, speed: 1.2, damage: 10, homing: foe, life: 60, power: c.pow });
        }
      },
    },
  },
  // ================================================================ Cursed Seal
  {
    id: 'curse_mark', name: 'Cursed Seal: Stage One', school: 'Cursed Seal', flag: 'curse', rank: 1, cost: 15, cd: 10,
    seals: [], desc: 'Black flame marks spread over your body: strength and speed from Orochimaru\'s seal.',
    toggle: {
      upkeep: 2,
      onStart(c) {
        sound(c.dim, SOUND.curse, c.p.location, 1.2, 0.6);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 1, false);
        effect(c.p, FX.speed, 2, 0, false);
        fx(c.dim, PARTICLE.blackFlame, c.p.location, CURSE);
      },
    },
  },
  {
    id: 'curse_mark_two', name: 'Cursed Seal: Stage Two', school: 'Cursed Seal', flag: 'curse', rank: 3, cost: 25, cd: 30,
    seals: [], active: 'curse_mark', desc: 'Your body transforms and sprouts hand-shaped wings. Immense power, at a cost.',
    toggle: {
      upkeep: 4,
      onStart(c) {
        title(c.p, '§8Cursed Seal', '§7Stage Two', 30);
        sound(c.dim, SOUND.roar, c.p.location, 1.4, 0.8);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 2, false);
        effect(c.p, FX.speed, 2, 1, false);
        effect(c.p, FX.resistance, 2, 1, false);
        effect(c.p, FX.slowFalling, 2, 0, false);
        hurt(c.p, 0.5, undefined, EntityDamageCause.magic);
        fx(c.dim, PARTICLE.blackFlame, add(c.p.location, v3(0, 1, 0)), CURSE);
      },
      onEnd(p) {
        effect(p, FX.nausea, 8, 0);
        effect(p, FX.weakness, 20, 0);
      },
    },
  },
]);
