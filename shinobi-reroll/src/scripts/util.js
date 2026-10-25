import {
  EntityDamageCause,
  EquipmentSlot,
  GameMode,
  ItemStack,
  MolangVariableMap,
  Player,
  system,
  world,
} from '@minecraft/server';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */

// ---------------------------------------------------------------- vectors
/** @param {number} x @param {number} y @param {number} z @returns {Vector3} */
export const v3 = (x, y, z) => ({ x, y, z });
/** @param {Vector3} a @param {Vector3} b */
export const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
/** @param {Vector3} a @param {Vector3} b */
export const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
/** @param {Vector3} a @param {number} s */
export const mul = (a, s) => v3(a.x * s, a.y * s, a.z * s);
/** @param {Vector3} a */
export const len = (a) => Math.hypot(a.x, a.y, a.z);
/** @param {Vector3} a @param {Vector3} b */
export const dist = (a, b) => len(sub(a, b));
/** @param {Vector3} a */
export const norm = (a) => {
  const l = len(a) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};
/** Horizontal unit direction from a to b. @param {Vector3} a @param {Vector3} b */
export const flatDir = (a, b) => {
  const d = v3(b.x - a.x, 0, b.z - a.z);
  const l = Math.hypot(d.x, d.z) || 1;
  return v3(d.x / l, 0, d.z / l);
};
/** Rotate a horizontal direction by deg around Y. @param {Vector3} d @param {number} deg */
export const yaw = (d, deg) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return v3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
};
/** @param {Vector3} a */
export const floor = (a) => v3(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z));
/** @param {Vector3} a @param {Vector3} b */
export const angleBetween = (a, b) => {
  const d = (a.x * b.x + a.y * b.y + a.z * b.z) / ((len(a) || 1) * (len(b) || 1));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};

// ---------------------------------------------------------------- numbers
/** @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** @param {number} lo @param {number} hi */
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
/** @template T @param {T[]} arr @returns {T} */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
/**
 * Weighted random choice.
 * @template T
 * @param {Array<[T, number]>} entries
 * @returns {T}
 */
export function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    if ((r -= w) <= 0) return v;
  }
  return entries[entries.length - 1][0];
}
/** @param {number} ticks */
export const secs = (ticks) => Math.ceil(ticks / 20);

// ---------------------------------------------------------------- entity helpers
/** @param {Entity | undefined} e @returns {e is Entity} */
export const valid = (e) => !!e && e.isValid;

/** @param {Entity} e @returns {e is Player} */
export const isPlayer = (e) => e instanceof Player;

/** @param {Entity} e */
export function health(e) {
  return e.getComponent('minecraft:health');
}

/** @param {Entity} e */
export function healthFraction(e) {
  const h = health(e);
  return h ? h.currentValue / h.effectiveMax : 1;
}

/** @param {Entity} e @param {number} amount */
export function heal(e, amount) {
  const h = health(e);
  if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
}

/** Location at eye height. @param {Entity} e */
export function eyes(e) {
  try {
    return e.getHeadLocation();
  } catch {
    return add(e.location, v3(0, 1.6, 0));
  }
}

/** Unique id of the player that owns a summon/clone, if any. @param {Entity} e */
export function ownerId(e) {
  const v = e.getDynamicProperty('sr:owner');
  if (typeof v === 'string') return v;
  const t = e.getComponent('minecraft:tameable');
  return t?.tamedToPlayerId;
}

/**
 * Whether `target` should be spared by `caster`'s attacks.
 * @param {Entity} caster @param {Entity} target
 */
export function isFriendly(caster, target) {
  if (caster.id === target.id) return true;
  const fam = target.typeId;
  if (fam === 'shinobi:jutsu_orb' || fam === 'shinobi:training_post' || fam === 'minecraft:item') return true;
  const owner = ownerId(target);
  if (owner && owner === caster.id) return true;
  const casterOwner = ownerId(caster);
  if (casterOwner && (casterOwner === target.id || casterOwner === owner)) return true;
  if (isPlayer(target)) {
    if (isPlayer(caster) || casterOwner) return !settings().pvp;
    return false;
  }
  return false;
}

/**
 * Hostile-to-caster entities around a point.
 * @param {Entity} caster @param {Vector3} center @param {number} radius
 * @returns {Entity[]}
 */
export function enemiesAround(caster, center, radius) {
  /** @type {Entity[]} */
  const out = [];
  let list;
  try {
    list = caster.dimension.getEntities({
      location: center,
      maxDistance: radius,
      excludeTypes: ['minecraft:item', 'minecraft:xp_orb', 'shinobi:jutsu_orb', 'minecraft:arrow'],
      excludeFamilies: ['inanimate', 'projectile'],
    });
  } catch {
    return out;
  }
  for (const e of list) {
    if (!valid(e) || isFriendly(caster, e)) continue;
    if (isPlayer(e) && e.getGameMode() === GameMode.Creative) continue;
    out.push(e);
  }
  return out;
}

