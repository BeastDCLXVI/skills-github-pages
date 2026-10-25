import { Player, system } from '@minecraft/server';
import { BIJUU, CLANS, DOJUTSU, NATURES, RANKS } from './data.js';
import { becomeJinchuriki, releaseBijuu } from './bosses.js';
import { dropToggles } from './casting.js';
import { awaken } from './dojutsu.js';
import { JUTSU, meets } from './jutsu/index.js';
import { dismissAll } from './jutsu/core.js';
import { addXp, changeClan, checkAwakening, syncAutoJutsu } from './progression.js';
import { getData, maxChakra, resetData, setChakra, touch } from './store.js';
import { clearTemp } from './terrain.js';
import { saveSettings, settings, tell } from './util.js';

// Operator commands: /scriptevent shinobi:admin <command> [args]
// (scriptevent already requires operator permissions / cheats.)

const HELP = [
  '§6Shinobi Reroll admin§r — /scriptevent shinobi:admin <command>',
  '  info · xp <n> · rank <0-5> · jp <n> · chakra',
  `  clan <${Object.keys(CLANS).join('|')}>`,
  `  nature <${Object.keys(NATURES).join('|')}> · eye <${Object.keys(DOJUTSU).join('|')}|none>`,
  `  bijuu <${BIJUU.map((b) => b.key).join('|')}|none> · karma · ascend · contract · wood`,
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
      d.contract = true;
      break;
    case 'wood':
      d.wood = true;
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
