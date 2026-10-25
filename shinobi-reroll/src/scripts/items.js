import { EquipmentSlot, Player, system, world } from '@minecraft/server';
import { BIJUU } from './data.js';
import { ENTITY, FX, ITEM, PARTICLE, SOUND } from './ids.js';
import { becomeJinchuriki, releaseBijuu, summonBoss, trySeal } from './bosses.js';
import { castSelected, cycle } from './casting.js';
import { awaken } from './dojutsu.js';
import { addXp, syncAutoJutsu } from './progression.js';
import { liveOrbs, paperBomb, reflectOrb, spawnOrb, throwTool } from './projectiles.js';
import { cooldownLeft, rt, setCooldown } from './state.js';
import { addChakra, getData, maxChakra, setChakra, touch } from './store.js';
import { bijuuSummonMenu, jutsuWheel, mainMenu, rerollClan } from './ui.js';
import {
  add, consumeHeld, countItem, dist, effect, enemiesAround, eyes, fx, hurt, isCreative, knock, later,
  lookBlock, ping, rgb, sound, takeItem, tell, title, v3, valid,
} from './util.js';

/** @typedef {import('@minecraft/server').ItemStack} ItemStack */

const THROWABLE = {
  [ITEM.kunai]: ENTITY.kunai,
  [ITEM.explosiveKunai]: ENTITY.explosiveKunai,
  [ITEM.shuriken]: ENTITY.shuriken,
  [ITEM.fuma]: ENTITY.fuma,
  [ITEM.senbon]: ENTITY.senbon,
  [ITEM.smokeBomb]: ENTITY.smokeBomb,
};

const ORBS = new Map(BIJUU.map((b) => [`shinobi:${b.key}_chakra`, b.key]));
const KOTE_ELEMENTS = ['fire', 'wind', 'lightning', 'water', 'earth'];

/** @param {Player} p @param {string} entityId */
function throwHeld(p, entityId) {
  const r = rt(p);
  if (system.currentTick - r.lastThrow < 5) return;
  r.lastThrow = system.currentTick;
  const d = getData(p);
  const triple = entityId === ENTITY.shuriken && p.isSneaking && d.rank >= 1;
  if (triple) {
    for (const yaw of [-10, 0, 10]) {
      const dir = p.getViewDirection();
      const r2 = (yaw * Math.PI) / 180;
      throwTool(p, entityId, v3(dir.x * Math.cos(r2) - dir.z * Math.sin(r2), dir.y, dir.x * Math.sin(r2) + dir.z * Math.cos(r2)));
    }
  } else {
    throwTool(p, entityId);
  }
  if (entityId === ENTITY.senbon) for (let i = 0; i < 2; i++) later(2 + i * 2, () => valid(p) && throwTool(p, entityId));
  sound(p.dimension, entityId === ENTITY.fuma ? SOUND.whoosh : SOUND.throw, p.location, 1.3, 0.6);
  if (!isCreative(p)) {
    consumeHeld(p);
    if (triple) {
      takeItem(p, ITEM.shuriken, Math.min(2, countItem(p, ITEM.shuriken)));
    }
  }
}

/** Plant an explosive tag on the block you look at. @param {Player} p */
function plantTag(p) {
  const hit = lookBlock(p, 6);
  if (!hit) {
    tell(p, '§7Look at a nearby surface to plant the tag.');
    return;
  }
  const at = add(hit.block.location, v3(0.5, 1.05, 0.5));
  let tag;
  try {
    tag = p.dimension.spawnEntity(ENTITY.paperBomb, at);
  } catch {
    return;
  }
  consumeHeld(p);
  sound(p.dimension, SOUND.fizz, at, 1.6, 0.6);
  const dim = p.dimension;
  let i = 0;
  const run = system.runInterval(() => {
    if (++i < 6) {
      fx(dim, PARTICLE.sparks, at, rgb('#ffb43a'));
      return;
    }
    system.clearRun(run);
    try {
      if (valid(tag)) tag.remove();
    } catch {}
    paperBomb(valid(p) ? p : undefined, dim, at, 12, 4);
  }, 10);
}

/** Uchiha Return: blast away foes and send jutsu back. @param {Player} p */
function gunbai(p) {
  if (cooldownLeft(p, 'gunbai') > 0) return;
  setCooldown(p, 'gunbai', 120);
  fx(p.dimension, PARTICLE.shockwave, p.location, rgb('#c0262b'));
  sound(p.dimension, SOUND.wind, p.location, 0.9);
  for (const e of enemiesAround(p, p.location, 6)) {
    knock(e, p.location, 2.6, 0.5);
    hurt(e, 4, p);
  }
  for (const o of liveOrbs()) {
    if (o.caster.id !== p.id && valid(o.entity) && dist(o.entity.location, p.location) < 7) reflectOrb(o, p);
  }
}

