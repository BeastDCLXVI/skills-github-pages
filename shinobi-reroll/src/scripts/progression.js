import { EquipmentSlot } from '@minecraft/server';
import { CLANS, DOJUTSU, RANKS } from './data.js';
import { ITEM, PARTICLE, SOUND } from './ids.js';
import { deed, onRankUp, xpMult } from './innerpath.js';
import { JUTSU, learnCost, meets } from './jutsu/index.js';
import { TOGGLE_POWER } from './jutsu/forge.js';
import { rt } from './state.js';
import { getData, loadoutSize, maxChakra, natureSlots, setChakra, touch } from './store.js';
import { fx, ping, settings, tell, title, worn } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

const JP_EVERY_XP = 250;

/** Damage multiplier applied to every jutsu the player casts. @param {Player} p */
export function power(p) {
  const d = getData(p);
  const r = rt(p);
  let m = 1 + d.rank * 0.12;
  if (r.toggles.has('sage_mode')) m += 0.5;
  if (r.toggles.has('tailed_beast_cloak')) m += 0.15 + d.sync / 400;
  if (r.toggles.has('karma_mode')) m += 0.4;
  if (r.toggles.has('lightning_armor')) m += 0.15;
  if (r.toggles.has('tenseigan_mode')) m += 0.4;
  if (r.toggles.has('white_karma')) m += 0.35;
  for (const t of r.toggles) m += TOGGLE_POWER.get(t) ?? 0;
  if (d.ascended) m += 0.4;
  if (worn(p, EquipmentSlot.Head) === ITEM.rogueHeadband) m += 0.1;
  return m;
}

/** @param {Player} p @param {number} amount */
export function addXp(p, amount) {
  if (amount <= 0) return;
  const d = getData(p);
  const before = d.xp;
  d.xp += Math.max(1, Math.round(amount * (CLANS[d.clan]?.xpMult ?? 1) * xpMult(d) * settings().xpRate));
  const milestones = Math.floor(d.xp / JP_EVERY_XP) - Math.floor(before / JP_EVERY_XP);
  if (milestones > 0) {
    d.jp += milestones;
    tell(p, `§e+${milestones} Jutsu Point${milestones > 1 ? 's' : ''} §7(open the Shinobi Scroll to learn jutsu)`);
  }
  while (d.rank < RANKS.length - 1 && d.xp >= RANKS[d.rank + 1].xp) {
    d.rank++;
    const gain = 3 + (d.clan === 'none' ? 1 : 0);
    d.jp += gain;
    const r = RANKS[d.rank];
    title(p, `${r.color}${r.name}`, `§e+${gain} Jutsu Points · max chakra ${maxChakra(p)}`, 60);
    ping(p, SOUND.levelup, 0.8);
    fx(p.dimension, PARTICLE.burst, p.location);
    tell(p, `§6Rank up! You are now a ${r.color}${r.name}§6. Loadout slots: ${loadoutSize(d)}, nature slots: ${natureSlots(d)}.`);
    setChakra(p, maxChakra(p));
    onRankUp(p);
  }
  touch(p);
  checkAwakening(p);
}

/** Bloodline eyes awaken on their own as the shinobi grows. @param {Player} p */
export function checkAwakening(p) {
  const d = getData(p);
  const clanEye = CLANS[d.clan]?.dojutsu;
  if (!d.eye && clanEye === 'byakugan') {
    d.eye = 'byakugan';
    d.eyeStage = 1;
    title(p, '§fByakugan', '§7Your bloodline awakens. Sneak + jump to activate it.', 70);
  }
  if (!d.eye && clanEye === 'sharingan' && d.rank >= 1) {
    d.eye = 'sharingan';
    d.eyeStage = 1;
    title(p, '§cSharingan', '§7One tomoe stirs in your eyes. Sneak + jump to activate it.', 70);
    ping(p, SOUND.curse, 1.6);
  }
  syncAutoJutsu(p);
  touch(p);
}

/** Grant / revoke the jutsu that come with eyes, beasts and seals. @param {Player} p */
export function syncAutoJutsu(p) {
  const d = getData(p);
  for (const j of JUTSU.values()) {
    if (!j.auto) continue;
    const has = d.learned.includes(j.id);
    const ok = meets(d, j).ok;
    if (ok && !has) {
      d.learned.push(j.id);
      if (d.slots.length < loadoutSize(d)) d.slots.push(j.id);
      tell(p, `§dNew technique: §f${j.name}`);
    } else if (!ok && has) {
      d.learned = d.learned.filter((x) => x !== j.id);
      d.slots = d.slots.filter((x) => x !== j.id);
      rt(p).toggles.delete(j.id);
    }
  }
  d.sel = Math.min(d.sel, Math.max(0, d.slots.length - 1));
  touch(p);
}

/** @param {Player} p @param {string} id @returns {string | null} error message */
export function learn(p, id) {
  const d = getData(p);
  const j = JUTSU.get(id);
  if (!j || j.auto) return 'That technique cannot be learned this way.';
  if (d.learned.includes(id)) return 'Already learned.';
  const m = meets(d, j);
  if (!m.ok) return `Cannot learn ${j.name}: ${m.why}.`;
  const cost = learnCost(j);
  if (d.jp < cost) return `Not enough Jutsu Points (${d.jp}/${cost}).`;
  d.jp -= cost;
  d.learned.push(id);
  if (d.slots.length < loadoutSize(d)) d.slots.push(id);
  touch(p);
  deed(p, 'learn');
  return null;
}

/** Remove clan-locked techniques after a reroll and refund their points. @param {Player} p */
export function purgeInvalidJutsu(p) {
  const d = getData(p);
  let refund = 0;
  d.learned = d.learned.filter((id) => {
    const j = JUTSU.get(id);
    if (!j || j.auto) return true;
    if (meets(d, j).ok || !(j.clan || j.kekkei)) return true;
    refund += learnCost(j);
    return false;
  });
  d.slots = d.slots.filter((id) => d.learned.includes(id));
  d.jp += refund;
  if (refund) tell(p, `§7Clan techniques you can no longer use were forgotten (§e+${refund} JP§7 refunded).`);
  touch(p);
}

/** Eyes that come from a bloodline (reset when the clan changes); the rest come from fruit or Karma. */
const CLAN_EYES = new Set(['byakugan', 'sharingan', 'mangekyo']);

/**
 * Move a shinobi to another clan: drop clan-only techniques and bloodline eyes
 * that no longer apply, then awaken whatever the new bloodline grants.
 * @param {Player} p @param {string} clan
 */
export function changeClan(p, clan) {
  const d = getData(p);
  const oldEye = CLANS[d.clan]?.dojutsu;
  d.clan = clan;
  rt(p).toggles.clear();
  rt(p).charged = null;
  if (d.eye && CLAN_EYES.has(d.eye) && oldEye !== CLANS[clan]?.dojutsu) {
    d.eye = null;
    d.eyeOn = false;
    d.eyeStage = 0;
    d.eyeXp = 0;
    d.strain = 0;
  }
  purgeInvalidJutsu(p);
  checkAwakening(p);
  touch(p);
}

/** @param {string | null} eye */
export const eyeName = (eye) => (eye ? DOJUTSU[eye]?.name ?? eye : 'None');
