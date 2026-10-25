import { world } from '@minecraft/server';
import { ENTITY, ITEM, SOUND } from './ids.js';
import { deed, missionMult } from './innerpath.js';
import { addXp } from './progression.js';
import { getData, touch } from './store.js';
import { countItem, give, ping, pick, takeItem, tell, title } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('./store.js').Mission} Mission */

/**
 * Mission templates. `target` is an entity id, `family:<name>` for any entity of a family,
 * an item id for gather missions, or `any` for cast / train missions.
 * @type {Array<{ rank: number, grade: string, kind: Mission['kind'], target: string, label: string,
 *   n: [number, number], ryo: number, xp: number, jp?: number }>}
 */
const TEMPLATES = [
  { rank: 0, grade: 'D', kind: 'hunt', target: 'minecraft:zombie', label: 'Clear zombies from the village outskirts', n: [4, 8], ryo: 3, xp: 20 },
  { rank: 0, grade: 'D', kind: 'hunt', target: 'minecraft:spider', label: 'Exterminate the giant spiders', n: [3, 6], ryo: 3, xp: 20 },
  { rank: 0, grade: 'D', kind: 'gather', target: 'minecraft:wheat', label: 'Help the farmers with the harvest', n: [12, 24], ryo: 3, xp: 15 },
  { rank: 0, grade: 'D', kind: 'gather', target: 'minecraft:oak_log', label: 'Gather timber for the academy', n: [8, 16], ryo: 3, xp: 15 },
  { rank: 0, grade: 'D', kind: 'train', target: 'any', label: 'Complete a Training Post regimen', n: [20, 40], ryo: 2, xp: 15 },
  { rank: 1, grade: 'C', kind: 'hunt', target: ENTITY.rogue, label: 'Escort duty: drive off rogue ninja', n: [2, 4], ryo: 8, xp: 45 },
  { rank: 1, grade: 'C', kind: 'gather', target: ITEM.crystal, label: 'Deliver chakra crystals to the Hokage', n: [4, 8], ryo: 9, xp: 40 },
  { rank: 1, grade: 'C', kind: 'cast', target: 'any', label: 'Practise your ninjutsu', n: [15, 30], ryo: 6, xp: 40 },
  { rank: 1, grade: 'C', kind: 'hunt', target: 'minecraft:skeleton', label: 'Patrol the borders at night', n: [5, 8], ryo: 7, xp: 40 },
  { rank: 2, grade: 'B', kind: 'hunt', target: ENTITY.zetsu, label: 'Investigate the White Zetsu sightings', n: [5, 9], ryo: 14, xp: 90 },
  { rank: 2, grade: 'B', kind: 'gather', target: 'shinobi:zetsu_spore', label: 'Bring Zetsu samples to the research lab', n: [4, 8], ryo: 14, xp: 80 },
  { rank: 2, grade: 'B', kind: 'hunt', target: 'minecraft:creeper', label: 'Defuse the walking explosive tags', n: [3, 6], ryo: 12, xp: 80 },
  { rank: 2, grade: 'B', kind: 'hunt', target: ENTITY.clawGrime, label: 'Track down the Claw Grime hunting chakra', n: [2, 4], ryo: 16, xp: 100 },
  { rank: 3, grade: 'A', kind: 'hunt', target: ENTITY.akatsuki, label: 'Intercept an Akatsuki operative', n: [1, 2], ryo: 30, xp: 220, jp: 1 },
  { rank: 3, grade: 'A', kind: 'hunt', target: 'family:akatsuki_boss', label: 'Bingo Book: defeat an S-rank criminal', n: [1, 1], ryo: 45, xp: 320, jp: 1 },
  { rank: 4, grade: 'S', kind: 'hunt', target: 'family:bijuu', label: 'Subdue a rampaging tailed beast', n: [1, 1], ryo: 80, xp: 600, jp: 2 },
  { rank: 5, grade: 'S', kind: 'hunt', target: 'family:otsutsuki', label: 'Repel the Otsutsuki invasion', n: [1, 1], ryo: 120, xp: 900, jp: 3 },
  { rank: 5, grade: 'S', kind: 'hunt', target: 'family:kara_inner', label: 'Bingo Book: Code of the Kara Inner (use a Kara Inner Mark)', n: [1, 1], ryo: 150, xp: 1000, jp: 3 },
];

export const GRADE_COLOR = { D: '§a', C: '§2', B: '§9', A: '§5', S: '§6' };

