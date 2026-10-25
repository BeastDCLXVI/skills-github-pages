// Smoke tests: load the real add-on scripts against the mock Bedrock API and
// drive a player through spawning, admin commands, every jutsu, items, menus,
// bosses, NPCs and temporary terrain. Any thrown error or logged script warning
// fails the run.
//
//   node --import ./tests/register.mjs --test tests/
import assert from 'node:assert/strict';
import test from 'node:test';
import * as mc from '@minecraft/server';
import * as ui from '@minecraft/server-ui';

await import('../src/scripts/main.js');
const { JUTSU } = await import('../src/scripts/jutsu/index.js');
const store = await import('../src/scripts/store.js');
const state = await import('../src/scripts/state.js');
const casting = await import('../src/scripts/casting.js');
const { CLANS } = await import('../src/scripts/data.js');

const { log, tick, overworld, world, system } = mc;

const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
};

function makePlayer(name) {
  const p = new mc.Player(overworld, name);
  world.players.push(p);
  overworld.entities.set(p.id, p);
  return p;
}
const hold = (p, id, n = 1) => p.inventory.setItem(0, new mc.ItemStack(id, n));
const use = (p) => {
  world.afterEvents.itemUse.fire({ source: p, itemStack: p.inventory.getItem(0) });
  tick(3); // input de-duplication window
};
const eat = (p, id) => world.afterEvents.itemCompleteUse.fire({ source: p, itemStack: new mc.ItemStack(id), useDuration: 20 });
const admin = (p, msg) => system.afterEvents.scriptEventReceive.fire({ id: 'shinobi:admin', message: msg, sourceEntity: p });
function dummy(type = 'minecraft:zombie', at = { x: 0, y: 64, z: 4 }) {
  const e = overworld.spawnEntity(type, at);
  e.hp = e.maxHp = 400;
  return e;
}
const noWarnings = (where) => {
  assert.deepEqual(log.warnings, [], `script warnings during ${where}`);
};

mc.markLoaded();
world.afterEvents.worldLoad.fire({});
const hero = makePlayer('Hero');
world.afterEvents.playerSpawn.fire({ player: hero, initialSpawn: true });
tick(60);

test('content registers and the world loads cleanly', () => {
  assert.ok(JUTSU.size >= 60, `only ${JUTSU.size} jutsu registered`);
  for (const j of JUTSU.values()) {
    for (const r of j.requires ?? []) assert.ok(JUTSU.has(r), `${j.id} requires unknown ${r}`);
    assert.ok(j.cast || j.toggle, `${j.id} has no behaviour`);
  }
  noWarnings('load');
});

test('a new shinobi gets a clan, chakra and a starter kit', () => {
  const d = store.getData(hero);
  assert.ok(CLANS[d.clan], 'valid clan');
  assert.equal(d.natures.length, 1);
  assert.equal(store.getChakra(hero), store.maxChakra(hero));
  const ids = hero.inventory.slots.filter(Boolean).map((s) => s.typeId);
  for (const id of ['shinobi:shinobi_scroll', 'shinobi:chakra_focus', 'shinobi:shuriken', 'shinobi:kunai']) {
    assert.ok(ids.includes(id), `starter kit missing ${id}`);
  }
  assert.ok(hero.chat.some((m) => m.includes('Shinobi Reroll')), 'welcome message');
});

test('the Chakra Focus casts and cycles the loadout', () => {
  admin(hero, 'clan none');
  const d = store.getData(hero);
  d.slots = ['substitution', 'body_flicker'];
  d.sel = 0;
  hold(hero, 'shinobi:chakra_focus');
  const before = store.getChakra(hero);
  use(hero);
  tick(40);
  assert.ok(store.getChakra(hero) < before + 5, 'substitution spent chakra');
  assert.ok(state.cooldownLeft(hero, 'substitution') > 0, 'cooldown set');
  hero.isSneaking = true;
  use(hero);
  hero.isSneaking = false;
  assert.equal(d.sel, 1, 'sneak + use cycles');
  noWarnings('focus');
});

