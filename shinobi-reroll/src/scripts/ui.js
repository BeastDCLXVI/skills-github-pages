import { system, world } from '@minecraft/server';
import { ActionFormData, FormCancelationReason, MessageFormData, ModalFormData } from '@minecraft/server-ui';
import {
  BIJUU, BOND_TIERS, CLANS, DOJUTSU, FOCI, KEKKEI, MOODS, NATURES, NINDO, RANKS, RARITY_COLOR, bijuuByKey, bondTier,
} from './data.js';
import { ITEM, PARTICLE, SOUND } from './ids.js';
import { JUTSU, learnCost, meets } from './jutsu/index.js';
import { costOf, dropToggles } from './casting.js';
import {
  RESOLVE_MAX, bondList, checkIn, chooseNindo, focusLabel, mixedThought, nindoLockedFor,
} from './innerpath.js';
import { GRADE_COLOR, abandon, accept, board, progressOf, turnIn } from './missions.js';
import { BUYBACK, OFFERS, buy, sell, wallet } from './shop.js';
import { summonBoss } from './bosses.js';
import { toggleEye } from './dojutsu.js';
import { changeClan, eyeName, learn } from './progression.js';
import { rt } from './state.js';
import { getChakra, getData, loadoutSize, maxChakra, natureSlots, rollClan, touch } from './store.js';
import { consumeHeld, fx, heldItem, ping, settings, tell, title } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

/**
 * Show a form, retrying while the player is busy (e.g. chat open).
 * @template {ActionFormData | MessageFormData | ModalFormData} F
 * @param {F} form @param {Player} p
 * @returns {Promise<Awaited<ReturnType<F['show']>> | undefined>}
 */
async function show(form, p) {
  for (let i = 0; i < 20; i++) {
    const res = /** @type {any} */ (await form.show(p));
    if (res.canceled && res.cancelationReason === FormCancelationReason.UserBusy) {
      await system.waitTicks(5);
      continue;
    }
    return res;
  }
  return undefined;
}

const ICON = {
  profile: 'textures/items/shinobi_scroll',
  loadout: 'textures/items/chakra_focus',
  learn: 'textures/items/forbidden_scroll',
  nature: 'textures/entity/jutsu/fire',
  eye: 'textures/items/sigil',
  beast: 'textures/items/kurama_chakra',
  settings: 'textures/items/kote_gauntlet',
  codex: 'textures/items/toad_contract',
  missions: 'textures/items/blueprint_leaf_gate',
  shop: 'textures/items/ryo',
  inner: 'textures/items/shinobi_journal',
};

/** @param {Player} p */
function summary(p) {
  const d = getData(p);
  const clan = CLANS[d.clan];
  const r = RANKS[d.rank];
  const next = RANKS[d.rank + 1];
  return [
    `${r.color}${r.name}§r  ·  ${clan.color}${clan.name}§r clan  ·  §e${d.jp} JP`,
    `§bChakra ${Math.floor(getChakra(p))}/${maxChakra(p)}§r  ·  XP ${d.xp}${next ? ` / ${next.xp}` : ''}`,
    `Natures: ${d.natures.map((n) => `${NATURES[n].color}${NATURES[n].name}§r`).join(', ')}`,
  ].join('\n');
}

/** @param {Player} p */
export async function mainMenu(p) {
  const d = getData(p);
  /** @type {Array<[string, string, () => Promise<void> | void]>} */
  const entries = [
    ['Profile', ICON.profile, () => profile(p)],
    [`Jutsu Loadout §8(${d.slots.length}/${loadoutSize(d)})`, ICON.loadout, () => loadout(p)],
    [`Learn Jutsu §8(${d.jp} JP)`, ICON.learn, () => learnMenu(p)],
    [`Nature Transformation §8(${d.natures.length}/${natureSlots(d)})`, ICON.nature, () => natureMenu(p)],
    [`Missions${d.mission ? ` §8(${progressOf(p).have}/${progressOf(p).need})` : ''}`, ICON.missions, () => missionsMenu(p)],
    [`Ninja Shop §8(${wallet(p)} Ryo)`, ICON.shop, () => shopMenu(p)],
    [`Inner Path${d.nindo ? ` §8(${Math.floor(d.resolve)} Resolve)` : ' §8(choose your Nindo)'}`, ICON.inner, () => innerPathMenu(p)],
  ];
  if (d.eye) entries.push([`${DOJUTSU[d.eye].color}${DOJUTSU[d.eye].name}`, ICON.eye, () => eyeMenu(p)]);
  if (d.bijuu) entries.push([`§6${bijuuByKey(d.bijuu)?.name}`, ICON.beast, () => beastMenu(p)]);
  entries.push(['Settings', ICON.settings, () => settingsMenu(p)], ['Shinobi Codex', ICON.codex, () => codex(p)]);
  const form = new ActionFormData().title('§l§6Shinobi Scroll').body(summary(p));
  for (const [label, icon] of entries) form.button(label, icon);
  const res = await show(form, p);
  if (!res || res.canceled || res.selection === undefined) return;
  await entries[res.selection][2]();
}