/**
 * First hostile entity along the caster's view.
 * @param {Entity} caster @param {number} range
 * @returns {Entity | undefined}
 */
export function lookTarget(caster, range) {
  try {
    for (const hit of caster.getEntitiesFromViewDirection({ maxDistance: range, excludeFamilies: ['inanimate'] })) {
      if (valid(hit.entity) && !isFriendly(caster, hit.entity) && hit.entity.typeId !== 'shinobi:jutsu_orb') {
        return hit.entity;
      }
    }
  } catch {}
  return undefined;
}

/** Block the caster looks at. @param {Entity} caster @param {number} range */
export function lookBlock(caster, range) {
  try {
    return caster.getBlockFromViewDirection({ maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false });
  } catch {
    return undefined;
  }
}

/** Point the caster looks at (block hit or max range). @param {Entity} caster @param {number} range */
export function lookPoint(caster, range) {
  const hit = lookBlock(caster, range);
  if (hit) return add(hit.block.location, v3(0.5, 1, 0.5));
  return add(eyes(caster), mul(caster.getViewDirection(), range));
}

/**
 * Damage attributed to the caster (counts as a player kill for loot/XP).
 * @param {Entity} target @param {number} amount @param {Entity} [source]
 * @param {EntityDamageCause} [cause]
 */
export function hurt(target, amount, source, cause = EntityDamageCause.entityAttack) {
  if (!valid(target) || amount <= 0) return false;
  try {
    if (source && valid(source)) return target.applyDamage(amount, { cause, damagingEntity: source });
    return target.applyDamage(amount, { cause });
  } catch {
    return false;
  }
}

/**
 * Push `target` away from `from` (works on players and mobs).
 * @param {Entity} target @param {Vector3} from @param {number} strength @param {number} up
 */
export function knock(target, from, strength, up = 0.4) {
  if (!valid(target)) return;
  const d = flatDir(from, target.location);
  try {
    target.applyKnockback({ x: d.x * strength, z: d.z * strength }, up);
  } catch {}
}

/** Pull `target` toward `to`. @param {Entity} target @param {Vector3} to @param {number} strength */
export function pull(target, to, strength) {
  if (!valid(target)) return;
  const d = flatDir(target.location, to);
  try {
    target.applyKnockback({ x: d.x * strength, z: d.z * strength }, 0.35);
  } catch {}
}

/** Dash the entity along a direction. @param {Entity} e @param {Vector3} dir @param {number} power */
export function dash(e, dir, power, up = 0.2) {
  try {
    e.applyKnockback({ x: dir.x * power, z: dir.z * power }, up + Math.max(0, dir.y) * 0.4);
  } catch {}
}

/**
 * Add effect silently ignoring failures (e.g. invalid entity).
 * @param {Entity} e @param {string} id @param {number} seconds @param {number} [amp] @param {boolean} [particles]
 */
export function effect(e, id, seconds, amp = 0, particles = true) {
  if (!valid(e)) return;
  try {
    e.addEffect(id, Math.max(1, Math.round(seconds * 20)), { amplifier: amp, showParticles: particles });
  } catch {}
}

/** Freeze an entity in place. @param {Entity} e @param {number} seconds */
export function stun(e, seconds) {
  effect(e, 'minecraft:slowness', seconds, 9, false);
  effect(e, 'minecraft:weakness', seconds, 4, false);
  effect(e, 'minecraft:mining_fatigue', seconds, 4, false);
  if (isPlayer(e)) effect(e, 'minecraft:jump_boost', seconds, 250, false);
}

// ---------------------------------------------------------------- particles / sound
/** @param {{r:number,g:number,b:number}} [color] */
function molang(color) {
  const m = new MolangVariableMap();
  if (color) m.setColorRGB('variable.color', { red: color.r, green: color.g, blue: color.b });
  return m;
}

/**
 * @param {Dimension} dim @param {string} id @param {Vector3} loc @param {{r:number,g:number,b:number}} [color]
 */
export function fx(dim, id, loc, color) {
  try {
    dim.spawnParticle(id, loc, molang(color));
  } catch {}
}

/** Particle only the given player can see. @param {Player} p @param {string} id @param {Vector3} loc @param {{r:number,g:number,b:number}} [color] */
export function fxFor(p, id, loc, color) {
  try {
    p.spawnParticle(id, loc, molang(color));
  } catch {}
}

/** @param {Dimension} dim @param {string} id @param {Vector3} loc @param {number} [pitch] @param {number} [volume] */
export function sound(dim, id, loc, pitch = 1, volume = 1) {
  try {
    dim.playSound(id, loc, { pitch, volume });
  } catch {}
}

/** @param {string} hex '#rrggbb' */
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// ---------------------------------------------------------------- items
/** @param {Player} p */
export const isCreative = (p) => p.getGameMode() === GameMode.Creative;