test('admin progression, clans and dojutsu awakening', () => {
  admin(hero, 'clan hyuga');
  assert.equal(store.getData(hero).eye, 'byakugan', 'Hyuga are born with the Byakugan');
  admin(hero, 'clan uchiha');
  assert.equal(store.getData(hero).eye, null, 'changing clan drops the old bloodline eye');
  admin(hero, 'xp 2500');
  const d = store.getData(hero);
  assert.equal(d.rank, 3, 'Jonin at 2500 XP');
  assert.equal(d.eye, 'sharingan', 'Uchiha awaken the Sharingan at Genin+');
  admin(hero, 'eye mangekyo');
  for (const id of ['amaterasu', 'tsukuyomi', 'susanoo', 'kamui']) assert.ok(d.learned.includes(id), `MS grants ${id}`);
  admin(hero, 'eye none');
  assert.ok(!d.learned.includes('amaterasu'), 'auto jutsu revoked with the eye');
  noWarnings('admin');
});

const KEKKEI_CLAN = { wood: 'senju', ice: 'yuki', lava: 'terumi', bone: 'kaguya' };

test('every jutsu executes against a live target without errors', () => {
  const p = makePlayer('Tester');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const d = store.getData(p);
  const failures = [];
  for (const j of JUTSU.values()) {
    log.warnings.length = 0;
    // satisfy every requirement
    d.rank = 5;
    d.xp = 20000;
    d.natures = ['fire', 'wind', 'lightning', 'earth', 'water'];
    d.clan = j.clan ?? (j.kekkei ? KEKKEI_CLAN[j.kekkei] : 'uzumaki');
    d.eye = j.eyes?.[0] ?? null;
    d.eyeOn = !!j.eyes;
    d.eyeStage = 3;
    d.contracts = ['toad', 'snake', 'slug'];
    d.unlocks = ['clay', 'puppet', 'curse'];
    d.bijuu = 'kurama';
    d.sync = 100;
    d.karma = true;
    d.karmaEnergy = 30;
    d.ascended = true;
    d.sageEnergy = 100;
    d.strain = 0;
    d.learned = [...new Set([...d.learned, ...(j.requires ?? []), j.id])];
    const r = state.rt(p);
    r.toggles.clear();
    if (j.active) r.toggles.add(j.active);
    r.cooldowns.clear();
    r.weavingUntil = 0;
    store.setChakra(p, 100000);
    p.location = { x: 0, y: 64, z: 0 };
    p.inventory.setItem(5, new mc.ItemStack('shinobi:shuriken', 16));
    const target = dummy('minecraft:zombie', { x: 0, y: 64, z: 4 });
    const casts = d.casts;
    casting.cast(p, j.id);
    tick(220);
    if (d.casts !== casts + 1) failures.push(`${j.id}: cast did not succeed (last chat: ${p.chat.at(-1)})`);
    if (log.warnings.length) failures.push(`${j.id}: ${log.warnings.join(' | ')}`);
    if (j.toggle && r.toggles.has(j.id)) casting.cast(p, j.id);
    target.remove();
  }
  assert.deepEqual(failures, []);
});

test('items: reroll, beasts, karma, fruit, tools and food', async () => {
  const p = makePlayer('Items');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const d = store.getData(p);

  hold(p, 'shinobi:clan_reroll_scroll');
  const rerolls = d.rerolls;
  use(p);
  tick(60);
  assert.equal(d.rerolls, rerolls + 1, 'reroll completed');

  hold(p, 'shinobi:kurama_chakra');
  use(p);
  assert.equal(d.bijuu, 'kurama');
  assert.ok(d.learned.includes('tailed_beast_cloak'));
  hold(p, 'shinobi:sealing_scroll');
  p.isSneaking = true;
  use(p);
  p.isSneaking = false;
  assert.equal(d.bijuu, null, 'sneak + sealing scroll releases the beast');

  admin(p, 'clan uzumaki');
  d.eye = null;
  hold(p, 'shinobi:karma_seal');
  use(p);
  assert.ok(d.karma && d.eye === 'jogan', 'Uzumaki with Karma awaken the Jogan');

  eat(p, 'shinobi:chakra_fruit');
  assert.ok(d.ascended, 'fruit ascends');
  for (const food of ['shinobi:ichiraku_ramen', 'shinobi:soldier_pill', 'shinobi:spinach_pill', 'shinobi:curry_pill',
    'shinobi:chili_pill', 'shinobi:dango']) {
    eat(p, food);
  }
  tick(900);

  const tools = ['shinobi:kunai', 'shinobi:explosive_kunai', 'shinobi:shuriken', 'shinobi:fuma_shuriken', 'shinobi:senbon',
    'shinobi:smoke_bomb', 'shinobi:explosive_tag', 'shinobi:gunbai', 'shinobi:forbidden_scroll', 'shinobi:toad_contract',
    'shinobi:hashirama_cells'];
  for (const t of tools) {
    hold(p, t, 4);
    use(p);
    tick(10);
  }
  hold(p, 'shinobi:kote_gauntlet');
  p.inventory.setItem(6, new mc.ItemStack('shinobi:jutsu_cartridge', 3));
  use(p);
  p.isSneaking = true;
  use(p);
  p.isSneaking = false;
  tick(80);
  assert.ok(d.contracts.includes('toad'), 'toad contract signed');
  assert.ok(log.spawned.includes('shinobi:paper_bomb'), 'explosive tag planted');
  assert.ok(log.spawned.includes('shinobi:kunai_projectile'), 'kunai thrown');

  ui.answers.push(0);
  hold(p, 'shinobi:bijuu_summoning_scroll');
  use(p);
  await flush();
  tick(5);
  assert.ok(log.spawned.includes('shinobi:shukaku'), 'summoning scroll summons the chosen beast');
  noWarnings('items');
});

