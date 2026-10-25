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
    d.unlocks = ['clay', 'puppet', 'curse', 'code'];
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
  await open(6, 2, 0);          // inner path -> bonds -> back
  await open(7, [false]);       // settings (hud off)
  await open(8, 1, 0);          // codex -> first page -> back
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

// ------------------------------------------------------------------ v1.2: The Inner Path

test('Inner Path data: every jutsu school has a focus, mixed thoughts are well-formed', async () => {
  const { FOCI, MIXED } = await import('../src/scripts/data.js');
  const schools = new Set([...JUTSU.values()].map((j) => j.school));
  for (const school of schools) {
    const owners = Object.keys(FOCI).filter((k) => FOCI[k].schools.includes(school));
    assert.equal(owners.length, 1, `school ${school} belongs to ${owners.length} focuses`);
  }
  for (const key of Object.keys(MIXED)) {
    const parts = key.split('+');
    assert.equal(parts.length, 2, key);
    assert.deepEqual([...parts].sort(), parts, `${key} must be sorted`);
    for (const f of parts) assert.ok(FOCI[f], `${key}: unknown focus ${f}`);
  }
});

test('Inner Path: nindo oath, private journal, resolve, missions, bonds and the Unbreakable Will', async () => {
  const inner = await import('../src/scripts/innerpath.js');
  const missions = await import('../src/scripts/missions.js');
  const p = makePlayer('Seeker');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  const d = store.getData(p);
  const open = async (...answers) => {
    ui.answers.length = 0;
    ui.answers.push(...answers);
    hold(p, 'shinobi:shinobi_scroll');
    use(p);
    await flush(12);
  };
  // swear "Never Go Back on My Word" (first nindo) with a motto
  await open(6, 0, 1, ['§cI keep\nmy promises', true]);
  assert.equal(d.nindo, 'word');
  assert.equal(d.motto, 'I keep my promises', 'motto sanitised');
  assert.match(inner.chooseNindo(p, 'fire') ?? '', /not changed lightly/, 'nindo locked for a few days');
  // an oath needs the toggle
  await open(6, 0, 2, ['', false]);
  assert.equal(d.nindo, 'word');

  // the journal: Drained, Self + Nature (Sage's Insight), an intention
  const xp = d.xp;
  await open(6, 1, [3, 6, 8, 'help a friend']);
  assert.equal(d.journalDays, 1);
  assert.equal(d.focus, 'self');
  assert.equal(d.focus2, 'nature');
  assert.equal(inner.mixedThought(d), "Sage's Insight");
  assert.equal(d.intention, 'help a friend');
  assert.equal(d.resolve, 15, 'mixed thought: +10 Resolve, x1.5 for the Self focus');
  assert.ok(d.xp > xp, 'reflection grants XP');
  assert.ok(p.effects.has('minecraft:regeneration'), 'a drained shinobi is cared for');
  // the journal item opens the same page; a second page today updates but is not rewarded again
  ui.answers.length = 0;
  ui.answers.push([1, 0, 0, '']);
  hold(p, 'shinobi:shinobi_journal');
  use(p);
  await flush(12);
  assert.equal(d.journalDays, 1);
  assert.equal(d.focus, 'body');
  assert.equal(d.focus2, null);
  assert.equal(d.resolve, 15);

  // focus discounts: Body covers Taijutsu
  const tai = [...JUTSU.values()].find((j) => j.school === 'Taijutsu' && j.cost > 0);
  if (tai) assert.ok(casting.costOf(p, tai) < tai.cost * (CLANS[d.clan].costMult ?? 1), 'focused school costs less');

  // keeping your word: +25% mission rewards and +20 Resolve
  d.mission = { id: 'w', grade: 'D', kind: 'cast', target: 'any', label: 'oath', need: 1, have: 1, ryo: 4, xp: 20, jp: 0 };
  assert.ok(missions.turnIn(p));
  const ryo = p.inventory.slots.filter(Boolean).filter((s) => s.typeId === 'shinobi:ryo').reduce((n, s) => n + s.amount, 0);
  assert.equal(ryo, 5, 'Never Go Back on My Word pays 25% more');
  assert.equal(d.resolve, 35);
  d.mission = { id: 'w2', grade: 'D', kind: 'cast', target: 'any', label: 'oath', need: 9, have: 0, ryo: 4, xp: 20, jp: 0 };
  missions.abandon(p);
  assert.equal(d.resolve, 20, 'abandoning a mission shakes your resolve');

  // bonds with a friend and a companion
  const friend = makePlayer('Friend');
  world.afterEvents.playerSpawn.fire({ player: friend, initialSpawn: true });
  tick(60);
  const wolf = overworld.spawnEntity('minecraft:wolf', { x: 1, y: 64, z: 1 });
  wolf.tamedTo = p.id;
  for (let i = 0; i < 5; i++) {
    const z = dummy('minecraft:zombie', { x: 0, y: 64, z: 3 });
    world.afterEvents.entityDie.fire({ deadEntity: z, damageSource: { cause: 'entityAttack', damagingEntity: p } });
  }
  assert.equal(d.bonds[`p:${friend.id}`]?.pts, 10, 'two points per shared victory');
  assert.equal(store.getData(friend).bonds[`p:${p.id}`]?.pts, 10, 'bonds are mutual');
  assert.equal(d.bonds[`c:${wolf.id}`]?.pts, 5, 'companions bond too');
  assert.ok(p.chat.some((m) => m.includes('Bond deepened') && m.includes('Friend')), 'Comrade announced');
  tick(41);
  assert.ok(state.rt(p).allyNear, 'allies detected');
  assert.ok(state.rt(p).bondTier >= 1, 'a Comrade is near');
  world.afterEvents.entityDie.fire({ deadEntity: wolf, damageSource: { cause: 'entityAttack' } });
  assert.equal(d.bonds[`c:${wolf.id}`]?.gone, true, 'a fallen companion is remembered');
  await open(6, 2, 0);
  assert.ok(ui.shown.some((f) => f.text.includes('remembered')), 'bonds page lists memories');

  // Unbreakable Will at full Resolve
  d.resolve = 100;
  p.hp = 3;
  world.afterEvents.entityHurt.fire({ hurtEntity: p, damage: 5, damageSource: { cause: 'entityAttack' } });
  assert.ok(p.hp >= 12, `rose again (${p.hp} hp)`);
  assert.equal(d.resolve, 50, 'the will costs 50 Resolve');
  assert.ok(p.titles.some((t) => t.includes("won't give up")));

  // nothing private leaks into world chat
  assert.ok(!log.messages.some((m) => m.includes('help a friend') && !p.chat.includes(m)), 'intention stays private');
  noWarnings('inner path');
});

