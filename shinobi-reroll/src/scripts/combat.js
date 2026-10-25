import { EntityDamageCause, EquipmentSlot, Player, system, world } from '@minecraft/server';
import { bijuuByKey } from './data.js';
import { dropToggles, flash } from './casting.js';
import { sharinganXp, tryMangekyo } from './dojutsu.js';
import { ENTITY, FX, ITEM, PARTICLE, SOUND } from './ids.js';
import { releaseCharged } from './jutsu/index.js';
import { deed, onAllyHurt, onCompanionDeath, onHurt, onKill, onPlayerDeath, trainingRank } from './innerpath.js';
import { advance } from './missions.js';
import { zetsuSplit } from './npc.js';
import { paperBomb } from './projectiles.js';
import { addXp, power } from './progression.js';
import { cooldownLeft, rt, setCooldown } from './state.js';
import { addChakra, getChakra, getData, setChakra, touch } from './store.js';
import {
  add, dist, effect, enemiesAround, eyes, fx, give, heal, health, healthFraction, heldItem, hurt, isPlayer, ownerId,
  rgb, sound, tell, title, v3, valid,
} from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */

const XP_BY_TYPE = {
  [ENTITY.rogue]: 12, [ENTITY.akatsuki]: 45, [ENTITY.zetsu]: 5, [ENTITY.leaf]: 3, [ENTITY.momoshiki]: 700,
  [ENTITY.juubi]: 1200, [ENTITY.code]: 800, [ENTITY.clawGrime]: 15,
};

/** Resolve the player responsible for a hit (directly, via projectile, or via summon). @param {Entity | undefined} e */
function responsiblePlayer(e) {
  if (!e || !valid(e)) return undefined;
  if (e instanceof Player) return e;
  const owner = ownerId(e);
  if (owner) return world.getAllPlayers().find((p) => p.id === owner);
  return undefined;
}

// ------------------------------------------------------------------ hits dealt by players

/** @param {import('@minecraft/server').Player} p @param {Entity} target */
function onPlayerHit(p, target) {
  if (target.typeId === ENTITY.post) {
    trainingHit(p, target);
    return;
  }
  const d = getData(p);
  releaseCharged(p, target, power(p));
  sharinganXp(p);
  const held = heldItem(p)?.typeId;
  switch (held) {
    case ITEM.samehada:
      addChakra(p, 8);
      heal(p, 1);
      if (isPlayer(target)) setChakra(target, getChakra(target) - 12);
      fx(p.dimension, PARTICLE.burst, eyes(target), rgb('#5d7e99'));
      break;
    case ITEM.kubikiribocho:
      heal(p, 1);
      repairHeld(p, 6);
      break;
    case ITEM.kusanagi:
      if (d.natures.includes('lightning') && getChakra(p) >= 5) {
        setChakra(p, getChakra(p) - 5);
        hurt(target, 4 * power(p), p, EntityDamageCause.lightning);
        fx(p.dimension, PARTICLE.sparks, eyes(target), rgb('#cfe4ff'));
      }
      break;
    case ITEM.chakraBlade:
      if (d.natures.includes('wind') && getChakra(p) >= 4) {
        setChakra(p, getChakra(p) - 4);
        hurt(target, 4 * power(p), p);
        fx(p.dimension, PARTICLE.shockwave, target.location, rgb('#c8ffe8'));
      }
      break;
    case ITEM.kiba:
      if (getChakra(p) >= 4) {
        setChakra(p, getChakra(p) - 4);
        hurt(target, 3 * power(p), p, EntityDamageCause.lightning);
        for (const e of enemiesAround(p, target.location, 5).filter((e) => e.id !== target.id).slice(0, 2)) {
          hurt(e, 4 * power(p), p, EntityDamageCause.lightning);
          fx(p.dimension, PARTICLE.sparks, eyes(e), rgb('#9fc8ff'));
        }
        fx(p.dimension, PARTICLE.sparks, eyes(target), rgb('#9fc8ff'));
      }
      break;
    case ITEM.nuibari:
      effect(target, FX.slowness, 3, 2);
      for (const e of enemiesAround(p, target.location, 3).filter((e) => e.id !== target.id)) {
        effect(e, FX.slowness, 3, 2);
        hurt(e, 2, p);
      }
      break;
    case ITEM.shibuki:
      if (Math.random() < 0.25) paperBomb(p, p.dimension, eyes(target), 8, 3);
      break;
    case ITEM.hiramekarei: {
      const r = rt(p);
      r.bladeCharge = Math.min(5, r.bladeCharge + 1);
      flash(p, `§bHiramekarei stores chakra: ${r.bladeCharge}/5`);
      break;
    }
    default:
      break;
  }
  if (rt(p).toggles.has('white_karma')) {
    hurt(target, 4 * power(p), p);
    fx(p.dimension, PARTICLE.mark, eyes(target), rgb('#f4f0e8'));
  }
  if (rt(p).toggles.has('baryon_mode')) {
    hurt(target, 6 * power(p), p);
    heal(p, 2);
    fx(p.dimension, PARTICLE.burst, eyes(target), rgb('#ff6aa8'));
  }
  if (d.clan === 'aburame' && isPlayer(target)) {
    setChakra(target, getChakra(target) - 4);
    addChakra(p, 2);
  }
  touch(p);
}