test('Shinobi Scroll menus render and navigate', async () => {
  const p = makePlayer('Menus');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  admin(p, 'clan none');
  admin(p, 'eye none');
  store.getData(p).jp = 10;
  const open = async (...answers) => {
    ui.answers.length = 0;
    ui.answers.push(...answers);
    hold(p, 'shinobi:shinobi_scroll');
    use(p);
    await flush(12);
  };
  const shownBefore = ui.shown.length;
  await open(0, 0);             // profile -> back -> main (closed)
  await open(1, 1);             // loadout -> toggle first jutsu
  await open(2, 1, 0);          // learn -> first option -> confirm
  await open(3, 0);             // natures
  await open(4, 1);             // missions -> accept first offer
  await open(4, 2);             // current mission -> abandon
  await open(5, 1);             // shop -> try to buy (no ryo)
  await open(6, [false]);       // settings (hud off)
  await open(7, 1, 0);          // codex -> first page -> back
  hold(p, 'shinobi:shinobi_scroll');
  p.isSneaking = true;
  ui.answers.push(0);
  use(p);                       // jutsu wheel
  p.isSneaking = false;
  await flush(6);
  assert.ok(ui.shown.length - shownBefore >= 12, `only ${ui.shown.length - shownBefore} forms shown`);
  assert.ok(ui.shown.some((f) => f.text.includes('Shinobi Codex')));
  noWarnings('menus');
});

test('combat hooks: charged Rasengan, Sharingan dodge, boss kill XP', () => {
  const p = makePlayer('Fighter');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const d = store.getData(p);
  d.rank = 1;
  d.learned.push('rasengan');
  store.setChakra(p, 999);
  casting.cast(p, 'rasengan');
  tick(2);
  const z = dummy();
  const hp = z.hp;
  world.afterEvents.entityHitEntity.fire({ damagingEntity: p, hitEntity: z });
  assert.ok(z.hp < hp, 'charged Rasengan detonates on hit');

  admin(p, 'eye sharingan');
  d.eyeOn = true;
  p.hp = 10;
  for (let i = 0; i < 40; i++) {
    world.afterEvents.entityHurt.fire({ hurtEntity: p, damage: 1, damageSource: { cause: 'entityAttack', damagingEntity: z } });
  }
  assert.ok(p.hp > 10 - 40, 'some attacks foreseen');

  const kurama = dummy('shinobi:kurama');
  const xp = d.xp;
  world.afterEvents.entityDie.fire({ deadEntity: kurama, damageSource: { cause: 'entityAttack', damagingEntity: p } });
  assert.ok(d.xp > xp, 'boss kill grants XP');
  noWarnings('combat');
});

test('bosses and NPCs think without errors', () => {
  const p = makePlayer('Bait');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  p.location = { x: 100, y: 64, z: 100 };
  const near = (dx, dz) => ({ x: 100 + dx, y: 64, z: 100 + dz });
  for (const id of ['shinobi:kurama', 'shinobi:juubi', 'shinobi:momoshiki']) dummy(id, near(0, 12));
  for (const id of ['shinobi:rogue_ninja', 'shinobi:akatsuki_rogue', 'shinobi:leaf_shinobi', 'shinobi:white_zetsu']) dummy(id, near(4, 6));
  dummy('minecraft:zombie', near(6, 6));
  const spawned = log.spawned.length;
  tick(800);
  assert.ok(log.spawned.slice(spawned).includes('shinobi:jutsu_orb'), 'bosses and NPCs cast jutsu');
  noWarnings('AI');
});