test('Waterfall of Truth: strikes feed the reflection, calm ends the trial', async () => {
  const { ENTITY } = await import('../src/scripts/ids.js');
  const inner = await import('../src/scripts/innerpath.js');
  const p = makePlayer('Calm');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  p.location = { x: 40, y: 64, z: 40 };
  const d = store.getData(p);
  d.rank = 1;
  admin(p, 'nindo peace');
  // a waterfall: three blocks of falling water beside the player, above head height
  const fall = [65, 66, 67].map((y) => `42,${y},40`);
  for (const k of fall) log.blocks.set(k, 'minecraft:flowing_water');
  assert.ok(inner.nearWaterfall(p));
  const jp = d.jp;
  p.isSneaking = true;
  tick(100);
  const t = inner.trialOf(p.id);
  assert.ok(t, 'sitting still beside a waterfall begins the trial');
  const e = world.getEntity(t.id);
  assert.equal(e?.typeId, ENTITY.darkReflection);
  // one strike: the reflection grows stronger and calm resets
  world.afterEvents.dataDrivenEntityTrigger.fire({ entity: e, eventId: 'shinobi:struck', getModifiers: () => [] });
  assert.equal(inner.trialOf(p.id)?.struck, 1);
  assert.ok(e.effects.has('minecraft:strength'), 'hatred feeds it');
  tick(20 * 26);
  assert.equal(inner.trialOf(p.id), undefined, 'the trial ended');
  assert.ok(d.innerPeace, 'calm brings Inner Peace');
  assert.equal(d.jp, jp + 3);
  assert.ok(!e.isValid, 'the reflection returns to the water');
  assert.ok(d.resolve >= 40);
  // the waterfall is quiet for the rest of the day
  p.isSneaking = false;
  tick(20);
  p.isSneaking = true;
  tick(100);
  assert.equal(inner.trialOf(p.id), undefined, 'one trial per day');
  p.isSneaking = false;

  // striking five times: hatred wins, no reward
  const q = makePlayer('Angry');
  world.afterEvents.playerSpawn.fire({ player: q, initialSpawn: true });
  tick(60);
  q.location = { x: -40, y: 64, z: -40 };
  admin(q, 'trial');
  const tq = inner.trialOf(q.id);
  assert.ok(tq, 'admin can start a trial');
  const eq = world.getEntity(tq.id);
  for (let i = 0; i < 5; i++) {
    if (i % 2) world.afterEvents.entityHitEntity.fire({ damagingEntity: q, hitEntity: eq });
    else world.afterEvents.dataDrivenEntityTrigger.fire({ entity: eq, eventId: 'shinobi:struck', getModifiers: () => [] });
    tick(11);
  }
  assert.equal(inner.trialOf(q.id), undefined, 'the trial failed');
  assert.equal(store.getData(q).innerPeace, false);
  assert.ok(!eq.isValid);
  assert.ok(q.chat.some((m) => m.includes('hatred feeds it')));
  for (const k of fall) log.blocks.delete(k);
  noWarnings('waterfall');
});

