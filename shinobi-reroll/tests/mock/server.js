// Minimal in-memory stand-in for @minecraft/server, enough to load the add-on's
// scripts in Node and drive them through a simulated game loop. It is not a
// game simulation: it records calls and returns plausible values so every code
// path can execute and throw if it misuses data.

export const GameMode = { Adventure: 'Adventure', Creative: 'Creative', Spectator: 'Spectator', Survival: 'Survival' };
export const EquipmentSlot = { Chest: 'Chest', Feet: 'Feet', Head: 'Head', Legs: 'Legs', Mainhand: 'Mainhand', Offhand: 'Offhand' };
export const InputButton = { Jump: 'Jump', Sneak: 'Sneak' };
export const ButtonState = { Pressed: 'Pressed', Released: 'Released' };
export const EntityDamageCause = new Proxy({}, { get: (_t, k) => String(k) });

export const log = { warnings: [], messages: [], particles: 0, sounds: 0, spawned: [], blocks: new Map(), explosions: 0 };

// ------------------------------------------------------------------ events
class Signal {
  constructor() {
    this.handlers = [];
  }
  subscribe(fn) {
    this.handlers.push(fn);
    return fn;
  }
  unsubscribe(fn) {
    this.handlers = this.handlers.filter((h) => h !== fn);
  }
  fire(ev) {
    for (const h of this.handlers) h(ev);
  }
}
const signals = () => new Proxy({}, { get: (t, k) => (t[k] ??= new Signal()) });

// ------------------------------------------------------------------ system
const tasks = new Map();
let nextTask = 1;
export const system = {
  currentTick: 0,
  afterEvents: signals(),
  beforeEvents: signals(),
  run(fn) {
    return this.runTimeout(fn, 0);
  },
  runTimeout(fn, delay = 0) {
    const id = nextTask++;
    tasks.set(id, { fn, at: this.currentTick + Math.max(0, delay), every: 0 });
    return id;
  },
  runInterval(fn, every = 1) {
    const id = nextTask++;
    tasks.set(id, { fn, at: this.currentTick + Math.max(1, every), every: Math.max(1, every) });
    return id;
  },
  clearRun(id) {
    tasks.delete(id);
  },
  waitTicks(n) {
    return new Promise((res) => this.runTimeout(res, n));
  },
  sendScriptEvent() {},
};

/** Advance the simulated clock, running due timers. Exceptions propagate. */
export function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    system.currentTick++;
    for (const [id, t] of [...tasks]) {
      if (!tasks.has(id) || t.at > system.currentTick) continue;
      if (t.every) t.at += t.every;
      else tasks.delete(id);
      t.fn();
    }
  }
}

// ------------------------------------------------------------------ items
export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId.includes(':') ? typeId : `minecraft:${typeId}`;
    this.amount = amount;
    this.maxAmount = 64;
    this.isStackable = true;
    this._dur = { damage: 0, maxDurability: 300 };
    this.nameTag = undefined;
  }
  getComponent(id) {
    if (id === 'minecraft:durability') return this._dur;
    if (id === 'minecraft:cooldown') return { startCooldown() {} };
    return undefined;
  }
  clone() {
    const c = new ItemStack(this.typeId, this.amount);
    c._dur = { ...this._dur };
    return c;
  }
  getLore() {
    return [];
  }
  setLore() {}
}

class Container {
  constructor(size) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
  }
  getItem(i) {
    return this.slots[i];
  }
  setItem(i, item) {
    this.slots[i] = item;
  }
  addItem(item) {
    for (let i = 0; i < this.size; i++) {
      const s = this.slots[i];
      if (s && s.typeId === item.typeId) {
        s.amount += item.amount;
        return undefined;
      }
    }
    const free = this.slots.indexOf(undefined);
    if (free < 0) return item;
    this.slots[free] = item;
    return undefined;
  }
  get emptySlotsCount() {
    return this.slots.filter((s) => !s).length;
  }
}

