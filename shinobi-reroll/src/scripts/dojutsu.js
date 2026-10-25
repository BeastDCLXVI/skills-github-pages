import { ButtonState, InputButton, system, world } from '@minecraft/server';
import { DOJUTSU } from './data.js';
import { FX, PARTICLE, SOUND } from './ids.js';
import { syncAutoJutsu } from './progression.js';
import { getData, spendChakra, touch } from './store.js';
import { add, effect, eyes, fx, fxFor, ping, rgb, tell, title, v3 } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

/** @param {Player} p */
export function toggleEye(p) {
  const d = getData(p);
  if (!d.eye) {
    tell(p, '§7You have no dojutsu. Bloodlines, the Chakra Fruit or the Karma can awaken one.');
    return;
  }
  if (!d.eyeOn && d.strain >= 100) {
    tell(p, '§cYour eyes are too strained. Rest them for a while.');
    return;
  }
  d.eyeOn = !d.eyeOn;
  const info = DOJUTSU[d.eye];
  if (d.eyeOn) {
    title(p, ' ', `${info.color}${info.name}${d.eye === 'sharingan' ? ` §7(${d.eyeStage} tomoe)` : ''}`, 20);
    ping(p, d.eye.includes('sharingan') || d.eye === 'mangekyo' ? SOUND.curse : SOUND.orb, 1.8);
    fx(p.dimension, PARTICLE.tomoe, eyes(p), rgb(info.hex));
  } else {
    try {
      p.removeEffect(FX.nightVision);
    } catch {}
    ping(p, SOUND.click, 0.8);
  }
  touch(p);
}

/** Grant a new dojutsu (Chakra Fruit, Karma, admin). @param {Player} p @param {string} eye */
export function awaken(p, eye, stage = 3) {
  const d = getData(p);
  d.eye = eye;
  d.eyeStage = stage;
  d.eyeOn = false;
  d.strain = 0;
  const info = DOJUTSU[eye];
  title(p, `${info.color}${info.name}`, '§7Sneak + jump to activate', 80);
  ping(p, SOUND.totem, 1.2);
  syncAutoJutsu(p);
  touch(p);
}

/** Combat experience feeds the Sharingan. @param {Player} p */
export function sharinganXp(p, amount = 1) {
  const d = getData(p);
  if (d.eye !== 'sharingan' || !d.eyeOn || d.eyeStage >= 3) return;
  d.eyeXp += amount;
  const next = d.eyeStage === 1 ? 40 : 120;
  if (d.eyeXp >= next) {
    d.eyeStage++;
    d.eyeXp = 0;
    title(p, '§cSharingan', `§7${d.eyeStage} tomoe`, 50);
    fx(p.dimension, PARTICLE.tomoe, eyes(p), rgb('#d01020'));
    ping(p, SOUND.curse, 1.4);
  }
  touch(p);
}

/** Mangekyo awakening: a loss witnessed by a fully matured Sharingan. @param {Player} p */
export function tryMangekyo(p) {
  const d = getData(p);
  if (d.eye !== 'sharingan' || d.eyeStage < 3 || d.rank < 3) return false;
  d.eye = 'mangekyo';
  d.eyeOn = true;
  title(p, '§4Mangekyo Sharingan', '§cGrief awakens the eye of hatred.', 90);
  world.sendMessage(`§4${p.name}'s Mangekyo Sharingan has awakened.`);
  ping(p, SOUND.curse, 0.8);
  fx(p.dimension, PARTICLE.tomoe, eyes(p), rgb('#a00010'));
  syncAutoJutsu(p);
  touch(p);
  return true;
}

function tick() {
  const now = system.currentTick;
  for (const p of world.getAllPlayers()) {
    const d = getData(p);
    if (!d.eye) continue;
    const eternal = d.rank >= 5;
    if (!d.eyeOn) {
      if (d.strain > 0) d.strain = Math.max(0, d.strain - 1);
      continue;
    }
    const info = DOJUTSU[d.eye];
    if (!spendChakra(p, info.drain / 2)) {
      d.eyeOn = false;
      tell(p, `§7${info.name} deactivated (out of chakra).`);
      continue;
    }
    effect(p, FX.nightVision, 15, 0, false);
    if (d.eye === 'mangekyo' && !eternal) {
      d.strain += 0.5;
      if (d.strain >= 100) {
        d.eyeOn = false;
        d.strain = 70;
        effect(p, FX.blindness, 8);
        title(p, '§4Eye strain', '§7Your vision fails...', 40);
        continue;
      }
    }
    if (now % 20 === 0 && (d.eye === 'byakugan' || d.eye === 'jogan' || d.eye === 'tenseigan')) {
      const radius = 16 + d.rank * 4 + (d.eye === 'jogan' ? 12 : 0);
      const color = rgb(d.eye === 'jogan' ? '#6fa8ff' : '#d8d0f0');
      try {
        for (const e of p.dimension.getEntities({ location: p.location, maxDistance: radius, families: ['monster'] })) {
          fxFor(p, PARTICLE.mark, add(e.location, v3(0, 2.4, 0)), e.matches({ families: ['shinobi_boss'] }) ? rgb('#ff4040') : color);
        }
      } catch {}
    }
    touch(p);
  }
}

export function startDojutsu() {
  system.runInterval(tick, 10);
  // sneak + jump toggles the eye
  world.afterEvents.playerButtonInput.subscribe((ev) => {
    if (ev.button === InputButton.Jump && ev.newButtonState === ButtonState.Pressed && ev.player.isSneaking) {
      toggleEye(ev.player);
    }
  });
}