// ------------------------------------------------------------------ v1.3: Boruto & HD

test('Boruto: Kara Inner Mark summons Code, White Karma unlocks his arts, Claw Marks blink', async () => {
  const { ENTITY } = await import('../src/scripts/ids.js');
  const p = makePlayer('Kawaki');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  p.location = { x: 200, y: 64, z: 200 };
  const d = store.getData(p);
  d.rank = 4;
  // summon Code with the mark (no other boss around)
  hold(p, 'shinobi:kara_inner_mark');
  use(p);
  assert.ok(log.spawned.includes(ENTITY.code), 'Code arrives');
  const code = overworld.getEntities({ type: ENTITY.code }).at(-1);
  // his brain runs every phase without errors
  code.location = { x: 205, y: 64, z: 200 };
  code.hp = code.maxHp = 640;
  for (let i = 0; i < 12; i++) tick(80);
  code.hp = 200;
  tick(80);
  assert.ok(log.messages.some((m) => m.includes('limiters')), 'limiter release at half health');
  for (let i = 0; i < 12; i++) tick(80);
  noWarnings('code brain');

  // White Karma Seal -> Claw Marks
  hold(p, 'shinobi:white_karma_seal');
  use(p);
  assert.ok(d.unlocks.includes('code'), 'White Karma unlocked');
  d.learned.push('claw_marks');
  store.setChakra(p, 999);
  casting.cast(p, 'claw_marks');
  tick(5);
  const mark = state.rt(p).clawMark;
  assert.ok(mark, 'first cast carves a mark');
  state.rt(p).cooldowns.clear();
  const z = dummy('minecraft:zombie', { x: (p.location.x + mark.loc.x) / 2, y: 64, z: (p.location.z + mark.loc.z) / 2 });
  const hp = z.hp;
  casting.cast(p, 'claw_marks');
  tick(5);
  assert.equal(state.rt(p).clawMark, null, 'second cast consumes the mark');
  assert.equal(p.location.x, mark.loc.x, 'blinked to the mark');
  assert.ok(z.hp < hp, 'slashed what stood between');

  // Claw Grime drain chakra
  const grime = dummy(ENTITY.clawGrime, p.location);
  store.setChakra(p, 100);
  world.afterEvents.entityHitEntity.fire({ damagingEntity: grime, hitEntity: p });
  assert.ok(store.getChakra(p) <= 90, 'chakra devoured');
  noWarnings('boruto');
});