test('temporary jutsu terrain is placed and reverted', () => {
  const p = makePlayer('Builder');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const d = store.getData(p);
  d.natures.push('earth');
  d.rank = 1;
  d.learned.push('earth_wall');
  store.setChakra(p, 999);
  p.location = { x: 300, y: 64, z: 300 };
  casting.cast(p, 'earth_wall');
  tick(20);
  const walls = [...log.blocks.values()].filter((t) => t === 'shinobi:earth_wall').length;
  assert.ok(walls > 0, 'wall placed');
  tick(600);
  const left = [...log.blocks.values()].filter((t) => t === 'shinobi:earth_wall').length;
  assert.equal(left, 0, 'wall reverted to air');
  noWarnings('terrain');
});

test('using an item on a block works once (no double cast)', () => {
  const p = makePlayer('Clicker');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const d = store.getData(p);
  d.slots = ['substitution', 'body_flicker'];
  d.sel = 0;
  p.isSneaking = true;
  hold(p, 'shinobi:chakra_focus');
  const item = p.inventory.getItem(0);
  const ev = { player: p, itemStack: item, isFirstEvent: true, block: overworld.getBlock({ x: 0, y: 63, z: 1 }), cancel: false };
  world.beforeEvents.playerInteractWithBlock.fire(ev);
  world.afterEvents.itemUse.fire({ source: p, itemStack: item });
  tick(2);
  p.isSneaking = false;
  assert.equal(d.sel, 1, 'one cycle, not two');
  noWarnings('interact');
});

test('missions: accept, progress by kills, report for Ryo', async () => {
  const p = makePlayer('Genin');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const missions = await import('../src/scripts/missions.js');
  const d = store.getData(p);
  d.board = [{ id: 'x', grade: 'D', kind: 'hunt', target: 'minecraft:zombie', label: 'test', need: 3, have: 0, ryo: 5, xp: 10, jp: 1 }];
  d.boardDay = world.getDay();
  assert.ok(missions.accept(p, 0));
  for (let i = 0; i < 3; i++) {
    const z = dummy('minecraft:zombie', { x: 0, y: 64, z: 3 });
    world.afterEvents.entityDie.fire({ deadEntity: z, damageSource: { cause: 'entityAttack', damagingEntity: p } });
  }
  assert.equal(d.mission?.have, 3);
  const jp = d.jp;
  assert.ok(missions.turnIn(p), 'reward claimed');
  assert.equal(d.mission, null);
  assert.equal(d.jp, jp + 1);
  const ryo = p.inventory.slots.filter(Boolean).filter((s) => s.typeId === 'shinobi:ryo').reduce((n, s) => n + s.amount, 0);
  assert.equal(ryo, 5, 'paid in Ryo');
  assert.equal(missions.board(p).length > 0, true, 'board offers missions');
  noWarnings('missions');
});

test('shop buys with Ryo and buys back crystals', async () => {
  const p = makePlayer('Buyer');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const shop = await import('../src/scripts/shop.js');
  p.inventory.setItem(10, new mc.ItemStack('shinobi:ryo', 5));
  p.inventory.setItem(11, new mc.ItemStack('shinobi:chakra_crystal', 4));
  assert.ok(shop.buy(p, shop.OFFERS.findIndex((o) => o.item === 'shinobi:kunai')));
  assert.equal(shop.wallet(p), 3);
  assert.equal(shop.sell(p, 0), 2, 'two bundles of crystals sold');
  assert.equal(shop.wallet(p), 5);
  assert.ok(!shop.buy(p, shop.OFFERS.findIndex((o) => o.item === 'shinobi:clan_reroll_scroll')), 'cannot afford');
  noWarnings('shop');
});

