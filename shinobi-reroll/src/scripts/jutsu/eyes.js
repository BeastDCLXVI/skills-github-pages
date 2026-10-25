import { system, world } from '@minecraft/server';
import { bijuuByKey } from '../data.js';
import { BLOCK, FX, PARTICLE, SOUND } from '../ids.js';
import { spawnOrb } from '../projectiles.js';
import { rt } from '../state.js';
import { placeTemp } from '../terrain.js';
import {
  add, effect, enemiesAround, eyes, fx, healthFraction, hurt, isPlayer, knock, lookPoint, mul, pull, repeat,
  rgb, sound, stun, title, v3, valid,
} from '../util.js';
import { fail, fan, line, register, ring, target } from './core.js';

const MS = rgb('#a00010');
const RINNE = rgb('#9a7ad8');
const SUSANOO = rgb('#8a3ad8');
const TENSEI = rgb('#7fd8ff');
const KARMA = rgb('#9a4ad0');

register([
  // ================================================================ Mangekyo Sharingan
  {
    id: 'amaterasu', name: 'Amaterasu', school: 'Mangekyo', eyes: ['mangekyo', 'rinne_sharingan'], rank: 0, cost: 60, cd: 20,
    seals: [], auto: true, strain: 15, desc: 'Black flames that burn until their target is gone. Strains your eyes.',
    cast(c) {
      const t = target(c, 30);
      if (!t) return fail(c, 'Amaterasu needs a target in sight.');
      sound(c.dim, SOUND.curse, c.p.location, 1.4, 0.6);
      repeat(16, 10, () => {
        if (!valid(t)) return false;
        try {
          t.setOnFire(3, true);
        } catch {}
        hurt(t, 2.5 * c.pow, c.p);
        fx(c.dim, PARTICLE.blackFlame, t.location, rgb('#140818'));
      });
    },
  },
  {
    id: 'tsukuyomi', name: 'Tsukuyomi', school: 'Mangekyo', eyes: ['mangekyo', 'rinne_sharingan'], rank: 0, cost: 50, cd: 25,
    seals: [], auto: true, strain: 20, desc: 'Trap a target in an illusion where days pass in a second.',
    cast(c) {
      const t = target(c, 16);
      if (!t) return fail(c, 'Meet your target\'s eyes first.');
      stun(t, 8);
      effect(t, FX.blindness, 8);
      effect(t, FX.nausea, 10);
      hurt(t, 6 * c.pow, c.p);
      if (isPlayer(t)) {
        try {
          t.camera.fade({ fadeColor: { red: 0.6, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.3, holdTime: 6, fadeOutTime: 1 } });
        } catch {}
        title(t, '§4Tsukuyomi', '§c72 hours...', 60);
      }
      fx(c.dim, PARTICLE.tomoe, eyes(t), MS);
    },
  },
  {
    id: 'susanoo', name: 'Susanoo', school: 'Mangekyo', eyes: ['mangekyo', 'rinne_sharingan'], rank: 0, cost: 40, cd: 15,
    seals: [], auto: true, desc: 'Manifest a chakra warrior around you: armor, absorption and crushing strength.',
    toggle: {
      upkeep: 6,
      onStart(c) {
        effect(c.p, FX.absorption, 30, 3, false);
        title(c.p, '§5Susanoo', '', 25);
        sound(c.dim, SOUND.power, c.p.location, 0.6);
      },
      onSecond(c) {
        c.d.strain = Math.min(120, c.d.strain + 1);
        effect(c.p, FX.resistance, 2, 2, false);
        effect(c.p, FX.strength, 2, 2, false);
        effect(c.p, FX.slowness, 2, 0, false);
        for (const at of ring(c.p.location, 1.4, 8)) fx(c.dim, PARTICLE.aura, at, SUSANOO);
        fx(c.dim, PARTICLE.burst, add(c.p.location, v3(0, 2.6, 0)), SUSANOO);
      },
      onEnd(p) {
        try {
          p.removeEffect(FX.absorption);
        } catch {}
      },
    },
  },
  {
    id: 'kamui', name: 'Kamui', school: 'Mangekyo', eyes: ['mangekyo'], rank: 0, cost: 45, cd: 18, seals: [], auto: true,
    strain: 20, desc: 'Warp a weakened enemy to another dimension, or phase yourself out of reality for 3 seconds.',
    cast(c) {
      const t = target(c, 20);
      if (t && !t.matches({ families: ['shinobi_boss'] }) && !isPlayer(t) && healthFraction(t) <= 0.6) {
        repeat(6, 3, (i) => {
          if (!valid(t)) return false;
          fx(c.dim, PARTICLE.spiral, eyes(t), rgb('#1a1a22'));
          if (i === 5) {
            hurt(t, 999, c.p);
            try {
              if (valid(t)) t.remove();
            } catch {}
          }
        });
        sound(c.dim, SOUND.portal, t.location, 0.5);
        return;
      }
      rt(c.p).intangibleUntil = system.currentTick + 60;
      effect(c.p, FX.resistance, 3, 4, false);
      effect(c.p, FX.invisibility, 3, 0, false);
      fx(c.dim, PARTICLE.spiral, eyes(c.p), rgb('#1a1a22'));
      sound(c.dim, SOUND.portal, c.p.location, 1.4);
    },
  },
  // ================================================================ Rinnegan
  {
    id: 'shinra_tensei', name: 'Almighty Push', school: 'Rinnegan', eyes: ['rinnegan', 'rinne_sharingan'], rank: 0, cost: 70,
    cd: 20, seals: [], auto: true, desc: 'Repel everything around you with overwhelming force.',
    cast(c) {
      title(c.p, '', '§5Shinra Tensei!', 20);
      fx(c.dim, PARTICLE.shockwave, c.p.location, RINNE);
      fx(c.dim, PARTICLE.shockwave, add(c.p.location, v3(0, 1, 0)), RINNE);
      sound(c.dim, SOUND.boom, c.p.location, 0.8);
      for (const e of enemiesAround(c.p, c.p.location, 12)) {
        hurt(e, 8 * c.pow, c.p);
        knock(e, c.p.location, 4.5, 0.9);
      }
    },
  },
  {
    id: 'bansho_tenin', name: 'Universal Pull', school: 'Rinnegan', eyes: ['rinnegan', 'rinne_sharingan'], rank: 0, cost: 30,
    cd: 6, seals: [], auto: true, desc: 'Drag a target to you.',
    cast(c) {
      const t = target(c, 30);
      if (!t) return fail(c, 'No target in sight.');
      pull(t, c.p.location, 3.2);
      line(c.dim, c.head, eyes(t), PARTICLE.burst, RINNE, 1.5);
      sound(c.dim, SOUND.portal, t.location, 0.7);
    },
  },
  {
    id: 'amenotejikara', name: 'Amenotejikara', school: 'Rinnegan', eyes: ['rinnegan', 'rinne_sharingan'], rank: 0, cost: 25,
    cd: 5, seals: [], auto: true, desc: 'Instantly swap places with the target you look at.',
    cast(c) {
      const t = target(c, 30);
      if (!t) return fail(c, 'No target to swap with.');
      const a = c.p.location;
      const b = t.location;
      try {
        t.teleport(a);
        c.p.teleport(b, { facingLocation: a });
      } catch {}
      fx(c.dim, PARTICLE.mark, add(a, v3(0, 1, 0)), RINNE);
      fx(c.dim, PARTICLE.mark, add(b, v3(0, 1, 0)), RINNE);
      sound(c.dim, SOUND.click, b, 0.6);
    },
  },
  {
    id: 'chibaku_tensei', name: 'Planetary Devastation', school: 'Rinnegan', eyes: ['rinnegan', 'rinne_sharingan'], rank: 4,
    cost: 200, cd: 120, seals: [], auto: true, desc: 'Create a gravity core that drags enemies in and entombs them in rock.',
    cast(c) {
      const core = add(lookPoint(c.p, 18), v3(0, 6, 0));
      title(c.p, '', '§5Chibaku Tensei', 30);
      sound(c.dim, SOUND.bigRoar, core, 0.5, 2);
      repeat(20, 3, (i) => {
        fx(c.dim, PARTICLE.spiral, core, RINNE);
        for (const e of enemiesAround(c.p, core, 18)) {
          if (i < 18) {
            pull(e, core, 1.0);
            try {
              e.applyKnockback({ x: 0, z: 0 }, core.y > e.location.y ? 0.35 : 0);
            } catch {}
          } else {
            hurt(e, 14 * c.pow, c.p);
            stun(e, 6);
          }
        }
        if (i === 19) {
          const shell = [];
          for (let x = -3; x <= 3; x++) {
            for (let y = -3; y <= 3; y++) {
              for (let z = -3; z <= 3; z++) {
                const r = Math.hypot(x, y, z);
                if (r > 2.2 && r <= 3.2) shell.push(add(core, v3(x, y, z)));
              }
            }
          }
          placeTemp(c.dim, shell, BLOCK.earthWall, 240);
          sound(c.dim, SOUND.stone, core, 0.4, 2);
        }
      });
    },
  },
  // ================================================================ Rinne-Sharingan / Tenseigan
  {
    id: 'infinite_tsukuyomi', name: 'Infinite Tsukuyomi', school: 'Rinne-Sharingan', eyes: ['rinne_sharingan'], rank: 0,
    cost: 300, cd: 300, seals: [], auto: true, desc: 'Reflect your eye off the moon: every foe within 48 blocks dreams for 15 seconds.',
    cast(c) {
      world.sendMessage(`§4${c.p.name} cast the Infinite Tsukuyomi!`);
      sound(c.dim, SOUND.curse, c.p.location, 0.6, 3);
      for (const e of enemiesAround(c.p, c.p.location, 48)) {
        stun(e, 15);
        effect(e, FX.blindness, 15);
        if (isPlayer(e)) title(e, '§4Infinite Tsukuyomi', '§cA world of dreams...', 80);
        fx(c.dim, PARTICLE.mark, eyes(e), MS);
      }
    },
  },
  {
    id: 'truth_seeking_orbs', name: 'Truth-Seeking Balls', school: 'Six Paths', eyes: ['tenseigan', 'rinne_sharingan'], rank: 0,
    cost: 60, cd: 12, seals: [], auto: true, desc: 'Six black orbs of Yin-Yang chakra hunt the nearest foes.',
    cast(c) {
      const foes = enemiesAround(c.p, c.p.location, 24);
      fan(c.dir, 6, 40).forEach((d, i) => {
        spawnOrb(c.p, {
          element: 'truth', size: 2, speed: 1.1, damage: 10, dir: d, homing: foes[i % Math.max(1, foes.length)],
          effects: [[FX.wither, 4, 0]], life: 80, power: c.pow,
        });
      });
      sound(c.dim, SOUND.beacon, c.p.location, 0.6);
    },
  },
  {
    id: 'tenseigan_mode', name: 'Tenseigan Chakra Mode', school: 'Tenseigan', eyes: ['tenseigan'], rank: 0, cost: 30, cd: 10,
    seals: [], auto: true, desc: 'Moon-blue chakra cloaks you: you drift, run and strike like the Otsutsuki.',
    toggle: {
      upkeep: 4,
      onStart(c) {
        title(c.p, '§bTenseigan Chakra Mode', '', 25);
      },
      onSecond(c) {
        effect(c.p, FX.slowFalling, 2, 0, false);
        effect(c.p, FX.speed, 2, 1, false);
        effect(c.p, FX.strength, 2, 1, false);
        effect(c.p, FX.resistance, 2, 0, false);
        fx(c.dim, PARTICLE.aura, c.p.location, TENSEI);
      },
    },
  },
  // ================================================================ Jinchuriki
  {
    id: 'tailed_beast_cloak', name: 'Tailed Beast Chakra Cloak', school: 'Jinchuriki', flag: 'jinchuriki', rank: 0, cost: 20,
    cd: 10, seals: [], auto: true, desc: 'Wrap yourself in your tailed beast\'s chakra. Grows stronger as your sync rises.',
    toggle: {
      upkeep: 3,
      onStart(c) {
        const b = bijuuByKey(c.d.bijuu ?? '');
        title(c.p, `§6${b?.title ?? 'Tailed Beast'} Cloak`, `§eSync ${Math.floor(c.d.sync)}%`, 25);
        sound(c.dim, SOUND.roar, c.p.location, 1.2, 0.7);
      },
      onSecond(c) {
        const b = bijuuByKey(c.d.bijuu ?? '');
        if (!b) return;
        c.d.sync = Math.min(100, c.d.sync + 0.25);
        const full = c.d.sync >= 100;
        const tier = Math.min(3, Math.floor(b.tails / 3));
        effect(c.p, FX.strength, 2, tier + (full ? 1 : 0), false);
        effect(c.p, FX.speed, 2, full ? 2 : 1, false);
        effect(c.p, FX.resistance, 2, full ? 2 : 1, false);
        effect(c.p, FX.regeneration, 2, 0, false);
        if (full) effect(c.p, FX.jumpBoost, 2, 1, false);
        fx(c.dim, PARTICLE.aura, c.p.location, rgb(b.hex));
      },
    },
  },
  {
    id: 'tailed_beast_bomb', name: 'Tailed Beast Bomb', school: 'Jinchuriki', flag: 'jinchuriki', rank: 0, cost: 80, cd: 30,
    seals: [], auto: true, active: 'tailed_beast_cloak', minSync: 50, desc: 'Compress black and white chakra into a world-shaking bomb. Requires the cloak and 50% sync.',
    cast(c) {
      const b = bijuuByKey(c.d.bijuu ?? '');
      sound(c.dim, SOUND.charge, c.p.location, 0.5, 2);
      repeat(6, 4, (i) => {
        if (!valid(c.p)) return false;
        fx(c.dim, PARTICLE.spiral, add(eyes(c.p), mul(c.p.getViewDirection(), 1.6)), rgb(b?.hex ?? '#7a1b8e'));
        if (i === 5) {
          spawnOrb(c.p, {
            element: 'bijuu_bomb', size: 5, speed: 1.2, damage: 22 + (b?.tails ?? 1) * 2, radius: 5, explode: 3,
            fizzleBoom: true, life: 50, power: c.pow, sound: SOUND.boom,
          });
        }
      });
    },
  },
  // ================================================================ Karma
  {
    id: 'karma_mode', name: 'Karma Activation', school: 'Karma', flag: 'karma', rank: 0, cost: 25, cd: 10, seals: [],
    auto: true, desc: 'Let the Karma spread across your body: power, speed, and a chance to absorb hits into Karma energy.',
    toggle: {
      upkeep: 2,
      onStart(c) {
        title(c.p, '§5Karma', '§dThe seal spreads...', 25);
        sound(c.dim, SOUND.curse, c.p.location, 1.6, 0.5);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 1, false);
        effect(c.p, FX.speed, 2, 0, false);
        effect(c.p, FX.regeneration, 2, 0, false);
        fx(c.dim, PARTICLE.aura, c.p.location, KARMA);
      },
    },
  },
  {
    id: 'karma_release', name: 'Karma: Absorbed Release', school: 'Karma', flag: 'karma', rank: 0, cost: 40, cd: 15, seals: [],
    auto: true, desc: 'Release every bit of Karma energy you absorbed as one blast.',
    cast(c) {
      const stored = Math.min(50, c.d.karmaEnergy);
      c.d.karmaEnergy = 0;
      spawnOrb(c.p, {
        element: 'karma', size: 3 + Math.floor(stored / 15), speed: 1.4, damage: 10 + stored * 0.8, radius: 3 + stored / 20,
        knock: 2, power: c.pow, sound: SOUND.boom,
      });
    },
  },
]);