/** @returns {Mission} */
function roll(t) {
  const need = t.n[0] + Math.floor(Math.random() * (t.n[1] - t.n[0] + 1));
  const scale = need / t.n[0];
  return {
    id: `${t.kind}:${t.target}:${need}`, grade: t.grade, kind: t.kind, target: t.target, label: t.label, need, have: 0,
    ryo: Math.round(t.ryo * scale), xp: Math.round(t.xp * scale), jp: t.jp ?? 0,
  };
}

/** Today's three offers, re-rolled every in-game day. @param {Player} p */
export function board(p) {
  const d = getData(p);
  const day = world.getDay();
  if (d.boardDay !== day || d.board.length === 0) {
    const fitting = TEMPLATES.filter((t) => t.rank <= d.rank && t.rank >= d.rank - 2);
    const pool = fitting.length ? fitting : TEMPLATES.filter((t) => t.rank === 0);
    /** @type {Mission[]} */
    const offers = [];
    for (let i = 0; i < 12 && offers.length < 3; i++) {
      const m = roll(pick(pool));
      if (!offers.some((o) => o.kind === m.kind && o.target === m.target)) offers.push(m);
    }
    d.board = offers;
    d.boardDay = day;
    touch(p);
  }
  return d.board;
}

/** @param {Player} p @param {number} index */
export function accept(p, index) {
  const d = getData(p);
  const offer = board(p)[index];
  if (!offer) return false;
  if (d.mission) {
    tell(p, '§cFinish or abandon your current mission first.');
    return false;
  }
  d.mission = { ...offer, have: 0 };
  d.board = d.board.filter((_, i) => i !== index);
  touch(p);
  title(p, `${GRADE_COLOR[offer.grade]}${offer.grade}-rank mission`, `§f${offer.label}`, 50);
  ping(p, SOUND.click, 1.2);
  return true;
}

/** @param {Player} p */
export function abandon(p) {
  const d = getData(p);
  if (!d.mission) return;
  tell(p, `§7Mission abandoned: ${d.mission.label}`);
  d.mission = null;
  touch(p);
  deed(p, 'abandon');
}

/** @param {Mission} m @param {Entity} e */
function matchesTarget(m, e) {
  if (m.target.startsWith('family:')) return e.matches({ families: [m.target.slice(7)] });
  return e.typeId === m.target;
}

/**
 * Advance the active mission.
 * @param {Player} p @param {'hunt' | 'cast' | 'train'} kind @param {Entity} [victim]
 */
export function advance(p, kind, victim) {
  const d = getData(p);
  const m = d.mission;
  if (!m || m.kind !== kind || m.have >= m.need) return;
  if (kind === 'hunt' && (!victim || !matchesTarget(m, victim))) return;
  m.have++;
  touch(p);
  if (m.have >= m.need) {
    title(p, '§aMission complete!', '§7Report via Shinobi Scroll › Missions', 50);
    ping(p, SOUND.levelup, 1.4);
  } else if (kind === 'hunt') {
    p.onScreenDisplay.setActionBar(`§7Mission: §f${m.have}/${m.need}`);
  }
}

/** Progress shown in menus (gather missions count the inventory). @param {Player} p */
export function progressOf(p) {
  const m = getData(p).mission;
  if (!m) return { have: 0, need: 0 };
  if (m.kind === 'gather') return { have: Math.min(m.need, countItem(p, m.target)), need: m.need };
  return { have: m.have, need: m.need };
}

/** Claim the reward if the mission is done. @param {Player} p */
export function turnIn(p) {
  const d = getData(p);
  const m = d.mission;
  if (!m) return false;
  const { have, need } = progressOf(p);
  if (have < need) {
    tell(p, `§cNot done yet: ${have}/${need}.`);
    return false;
  }
  if (m.kind === 'gather' && !takeItem(p, m.target, need)) return false;
  d.mission = null;
  d.missionsDone++;
  const mult = missionMult(d);
  const ryo = Math.round(m.ryo * mult);
  const xp = Math.round(m.xp * mult);
  give(p, ITEM.ryo, ryo);
  if (m.jp) d.jp += m.jp;
  addXp(p, xp);
  touch(p);
  title(p, `${GRADE_COLOR[m.grade]}${m.grade}-rank complete`, `§e+${ryo} Ryo · +${xp} XP${m.jp ? ` · +${m.jp} JP` : ''}`, 60);
  ping(p, SOUND.coins, 1.0);
  deed(p, 'mission');
  return true;
}

/** Operator helper: finish the current mission instantly. @param {Player} p */
export function forceComplete(p) {
  const m = getData(p).mission;
  if (m) m.have = m.need;
}

/** Operator helper: roll a fresh board. @param {Player} p */
export function rerollBoard(p) {
  getData(p).boardDay = -1;
  return board(p);
}