test('blueprints build structures into empty space only', () => {
  const p = makePlayer('Architect');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  for (const [bp, at] of [['shinobi:blueprint_leaf_gate', 500], ['shinobi:blueprint_ramen_stand', 600], ['shinobi:blueprint_training_ground', 700]]) {
    p.location = { x: at, y: 64, z: at };
    const before = log.blocks.size;
    hold(p, bp);
    use(p);
    assert.ok(log.blocks.size > before, `${bp} placed blocks`);
    assert.equal(p.inventory.getItem(0), undefined, `${bp} consumed`);
  }
  assert.ok(log.spawned.includes('shinobi:training_post'), 'training ground spawns posts');
  noWarnings('builder');
});

test('v1.1 items: clay, eyes, seal, contracts, puppetry, blades, rings', () => {
  const p = makePlayer('Collector');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const d = store.getData(p);
  p.location = { x: 900, y: 64, z: 900 };
  hold(p, 'shinobi:explosive_clay', 3);
  use(p);
  assert.ok(d.unlocks.includes('clay'), 'first clay teaches Explosion Release');
  use(p);
  admin(p, 'clan uchiha');
  d.eye = 'mangekyo';
  hold(p, 'shinobi:uchiha_eye');
  use(p);
  assert.ok(d.eternal, 'Itachi\'s eyes make the Mangekyo eternal');
  for (const c of ['shinobi:snake_contract', 'shinobi:slug_contract', 'shinobi:puppet_scroll', 'shinobi:curse_seal']) {
    hold(p, c);
    use(p);
  }
  assert.ok(d.contracts.includes('snake') && d.contracts.includes('slug'), 'contracts signed');
  assert.ok(d.unlocks.includes('puppet'), 'puppetry learned');
  hold(p, 'shinobi:hiramekarei');
  const z = dummy('minecraft:zombie', { x: 900, y: 64, z: 903 });
  world.afterEvents.entityHitEntity.fire({ damagingEntity: p, hitEntity: z });
  assert.equal(state.rt(p).bladeCharge, 1, 'Hiramekarei stores chakra');
  use(p);
  assert.equal(state.rt(p).bladeCharge, 0, 'and releases it');
  for (const blade of ['shinobi:kiba', 'shinobi:nuibari', 'shinobi:shibuki']) {
    hold(p, blade);
    world.afterEvents.entityHitEntity.fire({ damagingEntity: p, hitEntity: z });
  }
  hold(p, 'shinobi:kara_ring');
  use(p);
  assert.ok(log.spawned.includes('shinobi:jigen'), 'Kara ring summons Jigen');
  tick(40);
  noWarnings('v1.1 items');
});

test('mini-bosses think, Deidara detonates, Kinshiki is absorbed', () => {
  const p = makePlayer('Hunter');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  p.location = { x: -400, y: 64, z: -400 };
  const near = (dx, dz) => ({ x: -400 + dx, y: 64, z: -400 + dz });
  const bosses = ['itachi', 'kisame', 'deidara', 'orochimaru', 'jigen'].map((k, i) => dummy(`shinobi:${k}`, near(i * 2, 6)));
  const spawned = log.spawned.length;
  tick(600);
  assert.ok(log.spawned.slice(spawned).includes('shinobi:jutsu_orb'), 'rogues cast jutsu');
  const deidara = bosses[2];
  deidara.hp = 5;
  tick(140);
  assert.ok(deidara.hp <= 0 || deidara.removed, 'Deidara blows himself up');
  const momo = dummy('shinobi:momoshiki', near(-6, 6));
  const kin = dummy('shinobi:kinshiki', near(-8, 6));
  kin.hp = 10;
  momo.hp = 100;
  tick(40);
  assert.ok(kin.removed, 'Kinshiki absorbed');
  assert.ok(momo.hp > 100, 'Momoshiki healed');
  noWarnings('rogues');
});

test('talking to a Leaf Shinobi opens the mission desk', async () => {
  const p = makePlayer('Visitor');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const leaf = dummy('shinobi:leaf_shinobi', { x: 0, y: 64, z: 2 });
  const shown = ui.shown.length;
  world.beforeEvents.playerInteractWithEntity.fire({ player: p, target: leaf, cancel: false });
  tick(2);
  await flush(6);
  assert.ok(ui.shown.slice(shown).some((f) => f.text.includes('Mission Desk')), 'mission desk shown');
  noWarnings('leaf desk');
});

test('profiles persist through dynamic properties', () => {
  store.saveNow(hero);
  const raw = hero.getDynamicProperty('sr:data');
  assert.equal(typeof raw, 'string');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.clan, store.getData(hero).clan);
  assert.ok(raw.length < 32767);
});