/** @param {Player} p */
async function profile(p) {
  const d = getData(p);
  const clan = CLANS[d.clan];
  const lines = [
    summary(p),
    '',
    `§lClan:§r ${clan.color}${clan.name} §7(${RARITY_COLOR[clan.rarity]}${clan.rarity}§7)`,
    `§7${clan.lore}`,
    `§aPerk:§r ${clan.perk}`,
    clan.kekkei ? `§dKekkei Genkai:§r ${KEKKEI[clan.kekkei].name}` : '',
    d.wood && d.clan !== 'senju' ? '§2Hashirama Cells:§r Wood Release unlocked' : '',
    '',
    `§lDojutsu:§r ${d.eternal && d.eye === 'mangekyo' ? 'Eternal ' : ''}${eyeName(d.eye)}${d.eye === 'sharingan' ? ` (${d.eyeStage} tomoe, ${d.eyeXp} eye XP)` : ''}${d.eye ? ` · strain ${Math.floor(d.strain)}%` : ''}`,
    `§lTailed Beast:§r ${d.bijuu ? `${bijuuByKey(d.bijuu)?.name} (sync ${Math.floor(d.sync)}%)` : 'None'}`,
    `§lKarma:§r ${d.karma ? `Yes (energy ${Math.floor(d.karmaEnergy)})` : 'No'}  ·  §lOtsutsuki:§r ${d.ascended ? 'Ascended' : 'No'}`,
    `§lContracts:§r ${d.contracts.length ? d.contracts.join(', ') : 'none'}${d.contracts.includes('toad') ? ` · natural energy ${Math.floor(d.sageEnergy)}%` : ''}`,
    d.unlocks.length ? `§lArts:§r ${d.unlocks.map((u) => ({ clay: 'Explosion Release', puppet: 'Puppetry', curse: 'Cursed Seal', code: 'White Karma', sand: 'Sand' })[u] ?? u).join(', ')}` : '',
    `§lNindo:§r ${d.nindo ? `${NINDO[d.nindo].color}${NINDO[d.nindo].name}§r · Resolve ${Math.floor(d.resolve)}/${RESOLVE_MAX}` : 'not chosen'}${d.innerPeace ? ' · §fInner Peace' : ''}`,
    '',
    `§7Jutsu learned: ${d.learned.length} · casts: ${d.casts} · defeated: ${d.kills} · missions: ${d.missionsDone} · rerolls: ${d.rerolls}`,
  ].filter((l) => l !== '');
  const res = await show(new ActionFormData().title('Profile').body(lines.join('\n')).button('Back'), p);
  if (res && !res.canceled) await mainMenu(p);
}

/** @param {Player} p */
async function loadout(p) {
  const d = getData(p);
  const learned = d.learned.map((id) => JUTSU.get(id)).filter((j) => !!j);
  learned.sort((a, b) => a.school.localeCompare(b.school) || a.rank - b.rank);
  const form = new ActionFormData().title('Jutsu Loadout')
    .body(`Equipped jutsu are cast with the §bChakra Focus§r (use = cast, sneak + use = next).\nSlots: ${d.slots.length}/${loadoutSize(d)}`)
    .button('§lDone');
  for (const j of learned) {
    const on = d.slots.includes(j.id);
    const active = d.slots[d.sel] === j.id;
    form.button(`${active ? '§6» ' : on ? '§a+ ' : '§7- '}${j.name}\n§8${j.school} · ${costOf(p, j)} chakra · ${j.cd}s`);
  }
  const res = await show(form, p);
  if (!res || res.canceled || !res.selection) return;
  const j = learned[res.selection - 1];
  if (d.slots.includes(j.id)) {
    const idx = d.slots.indexOf(j.id);
    if (d.sel === idx) {
      d.slots.splice(idx, 1);
      d.sel = Math.min(d.sel, Math.max(0, d.slots.length - 1));
    } else {
      d.sel = idx;
    }
  } else if (d.slots.length < loadoutSize(d)) {
    d.slots.push(j.id);
    d.sel = d.slots.length - 1;
  } else {
    tell(p, '§cLoadout full. Unequip something first (tap the active jutsu to unequip it).');
  }
  touch(p);
  await loadout(p);
}

