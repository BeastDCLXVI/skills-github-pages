import { GameMode, system, world } from '@minecraft/server';
import { ENTITY, PARTICLE, SOUND } from './ids.js';
import { notifyCast } from './casting.js';
import { addXp } from './progression.js';
import { spawnOrb, throwTool } from './projectiles.js';
import { fan, summonsOf, tickSummons } from './jutsu/core.js';
import { add, eyes, flatDir, fx, heal, mul, norm, pick, rgb, settings, sub, v3, valid } from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Player} Player */

/** @param {Entity} from @param {Entity} to */
const aim = (from, to) => norm(sub(eyes(to), eyes(from)));

/** @param {Entity} npc @param {number} range */
function nearestPlayer(npc, range) {
  try {
    return npc.dimension.getPlayers({
      location: npc.location, maxDistance: range, excludeGameModes: [GameMode.Creative, GameMode.Spectator], closest: 1,
    })[0];
  } catch {
    return undefined;
  }
}

/** @param {Entity} npc @param {number} range */
function nearestMonster(npc, range) {
  try {
    return npc.dimension.getEntities({
      location: npc.location, maxDistance: range, families: ['monster'], excludeFamilies: ['shinobi_boss'], closest: 1,
    })[0];
  } catch {
    return undefined;
  }
}

/** @param {Entity} npc */
function rogueBrain(npc) {
  const t = nearestPlayer(npc, 14);
  if (!t || Math.random() > 0.25) return;
  spawnOrb(npc, { element: 'fire', size: 3, speed: 1.3, damage: 6, radius: 2, fire: 4, dir: aim(npc, t), sound: SOUND.fire });
  notifyCast(npc, 'great_fireball');
}

/** @param {Entity} npc */
function akatsukiBrain(npc) {
  const t = nearestPlayer(npc, 24);
  if (!t || Math.random() > 0.45) return;
  const move = pick(['fire_dragon', 'water_dragon', 'clay', 'vacuum', 'flicker']);
  const dir = aim(npc, t);
  switch (move) {
    case 'fire_dragon':
      for (let i = 0; i < 3; i++) {
        system.runTimeout(() => valid(npc) && spawnOrb(npc, { element: 'fire', size: 3, speed: 1.5, damage: 8, radius: 2, fire: 5, dir }), i * 4);
      }
      notifyCast(npc, 'fire_dragon');
      break;
    case 'water_dragon':
      spawnOrb(npc, { element: 'water', size: 4, speed: 1.3, damage: 10, radius: 3, knock: 2, dir, sound: SOUND.water });
      notifyCast(npc, 'water_dragon');
      break;
    case 'clay':
      for (const d of fan(dir, 3, 18)) {
        spawnOrb(npc, { element: 'earth', size: 1, speed: 1.1, damage: 7, radius: 2.5, explode: 1, color: '#f4efe0', dir: d, homing: t, life: 60, fizzleBoom: true });
      }
      break;
    case 'vacuum':
      spawnOrb(npc, { element: 'wind', size: 2, speed: 2.2, damage: 8, dir, sound: SOUND.whoosh });
      notifyCast(npc, 'vacuum_bullets');
      break;
    case 'flicker': {
      const to = add(t.location, mul(flatDir(t.location, npc.location), 2.5));
      fx(npc.dimension, PARTICLE.smoke, npc.location);
      npc.tryTeleport(to, { checkForBlocks: true, facingLocation: t.location });
      break;
    }
    default:
      break;
  }
}

/** @param {Entity} npc */
function leafBrain(npc) {
  const m = nearestMonster(npc, 12);
  if (!m || Math.random() > 0.35) return;
  if (Math.random() < 0.6) throwTool(npc, ENTITY.shuriken, aim(npc, m));
  else spawnOrb(npc, { element: 'fire', size: 2, speed: 1.4, damage: 6, fire: 3, dir: aim(npc, m), sound: SOUND.fire });
}

function think() {
  if (!settings().npcJutsu) return;
  const seen = new Set();
  for (const p of world.getAllPlayers()) {
    let list;
    try {
      list = p.dimension.getEntities({ location: p.location, maxDistance: 40, families: ['shinobi_npc'] });
    } catch {
      continue;
    }
    for (const npc of list) {
      if (seen.has(npc.id) || !valid(npc)) continue;
      seen.add(npc.id);
      try {
        if (npc.typeId === ENTITY.rogue) rogueBrain(npc);
        else if (npc.typeId === ENTITY.akatsuki) akatsukiBrain(npc);
        else if (npc.typeId === ENTITY.leaf) leafBrain(npc);
      } catch (err) {
        console.warn(`[shinobi] npc ${npc.typeId}: ${err}`);
      }
    }
  }
}

/** White Zetsu multiply when wounded. @param {Entity} zetsu */
export function zetsuSplit(zetsu) {
  if (Math.random() > 0.08) return;
  try {
    const near = zetsu.dimension.getEntities({ location: zetsu.location, maxDistance: 16, type: ENTITY.zetsu });
    if (near.length >= 8) return;
    const at = add(zetsu.location, v3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1));
    zetsu.dimension.spawnEntity(ENTITY.zetsu, at);
    fx(zetsu.dimension, PARTICLE.leaves, at);
  } catch {}
}

/** When a shadow clone dispels, its experience flows back to the original. */
function onSummonExpire(ownerId, kind) {
  if (kind !== ENTITY.clone) return;
  const owner = world.getAllPlayers().find((p) => p.id === ownerId);
  if (owner) addXp(owner, 1);
}

/** Katsuyu heals her summoner and nearby allies. */
function katsuyu() {
  for (const p of world.getAllPlayers()) {
    for (const s of summonsOf(p.id, ENTITY.slug)) {
      if (!valid(s.entity) || s.entity.dimension.id !== p.dimension.id) continue;
      const near = s.entity.dimension.getEntities({ location: s.entity.location, maxDistance: 10, families: ['shinobi_ally'] });
      for (const e of [p, ...near]) {
        if (Math.hypot(e.location.x - s.entity.location.x, e.location.z - s.entity.location.z) > 12) continue;
        heal(e, 2);
        fx(e.dimension, PARTICLE.aura, e.location, rgb('#7fff9a'));
      }
    }
  }
}

export function startNpc() {
  system.runInterval(think, 40);
  system.runInterval(katsuyu, 40);
  system.runInterval(() => tickSummons(onSummonExpire), 20);
}