// ------------------------------------------------------------------ blocks / dimension
class Block {
  constructor(dim, loc) {
    this.dimension = dim;
    this.location = loc;
    this.x = loc.x;
    this.y = loc.y;
    this.z = loc.z;
  }
  get key() {
    return `${this.x},${this.y},${this.z}`;
  }
  get typeId() {
    return log.blocks.get(this.key) ?? (this.y < 64 ? 'minecraft:stone' : 'minecraft:air');
  }
  get isAir() {
    return this.typeId === 'minecraft:air';
  }
  get isLiquid() {
    return false;
  }
  get isValid() {
    return true;
  }
  setType(t) {
    log.blocks.set(this.key, typeof t === 'string' ? t : t.id);
  }
  center() {
    return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 };
  }
}

class Dimension {
  constructor(id) {
    this.id = id;
    this.entities = new Map();
  }
  getBlock(loc) {
    return new Block(this, { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
  }
  spawnEntity(typeId, loc) {
    const e = typeId === 'minecraft:player' ? new Player(this, 'Dummy') : new Entity(typeId, this, loc);
    e.location = { ...loc };
    this.entities.set(e.id, e);
    log.spawned.push(typeId);
    return e;
  }
  spawnItem(item, loc) {
    return this.spawnEntity('minecraft:item', loc);
  }
  getEntities(opts = {}) {
    let list = [...this.entities.values()].filter((e) => e.isValid);
    if (opts.location && opts.maxDistance !== undefined) {
      list = list.filter((e) => dist(e.location, opts.location) <= opts.maxDistance);
    }
    if (opts.type) list = list.filter((e) => e.typeId === opts.type);
    if (opts.families) list = list.filter((e) => opts.families.every((f) => e.families.includes(f)));
    if (opts.excludeFamilies) list = list.filter((e) => !opts.excludeFamilies.some((f) => e.families.includes(f)));
    if (opts.excludeTypes) list = list.filter((e) => !opts.excludeTypes.includes(e.typeId));
    if (opts.closest) list = list.slice(0, opts.closest);
    return list;
  }
  getPlayers(opts = {}) {
    return this.getEntities(opts).filter((e) => e instanceof Player && (!opts.excludeGameModes || !opts.excludeGameModes.includes(e.mode)));
  }
  spawnParticle(id, loc, molang) {
    if (typeof id !== 'string' || !loc || !(molang instanceof MolangVariableMap)) throw new Error('bad particle call');
    log.particles++;
  }
  playSound(id) {
    if (typeof id !== 'string') throw new Error('bad sound');
    log.sounds++;
  }
  createExplosion() {
    log.explosions++;
    return true;
  }
  runCommand() {
    return { successCount: 1 };
  }
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// ------------------------------------------------------------------ entities
let nextId = 1;
const FAMILIES = {
  'shinobi:rogue_ninja': ['shinobi_npc', 'rogue', 'monster', 'mob'],
  'shinobi:akatsuki_rogue': ['shinobi_npc', 'monster', 'mob'],
  'shinobi:leaf_shinobi': ['shinobi_npc', 'mob'],
  'shinobi:white_zetsu': ['shinobi_npc', 'monster', 'mob'],
  'shinobi:kurama': ['bijuu', 'tailed_beast', 'shinobi_boss', 'monster', 'mob'],
  'shinobi:juubi': ['juubi', 'tailed_beast', 'shinobi_boss', 'monster', 'mob'],
  'shinobi:momoshiki': ['otsutsuki', 'shinobi_boss', 'monster', 'mob'],
  'shinobi:training_post': ['inanimate'],
  'minecraft:zombie': ['monster', 'mob'],
  'minecraft:player': ['player'],
};

export class Entity {
  constructor(typeId, dim, loc = { x: 0, y: 64, z: 0 }) {
    this.id = String(nextId++);
    this.typeId = typeId;
    this.dimension = dim;
    this.location = { ...loc };
    this.families = FAMILIES[typeId] ?? (typeId.includes('projectile') || typeId.includes('orb') ? ['projectile'] : ['mob']);
    this.tags = new Set();
    this.props = new Map();
    this.dyn = new Map();
    this.effects = new Map();
    this.hp = 40;
    this.maxHp = 40;
    this.removed = false;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.isSneaking = false;
    this.nameTag = '';
    this.tamedTo = undefined;
  }
  get isValid() {
    return !this.removed;
  }
  getComponent(id) {
    if (id === 'minecraft:health') {
      const self = this;
      return {
        get currentValue() {
          return self.hp;
        },
        get effectiveMax() {
          return self.maxHp;
        },
        defaultValue: this.maxHp,
        setCurrentValue(v) {
          self.hp = Math.max(0, Math.min(self.maxHp, v));
          return true;
        },
        resetToMaxValue() {
          self.hp = self.maxHp;
        },
      };
    }
    if (id === 'minecraft:projectile') {
      return { owner: undefined, gravity: 0, shoot: (v) => (this.velocity = { ...v }) };
    }
    if (id === 'minecraft:tameable') {
      const self = this;
      return {
        get tamedToPlayerId() {
          return self.tamedTo;
        },
        tame(p) {
          self.tamedTo = p.id;
          return true;
        },
        isTamed: !!this.tamedTo,
      };
    }
    return undefined;
  }
  hasComponent(id) {
    return !!this.getComponent(id);
  }
  getProperty(k) {
    return this.props.get(k);
  }
  setProperty(k, v) {
    if (!k.startsWith('shinobi:')) throw new Error(`unknown property ${k}`);
    this.props.set(k, v);
  }
  getDynamicProperty(k) {
    return this.dyn.get(k);
  }
  setDynamicProperty(k, v) {
    if (v === undefined) this.dyn.delete(k);
    else this.dyn.set(k, v);
  }
  addEffect(id, duration, opts) {
    if (typeof id !== 'string' || !(duration > 0)) throw new Error(`bad effect ${id} ${duration}`);
    this.effects.set(id, { duration, amplifier: opts?.amplifier ?? 0 });
    return undefined;
  }
  removeEffect(id) {
    return this.effects.delete(id);
  }
  getEffect(id) {
    return this.effects.get(id);
  }
  applyDamage(amount, opts) {
    if (!(amount >= 0) || !Number.isFinite(amount)) throw new Error(`bad damage ${amount}`);
    if (opts && !opts.cause) throw new Error('damage without cause');
    this.hp -= amount;
    return true;
  }
  applyKnockback(h, v) {
    if (typeof h !== 'object' || !Number.isFinite(h.x) || !Number.isFinite(h.z) || !Number.isFinite(v)) throw new Error('bad knockback');
  }
  applyImpulse(v) {
    if (this instanceof Player) throw new Error('applyImpulse on player');
    this.velocity = { ...v };
  }
  clearVelocity() {
    this.velocity = { x: 0, y: 0, z: 0 };
  }
  getVelocity() {
    return { ...this.velocity };
  }
  getViewDirection() {
    return { x: 0, y: 0, z: 1 };
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.6, z: this.location.z };
  }
  getRotation() {
    return { x: 0, y: 0 };
  }
  teleport(loc) {
    if (!Number.isFinite(loc.x)) throw new Error('bad teleport');
    this.location = { ...loc };
  }
  tryTeleport(loc) {
    this.teleport(loc);
    return true;
  }
  setOnFire() {
    return true;
  }
  extinguishFire() {
    return true;
  }
  matches(opts) {
    return !opts.families || opts.families.every((f) => this.families.includes(f));
  }
  hasTag(t) {
    return this.tags.has(t);
  }
  addTag(t) {
    this.tags.add(t);
    return true;
  }
  removeTag(t) {
    return this.tags.delete(t);
  }
  getTags() {
    return [...this.tags];
  }
  remove() {
    this.removed = true;
  }
  kill() {
    this.removed = true;
    return true;
  }
  triggerEvent() {}
  getEntitiesFromViewDirection(opts = {}) {
    return this.dimension
      .getEntities({ location: this.location, maxDistance: opts.maxDistance ?? 16 })
      .filter((e) => e.id !== this.id && !e.families.includes('projectile') && (!opts.families || e.matches(opts)))
      .map((entity) => ({ entity, distance: dist(entity.location, this.location) }));
  }
  getBlockFromViewDirection() {
    const b = this.dimension.getBlock({ x: this.location.x, y: 63, z: this.location.z + 5 });
    return { block: b, face: 'Up', faceLocation: { x: 0.5, y: 1, z: 0.5 } };
  }
}

export class Player extends Entity {
  constructor(dim, name = 'Shinobi') {
    super('minecraft:player', dim, { x: 0, y: 64, z: 0 });
    this.name = name;
    this.mode = GameMode.Survival;
    this.hp = 20;
    this.maxHp = 20;
    this.inventory = new Container(36);
    this.equipment = new Map();
    this.titles = [];
    this.actionbar = '';
    this.chat = [];
    this.forms = [];
    const self = this;
    this.camera = {
      setCamera(preset, opts) {
        if (typeof preset !== 'string' || !opts) throw new Error('bad camera');
      },
      clear() {},
      fade() {},
    };
    this.onScreenDisplay = {
      setActionBar(t) {
        self.actionbar = String(t);
      },
      setTitle(t, o) {
        if (o && !(o.fadeInDuration >= 0 && o.stayDuration >= 0 && o.fadeOutDuration >= 0)) throw new Error('bad title options');
        self.titles.push(String(t) + ' | ' + (o?.subtitle ?? ''));
      },
      updateSubtitle() {},
    };
  }
  getComponent(id) {
    if (id === 'minecraft:inventory') return { container: this.inventory };
    if (id === 'minecraft:equippable') {
      const self = this;
      return {
        getEquipment(slot) {
          if (slot === EquipmentSlot.Mainhand) return self.inventory.getItem(0);
          return self.equipment.get(slot);
        },
        setEquipment(slot, item) {
          if (slot === EquipmentSlot.Mainhand) self.inventory.setItem(0, item);
          else self.equipment.set(slot, item);
          return true;
        },
        getEquipmentSlot(slot) {
          return {
            getItem: () => this.getEquipment(slot),
            setItem: (item) => this.setEquipment(slot, item),
          };
        },
      };
    }
    return super.getComponent(id);
  }
  getGameMode() {
    return this.mode;
  }
  sendMessage(m) {
    this.chat.push(String(m));
    log.messages.push(String(m));
  }
  playSound(id) {
    if (typeof id !== 'string') throw new Error('bad sound');
    log.sounds++;
  }
  spawnParticle(id, loc, molang) {
    this.dimension.spawnParticle(id, loc, molang);
  }
  startItemCooldown() {}
  getItemCooldown() {
    return 0;
  }
}

export class MolangVariableMap {
  setColorRGB(name, c) {
    if (!name.startsWith('variable.') || !['red', 'green', 'blue'].every((k) => Number.isFinite(c[k]))) throw new Error('bad color');
  }
  setFloat() {}
}

// ------------------------------------------------------------------ world
const dims = { 'minecraft:overworld': new Dimension('minecraft:overworld') };
const worldDyn = new Map();

// Script API 2.0 "early execution": until the world has loaded, scripts may only
// subscribe to events and schedule work. The mock enforces the same rule.
let loaded = false;
export const markLoaded = () => {
  loaded = true;
};
const guard = (what) => {
  if (!loaded) throw new Error(`${what} cannot be used in early-execution mode`);
};

export const world = {
  afterEvents: signals(),
  beforeEvents: signals(),
  players: [],
  getAllPlayers() {
    guard('world.getAllPlayers');
    return this.players.filter((p) => p.isValid);
  },
  getPlayers() {
    return this.getAllPlayers();
  },
  getDimension(id) {
    guard('world.getDimension');
    return dims[id] ?? dims['minecraft:overworld'];
  },
  getDynamicProperty(k) {
    guard('world.getDynamicProperty');
    return worldDyn.get(k);
  },
  setDynamicProperty(k, v) {
    guard('world.setDynamicProperty');
    if (typeof v === 'string' && v.length > 32767) throw new Error(`dynamic property ${k} too large`);
    if (v === undefined) worldDyn.delete(k);
    else worldDyn.set(k, v);
  },
  sendMessage(m) {
    guard('world.sendMessage');
    log.messages.push(String(m));
  },
  getAbsoluteTime() {
    guard('world.getAbsoluteTime');
    return 1000000 + system.currentTick;
  },
  getEntity(id) {
    guard('world.getEntity');
    for (const d of Object.values(dims)) if (d.entities.has(id)) return d.entities.get(id);
    return undefined;
  },
};

export const overworld = dims['minecraft:overworld'];

console.warn = (...a) => log.warnings.push(a.join(' '));