/** @param {Player} p */
async function learnMenu(p) {
  const d = getData(p);
  const options = [...JUTSU.values()].filter((j) => !j.auto && !d.learned.includes(j.id));
  options.sort((a, b) => Number(!meets(d, a).ok) - Number(!meets(d, b).ok) || a.rank - b.rank || a.name.localeCompare(b.name));
  const form = new ActionFormData().title(`Learn Jutsu (${d.jp} JP)`)
    .body('Earn Jutsu Points from rank-ups, every 250 XP and Scrolls of Seals.')
    .button('§lBack');
  for (const j of options) {
    const m = meets(d, j);
    form.button(`${m.ok ? (d.jp >= learnCost(j) ? '§a' : '§e') : '§8'}${j.name}\n§8${j.school} · ${learnCost(j)} JP${m.ok ? '' : ` · ${m.why}`}`);
  }
  const res = await show(form, p);
  if (!res || res.canceled) return;
  if (!res.selection) return mainMenu(p);
  const j = options[res.selection - 1];
  const m = meets(d, j);
  const body = [
    `§l${j.name}§r  §7(${j.school})`,
    j.desc,
    '',
    `Rank: ${RANKS[j.rank].name} · Chakra: ${j.cost} · Cooldown: ${j.cd}s${j.toggle ? ` · Upkeep ${j.toggle.upkeep}/s` : ''}`,
    j.seals.length ? `Hand seals: ${j.seals.join(' > ')}` : 'No hand seals needed.',
    m.ok ? `§aYou can learn this for ${learnCost(j)} JP.` : `§cLocked: ${m.why}.`,
  ].join('\n');
  const confirm = await show(new MessageFormData().title(j.name).body(body).button1(m.ok ? 'Learn' : 'Back').button2('Cancel'), p);
  if (confirm && !confirm.canceled && confirm.selection === 0 && m.ok) {
    const err = learn(p, j.id);
    if (err) tell(p, `§c${err}`);
    else {
      title(p, ' ', `§aLearned ${j.name}!`, 30);
      ping(p, SOUND.levelup, 1.4);
    }
  }
  await learnMenu(p);
}

/** @param {Player} p */
async function natureMenu(p) {
  const d = getData(p);
  const free = natureSlots(d) - d.natures.length;
  const rest = Object.keys(NATURES).filter((n) => !d.natures.includes(n));
  const form = new ActionFormData().title('Nature Transformation')
    .body(`Your natures: ${d.natures.map((n) => NATURES[n].name).join(', ')}\n${free > 0 ? `§aYou may master ${free} more nature${free > 1 ? 's' : ''}.` : '§7Rank up to unlock more natures (Chunin, Jonin, Sannin, Kage).'}`)
    .button('§lBack');
  if (free > 0) for (const n of rest) form.button(`${NATURES[n].color}${NATURES[n].name} §7(${NATURES[n].kanji})`);
  const res = await show(form, p);
  if (!res || res.canceled) return;
  if (!res.selection) return mainMenu(p);
  const n = rest[res.selection - 1];
  d.natures.push(n);
  touch(p);
  title(p, `${NATURES[n].color}${NATURES[n].name} Release`, '§7New nature mastered', 40);
  ping(p, SOUND.orb, 1.0);
}

/** @param {Player} p */
async function eyeMenu(p) {
  const d = getData(p);
  if (!d.eye) return;
  const info = DOJUTSU[d.eye];
  const body = [
    `${info.color}${info.name}§r · ${d.eyeOn ? '§aactive' : '§7inactive'}`,
    `Chakra drain: ${info.drain}/s · Eye strain: ${Math.floor(d.strain)}%`,
    d.eye === 'sharingan' ? `Tomoe: ${d.eyeStage}/3 (${d.eyeXp} eye XP). Fight with it active to mature it.` : '',
    d.eye === 'sharingan' && d.eyeStage >= 3 ? '§4At Jonin rank, the loss of a companion you cherish awakens the Mangekyo.' : '',
    d.eye === 'mangekyo' ? (d.rank >= 5 || d.eternal ? '§aEternal: no more strain.' : '§cEvery use strains your eyes. Reach Kage rank or transplant Itachi\'s eyes for the Eternal Mangekyo.') : '',
    '§7Quick toggle: sneak + jump.',
  ].filter(Boolean).join('\n');
  const res = await show(new ActionFormData().title(info.name).body(body).button(d.eyeOn ? 'Deactivate' : 'Activate').button('Back'), p);
  if (!res || res.canceled) return;
  if (res.selection === 0) toggleEye(p);
  else await mainMenu(p);
}

/** @param {Player} p */
async function beastMenu(p) {
  const d = getData(p);
  const b = bijuuByKey(d.bijuu ?? '');
  if (!b) return;
  const body = [
    `§6${b.name}§r, the ${b.title}`,
    `Sync: ${Math.floor(d.sync)}% (rises while the cloak is active; 100% unlocks full Tailed Beast power)`,
    'Techniques: Tailed Beast Chakra Cloak, Tailed Beast Bomb (needs cloak + 50% sync).',
    '§7To release the beast into an orb, sneak and use a Sealing Scroll.',
  ].join('\n');
  const res = await show(new ActionFormData().title(b.name).body(body).button('Back'), p);
  if (res && !res.canceled) await mainMenu(p);
}

