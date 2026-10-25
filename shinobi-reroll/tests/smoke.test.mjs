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
    d.contract = true;
    d.bijuu = 'kurama';
    d.sync = 60;
    d.karma = true;
    d.karmaEnergy = 30;
    d.ascended = true;
    d.sageEnergy = 100;
    d.strain = 0;
    d.learned = [...new Set([...d.learned, ...(j.requires ?? []), j.id])];
    const r = state.rt(p);
    r.toggles.clear();
    if (j.id === 'tailed_beast_bomb') r.toggles.add('tailed_beast_cloak');
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
  assert.ok(d.contract, 'toad contract signed');
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
  await open(4, [false]);       // settings (hud off)
  await open(5, 1, 0);          // codex -> first page -> back
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

test('profiles persist through dynamic properties', () => {
  store.saveNow(hero);
  const raw = hero.getDynamicProperty('sr:data');
  assert.equal(typeof raw, 'string');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.clan, store.getData(hero).clan);
  assert.ok(raw.length < 32767);
});