/** @param {import('@minecraft/server').Player} p @param {number} amount */
function repairHeld(p, amount) {
  const eq = p.getComponent('minecraft:equippable');
  const slot = eq?.getEquipmentSlot(EquipmentSlot.Mainhand);
  const item = slot?.getItem();
  const dur = item?.getComponent('minecraft:durability');
  if (!slot || !item || !dur) return;
  dur.damage = Math.max(0, dur.damage - amount);
  slot.setItem(item);
}

/** @param {import('@minecraft/server').Player} p @param {Entity} post */
function trainingHit(p, post) {
  if (p.isSneaking) {
    fx(post.dimension, PARTICLE.smoke, post.location);
    try {
      post.remove();
    } catch {}
    give(p, 'shinobi:training_post', 1);
    return;
  }
  fx(post.dimension, PARTICLE.burst, add(post.location, v3(0, 1.2, 0)), rgb('#e2c26a'));
  if (cooldownLeft(p, 'training') > 0) return;
  setCooldown(p, 'training', 20);
  const d = getData(p);
  const learning = d.rank < trainingRank(d);
  if (learning) addXp(p, 1);
  advance(p, 'train');
  deed(p, 'train');
  sound(post.dimension, SOUND.wood, post.location, 1.4, 0.4);
  flash(p, `§6Training... §7(${d.xp} XP${learning ? '' : ', you have outgrown the post'})`);
}

// ------------------------------------------------------------------ damage taken

/** @param {import('@minecraft/server').Player} p @param {number} damage @param {import('@minecraft/server').EntityDamageSource} src */
function onPlayerHurt(p, damage, src) {
  const d = getData(p);
  const r = rt(p);
  const now = system.currentTick;
  const physical = src.cause === EntityDamageCause.entityAttack || src.cause === EntityDamageCause.projectile;
  if (now < r.intangibleUntil && physical) {
    heal(p, damage);
    return;
  }
  if (physical && d.eyeOn && ['sharingan', 'mangekyo', 'rinne_sharingan'].includes(d.eye ?? '')) {
    const chance = d.eye === 'sharingan' ? [0, 0.1, 0.18, 0.25][d.eyeStage] : 0.3;
    if (Math.random() < chance) {
      heal(p, damage);
      fx(p.dimension, PARTICLE.tomoe, eyes(p), rgb('#d01020'));
      flash(p, '§cSharingan: §fattack foreseen!');
      return;
    }
  }
  if (r.toggles.has('karma_mode') && Math.random() < 0.3) {
    heal(p, damage);
    d.karmaEnergy = Math.min(80, d.karmaEnergy + damage * 2);
    fx(p.dimension, PARTICLE.burst, eyes(p), rgb('#9a4ad0'));
  }
  if (src.cause === EntityDamageCause.projectile && now < r.absorbUntil) {
    heal(p, damage);
    addChakra(p, damage * 3);
  }
  if (d.bijuu && healthFraction(p) < 0.3 && cooldownLeft(p, 'beast_save') === 0) {
    setCooldown(p, 'beast_save', 1200);
    const b = bijuuByKey(d.bijuu);
    effect(p, FX.regeneration, 6, 2);
    effect(p, FX.resistance, 4, 1);
    tell(p, `§6${b?.name ?? 'Your tailed beast'} lends you its chakra!`);
    fx(p.dimension, PARTICLE.aura, p.location, rgb(b?.hex ?? '#e2701f'));
  }
  onHurt(p);
  touch(p);
}