/** @param {Player} p */
async function settingsMenu(p) {
  const d = getData(p);
  const s = settings();
  const form = new ModalFormData().title('Settings')
    .toggle('Show chakra HUD', { defaultValue: d.hud })
    .label(`§7World rules (change with §f/scriptevent shinobi:admin§7):\nJutsu break blocks: ${s.griefing ? '§con' : '§aoff'}§7 · PvP jutsu: ${s.pvp ? 'on' : 'off'} · NPC jutsu: ${s.npcJutsu ? 'on' : 'off'} · XP rate: x${s.xpRate}`);
  const res = await show(form, p);
  if (!res || res.canceled || !res.formValues) return;
  d.hud = !!res.formValues[0];
  if (!d.hud) p.onScreenDisplay.setActionBar(' ');
  touch(p);
}

/** @param {Player} p */
export async function missionsMenu(p) {
  const d = getData(p);
  const m = d.mission;
  if (m) {
    const { have, need } = progressOf(p);
    const done = have >= need;
    const body = [
      `${GRADE_COLOR[m.grade]}${m.grade}-rank§r · ${m.label}`,
      `${m.kind === 'gather' ? 'Bring' : m.kind === 'hunt' ? 'Defeat' : m.kind === 'cast' ? 'Cast jutsu' : 'Training Post hits'}: ${have}/${need}${m.kind === 'gather' ? ` × ${m.target.split(':')[1].replace(/_/g, ' ')}` : m.kind === 'hunt' ? ` × ${m.target.replace('family:', '').split(':').pop()?.replace(/_/g, ' ')}` : ''}`,
      `Reward: §e${m.ryo} Ryo§r, ${m.xp} XP${m.jp ? `, ${m.jp} JP` : ''}`,
    ].join('\n');
    const res = await show(new ActionFormData().title('Current Mission').body(body)
      .button(done ? '§aReport & claim reward' : '§8Report (not done yet)').button('§cAbandon mission').button('Back'), p);
    if (!res || res.canceled) return;
    if (res.selection === 0) turnIn(p);
    else if (res.selection === 1) abandon(p);
    else await mainMenu(p);
    return;
  }
  const offers = board(p);
  const form = new ActionFormData().title('Mission Desk')
    .body(`Pick a mission. New offers arrive every day.\nCompleted missions: ${d.missionsDone}`).button('§lBack');
  for (const o of offers) form.button(`${GRADE_COLOR[o.grade]}${o.grade}§r ${o.label}\n§8${o.need}× · ${o.ryo} Ryo · ${o.xp} XP${o.jp ? ` · ${o.jp} JP` : ''}`);
  const res = await show(form, p);
  if (!res || res.canceled) return;
  if (!res.selection) return mainMenu(p);
  accept(p, res.selection - 1);
}

/** @param {Player} p */
async function shopMenu(p) {
  const form = new ActionFormData().title(`Ninja Shop · ${wallet(p)} Ryo`)
    .body('Earn Ryo from missions and defeated enemies.').button('§lBack');
  for (const o of OFFERS) form.button(`${o.name}\n§8${o.price} Ryo`, `textures/items/${o.item.split(':')[1]}`);
  for (const b of BUYBACK) form.button(`§2Sell ${b.name}\n§8for ${b.pay} Ryo`, `textures/items/${b.item.split(':')[1]}`);
  const res = await show(form, p);
  if (!res || res.canceled) return;
  if (!res.selection) return mainMenu(p);
  const i = res.selection - 1;
  if (i < OFFERS.length) buy(p, i);
  else sell(p, i - OFFERS.length);
  await shopMenu(p);
}

// ----------------------------------------------------------------- the Inner Path

/** @param {number} v @param {number} max */
const meter = (v, max, color = '§6') => {
  const n = Math.round((Math.max(0, Math.min(max, v)) / max) * 20);
  return `${color}${'|'.repeat(n)}§8${'|'.repeat(20 - n)}`;
};

