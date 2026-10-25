// Shinobi Reroll — Naruto / Shippuden / Boruto for Minecraft Bedrock.
// Entry point declared in the behavior pack manifest (scripts/main.js).
import { system, world } from '@minecraft/server';
import { startAdmin } from './admin.js';
import { startBosses } from './bosses.js';
import { dropToggles, startCasting } from './casting.js';
import { startCombat } from './combat.js';
import { CLANS, NATURES, RARITY_COLOR } from './data.js';
import { startDojutsu } from './dojutsu.js';
import { ENTITY, ITEM } from './ids.js';
import { startItems } from './items.js';
import { dismissAll } from './jutsu/core.js';
import { JUTSU } from './jutsu/index.js';
import { startNpc } from './npc.js';
import { checkAwakening } from './progression.js';
import { startProjectiles } from './projectiles.js';
import { dropRuntime } from './state.js';
import { forget, getData, hasProfile, maxChakra, saveNow, setChakra, startAutosave, touch } from './store.js';
import { startTerrain } from './terrain.js';
import { missionsMenu } from './ui.js';
import { give, later, tell, title } from './util.js';

/** @param {import('@minecraft/server').Player} p */
function welcome(p) {
  const first = !hasProfile(p);
  const d = getData(p);
  checkAwakening(p);
  if (first) {
    setChakra(p, maxChakra(p));
    give(p, ITEM.scroll, 1);
    give(p, ITEM.focus, 1);
    give(p, ITEM.shuriken, 16);
    give(p, ITEM.kunai, 4);
    give(p, ITEM.ramen, 2);
    const c = CLANS[d.clan];
    later(40, () => {
      title(p, `${c.color}§l${c.name} Clan`, `${RARITY_COLOR[c.rarity]}${c.rarity}§r §7· ${NATURES[d.natures[0]].name} nature`, 90);
      tell(p, [
        '§6§l=== Shinobi Reroll ===§r',
        `You were born into the ${c.color}${c.name}§r clan (${c.rarity}). ${c.perk}`,
        '§bChakra Focus§r: use = cast jutsu, sneak + use = next jutsu, sneak still = charge chakra.',
        '§6Shinobi Scroll§r: learn jutsu, build your loadout, read the Codex.',
        'Sneak + jump toggles your dojutsu once you awaken one.',
      ].join('\n'));
    });
    touch(p);
  }
}

startAutosave();
startTerrain();
startProjectiles();
startCasting();
startDojutsu();
startCombat();
startItems();
startNpc();
startBosses();
startAdmin();

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) welcome(player);
  else setChakra(player, Math.max(maxChakra(player) * 0.5, 0));
});

world.beforeEvents.playerLeave.subscribe(({ player }) => {
  const id = player.id;
  system.run(() => {
    dismissAll(id);
    dropRuntime(id);
    forget(id);
  });
  try {
    saveNow(player);
  } catch {}
});

// Talking to a Leaf Shinobi opens the mission desk (unless you are feeding or taming them).
const FEED = new Set([ITEM.ramen, 'minecraft:bread']);
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (ev.target.typeId !== ENTITY.leaf || (ev.itemStack && FEED.has(ev.itemStack.typeId))) return;
  const p = ev.player;
  system.run(() => void missionsMenu(p));
});

world.afterEvents.worldLoad.subscribe(() => {
  for (const p of world.getAllPlayers()) {
    getData(p);
    checkAwakening(p);
    dropToggles(p);
  }
  console.info(`[shinobi] Shinobi Reroll loaded: ${JUTSU.size} jutsu, ${Object.keys(CLANS).length} clans.`);
});