/** Remove one of the item in the main hand (no-op in creative). @param {Player} p */
export function consumeHeld(p) {
  if (isCreative(p)) return;
  const eq = p.getComponent('minecraft:equippable');
  if (!eq) return;
  const slot = eq.getEquipmentSlot(EquipmentSlot.Mainhand);
  const item = slot.getItem();
  if (!item) return;
  if (item.amount > 1) {
    item.amount -= 1;
    slot.setItem(item);
  } else {
    slot.setItem(undefined);
  }
}

/** @param {Player} p */
export function heldItem(p) {
  return p.getComponent('minecraft:equippable')?.getEquipment(EquipmentSlot.Mainhand);
}

/** @param {Player} p @param {import('@minecraft/server').EquipmentSlot} slot */
export function worn(p, slot) {
  return p.getComponent('minecraft:equippable')?.getEquipment(slot)?.typeId;
}

/** Count an item across the inventory. @param {Player} p @param {string} id */
export function countItem(p, id) {
  const inv = p.getComponent('minecraft:inventory')?.container;
  if (!inv) return 0;
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId === id) n += it.amount;
  }
  return n;
}

/** Remove `amount` of an item from the inventory. @param {Player} p @param {string} id @param {number} amount */
export function takeItem(p, id, amount = 1) {
  if (isCreative(p)) return true;
  const inv = p.getComponent('minecraft:inventory')?.container;
  if (!inv || countItem(p, id) < amount) return false;
  for (let i = 0; i < inv.size && amount > 0; i++) {
    const it = inv.getItem(i);
    if (it?.typeId !== id) continue;
    const take = Math.min(amount, it.amount);
    amount -= take;
    if (it.amount > take) {
      it.amount -= take;
      inv.setItem(i, it);
    } else {
      inv.setItem(i, undefined);
    }
  }
  return true;
}

/** Give an item, dropping leftovers at the player's feet. @param {Player} p @param {string} id @param {number} amount */
export function give(p, id, amount = 1) {
  const inv = p.getComponent('minecraft:inventory')?.container;
  const stack = new ItemStack(id, amount);
  const left = inv?.addItem(stack) ?? stack;
  if (left) p.dimension.spawnItem(left, p.location);
}

// ---------------------------------------------------------------- messaging
/** @param {Player} p @param {string} msg */
export const tell = (p, msg) => {
  try {
    p.sendMessage(msg);
  } catch {}
};

/** @param {Player} p @param {string} title @param {string} [subtitle] */
export function title(p, title, subtitle = '', stay = 40) {
  try {
    p.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 5, stayDuration: stay, fadeOutDuration: 10 });
  } catch {}
}

/** @param {Player} p @param {string} id @param {number} [pitch] */
export function ping(p, id, pitch = 1) {
  try {
    p.playSound(id, { pitch, volume: 0.8 });
  } catch {}
}

/** @param {string} msg */
export const broadcast = (msg) => world.sendMessage(msg);

// ---------------------------------------------------------------- scheduling
/**
 * Repeat `fn(i)` `times` times every `interval` ticks; stops early when it returns false.
 * @param {number} times @param {number} interval @param {(i:number)=>boolean|void} fn
 */
export function repeat(times, interval, fn) {
  let i = 0;
  const id = system.runInterval(() => {
    let keep = true;
    try {
      keep = fn(i) !== false;
    } catch (err) {
      keep = false;
      console.warn(`[shinobi] repeat task failed: ${err}`);
    }
    if (!keep || ++i >= times) system.clearRun(id);
  }, interval);
  return id;
}

/** @param {number} ticks @param {() => void} fn */
export function later(ticks, fn) {
  return system.runTimeout(() => {
    try {
      fn();
    } catch (err) {
      console.warn(`[shinobi] delayed task failed: ${err}`);
    }
  }, ticks);
}

// ---------------------------------------------------------------- world settings
/** @typedef {{ griefing: boolean, pvp: boolean, xpRate: number, hudDefault: boolean, npcJutsu: boolean }} Settings */
/** @type {Settings} */
const DEFAULT_SETTINGS = { griefing: false, pvp: true, xpRate: 1, hudDefault: true, npcJutsu: true };
/** @type {Settings | undefined} */
let cachedSettings;

/** @returns {Settings} */
export function settings() {
  if (cachedSettings) return cachedSettings;
  let parsed = {};
  try {
    const raw = world.getDynamicProperty('sr:settings');
    if (typeof raw === 'string') parsed = JSON.parse(raw);
  } catch {}
  cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
  return cachedSettings;
}

/** @param {Partial<Settings>} patch */
export function saveSettings(patch) {
  cachedSettings = { ...settings(), ...patch };
  world.setDynamicProperty('sr:settings', JSON.stringify(cachedSettings));
}