/** @param {Player} p */
export async function innerPathMenu(p) {
  const d = getData(p);
  const n = d.nindo ? NINDO[d.nindo] : undefined;
  const best = bondList(d).find((b) => !b.gone);
  const today = d.journalDay === world.getDay();
  const combo = mixedThought(d);
  const body = [
    n ? `§lNindo:§r ${n.color}${n.name}§r §7(${n.who})` : '§lNindo:§r §7not chosen. A shinobi without a way is only half a shinobi.',
    d.motto ? `§o§7"${d.motto}"§r` : '',
    n ? `§aBoon:§r ${n.boon}` : '',
    n ? `§lResolve§r ${meter(d.resolve, RESOLVE_MAX)} §f${Math.floor(d.resolve)}/${RESOLVE_MAX}` : '',
    n ? `§7Grows when you: ${n.way}` : '',
    '',
    `§lBonds:§r ${Object.keys(d.bonds).length}${best ? ` · closest: ${best.name} (${BOND_TIERS[bondTier(best.pts)].color}${BOND_TIERS[bondTier(best.pts)].name}§r)` : ' · fight beside others to forge them'}`,
    `§lJournal:§r ${d.journalDays} day${d.journalDays === 1 ? '' : 's'} reflected${today ? ` · today: ${focusLabel(d)}${combo ? ` §d(${combo})§r` : ''}` : ' · §etoday\'s page is empty'}`,
    `§lInner Peace:§r ${d.innerPeace ? '§fyes§r (Waterfall of Truth)' : '§7not yet. Somewhere, a waterfall waits for a shinobi who sits still before it.'}`,
  ].filter((l) => l !== '').join('\n');
  const form = new ActionFormData().title('§l§3Inner Path').body(body)
    .button(d.nindo ? 'Your Nindo' : '§6Choose your Nindo', ICON.inner)
    .button(`Shinobi Journal${today ? '' : ' §e(new page)'}`, ICON.inner)
    .button('Bonds', ICON.missions)
    .button('§lBack');
  const res = await show(form, p);
  if (!res || res.canceled) return;
  if (res.selection === 0) await nindoMenu(p);
  else if (res.selection === 1) await journalMenu(p);
  else if (res.selection === 2) await bondsMenu(p);
  else await mainMenu(p);
}

const NINDO_KEYS = Object.keys(NINDO);

/** @param {Player} p */
async function nindoMenu(p) {
  const d = getData(p);
  const wait = nindoLockedFor(d);
  const form = new ActionFormData().title('Choose your Nindo')
    .body([
      'Your nindo is your ninja way: the promise you live by. It grants a boon and grows your Resolve when you keep it.',
      d.nindo && wait ? `§7You swore your current way recently; you may choose a different one in ${wait} day${wait > 1 ? 's' : ''}.` : '',
      d.nindo ? '§7Choosing a different way resets your Resolve.' : '',
    ].filter(Boolean).join('\n'))
    .button('§lBack');
  for (const k of NINDO_KEYS) form.button(`${d.nindo === k ? '§6» ' : NINDO[k].color}${NINDO[k].name}\n§8${NINDO[k].who}${NINDO[k].era ? ` · ${NINDO[k].era} era` : ''}`);
  const res = await show(form, p);
  if (!res || res.canceled) return;
  if (!res.selection) return innerPathMenu(p);
  const key = NINDO_KEYS[res.selection - 1];
  const n = NINDO[key];
  const modal = new ModalFormData().title(n.name)
    .textField(`${n.color}§l${n.name}§r §7(${n.who})\n§aBoon:§r ${n.boon}\n§7Resolve: ${n.way}\n\nYour own words (optional, private):`, 'e.g. I will never abandon a teammate', { defaultValue: d.nindo === key ? d.motto : '' })
    .toggle('I swear to live by this way', { defaultValue: false })
    .submitButton('Swear');
  const res2 = await show(modal, p);
  if (!res2 || res2.canceled || !res2.formValues) return;
  if (!res2.formValues[1]) {
    tell(p, '§7You need to mean it. Toggle the oath to swear your nindo.');
    return;
  }
  const err = chooseNindo(p, key, String(res2.formValues[0] ?? ''));
  if (err) {
    tell(p, `§c${err}`);
    ping(p, SOUND.deny, 0.6);
    return;
  }
  title(p, `${n.color}${n.name}`, '§7This is my ninja way!', 60);
  ping(p, SOUND.chime, 1.0);
  fx(p.dimension, PARTICLE.leaves, p.location);
}

const FOCUS_KEYS = Object.keys(FOCI);

/** The Shinobi Journal: a private daily check-in. @param {Player} p */
export async function journalMenu(p) {
  const d = getData(p);
  const day = world.getDay();
  const first = d.journalDay !== day;
  const focusNames = FOCUS_KEYS.map((k) => `${FOCI[k].name}: ${FOCI[k].art}`);
  const form = new ModalFormData().title(`Shinobi Journal · Day ${day + 1}`)
    .dropdown(`§7A quiet page, just for you. Nothing written here is shown to anyone else.${first ? '' : '\n§8(Today\'s page is written; you may still change your focus.)'}\n\n§fHow is your chakra today?`,
      MOODS.map((m) => `${m.color}${m.name}`), { defaultValueIndex: d.mood })
    .dropdown('Today I train my...', focusNames, { defaultValueIndex: Math.max(0, FOCUS_KEYS.indexOf(d.focus ?? 'body')) })
    .dropdown('...mixed with a second thought', ['Nothing else', ...focusNames], { defaultValueIndex: d.focus2 ? FOCUS_KEYS.indexOf(d.focus2) + 1 : 0 })
    .textField('One small intention for today (optional)', 'e.g. help a friend, finish my mission', { defaultValue: first ? '' : d.intention })
    .submitButton(first ? 'Write today\'s page' : 'Update');
  const res = await show(form, p);
  if (!res || res.canceled || !res.formValues) return;
  const [mood, focus, focus2, intention] = res.formValues;
  checkIn(p, {
    mood: Number(mood) || 0,
    focus: FOCUS_KEYS[Number(focus) || 0],
    focus2: Number(focus2) ? FOCUS_KEYS[Number(focus2) - 1] : null,
    intention: String(intention ?? ''),
  });
}

