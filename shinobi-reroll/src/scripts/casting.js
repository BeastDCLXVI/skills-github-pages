import { EquipmentSlot, system, world } from '@minecraft/server';
import { CLANS, DOJUTSU, RANKS } from './data.js';
import { FX, ITEM, PARTICLE, SOUND } from './ids.js';
import { JUTSU, meets } from './jutsu/index.js';
import { advance } from './missions.js';
import { addXp, power } from './progression.js';
import { cooldownLeft, rt, setCooldown } from './state.js';
import { addChakra, getChakra, getData, maxChakra, spendChakra, touch } from './store.js';
import {
  effect, eyes, fx, heldItem, hurt, ping, rgb, secs, sound, tell, title, valid, worn,
} from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('./jutsu/core.js').Jutsu} Jutsu */
/** @typedef {import('./jutsu/core.js').Ctx} Ctx */

/** Show a short message on the HUD's second line (survives the next HUD refresh). @param {Player} p @param {string} msg */
export function flash(p, msg, ticks = 30) {
  const r = rt(p);
  r.seals = msg;
  r.sealsUntil = system.currentTick + ticks;
  try {
    p.onScreenDisplay.setActionBar(msg);
  } catch {}
}

/** @param {Player} p @returns {Ctx} */
export function ctxFor(p) {
  const d = getData(p);
  return { p, d, dim: p.dimension, pow: power(p), dir: p.getViewDirection(), head: eyes(p), rank: d.rank };
}

/** Chakra cost after clan, sage and eye modifiers. @param {Player} p @param {Jutsu} j */
export function costOf(p, j) {
  const d = getData(p);
  let m = CLANS[d.clan]?.costMult ?? 1;
  if (rt(p).toggles.has('sage_mode')) m *= 0.8;
  if (d.ascended) m *= 0.9;
  return Math.round(j.cost * m);
}

/** Cooldown in ticks after clan modifiers. @param {Player} p @param {Jutsu} j */
function cooldownOf(p, j) {
  const d = getData(p);
  return j.cd * 20 * (d.clan === 'nara' ? 0.9 : 1);
}

/** Seal weaving time: Sharingan users and veterans weave faster. @param {Player} p @param {Jutsu} j */
function weaveTicks(p, j) {
  const d = getData(p);
  const eyeBoost = d.eyeOn && ['sharingan', 'mangekyo', 'rinne_sharingan'].includes(d.eye ?? '') ? 0.4 : 1;
  return Math.round(j.seals.length * 3 * eyeBoost * Math.max(0.4, 1 - d.rank * 0.08));
}

/**
 * Cast a jutsu by id.
 * @param {Player} p @param {string} id
 */
export function cast(p, id) {
  const d = getData(p);
  const r = rt(p);
  const j = JUTSU.get(id);
  if (!j || !d.learned.includes(id)) return;
  if (system.currentTick < r.weavingUntil) return;

  if (j.toggle && r.toggles.has(id)) {
    r.toggles.delete(id);
    j.toggle.onEnd?.(p);
    tell(p, `§7${j.name} released.`);
    setCooldown(p, id, cooldownOf(p, j));
    return;
  }
  const m = meets(d, j);
  if (!m.ok) {
    tell(p, `§c${j.name}: ${m.why}.`);
    ping(p, SOUND.deny, 0.6);
    return;
  }
  if (j.active && !r.toggles.has(j.active)) {
    tell(p, `§c${j.name} requires ${JUTSU.get(j.active)?.name ?? j.active} to be active.`);
    ping(p, SOUND.deny, 0.6);
    return;
  }
  if (j.minSync && d.sync < j.minSync) {
    tell(p, `§c${j.name}: tailed beast sync too low (${Math.floor(d.sync)}% / ${j.minSync}%).`);
    ping(p, SOUND.deny, 0.6);
    return;
  }
  if (j.eyes && !d.eyeOn) {
    tell(p, '§cActivate your dojutsu first (sneak + jump, or from the Shinobi Scroll).');
    ping(p, SOUND.deny, 0.6);
    return;
  }
  const cd = cooldownLeft(p, id);
  if (cd > 0) {
    flash(p, `§c${j.name} §7is on cooldown: §f${secs(cd)}s`);
    ping(p, SOUND.deny, 0.8);
    return;
  }
  const cost = costOf(p, j);
  if (getChakra(p) < cost) {
    flash(p, `§cNot enough chakra §7(${Math.floor(getChakra(p))}/${cost})`);
    ping(p, SOUND.deny, 0.5);
    return;
  }

  const weave = weaveTicks(p, j);
  r.weavingUntil = system.currentTick + weave;
  if (weave > 0) {
    r.seals = j.seals.join(' §8›§f ');
    r.sealsUntil = system.currentTick + weave + 20;
  }
  system.runTimeout(() => execute(p, j, cost), weave);
}

