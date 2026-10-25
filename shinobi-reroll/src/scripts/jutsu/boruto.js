// v1.3: Boruto era: Boruto's Gale Palm, Kakashi's Purple Lightning, and the arts of Code of the Kara Inner.
import { EntityDamageCause, system } from '@minecraft/server';
import { ENTITY, FX, PARTICLE, SOUND } from '../ids.js';
import { rt } from '../state.js';
import {
  add, dist, effect, enemiesAround, eyes, fx, hurt, knock, lookPoint, mul, repeat, rgb, sound, stun, sub, title, v3,
  valid,
} from '../util.js';
import { ahead, cone, fail, ground, line, register, summon, target } from './core.js';

const PURPLE = rgb('#b06aff');
const WHITE = rgb('#f4f0e8');
const GALE = rgb('#c8ffe8');
const MARK_TICKS = 30 * 20;

/** @param {import('./core.js').Ctx} c @param {import('@minecraft/server').Vector3} at */
function drawMark(c, at) {
  for (const dx of [-0.5, 0, 0.5]) line(c.dim, add(at, v3(dx - 0.35, 1.7, 0)), add(at, v3(dx + 0.35, 0.3, 0)), PARTICLE.mark, WHITE, 0.35);
}

register([
  {
    id: 'gale_palm', name: 'Wind Style: Gale Palm', school: 'Wind', nature: 'wind', rank: 1, cost: 15, cd: 4,
    seals: ['Tiger'], desc: "Boruto's favourite opener: a clap of compressed wind that blows enemies and projectiles away.",
    cast(c) {
      for (const e of cone(c, 9, 70)) {
        hurt(e, 4 * c.pow, c.p);
        knock(e, c.p.location, 2.2, 0.45);
      }
      const flying = ['projectile', 'arrow'].flatMap((f) => c.dim.getEntities({ location: c.p.location, maxDistance: 9, families: [f] }));
      for (const e of flying) {
        if (e.typeId === ENTITY.orb || !valid(e)) continue;
        try {
          e.applyImpulse(mul(c.dir, 1.5));
        } catch {}
      }
      for (let i = 1; i < 8; i++) fx(c.dim, PARTICLE.shockwave, add(c.head, mul(c.dir, i)), GALE);
      sound(c.dim, SOUND.wind, c.p.location, 1.3, 1);
    },
  },
  {
    id: 'purple_lightning', name: 'Lightning Style: Purple Lightning', school: 'Lightning', nature: 'lightning', rank: 3,
    cost: 45, cd: 12, seals: ['Ox', 'Hare', 'Monkey'],
    desc: "Kakashi's signature of the new era: a bolt of purple lightning that leaps from your target to two more enemies.",
    cast(c) {
      const first = target(c, 24);
      if (!first) return fail(c, 'No target in sight.');
      let from = c.head;
      /** @type {import('@minecraft/server').Entity | undefined} */
      let cur = first;
      const hit = new Set();
      for (let jump = 0; jump < 3 && cur; jump++) {
        hit.add(cur.id);
        line(c.dim, from, eyes(cur), PARTICLE.sparks, PURPLE, 0.6);
        hurt(cur, (jump ? 8 : 12) * c.pow, c.p, EntityDamageCause.lightning);
        stun(cur, jump ? 0.5 : 1);
        from = eyes(cur);
        const at = cur.location;
        cur = enemiesAround(c.p, at, 7).find((e) => !hit.has(e.id));
      }
      sound(c.dim, SOUND.zap, c.p.location, 1.4, 1.2);
    },
  },
  // ================================================================ Code (Kara Inner)
  {
    id: 'claw_marks', name: 'Claw Marks', school: 'Kara', flag: 'code', rank: 2, cost: 15, cd: 2, seals: [],
    desc: "Code's teleportation: carve a mark where you look; cast again to vanish to it, slashing everything on the way.",
    cast(c) {
      const r = rt(c.p);
      const mark = r.clawMark;
      if (!mark || mark.until < system.currentTick || mark.dim !== c.dim.id) {
        const pt = lookPoint(c.p, 28);
        const at = ground(c.dim, pt) ?? pt;
        r.clawMark = { loc: at, dim: c.dim.id, until: system.currentTick + MARK_TICKS };
        drawMark(c, at);
        repeat(MARK_TICKS / 20, 20, () => {
          if (!valid(c.p) || rt(c.p).clawMark?.loc !== at) return false;
          drawMark(c, at);
        });
        title(c.p, ' ', '§fClaw Mark carved. §7Cast again to vanish to it.', 40);
        sound(c.dim, SOUND.fangs, at, 1.4, 0.8);
        return;
      }
      if (dist(c.p.location, mark.loc) > 64) return fail(c, 'The mark is too far away.');
      const from = c.p.location;
      const seg = sub(mark.loc, from);
      const len = Math.max(1, Math.hypot(seg.x, seg.y, seg.z));
      for (const e of enemiesAround(c.p, add(from, mul(seg, 0.5)), len / 2 + 2)) {
        // distance from the segment
        const t = Math.max(0, Math.min(1, ((e.location.x - from.x) * seg.x + (e.location.y - from.y) * seg.y + (e.location.z - from.z) * seg.z) / (len * len)));
        if (dist(e.location, add(from, mul(seg, t))) > 2.5) continue;
        hurt(e, 10 * c.pow, c.p);
        fx(c.dim, PARTICLE.mark, eyes(e), WHITE);
      }
      if (!c.p.tryTeleport(add(mark.loc, v3(0, 0.1, 0)), { checkForBlocks: true, keepVelocity: false })) {
        return fail(c, 'Something blocks the mark.');
      }
      line(c.dim, add(from, v3(0, 1, 0)), add(mark.loc, v3(0, 1, 0)), PARTICLE.mark, WHITE, 1.2);
      r.clawMark = null;
      sound(c.dim, SOUND.whoosh, mark.loc, 1.5, 1);
    },
  },
  {
    id: 'white_karma', name: 'White Karma: Limiter Release', school: 'Kara', flag: 'code', rank: 3, cost: 30, cd: 20,
    seals: [], desc: 'Release the limiters on your White Karma: overwhelming strength and speed, and every blow tears with claw marks.',
    toggle: {
      upkeep: 4,
      onStart(c) {
        title(c.p, '§fWhite Karma', '§7Limiters released', 30);
        fx(c.dim, PARTICLE.shockwave, c.p.location, WHITE);
        sound(c.dim, SOUND.roar, c.p.location, 1.3, 0.8);
      },
      onSecond(c) {
        effect(c.p, FX.strength, 2, 2, false);
        effect(c.p, FX.speed, 2, 1, false);
        effect(c.p, FX.resistance, 2, 0, false);
        effect(c.p, FX.jumpBoost, 2, 1, false);
        fx(c.dim, PARTICLE.aura, c.p.location, WHITE);
      },
    },
  },
  {
    id: 'claw_grime_summon', name: 'Claw Grime', school: 'Kara', flag: 'code', rank: 4, cost: 60, cd: 45,
    seals: [], desc: 'Two Claw Grime crawl out of your marks and hunt your enemies for a minute.',
    cast(c) {
      let ok = 0;
      for (const side of [-2, 2]) {
        const at = add(ahead(c, 3), v3(-c.dir.z * side, 0.3, c.dir.x * side));
        if (summon(c, ENTITY.clawGrime, at, 60 * 20)) ok++;
        drawMark(c, at);
      }
      if (!ok) return fail(c, 'The marks will not open here.');
      sound(c.dim, SOUND.growl, c.p.location, 0.6, 1);
    },
  },
]);