/** @param {Player} p */
async function bondsMenu(p) {
  const d = getData(p);
  const list = bondList(d);
  const lines = list.length
    ? list.map((b) => {
      const t = BOND_TIERS[bondTier(b.pts)];
      return `${b.gone ? '§8' : t.color}${b.name}§r §7· ${t.name} (${b.pts})${b.gone ? ' §8· remembered' : ''}`;
    })
    : ['§7No bonds yet. Defeat enemies alongside friends and companions to forge them.'];
  const body = [
    ...lines,
    '',
    '§8Comrades nearby: +10% chakra regeneration. A Precious Person beside you: Resistance.',
  ].join('\n');
  const res = await show(new ActionFormData().title('Bonds').body(body).button('Back'), p);
  if (res && !res.canceled) await innerPathMenu(p);
}

const CODEX = [
  ['Getting Started', [
    'Hold the §bChakra Focus§r: use it to cast your selected jutsu, sneak + use to cycle your loadout.',
    'Sneak and stand still while holding it to charge chakra three times faster.',
    'Open this §6Shinobi Scroll§r to learn jutsu with Jutsu Points and build your loadout.',
    'Hand seals are woven automatically before each jutsu; the Sharingan and experience make you faster.',
  ]],
  ['Chakra & Ranks', [
    'Ranks: Academy Student > Genin (100 XP) > Chunin (600) > Jonin (2000) > Sannin (5000) > Kage (10000).',
    'XP comes from defeating enemies, casting jutsu and hitting a Training Post (until Jonin).',
    'Each rank: +3 JP, more max chakra, more loadout slots, and nature slots at Chunin, Jonin, Sannin and Kage.',
    'Ichiraku Ramen, Soldier Pills and Akimichi pills restore chakra. Leaf headbands, the Kage hat and the Akatsuki cloak speed up regeneration.',
  ]],
  ['Clans & Rerolls', [
    'Every shinobi is born into a random clan (Common > Uncommon > Rare > Legendary).',
    'Use a §6Clan Reroll Scroll§r to spin again. After 10 rerolls without a Rare, the next is guaranteed Rare or better.',
    'Clans grant chakra, regeneration, signature jutsu, kekkei genkai or dojutsu. Otsutsuki is Legendary.',
    'Rerolling forgets clan-only techniques and refunds their Jutsu Points.',
  ]],
  ['Natures & Kekkei Genkai', [
    'Fire, Wind, Lightning, Earth and Water unlock their jutsu trees.',
    'Wood (Senju or Hashirama Cells), Ice (Yuki), Lava/Boil (Terumi) and Bone (Kaguya) are bloodline releases.',
    'Earth walls, timber and ice are temporary: they crumble back to air after a while.',
  ]],
  ['Dojutsu', [
    'Toggle your eyes with sneak + jump. They drain chakra and grant night vision.',
    'Byakugan/Jogan mark nearby enemies through walls (only you can see them). Gentle Fist hits harder with them active.',
    'Sharingan: foresee attacks (dodge), weave seals faster, and copy jutsu cast near you. It matures from 1 to 3 tomoe in combat.',
    'Mangekyo: an Uchiha Jonin with 3 tomoe who sees a companion (tamed wolf or Leaf Shinobi) die awakens it: Amaterasu, Tsukuyomi, Susanoo, Kamui.',
    'Eating a Chakra Fruit grants the Rinnegan (Rinne-Sharingan for Uchiha/Otsutsuki, Tenseigan for Hyuga).',
  ]],
  ['Tailed Beasts', [
    'Craft a Tailed Beast Summoning Scroll and choose which of the nine beasts to face.',
    'Defeat it, or weaken it below 30% and use a Sealing Scroll on it, to obtain its chakra orb.',
    'Use the orb to become its Jinchuriki: Tailed Beast Cloak and Tailed Beast Bomb. Sneak + Sealing Scroll releases it.',
    'Combine all nine orbs into the Gedo Statue Core to summon the Ten-Tails, which drops Chakra Fruit.',
  ]],
  ['Otsutsuki & Karma', [
    'Chakra Fruit: Otsutsuki ascension. +300 max chakra and a legendary dojutsu.',
    'Craft the Otsutsuki Summoning Sigil (needs a Chakra Fruit) to challenge Momoshiki. He absorbs jutsu while his palms glow!',
    'Momoshiki drops the Karma Seal: Karma Activation and Absorbed Release. Uzumaki or Hyuga without a dojutsu awaken the Jogan.',
  ]],
  ['Ninja Tools', [
    'Kunai, shuriken, fuma shuriken and senbon are thrown with use. Explosive kunai and tags detonate.',
    'Smoke bombs blind enemies and hide you. The Kote fires elemental scrolls from Jutsu Cartridges without chakra (sneak + use to switch element).',
    'Samehada eats chakra, Kubikiribocho repairs itself on hits, Kusanagi channels Chidori for Lightning users, Chakra Blades cut with Wind.',
    'The Uchiha Gunbai sends jutsu back at their caster.',
  ]],
  ['Missions, Ryo & Building', [
    'Shinobi Scroll › Missions (or talk to a Leaf Shinobi) shows three D- to S-rank missions every day, scaled to your rank.',
    'Missions pay Ryo, XP and sometimes Jutsu Points. Spend Ryo in the Ninja Shop; sell crystals and Zetsu spores back.',
    'Blueprint scrolls build a Leaf Village Gate, an Ichiraku Ramen Stand or a Training Ground in front of you (only into empty space).',
  ]],
  ['Eight Gates & Medical Ninjutsu', [
    'The Eight Gates cost health instead of chakra (half for the Clanless). Front Lotus, Morning Peacock, Daytime Tiger, Evening Elephant and Night Guy need their gate open.',
    'The Gate of Death is the strongest state in the game and leaves you crippled when it ends.',
    'Medical ninjutsu heals the ally you look at; Strength of a Hundred purges poison and curses; Cherry Blossom Impact craters the ground.',
  ]],
  ['Akatsuki, Sannin & Kara', [
    'Itachi, Kisame, Deidara and Orochimaru roam at night (normal difficulty and above).',
    'Itachi\'s Eyes grant the Eternal Mangekyo to a Mangekyo user. Orochimaru carries the Cursed Seal and the Snake Contract. Deidara drops Explosive Clay.',
    'The Otsutsuki Sigil now brings Kinshiki too: Momoshiki will absorb him if he falls low. Craft a Kara Ring to face Jigen.',
    'Explosive Clay teaches Explosion Release; the Puppet Scroll teaches Puppetry; the Slug Contract summons Katsuyu, who heals you.',
    'Baryon Mode (Kurama, Kage, 100% sync) and Six Paths Sage Mode (ascended toad sage) are the final forms.',
  ]],
  ['The Inner Path', [
    'Shinobi Scroll › Inner Path: swear a §6Nindo§r (ninja way). Each grants a boon, and keeping it builds §6Resolve§r.',
    'At 100 Resolve your will is unbreakable: the next time you are about to fall, you rise again (costs 50 Resolve).',
    'Bonds form with players and companions you fight beside: Comrades speed chakra, a Precious Person shields you.',
    'The §3Shinobi Journal§r is a private daily page: how your chakra feels, what you train today, and one small intention. Two focuses together make a mixed thought.',
    'The Waterfall of Truth: sneak and be still beside a tall waterfall. Your dark reflection cannot be beaten by force. Stay calm, and do not strike.',
    'Shinobi carry heavy things; so do people. If something outside the game feels too heavy, talk to someone you trust. If you might be in danger, contact your local emergency number or a crisis line.',
  ]],
  ['Boruto: Code & the Kara', [
    'Defeat Jigen and he becomes §5Isshiki Otsutsuki§r below 30% health: Sukunahikona stakes and bigger Daikokuten strikes. He drops a §fKara Inner Mark§r.',
    'Use the Kara Inner Mark (or craft one: Kara Ring, Chakra Crystals, Obsidian) to face §fCode§r. He blinks through claw marks, summons Claw Grime and tears off his limiters at half health.',
    'Code drops the §fWhite Karma Seal§r: Claw Marks (carve a mark, cast again to vanish to it), White Karma: Limiter Release and Claw Grime summons.',
    'Wild Claw Grime roam at night and devour the chakra of anyone they claw.',
    'New for everyone: Wind Style: Gale Palm (Boruto, Genin) and Lightning Style: Purple Lightning (Kakashi, Jonin).',
    'Two Boruto-era Nindo: Protect the Village from the Shadows (Boruto) and I Will Become Hokage (Sarada).',
  ]],
  ['The Great Catalogue', [
    'Over two hundred jutsu: open Learn Jutsu to see which ones you qualify for. Locked ones say exactly what they need.',
    'Several natures at once unlock advanced releases: Storm (Lightning + Water), Scorch (Fire + Wind), Dust (Earth + Wind + Fire).',
    'Craft a §6Sand Gourd§r (Sand, Leather, Chakra Crystal Block) for the Sand arts; Shukaku\'s jinchuriki needs none.',
    'Flying Thunder God: cast once to place a mark, cast again to flash to it, cutting everything on the way.',
    'Sage Art techniques need Sage Mode active; Susanoo techniques need Susanoo; Six Paths techniques need Six Paths Sage Mode.',
    'Other add-ons can add their own jutsu: they show up here like any other.',
  ]],
  ['Commands (operators)', [
    '/scriptevent shinobi:admin help — list admin commands.',
    'Examples: xp 500, rank 3, clan uchiha, eye mangekyo, bijuu kurama, karma, ascend, learn all, griefing on, pvp off.',
  ]],
];

