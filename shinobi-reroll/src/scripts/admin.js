import { Player, system } from '@minecraft/server';
import { BIJUU, CLANS, DOJUTSU, NATURES, NINDO, RANKS } from './data.js';
import { becomeJinchuriki, releaseBijuu } from './bosses.js';
import { dropToggles } from './casting.js';
import { awaken } from './dojutsu.js';
import { JUTSU, meets } from './jutsu/index.js';
import { dismissAll } from './jutsu/core.js';
import { addXp, changeClan, checkAwakening, syncAutoJutsu } from './progression.js';
import { getData, maxChakra, resetData, setChakra, touch } from './store.js';
import { clearTemp } from './terrain.js';
import { give, saveSettings, settings, tell } from './util.js';
import { ITEM } from './ids.js';
import { forceComplete, rerollBoard } from './missions.js';
import { RESOLVE_MAX, beginTrial, chooseNindo } from './innerpath.js';

// Operator commands: /scriptevent shinobi:admin <command> [args]
// (scriptevent already requires operator permissions / cheats.)

const HELP = [
  '§6Shinobi Reroll admin§r — /scriptevent shinobi:admin <command>',
  '  info · xp <n> · rank <0-5> · jp <n> · chakra',
  `  clan <${Object.keys(CLANS).join('|')}>`,
  `  nature <${Object.keys(NATURES).join('|')}> · eye <${Object.keys(DOJUTSU).join('|')}|none>`,
  `  bijuu <${BIJUU.map((b) => b.key).join('|')}|none> · karma · ascend · wood · eternal`,
  '  contract <toad|snake|slug> · unlock <clay|puppet|curse|code> · ryo <n> · mission <reroll|complete>',
  `  nindo <${Object.keys(NINDO).join('|')}|none> · resolve <0-100> · peace · journal · trial`,
  '  learn <jutsu_id|all> · reset · cleanup',
  '  griefing <on|off> · pvp <on|off> · npcjutsu <on|off> · xprate <0.1-10> · hud <on|off>',
];

/** @param {Player} p @param {string[]} args */
function run(p, args) {
  const d = getData(p);
  const [cmd, a1] = args;
  const on = a1 === 'on' || a1 === 'true';
  switch (cmd) {
    case undefined:
    case 'help':
      return tell(p, HELP.join('\n'));
    case 'info':
      return tell(p, `§7${JSON.stringify(d)}`);
    case 'xp':
      addXp(p, Number(a1) || 0);
      return tell(p, `§aXP is now ${d.xp} (${RANKS[d.rank].name}).`);
    case 'rank':
      d.rank = Math.max(0, Math.min(RANKS.length - 1, Number(a1) | 0));
      d.xp = Math.max(d.xp, RANKS[d.rank].xp);
      checkAwakening(p);
      break;
    case 'jp':
      d.jp += Number(a1) || 0;
      break;
    case 'chakra':
      setChakra(p, maxChakra(p));
      break;
    case 'clan':
      if (!a1 || !CLANS[a1]) return tell(p, '§cUnknown clan.');
      dropToggles(p);
      changeClan(p, a1);
      break;
    case 'nature':
      if (!a1 || !NATURES[a1]) return tell(p, '§cUnknown nature.');
      if (!d.natures.includes(a1)) d.natures.push(a1);
      break;
    case 'eye':
      if (a1 === 'none') {
        d.eye = null;
        d.eyeOn = false;
        syncAutoJutsu(p);
      } else if (a1 && DOJUTSU[a1]) {
        awaken(p, a1, 3);
      } else return tell(p, '§cUnknown dojutsu.');
      break;
    case 'bijuu':
      if (a1 === 'none') releaseBijuu(p);
      else if (a1 && BIJUU.some((b) => b.key === a1)) {
        if (d.bijuu) releaseBijuu(p);
        becomeJinchuriki(p, a1);
      } else return tell(p, '§cUnknown tailed beast.');
      break;
    case 'karma':
      d.karma = true;
      syncAutoJutsu(p);
      break;
    case 'ascend':
      d.ascended = true;
      break;
    case 'contract':
      if (!['toad', 'snake', 'slug'].includes(a1 ?? '')) return tell(p, '§cUsage: contract <toad|snake|slug>');
      if (!d.contracts.includes(/** @type {string} */ (a1))) d.contracts.push(/** @type {string} */ (a1));
      break;
    case 'unlock':
      if (!['clay', 'puppet', 'curse', 'code'].includes(a1 ?? '')) return tell(p, '§cUsage: unlock <clay|puppet|curse|code>');
      if (!d.unlocks.includes(/** @type {string} */ (a1))) d.unlocks.push(/** @type {string} */ (a1));
      break;
    case 'eternal':
      d.eternal = true;
      break;
    case 'ryo':
      give(p, ITEM.ryo, Math.max(1, Math.min(640, Number(a1) || 0)));
      break;
    case 'mission':
      if (a1 === 'reroll') rerollBoard(p);
      else if (a1 === 'complete') forceComplete(p);
      else return tell(p, '§cUsage: mission <reroll|complete>');
      break;
    case 'wood':
      d.wood = true;
      break;
    case 'nindo':
      if (a1 === 'none') {
        d.nindo = null;
        d.resolve = 0;
      } else if (a1 && NINDO[a1]) {
        d.nindoDay = -99; // operators may switch freely
        chooseNindo(p, a1, d.motto);
      } else return tell(p, '§cUnknown nindo.');
      break;
    case 'resolve':
      d.resolve = Math.max(0, Math.min(RESOLVE_MAX, Number(a1) || 0));
      break;
    case 'peace':
      d.innerPeace = true;
      break;
    case 'journal':
      d.journalDay = -1;
      break;
    case 'trial':
      d.trialDay = -1;
      if (!beginTrial(p)) return tell(p, '§cA trial is already in progress.');
      break;
    case 'learn':
      for (const j of JUTSU.values()) {
        if (j.auto) continue;
        if ((a1 === 'all' && meets(d, j).ok) || j.id === a1) {
          if (!d.learned.includes(j.id)) d.learned.push(j.id);
        }
      }
      break;
    case 'reset':
      dropToggles(p);
      dismissAll(p.id);
      resetData(p);
      return tell(p, '§eProfile reset. A new clan has been rolled.');
    case 'cleanup':
      clearTemp();
      return tell(p, '§7Temporary jutsu terrain removed.');
    case 'griefing':
      saveSettings({ griefing: on });
      break;
    case 'pvp':
      saveSettings({ pvp: on });
      break;
    case 'npcjutsu':
      saveSettings({ npcJutsu: on });
      break;
    case 'xprate':
      saveSettings({ xpRate: Math.max(0.1, Math.min(10, Number(a1) || 1)) });
      break;
    case 'hud':
      saveSettings({ hudDefault: on });
      break;
    default:
      return tell(p, `§cUnknown command '${cmd}'.\n${HELP.join('\n')}`);
  }
  syncAutoJutsu(p);
  touch(p);
  tell(p, `§aDone.§7 Settings: ${JSON.stringify(settings())}`);
}

export function startAdmin() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== 'shinobi:admin') return;
    const p = ev.sourceEntity;
    if (!(p instanceof Player)) {
      console.warn('[shinobi] shinobi:admin must be run by a player (e.g. /execute as <player> run scriptevent ...)');
      return;
    }
    try {
      run(p, ev.message.trim().split(/\s+/).filter(Boolean));
    } catch (err) {
      tell(p, `§cAdmin command failed: ${err}`);
    }
  });
}