/** @param {Player} p @param {Jutsu} j @param {number} cost */
function execute(p, j, cost) {
  if (!valid(p)) return;
  const d = getData(p);
  const r = rt(p);
  const ctx = ctxFor(p);
  let ok;
  try {
    ok = j.toggle ? j.toggle.onStart?.(ctx) : j.cast?.(ctx);
  } catch (err) {
    console.warn(`[shinobi] ${j.id} failed: ${err}`);
    ok = false;
  }
  if (ok === false) return;
  if (!spendChakra(p, cost)) addChakra(p, -cost);
  if (j.toggle) r.toggles.add(j.id);
  else setCooldown(p, j.id, cooldownOf(p, j));
  if (j.strain) d.strain = Math.min(120, d.strain + j.strain);
  d.casts++;
  if (d.casts % 4 === 0) addXp(p, 1 + j.rank);
  sound(p.dimension, SOUND.cast, p.location, 1.2, 0.4);
  flash(p, `§6${j.name}!`);
  touch(p);
  notifyCast(p, j.id);
  advance(p, 'cast');
}

/** Sharingan users near a caster may copy the technique. @param {import('@minecraft/server').Entity} caster @param {string} id */
export function notifyCast(caster, id) {
  const j = JUTSU.get(id);
  if (!j || j.auto || j.clan || j.kekkei || j.eyes || j.flag) return;
  let near;
  try {
    near = caster.dimension.getPlayers({ location: caster.location, maxDistance: 18 });
  } catch {
    return;
  }
  for (const watcher of near) {
    if (watcher.id === caster.id) continue;
    const d = getData(watcher);
    if (!d.eyeOn || !['sharingan', 'mangekyo', 'rinne_sharingan'].includes(d.eye ?? '')) continue;
    if (d.learned.includes(id) || d.rank < j.rank || Math.random() > 0.3) continue;
    d.learned.push(id);
    tell(watcher, `§cSharingan: §fcopied §e${j.name}§f!`);
    fx(watcher.dimension, PARTICLE.tomoe, eyes(watcher), rgb('#d01020'));
    touch(watcher);
  }
}

/** Cycle the selected loadout slot. @param {Player} p @param {number} dir */
export function cycle(p, dir = 1) {
  const d = getData(p);
  if (!d.slots.length) {
    tell(p, '§7Your loadout is empty. Open the Shinobi Scroll to equip jutsu.');
    return;
  }
  d.sel = (d.sel + dir + d.slots.length) % d.slots.length;
  const j = JUTSU.get(d.slots[d.sel]);
  if (j) title(p, ' ', `§e${j.name} §7(${costOf(p, j)} chakra)`, 18);
  ping(p, SOUND.click, 1.6);
  touch(p);
}

/** @param {Player} p */
export function castSelected(p) {
  const d = getData(p);
  const id = d.slots[d.sel];
  if (!id) {
    tell(p, '§7No jutsu selected. Open the Shinobi Scroll to build your loadout.');
    return;
  }
  cast(p, id);
}

// ----------------------------------------------------------------- per-tick systems

/** Chakra regeneration per second. @param {Player} p */
export function regenRate(p) {
  const d = getData(p);
  const r = rt(p);
  let rate = 2 + d.rank * 0.6 + (CLANS[d.clan]?.regen ?? 0);
  if (d.bijuu) rate += 1 + d.sync / 50;
  if (d.ascended) rate += 3;
  if (d.karma) rate += 1;
  if (r.toggles.has('sage_mode')) rate += 2;
  if (d.eyeOn && (d.eye === 'rinnegan' || d.eye === 'rinne_sharingan')) rate += 2;
  if (worn(p, EquipmentSlot.Head) === ITEM.leafHeadband) rate *= 1.1;
  if (worn(p, EquipmentSlot.Chest) === ITEM.akatsukiCloak) rate *= 1.2;
  if (worn(p, EquipmentSlot.Head) === ITEM.kageHat) rate *= 1.15;
  return rate;
}