/** @param {Player} p */
async function codex(p) {
  const form = new ActionFormData().title('Shinobi Codex').body('The way of the ninja, in short.').button('§lBack');
  for (const [name] of CODEX) form.button(/** @type {string} */ (name));
  const res = await show(form, p);
  if (!res || res.canceled) return;
  if (!res.selection) return mainMenu(p);
  const [name, lines] = CODEX[res.selection - 1];
  await show(new MessageFormData().title(/** @type {string} */ (name)).body(/** @type {string[]} */ (lines).map((l) => `• ${l}`).join('\n\n')).button1('Back').button2('Close'), p)
    .then((r) => (r && !r.canceled && r.selection === 0 ? codex(p) : undefined));
}

/** Pick the active jutsu directly. @param {Player} p */
export async function jutsuWheel(p) {
  const d = getData(p);
  if (!d.slots.length) return mainMenu(p);
  const form = new ActionFormData().title('Select Jutsu');
  d.slots.forEach((id, i) => {
    const j = JUTSU.get(id);
    form.button(`${i === d.sel ? '§6» ' : ''}${j?.name ?? id}\n§8${j ? `${costOf(p, j)} chakra · ${j.cd}s` : ''}`);
  });
  const res = await show(form, p);
  if (!res || res.canceled || res.selection === undefined) return;
  d.sel = res.selection;
  touch(p);
}