/** Boruto's scientific ninja tool. @param {Player} p @param {ItemStack} stack */
function kote(p, stack) {
  const r = rt(p);
  if (p.isSneaking) {
    r.koteMode = (r.koteMode + 1) % KOTE_ELEMENTS.length;
    title(p, ' ', `§bKote loaded: §f${KOTE_ELEMENTS[r.koteMode]} scroll`, 20);
    ping(p, SOUND.click, 1.4);
    return;
  }
  if (cooldownLeft(p, 'kote') > 0) return;
  if (!takeItem(p, ITEM.cartridge, 1)) {
    tell(p, '§7Out of Jutsu Scroll Cartridges.');
    ping(p, SOUND.deny, 0.6);
    return;
  }
  setCooldown(p, 'kote', 16);
  const el = KOTE_ELEMENTS[r.koteMode];
  spawnOrb(p, { element: el, size: 2, speed: 1.9, damage: 8, radius: el === 'earth' ? 2 : 1, fire: el === 'fire' ? 4 : 0, sound: SOUND.blaze });
  if (!isCreative(p)) {
    const dur = stack.getComponent('minecraft:durability');
    const slot = p.getComponent('minecraft:equippable')?.getEquipmentSlot(EquipmentSlot.Mainhand);
    if (dur && slot) {
      if (dur.damage + 1 >= dur.maxDurability) {
        slot.setItem(undefined);
        sound(p.dimension, SOUND.anvil, p.location, 1.5, 0.6);
      } else {
        dur.damage += 1;
        slot.setItem(stack);
      }
    }
  }
}

/** Hashirama Cells: a gamble for Wood Release. @param {Player} p */
function implantCells(p) {
  const d = getData(p);
  if (d.clan === 'senju' || d.wood) {
    tell(p, '§7Your body already wields Wood Release.');
    return;
  }
  consumeHeld(p);
  if (Math.random() < 0.25) {
    effect(p, FX.poison, 10, 1);
    effect(p, FX.wither, 5, 0);
    title(p, '§cRejection', '§7Your body rejects the cells...', 50);
    return;
  }
  d.wood = true;
  touch(p);
  title(p, '§2Wood Release', '§7Hashirama\'s cells take root in you.', 60);
  fx(p.dimension, PARTICLE.leaves, p.location);
  ping(p, SOUND.levelup, 0.9);
}

/** @param {Player} p */
function acceptKarma(p) {
  const d = getData(p);
  if (d.karma) {
    tell(p, '§7The Karma already marks you.');
    return;
  }
  consumeHeld(p);
  d.karma = true;
  setChakra(p, maxChakra(p));
  title(p, '§5Karma', '§dAn Otsutsuki vessel mark spreads across your palm.', 80);
  world.sendMessage(`§5${p.name} has received the Karma.`);
  if (!d.eye && (d.clan === 'uzumaki' || d.clan === 'hyuga')) awaken(p, 'jogan', 1);
  syncAutoJutsu(p);
  touch(p);
}

/** The god tree's fruit. @param {Player} p */
function eatFruit(p) {
  const d = getData(p);
  if (d.ascended) {
    addChakra(p, 200);
    tell(p, '§7The fruit restores your celestial chakra.');
    return;
  }
  d.ascended = true;
  const eye = d.clan === 'uchiha' || d.clan === 'otsutsuki' ? 'rinne_sharingan' : d.clan === 'hyuga' ? 'tenseigan' : 'rinnegan';
  awaken(p, eye, 3);
  setChakra(p, maxChakra(p));
  effect(p, FX.levitation, 2, 0, false);
  effect(p, FX.regeneration, 20, 2);
  world.sendMessage(`§5${p.name} ate the Chakra Fruit and ascended as an Otsutsuki!`);
  touch(p);
}

/** @param {Player} p @param {ItemStack} item */
function onUse(p, item) {
  const id = item.typeId;
  const thrown = THROWABLE[id];
  if (thrown) return throwHeld(p, thrown);
  const orb = ORBS.get(id);
  if (orb) {
    if (becomeJinchuriki(p, orb)) consumeHeld(p);
    return;
  }
  switch (id) {
    case ITEM.focus:
      return p.isSneaking ? cycle(p, 1) : castSelected(p);
    case ITEM.scroll:
      return void (p.isSneaking ? jutsuWheel(p) : mainMenu(p));
    case ITEM.reroll:
      return rerollClan(p);
    case ITEM.bijuuScroll:
      return void bijuuSummonMenu(p);
    case ITEM.sealingScroll:
      if (p.isSneaking && getData(p).bijuu) {
        if (releaseBijuu(p)) consumeHeld(p);
      } else if (trySeal(p)) {
        consumeHeld(p);
      }
      return;
    case ITEM.toadContract: {
      const d = getData(p);
      if (d.contract) return tell(p, '§7You already signed the toad contract.');
      d.contract = true;
      consumeHeld(p);
      touch(p);
      title(p, '§6Toad Contract', '§7Summoning Jutsu: Toad and Sage Mode can now be learned (Chunin / Jonin).', 70);
      return ping(p, SOUND.levelup, 1.2);
    }
    case ITEM.forbiddenScroll: {
      const d = getData(p);
      d.jp += 2;
      consumeHeld(p);
      addXp(p, 25);
      touch(p);
      return title(p, ' ', '§e+2 Jutsu Points from the Scroll of Seals', 40);
    }
    case ITEM.sigil:
      if (summonBoss(p, ENTITY.momoshiki, 10)) {
        consumeHeld(p);
        world.sendMessage('§5An Otsutsuki descends from the sky...');
      }
      return;
    case ITEM.gedoCore:
      if (summonBoss(p, ENTITY.juubi, 20)) {
        consumeHeld(p);
        world.sendMessage('§4The Gedo Statue awakens. The Ten-Tails has been revived!');
      }
      return;
    case ITEM.karmaSeal:
      return acceptKarma(p);
    case ITEM.hashiramaCells:
      return implantCells(p);
    case ITEM.kote:
      return kote(p, item);
    case ITEM.explosiveTag:
      return plantTag(p);
    case ITEM.gunbai:
      return gunbai(p);
    default:
      return undefined;
  }
}