// ------------------------------------------------------------------ deaths

/** @param {Entity} dead @param {import('@minecraft/server').EntityDamageSource} src */
function onDeath(dead, src) {
  const typeId = dead.typeId;
  if (dead instanceof Player) {
    dropToggles(dead);
    onPlayerDeath(dead);
    const d = getData(dead);
    d.eyeOn = false;
    touch(dead);
    return;
  }
  const killer = responsiblePlayer(src.damagingEntity) ?? responsiblePlayer(src.damagingProjectile);
  // Mangekyo: an Uchiha whose companion dies before their eyes
  const owner = ownerId(dead);
  const ownerPlayer = owner ? world.getAllPlayers().find((x) => x.id === owner) : undefined;
  if (ownerPlayer) onCompanionDeath(ownerPlayer, dead);
  if (ownerPlayer && (dead.typeId === 'minecraft:wolf' || dead.typeId === ENTITY.leaf)) {
    try {
      if (ownerPlayer.dimension.id === dead.dimension.id && dist(ownerPlayer.location, dead.location) < 32) tryMangekyo(ownerPlayer);
    } catch {}
  }
  const bijuu = bijuuByKey(typeId.split(':')[1] ?? '');
  if (bijuu || typeId === ENTITY.juubi || typeId === ENTITY.momoshiki || typeId === ENTITY.code) {
    const name = bijuu?.name ?? ({ [ENTITY.juubi]: 'The Ten-Tails', [ENTITY.code]: 'Code of the Kara Inner' })[typeId] ?? 'Momoshiki Otsutsuki';
    world.sendMessage(`§6${name} has fallen${killer ? ` to ${killer.name}` : ''}!`);
  }
  if (!killer) return;
  const d = getData(killer);
  d.kills++;
  onKill(killer, dead);
  let xp = XP_BY_TYPE[typeId];
  if (bijuu) xp = 150 + bijuu.tails * 40;
  if (xp === undefined) {
    if (!dead.matches({ families: ['monster'] })) {
      advance(killer, 'hunt', dead);
      return touch(killer);
    }
    const max = health(dead)?.effectiveMax ?? 20;
    xp = Math.max(2, Math.min(20, Math.round(max / 5)));
  }
  advance(killer, 'hunt', dead);
  addXp(killer, xp);
  if (bijuu || typeId === ENTITY.juubi || typeId === ENTITY.momoshiki || typeId === ENTITY.code) title(killer, '§6Victory', `§e+${xp} XP`, 50);
}

export function startCombat() {
  world.afterEvents.entityHitEntity.subscribe((ev) => {
    if (!valid(ev.hitEntity)) return;
    if (ev.damagingEntity instanceof Player) onPlayerHit(ev.damagingEntity, ev.hitEntity);
    else if (ev.damagingEntity?.typeId === ENTITY.puppet) effect(ev.hitEntity, FX.poison, 3, 1);
    else if (ev.damagingEntity?.typeId === ENTITY.clawGrime && ev.hitEntity instanceof Player) {
      // Claw Grime hunt chakra: every claw drains some
      setChakra(ev.hitEntity, getChakra(ev.hitEntity) - 10);
      flash(ev.hitEntity, '§8The Claw Grime devours your chakra!', 30);
    }
  });
  world.afterEvents.entityHurt.subscribe((ev) => {
    const e = ev.hurtEntity;
    if (!valid(e)) return;
    if (e instanceof Player) onPlayerHurt(e, ev.damage, ev.damageSource);
    else if (e.typeId === ENTITY.zetsu) zetsuSplit(e);
    if (valid(e) && (e instanceof Player || ownerId(e))) onAllyHurt(e);
  });
  world.afterEvents.entityDie.subscribe((ev) => onDeath(ev.deadEntity, ev.damageSource));
}