// ----------------------------------------------------------------- reroll

/** @param {Player} p */
export function rerollClan(p) {
  const d = getData(p);
  const r = rt(p);
  if (system.currentTick < r.weavingUntil) return;
  consumeHeld(p);
  r.weavingUntil = system.currentTick + 40;
  const ids = Object.keys(CLANS);
  let i = 0;
  const run = system.runInterval(() => {
    const spin = CLANS[ids[Math.floor(Math.random() * ids.length)]];
    title(p, `${spin.color}${spin.name}`, '§7Rerolling...', 6);
    ping(p, SOUND.click, 1 + i * 0.05);
    if (++i < 12) return;
    system.clearRun(run);
    d.rerolls++;
    let clan = rollClan(true);
    if (d.pity >= 9) {
      while (!['Rare', 'Legendary'].includes(CLANS[clan].rarity)) clan = rollClan(true);
    }
    const rarity = CLANS[clan].rarity;
    d.pity = rarity === 'Rare' || rarity === 'Legendary' ? 0 : d.pity + 1;
    dropToggles(p);
    changeClan(p, clan);
    const c = CLANS[clan];
    title(p, `${c.color}§l${c.name}`, `${RARITY_COLOR[rarity]}${rarity}§r §7clan`, 70);
    ping(p, rarity === 'Legendary' ? SOUND.totem : rarity === 'Rare' ? SOUND.levelup : SOUND.orb, 1);
    fx(p.dimension, PARTICLE.burst, p.location);
    tell(p, `§7Reroll #${d.rerolls}: ${c.color}${c.name}§7 (${rarity}). ${c.perk}${d.pity ? ` §8Pity ${d.pity}/10` : ''}`);
    if (rarity === 'Legendary') tell(p, '§5§lThe celestial bloodline answers your call!');
  }, 3);
}

/** Tailed beast summoning scroll picker. @param {Player} p */
export async function bijuuSummonMenu(p) {
  const form = new ActionFormData().title('Summon a Tailed Beast').body('§cWarning: tailed beasts are bosses.§r Choose your opponent:');
  for (const b of BIJUU) form.button(`${b.title}: §l${b.name}`, `textures/items/${b.key}_chakra`);
  const res = await show(form, p);
  if (!res || res.canceled || res.selection === undefined) return;
  const b = BIJUU[res.selection];
  if (heldItem(p)?.typeId !== ITEM.bijuuScroll) {
    tell(p, '§7Hold the summoning scroll while choosing.');
    return;
  }
  if (summonBoss(p, `shinobi:${b.key}`)) {
    consumeHeld(p);
    title(p, `§6${b.name}`, `§cThe ${b.title} has been released!`, 60);
  }
}