/** @param {Player} p @param {ItemStack} item */
function onEat(p, item) {
  const d = getData(p);
  const foodBoost = d.clan === 'akimichi' ? 1.5 : 1;
  /** @param {number} n */
  const chakra = (n) => addChakra(p, n * foodBoost);
  switch (item.typeId) {
    case ITEM.ramen:
      chakra(40);
      effect(p, FX.regeneration, 5, 0);
      break;
    case ITEM.soldierPill:
      chakra(80);
      effect(p, FX.strength, 30, 0);
      break;
    case ITEM.dango:
      chakra(10);
      effect(p, FX.regeneration, 4, 0);
      break;
    case ITEM.spinachPill:
      chakra(30);
      effect(p, FX.strength, 40, 1);
      break;
    case ITEM.curryPill:
      chakra(60);
      effect(p, FX.strength, 40, 2);
      effect(p, FX.resistance, 40, 0);
      later(800, () => valid(p) && effect(p, FX.weakness, 20, 1));
      break;
    case ITEM.chiliPill: {
      setChakra(p, maxChakra(p));
      effect(p, FX.strength, 30, 3);
      effect(p, FX.speed, 30, 1);
      effect(p, FX.resistance, 30, 1);
      effect(p, FX.regeneration, 30, 1);
      title(p, '§cButterfly Mode', '§6Chakra wings burst from your back!', 50);
      fx(p.dimension, PARTICLE.aura, p.location, rgb('#ff5a7a'));
      const mild = d.clan === 'akimichi';
      later(600, () => {
        if (!valid(p)) return;
        effect(p, FX.weakness, mild ? 20 : 60, 1);
        effect(p, FX.hunger, mild ? 10 : 30, 1);
        if (!mild) effect(p, FX.wither, 8, 1);
        tell(p, '§7The chili pill\'s power fades, leaving you drained...');
      });
      break;
    }
    case ITEM.chakraFruit:
      eatFruit(p);
      break;
    default:
      return;
  }
  ping(p, SOUND.eat, 1.2);
  fx(p.dimension, PARTICLE.burst, eyes(p), rgb('#6fc8ff'));
}

/** Items this module reacts to when used (casting, throwing, scrolls...). */
const USABLE = new Set([
  ...Object.keys(THROWABLE), ...ORBS.keys(), ITEM.focus, ITEM.scroll, ITEM.reroll, ITEM.bijuuScroll, ITEM.sealingScroll,
  ITEM.toadContract, ITEM.forbiddenScroll, ITEM.sigil, ITEM.gedoCore, ITEM.karmaSeal, ITEM.hashiramaCells, ITEM.kote,
  ITEM.explosiveTag, ITEM.gunbai,
]);

/** @type {Map<string, number>} */
const lastUse = new Map();

/** Clicking air fires itemUse, clicking a block fires playerInteractWithBlock: accept either, once. @param {Player} p @param {ItemStack} item */
function handleUse(p, item) {
  const now = system.currentTick;
  if ((lastUse.get(p.id) ?? -10) >= now - 2) return;
  lastUse.set(p.id, now);
  try {
    onUse(p, item);
  } catch (err) {
    console.warn(`[shinobi] item use ${item.typeId}: ${err}`);
  }
}

export function startItems() {
  world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.source instanceof Player && USABLE.has(ev.itemStack.typeId)) handleUse(ev.source, ev.itemStack);
  });
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const item = ev.itemStack;
    if (!ev.isFirstEvent || !item || !USABLE.has(item.typeId)) return;
    const p = ev.player;
    system.run(() => valid(p) && handleUse(p, item));
  });
  world.afterEvents.itemCompleteUse.subscribe((ev) => {
    try {
      onEat(ev.source, ev.itemStack);
    } catch (err) {
      console.warn(`[shinobi] item eat ${ev.itemStack.typeId}: ${err}`);
    }
  });
}