function upkeep() {
  for (const p of world.getAllPlayers()) {
    const r = rt(p);
    if (!r.toggles.size) continue;
    const ctx = ctxFor(p);
    for (const id of [...r.toggles]) {
      const j = JUTSU.get(id);
      if (!j?.toggle) {
        r.toggles.delete(id);
        continue;
      }
      const lost = !meets(ctx.d, j).ok || (j.active && !r.toggles.has(j.active));
      if (lost || (j.toggle.upkeep && !spendChakra(p, j.toggle.upkeep))) {
        r.toggles.delete(id);
        j.toggle.onEnd?.(p);
        tell(p, `§7${j.name} faded${lost ? '' : ' (out of chakra)'}.`);
        continue;
      }
      try {
        j.toggle.onSecond?.(ctx);
      } catch (err) {
        console.warn(`[shinobi] toggle ${id}: ${err}`);
      }
    }
    touch(p);
  }
}

const SAGE = rgb('#ff9a2a');

/** Chakra charging, natural-energy gathering and the HUD, every 5 ticks. */
function fast() {
  const now = system.currentTick;
  for (const p of world.getAllPlayers()) {
    const d = getData(p);
    const r = rt(p);
    let rate = regenRate(p);
    const pos = p.location;
    const still = r.lastPos ? Math.hypot(pos.x - r.lastPos.x, pos.z - r.lastPos.z) < 0.05 : false;
    r.lastPos = pos;
    const focusing = p.isSneaking && still && heldItem(p)?.typeId === ITEM.focus;
    let status = '';
    if (focusing) {
      r.gatherTicks += 5;
      if (d.learned.includes('sage_mode') && !r.toggles.has('sage_mode')) {
        if (r.gatherTicks > 30) {
          d.sageEnergy = Math.min(100, d.sageEnergy + 2.5);
          fx(p.dimension, PARTICLE.aura, pos, SAGE);
          status = `§6Natural energy ${Math.floor(d.sageEnergy)}%`;
          if (d.sageEnergy >= 100 && r.gatherTicks > 260) {
            status = '§c§lYou are turning into a toad! Stop!';
            effect(p, FX.slowness, 2, 3, false);
            effect(p, FX.nausea, 4, 0, false);
            if (now % 20 === 0) hurt(p, 1);
          }
        }
      } else {
        rate *= 3;
        if (now % 10 === 0) fx(p.dimension, PARTICLE.aura, pos);
        status = '§bCharging chakra...';
      }
    } else {
      r.gatherTicks = 0;
    }
    addChakra(p, rate / 4);
    if (d.hud) hud(p, status);
  }
}

/** @param {Player} p @param {string} status */
function hud(p, status) {
  const d = getData(p);
  const r = rt(p);
  const now = system.currentTick;
  const cur = Math.floor(getChakra(p));
  const max = maxChakra(p);
  const filled = Math.round((cur / max) * 20);
  const bar = `§b${'|'.repeat(filled)}§8${'|'.repeat(20 - filled)}`;
  const rank = RANKS[d.rank];
  const sel = JUTSU.get(d.slots[d.sel] ?? '');
  let jutsu = '';
  if (sel) {
    const cd = cooldownLeft(p, sel.id);
    const on = r.toggles.has(sel.id);
    jutsu = `§e${sel.name}${on ? ' §a[ON]' : cd ? ` §c${secs(cd)}s` : ''}`;
  }
  const tags = [];
  if (d.eyeOn && d.eye) tags.push(`${DOJUTSU[d.eye]?.color ?? '§c'}${DOJUTSU[d.eye]?.name ?? d.eye}`);
  for (const t of r.toggles) tags.push(`§d${JUTSU.get(t)?.name.split(' ')[0] ?? t}`);
  if (d.karma && d.karmaEnergy > 0) tags.push(`§5Karma ${Math.floor(d.karmaEnergy)}`);
  let line2 = status;
  if (now < r.sealsUntil) line2 = `§f${r.seals}`;
  const top = `§bChakra ${bar} §f${cur}/${max}  ${rank.color}${rank.name}  ${jutsu}${tags.length ? '  ' + tags.join(' ') : ''}`;
  try {
    p.onScreenDisplay.setActionBar(line2 ? `${top}\n${line2}` : top);
  } catch {}
}

export function startCasting() {
  system.runInterval(upkeep, 20);
  system.runInterval(fast, 5);
}

/** Turn everything off (death, release, reroll). @param {Player} p */
export function dropToggles(p) {
  const r = rt(p);
  for (const id of r.toggles) JUTSU.get(id)?.toggle?.onEnd?.(p);
  r.toggles.clear();
  r.charged = null;
}