test('Boruto: Jigen becomes Isshiki below 30% health', async () => {
  const { ENTITY } = await import('../src/scripts/ids.js');
  const p = makePlayer('Boruto');
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  tick(60);
  p.location = { x: -200, y: 64, z: -200 };
  const jigen = dummy(ENTITY.jigen, { x: -196, y: 64, z: -200 });
  jigen.maxHp = 520;
  jigen.hp = 100;
  for (let i = 0; i < 6; i++) tick(80);
  assert.equal(jigen.nameTag, 'Isshiki Otsutsuki');
  assert.ok(jigen.hp > 100, 'the vessel heals as Isshiki takes over');
  assert.ok(log.messages.some((m) => m.includes('Isshiki Otsutsuki')));
  for (let i = 0; i < 10; i++) tick(80);
  jigen.remove();
  noWarnings('isshiki');
});

test('Boruto-era Nindo: the shadow guard answers, the future Hokage earns more', async () => {
  const inner = await import('../src/scripts/innerpath.js');
  const g = makePlayer('Guardian');
  const ally = makePlayer('Ally');
  for (const x of [g, ally]) world.afterEvents.playerSpawn.fire({ player: x, initialSpawn: true });
  tick(60);
  for (const x of [g, ally]) x.location = { x: 300, y: 64, z: 300 };
  const dg = store.getData(g);
  assert.equal(inner.chooseNindo(g, 'shadow'), null);
  world.afterEvents.entityHurt.fire({ hurtEntity: ally, damage: 2, damageSource: { cause: 'entityAttack' } });
  assert.ok(g.effects.has('minecraft:speed') && g.effects.has('minecraft:strength'), 'guardian empowered');
  assert.equal(dg.resolve, 1);
  // night kills build resolve
  world.timeOfDay = 18000;
  const z = dummy('minecraft:zombie', { x: 300, y: 64, z: 303 });
  world.afterEvents.entityDie.fire({ deadEntity: z, damageSource: { cause: 'entityAttack', damagingEntity: g } });
  world.timeOfDay = 6000;
  assert.equal(dg.resolve, 3);

  const s = makePlayer('Sarada');
  world.afterEvents.playerSpawn.fire({ player: s, initialSpawn: true });
  tick(60);
  const ds = store.getData(s);
  admin(s, 'clan none');
  assert.equal(inner.chooseNindo(s, 'hokage'), null);
  const jp = ds.jp;
  admin(s, 'xp 100');
  assert.equal(ds.rank, 1, 'Genin');
  assert.equal(ds.jp, jp + 3 + 1 + 1, 'rank-up JP + clanless bonus + the future Hokage\'s extra point');
  assert.equal(ds.resolve, 30);
  noWarnings('boruto nindo');
});

test('HD textures: 32-texel heads, 32x icons and blocks, 2x creature textures', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const rp = new URL('../build/ShinobiReroll_RP/', import.meta.url);
  if (!existsSync(rp)) return; // `npm run check` builds first; plain `npm test` may run without a build
  const size = (rel) => {
    const b = readFileSync(new URL(rel, rp));
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  assert.deepEqual(size('textures/entity/npc/code.png'), [256, 256], 'skins are 4x (head = 32x32x32 texels)');
  assert.deepEqual(size('textures/entity/npc/shadow_clone.png'), [256, 256]);
  assert.deepEqual(size('textures/items/kara_inner_mark.png'), [32, 32]);
  assert.deepEqual(size('textures/items/kunai.png'), [32, 32]);
  assert.deepEqual(size('textures/blocks/chakra_ore.png'), [32, 32]);
  assert.deepEqual(size('textures/models/armor/leaf_headband.png'), [256, 128]);
  const geo = JSON.parse(readFileSync(new URL('models/entity/claw_grime.geo.json', rp), 'utf8'))['minecraft:geometry'][0].description;
  assert.deepEqual(size('textures/entity/claw_grime.png'), [geo.texture_width * 2, geo.texture_height * 2]);
});
