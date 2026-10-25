// The great jutsu catalogue (v2.0): signature techniques of Naruto, Shippuden, Boruto and the films,
// described as forge specs (see forge.js). Hand-written behaviour lives in the other school files;
// everything here is data, plus a few `custom` runs for techniques no archetype captures.
import { system } from '@minecraft/server';
import { ENTITY, FX, PARTICLE, SOUND } from '../ids.js';
import { rt } from '../state.js';
import {
  effect, enemiesAround, eyes, fx, health, hurt, later, rgb, sound, stun, title, valid,
} from '../util.js';
import { fail, summon, target } from './core.js';
import { forgeAll } from './forge.js';

/** @typedef {import('./forge.js').JutsuSpec} JutsuSpec */
/** @typedef {import('./core.js').Ctx} Ctx */

const MS = ['mangekyo', 'rinne_sharingan'];
const RINNEGAN = ['rinnegan', 'rinne_sharingan'];
const SHARINGAN = ['sharingan', 'mangekyo', 'rinne_sharingan'];
const BYAKUGAN = ['byakugan', 'tenseigan', 'jogan'];

/** Turn a target against its own side: its neighbours take blows "from" it and retaliate. @param {Ctx} c @param {number} radius @param {number} seconds */
function turnAgainst(c, radius, seconds) {
  const t = target(c, 16);
  if (!t) return fail(c, 'No one to control.');
  effect(t, FX.weakness, seconds, 4);
  effect(t, FX.slowness, 2, 1);
  fx(c.dim, PARTICLE.tomoe, eyes(t), rgb('#d01020'));
  const others = enemiesAround(c.p, t.location, radius).filter((e) => e.id !== t.id);
  for (const e of others) hurt(e, 3 * c.pow, t);
  if (!others.length) stun(t, 3);
  return true;
}

/** @type {JutsuSpec[]} */
const SPECS = [
  // =============================================================== NINJUTSU
  {
    id: 'clone_technique', name: 'Clone Technique', school: 'Ninjutsu', rank: 0, cost: 8, cd: 10, seals: ['Ram', 'Snake', 'Tiger'],
    kind: 'summon', entity: 'clone', count: 2, life: 8,
    desc: 'The Academy basic: two short-lived copies of you that distract the enemy.',
  },
  {
    id: 'multi_shadow_clone', name: 'Multi Shadow Clone Technique', school: 'Ninjutsu', rank: 3, cost: 90, cd: 50,
    seals: ['Ram', 'Snake', 'Tiger'], requires: ['shadow_clone'], kind: 'summon', entity: 'clone', count: 6, life: 30,
    desc: "Naruto's forbidden signature: a crowd of solid shadow clones joins the fight.",
  },
  {
    id: 'clone_explosion', name: 'Shadow Clone Explosion', school: 'Ninjutsu', rank: 3, cost: 50, cd: 20,
    seals: ['Ram', 'Snake', 'Tiger'], requires: ['shadow_clone'], kind: 'custom', damage: 18,
    desc: "Itachi's trick: a shadow clone rushes in and detonates.",
    run(c, s) {
      const t = target(c, 18);
      const at = t ? t.location : c.p.location;
      const clone = summon(c, ENTITY.clone, at, 60);
      if (!clone) return fail(c, 'The clone could not form here.');
      later(30, () => {
        if (!valid(clone) || !valid(c.p)) return;
        const loc = clone.location;
        for (const e of enemiesAround(c.p, loc, 5)) hurt(e, (s.damage ?? 18) * c.pow, c.p);
        fx(c.dim, PARTICLE.explosion, loc);
        fx(c.dim, PARTICLE.flame, loc);
        sound(c.dim, SOUND.explode, loc, 1, 1.2);
        try {
          clone.remove();
        } catch {}
      });
    },
  },
  {
    id: 'rasengan_barrage', name: 'Rasengan Barrage', school: 'Ninjutsu', rank: 3, cost: 70, cd: 16, requires: ['rasengan'],
    kind: 'barrage', element: 'rasengan', size: 2, speed: 1.6, damage: 9, radius: 2, waves: 5, interval: 5, homing: true,
    desc: 'Clone after clone dives in with a Rasengan.',
  },
  {
    id: 'planetary_rasengan', name: 'Planetary Rasengan', school: 'Ninjutsu', rank: 4, cost: 110, cd: 25, requires: ['rasengan'],
    kind: 'bolt', element: 'rasengan', size: 5, speed: 1.1, damage: 18, radius: 4, pulses: 5,
    desc: 'A great Rasengan circled by three smaller ones, grinding everything around the impact.',
  },
  {
    id: 'hiding_in_mist', name: 'Hiding in Mist Technique', school: 'Ninjutsu', nature: 'water', rank: 2, cost: 35, cd: 30,
    seals: ['Ram', 'Snake'], kind: 'field', at: 'self', radius: 8, duration: 10, color: '#dfe8f0',
    effects: [['blindness', 2, 0]], self: [['invisibility', 10, 0]],
    desc: 'Zabuza\'s silent killing mist: enemies near you are blinded while you vanish.',
  },
  {
    id: 'camouflage', name: 'Hiding in Camouflage Technique', school: 'Ninjutsu', rank: 2, cost: 30, cd: 40, seals: ['Ram'],
    kind: 'buff', color: '#9fd8c8', self: [['invisibility', 20, 0], ['speed', 20, 0]],
    desc: 'Blend into your surroundings and move unseen.',
  },
  {
    id: 'super_beast_drawing', name: 'Super Beast Imitating Drawing', school: 'Ninjutsu', rank: 2, cost: 35, cd: 12, seals: [],
    kind: 'barrage', element: 'ink', size: 2, speed: 1.3, damage: 7, waves: 3, count: 2, spread: 14, interval: 6, homing: true,
    desc: 'Sai and Inojin\'s ink beasts leap off the scroll and hunt your enemies.',
  },
  {
    id: 'shikigami_dance', name: 'Dance of the Shikigami', school: 'Ninjutsu', rank: 3, cost: 60, cd: 18, seals: [],
    kind: 'barrage', element: 'wind', color: '#f4f0e8', size: 1, speed: 2.2, damage: 6, waves: 6, count: 3, spread: 18,
    interval: 4, homing: true,
    desc: "Konan's storm of paper shuriken, each sheet sharp as steel.",
  },
  {
    id: 'striking_shadow_snakes', name: 'Striking Shadow Snakes', school: 'Ninjutsu', rank: 2, cost: 30, cd: 10,
    seals: ['Snake'], kind: 'bind', range: 14, damage: 9, pull: true, stun: 1, color: '#6a4a8e',
    effects: [['poison', 4, 0]],
    desc: 'Snakes shoot from your sleeves, bite, and drag the enemy to you (Orochimaru, Mitsuki).',
  },
  {
    id: 'summoning_rashomon', name: 'Summoning: Rashomon', school: 'Ninjutsu', rank: 3, cost: 60, cd: 40,
    seals: ['Boar', 'Dog', 'Bird', 'Monkey', 'Ram'], kind: 'terrain', shape: 'wall', block: 'barrier', at: 'look',
    range: 3, size: 7, height: 5, duration: 12, color: '#8a6ad8',
    desc: 'Summon the demon-faced Rashomon gate: an unbreakable wall for twelve seconds.',
  },
  // =============================================================== TAIJUTSU
  {
    id: 'dynamic_entry', name: 'Dynamic Entry', school: 'Taijutsu', rank: 1, cost: 10, cd: 6, seals: [],
    kind: 'dash', speed: 3.2, damage: 9, knock: 2, radius: 2.5, color: '#58d858',
    desc: "Might Guy's flying kick: make an entrance nobody forgets.",
  },
  {
    id: 'leaf_rising_wind', name: 'Leaf Rising Wind', school: 'Taijutsu', rank: 1, cost: 12, cd: 6, seals: [],
    kind: 'strike', range: 3.5, damage: 6, knock: 0.2, up: 1.4, color: '#58d858',
    desc: 'A rising kick that launches the enemy into the air.',
  },
  {
    id: 'leaf_gale', name: 'Leaf Gale', school: 'Taijutsu', rank: 2, cost: 20, cd: 8, seals: [],
    kind: 'cone', range: 4.5, angle: 140, damage: 10, knock: 1.6, element: 'wind', color: '#58d858',
    desc: 'A sweeping roundhouse that clears everything in front of you.',
  },
  {
    id: 'severe_leaf_hurricane', name: 'Severe Leaf Hurricane', school: 'Taijutsu', rank: 3, cost: 35, cd: 12, seals: [],
    kind: 'burst', at: 'self', radius: 4.5, damage: 14, knock: 2.2, element: 'wind', color: '#58d858',
    desc: 'A spinning series of kicks fast enough to raise a whirlwind.',
  },
  {
    id: 'drunken_fist', name: 'Drunken Fist', school: 'Taijutsu', rank: 3, cost: 20, cd: 20, seals: [], kind: 'aura',
    upkeep: 3, power: 0.15, color: '#e8a06a', self: [['speed', 2, 1], ['strength', 2, 1], ['jumpBoost', 2, 1]],
    desc: "Rock Lee's unpredictable stance: faster, harder, impossible to read.",
  },
  {
    id: 'lion_combo', name: 'Lion Combo', school: 'Taijutsu', rank: 2, cost: 25, cd: 9, seals: [],
    kind: 'strike', range: 4, damage: 15, knock: 0.6, up: 1.1, color: '#58d858',
    desc: 'Launch, shadow and slam: the Shadow of the Dancing Leaf finished on the ground.',
  },
  {
    id: 'reverse_lotus', name: 'Reverse Lotus', school: 'Eight Gates', rank: 3, cost: 0, cd: 25, seals: [],
    active: 'gate_of_opening', kind: 'strike', range: 4, damage: 30, stun: 2, up: 1.0, health: 2, color: '#58d858',
    desc: 'With the inner gates open: launch the enemy and crush them with a hidden lotus.',
  },
  // =============================================================== FIRE
  {
    id: 'great_dragon_fire', name: 'Fire Style: Great Dragon Fire Technique', school: 'Fire', nature: 'fire', rank: 3,
    cost: 60, cd: 14, seals: ['Snake', 'Dragon', 'Hare', 'Tiger'], kind: 'bolt',
    element: 'fire', count: 3, spread: 14, size: 4, speed: 1.3, damage: 16, radius: 3, fire: 6,
    desc: 'Three dragon heads of flame race toward the enemy.',
  },
  {
    id: 'dragon_fire', name: 'Fire Style: Dragon Fire Technique', school: 'Fire', nature: 'fire', rank: 2, cost: 35, cd: 9,
    seals: ['Snake', 'Dragon', 'Tiger'], kind: 'beam', element: 'fire', length: 16, width: 1.4, damage: 7, waves: 3,
    interval: 5, fire: 5, desc: 'A stream of fire racing along a line toward the enemy.',
  },
  {
    id: 'hiding_ash', name: 'Fire Style: Hiding Ash Accumulation Burn', school: 'Fire', nature: 'fire', rank: 3, cost: 45,
    cd: 16, seals: ['Ram', 'Snake'], kind: 'burst', at: 'look', range: 18, radius: 5.5, delay: 30, damage: 16, fire: 6,
    element: 'fire', desc: "Asuma's ash cloud drifts over the enemy, then a spark sets it ablaze.",
  },
  {
    id: 'running_fire', name: 'Fire Style: Running Fire', school: 'Fire', nature: 'fire', rank: 1, cost: 18, cd: 6,
    seals: ['Tiger'], kind: 'beam', element: 'fire', length: 12, width: 1.2, damage: 6, fire: 4,
    desc: 'Flame races along a wire or the ground to its target.',
  },
  {
    id: 'phoenix_nail_crimson', name: 'Fire Style: Phoenix Flower Nail Crimson', school: 'Fire', nature: 'fire', rank: 2,
    cost: 30, cd: 8, seals: ['Tiger'], kind: 'barrage', element: 'fire', color: '#ff9a3a', size: 1, speed: 2.4, damage: 5,
    count: 3, waves: 2, spread: 10, interval: 5, homing: true, fire: 3,
    desc: 'Shuriken hidden inside phoenix flames: two attacks in one.',
  },
  {
    id: 'majestic_demolisher', name: 'Fire Style: Majestic Demolisher Flame', school: 'Fire', nature: 'fire', rank: 5,
    cost: 160, cd: 50, seals: ['Tiger', 'Snake', 'Ram', 'Monkey'], kind: 'cone', element: 'fire', range: 18, angle: 90,
    damage: 30, fire: 8, desc: "Madara's sea of fire, wide enough to swallow an army.",
  },
  // =============================================================== WIND
  {
    id: 'sickle_weasel', name: 'Wind Style: Sickle Weasel Technique', school: 'Wind', nature: 'wind', rank: 2, cost: 30,
    cd: 8, seals: [], kind: 'cone', element: 'wind', range: 11, angle: 45, damage: 10, knock: 2.5,
    desc: "Temari's fan sends blades of wind slicing through the line in front of you.",
  },
  {
    id: 'great_sickle_weasel', name: 'Wind Style: Great Sickle Weasel', school: 'Wind', nature: 'wind', rank: 3, cost: 55,
    cd: 14, seals: [], requires: ['sickle_weasel'], kind: 'cone', element: 'wind', range: 15, angle: 75, damage: 15,
    knock: 3, desc: 'A full swing of the giant fan: a gale of cutting wind.',
  },
  {
    id: 'summoning_kamatari', name: 'Summoning: Kamatari', school: 'Wind', nature: 'wind', rank: 4, cost: 90, cd: 35,
    seals: ['Dog', 'Bird'], requires: ['great_sickle_weasel'], kind: 'cone', element: 'wind', range: 20, angle: 70,
    damage: 22, knock: 3.5, desc: 'The one-eyed sickle weasel rides your wind and cuts down the battlefield.',
  },
  {
    id: 'vacuum_great_sphere', name: 'Wind Style: Vacuum Great Sphere', school: 'Wind', nature: 'wind', rank: 3, cost: 50,
    cd: 12, seals: ['Ram', 'Tiger'], kind: 'bolt', element: 'wind', size: 5, speed: 1.8, damage: 17, radius: 3, knock: 2,
    desc: 'One huge sphere of compressed air, spat with enough force to crater stone.',
  },
  {
    id: 'pressure_damage', name: 'Wind Style: Pressure Damage', school: 'Wind', nature: 'wind', rank: 4, cost: 80, cd: 22,
    seals: ['Ram', 'Tiger', 'Dog'], kind: 'bolt', element: 'wind', size: 6, speed: 1.2, damage: 22, radius: 5, explode: 2,
    knock: 3, desc: "Kakuzu's wind mask exhales a storm that flattens everything around the impact.",
  },
  // =============================================================== LIGHTNING
  {
    id: 'raikiri', name: 'Lightning Cutter', school: 'Lightning', nature: 'lightning', rank: 3, cost: 55, cd: 12, seals: [],
    requires: ['chidori'], kind: 'strike', range: 7, damage: 26, stun: 1, element: 'lightning',
    desc: "Kakashi's perfected Chidori, sharp enough to cut a bolt of lightning.",
  },
  {
    id: 'chidori_stream', name: 'Chidori Stream', school: 'Lightning', nature: 'lightning', rank: 2, cost: 35, cd: 10,
    seals: [], requires: ['chidori'], kind: 'burst', at: 'self', radius: 4.5, damage: 9, stun: 1.5, element: 'lightning',
    desc: 'Lightning floods out of your whole body and paralyses everyone touching you.',
  },
  {
    id: 'chidori_spear', name: 'Chidori Sharp Spear', school: 'Lightning', nature: 'lightning', rank: 3, cost: 45, cd: 10,
    seals: [], requires: ['chidori'], kind: 'beam', element: 'lightning', length: 14, width: 1.0, damage: 18,
    desc: 'The Chidori stretched into a piercing blade of lightning.',
  },
  {
    id: 'chidori_senbon', name: 'Chidori Senbon', school: 'Lightning', nature: 'lightning', rank: 2, cost: 30, cd: 8,
    seals: [], requires: ['chidori'], kind: 'bolt', element: 'lightning', count: 6, spread: 24, size: 1, speed: 2.6,
    damage: 6, effects: [['slowness', 2, 2]], desc: 'Dozens of needles of lightning that numb whatever they pierce.',
  },
  {
    id: 'lightning_hound', name: 'Lightning Style: Lightning Beast Running', school: 'Lightning', nature: 'lightning',
    rank: 3, cost: 50, cd: 12, seals: ['Ox', 'Hare', 'Monkey'], kind: 'bolt', element: 'lightning', size: 3, speed: 1.4,
    damage: 17, radius: 2, homing: true, desc: "Kakashi's hound of lightning that hunts its target down.",
  },
  {
    id: 'black_panther', name: 'Lightning Style: Black Panther', school: 'Lightning', nature: 'lightning', rank: 4,
    cost: 75, cd: 20, seals: [], kind: 'bolt', element: 'lightning', color: '#2a2440', size: 4, speed: 1.5, damage: 22,
    radius: 3, homing: true, effects: [['slowness', 3, 3]], desc: "Darui's black lightning panther: it paralyses what it touches.",
  },
  {
    id: 'false_darkness', name: 'Lightning Style: False Darkness', school: 'Lightning', nature: 'lightning', rank: 3,
    cost: 45, cd: 11, seals: [], kind: 'beam', element: 'lightning', color: '#9fd0ff', length: 22, width: 1.2, damage: 18,
    desc: "Kakuzu's spear of lightning, fired from a mask on his back.",
  },
  {
    id: 'lariat', name: 'Lightning Style: Lariat', school: 'Lightning', nature: 'lightning', rank: 3, cost: 40, cd: 12,
    seals: [], kind: 'dash', element: 'lightning', speed: 3.6, damage: 19, knock: 3, radius: 3,
    desc: "The Raikage's and Killer Bee's lightning-armoured clothesline.",
  },
  // =============================================================== ADVANCED NATURES
  {
    id: 'laser_circus', name: 'Storm Release: Laser Circus', school: 'Storm', natures: ['lightning', 'water'], rank: 4,
    cost: 80, cd: 20, seals: [], kind: 'barrage', element: 'lightning', color: '#7fdcff', size: 1, speed: 2.4, damage: 8,
    count: 4, waves: 3, spread: 22, interval: 6, homing: true,
    desc: "Darui's bending beams of storm chakra that curve to find every enemy.",
  },
  {
    id: 'extra_steaming_murder', name: 'Scorch Release: Extra Steaming Murder', school: 'Scorch', natures: ['fire', 'wind'],
    rank: 4, cost: 80, cd: 22, seals: [], kind: 'barrage', element: 'fire', color: '#ffb43a', size: 2, speed: 1.2,
    damage: 10, count: 2, waves: 3, interval: 8, homing: true, effects: [['wither', 3, 0]],
    desc: "Pakura's scorching orbs evaporate the water in the body of whoever they touch.",
  },
  {
    id: 'dust_release', name: 'Dust Release: Detachment of the Primitive World', school: 'Dust',
    natures: ['earth', 'wind', 'fire'], rank: 5, cost: 220, cd: 120, seals: [], kind: 'beam', element: 'truth',
    color: '#eef4ff', length: 32, width: 2.6, damage: 55,
    desc: "Onoki's prism of dust: whatever it touches is broken down to molecules.",
  },
  // =============================================================== EARTH
  {
    id: 'headhunter', name: 'Earth Style: Headhunter Jutsu', school: 'Earth', nature: 'earth', rank: 1, cost: 18, cd: 10,
    seals: [], kind: 'bind', range: 12, stun: 3, damage: 6, element: 'earth',
    desc: 'Drag the enemy into the ground up to their neck.',
  },
  {
    id: 'earth_dragon_bullet', name: 'Earth Style: Earth Dragon Bullet', school: 'Earth', nature: 'earth', rank: 2, cost: 35,
    cd: 10, seals: ['Tiger', 'Ram', 'Snake', 'Dog'], kind: 'barrage', element: 'earth', size: 2, speed: 1.5, damage: 8,
    waves: 4, interval: 5, desc: 'A mud dragon rises and spits balls of hardened earth.',
  },
  {
    id: 'earth_flow_river', name: 'Earth Style: Earth Flow River', school: 'Earth', nature: 'earth', rank: 2, cost: 30,
    cd: 14, seals: ['Ox', 'Dog'], kind: 'field', at: 'look', radius: 5, duration: 6, color: '#8a6a42', element: 'earth',
    effects: [['slowness', 2, 3]], desc: 'Turn the ground into a river of mud that drags enemies down.',
  },
  {
    id: 'swamp_underworld', name: 'Earth Style: Swamp of the Underworld', school: 'Earth', nature: 'earth', rank: 4,
    cost: 70, cd: 25, seals: ['Tiger', 'Ram'], kind: 'field', at: 'look', radius: 7, duration: 8, color: '#4a3a2a',
    element: 'earth', damage: 2, effects: [['slowness', 2, 4], ['weakness', 2, 1]],
    desc: "Jiraiya's bottomless swamp swallows anyone who stands in it.",
  },
  {
    id: 'light_weight_rock', name: 'Earth Style: Light Weight Rock Technique', school: 'Earth', nature: 'earth', rank: 3,
    cost: 30, cd: 30, seals: [], kind: 'buff', color: '#c8b88a',
    self: [['slowFalling', 30, 0], ['jumpBoost', 30, 1], ['speed', 30, 0]],
    desc: "Onoki's technique: make yourself weightless enough to fly.",
  },
  {
    id: 'added_weight_rock', name: 'Earth Style: Added Weight Rock Technique', school: 'Earth', nature: 'earth', rank: 3,
    cost: 35, cd: 14, seals: [], kind: 'bind', range: 16, stun: 2, damage: 8, element: 'earth',
    effects: [['slowness', 10, 3]], desc: 'Multiply the enemy\'s weight until they cannot stand.',
  },
  // =============================================================== WATER
  {
    id: 'water_clone', name: 'Water Style: Water Clone Technique', school: 'Water', nature: 'water', rank: 1, cost: 20,
    cd: 25, seals: ['Ram'], kind: 'summon', entity: 'clone', count: 1, life: 20, color: '#56b6ff',
    desc: 'A clone made of water: one tenth of your strength, all of your nerve.',
  },
  {
    id: 'starch_syrup', name: 'Water Style: Starch Syrup Capture Field', school: 'Water', nature: 'water', rank: 1,
    cost: 18, cd: 12, seals: [], kind: 'field', at: 'look', radius: 5, duration: 8, color: '#e8d08a', element: 'water',
    effects: [['slowness', 2, 5]], desc: 'Spit a field of sticky syrup that glues enemies to the ground.',
  },
  {
    id: 'water_shark_bomb', name: 'Water Style: Water Shark Bomb', school: 'Water', nature: 'water', rank: 2, cost: 35,
    cd: 9, seals: [], kind: 'bolt', element: 'water', size: 4, speed: 1.7, damage: 12, radius: 2.5, knock: 1.8,
    desc: "Kisame's shark of water that bites down on its target.",
  },
  {
    id: 'water_wall', name: 'Water Style: Water Formation Wall', school: 'Water', nature: 'water', rank: 2, cost: 30, cd: 14,
    seals: ['Tiger', 'Ox'], kind: 'burst', at: 'self', radius: 4, knock: 2.6, element: 'water',
    self: [['resistance', 5, 1]], desc: 'Spit a wall of water around yourself that throws attackers back.',
  },
  {
    id: 'water_fang', name: 'Water Style: Water Fang Bullet', school: 'Water', nature: 'water', rank: 3, cost: 45, cd: 10,
    seals: [], kind: 'bolt', element: 'water', count: 3, spread: 8, size: 2, speed: 2.6, damage: 12,
    desc: 'Drilling spirals of water that bore through armour.',
  },
  {
    id: 'great_waterfall', name: 'Water Style: Great Waterfall Technique', school: 'Water', nature: 'water', rank: 3,
    cost: 60, cd: 16, seals: ['Ox', 'Monkey', 'Hare'], kind: 'cone', element: 'water',
    range: 13, angle: 75, damage: 16, knock: 3.2, desc: 'A torrent the size of a waterfall crashes over everyone in front of you.',
  },
  {
    id: 'colliding_wave', name: 'Water Style: Exploding Water Colliding Wave', school: 'Water', nature: 'water', rank: 4,
    cost: 90, cd: 30, seals: [], kind: 'field', at: 'self', radius: 9, duration: 5, interval: 20, damage: 5, knock: 1.4,
    element: 'water', effects: [['slowness', 2, 2]], desc: 'Vomit a sea of water that floods the whole battlefield.',
  },
  {
    id: 'thousand_sharks', name: 'Water Style: Thousand Feeding Sharks', school: 'Water', nature: 'water', rank: 5,
    cost: 140, cd: 45, seals: [], kind: 'barrage', element: 'water', size: 2, speed: 1.8, damage: 8, count: 3, waves: 6,
    spread: 24, interval: 5, homing: true, desc: "Kisame's school of hungry sharks: there is nowhere to run.",
  },
  // =============================================================== WOOD / ICE / BONE / HOZUKI
  {
    id: 'four_pillar_prison', name: 'Wood Style: Four Pillar Prison', school: 'Wood', kekkei: 'wood', rank: 2, cost: 40,
    cd: 20, seals: [], kind: 'terrain', shape: 'cage', block: 'wood', at: 'target', range: 16, size: 2, height: 3,
    duration: 12, stun: 3, element: 'wood', desc: "Yamato's wooden cage springs up around the enemy.",
  },
  {
    id: 'wood_clone', name: 'Wood Style: Wood Clone Technique', school: 'Wood', kekkei: 'wood', rank: 3, cost: 50, cd: 35,
    seals: [], kind: 'summon', entity: 'clone', count: 2, life: 45, element: 'wood',
    desc: 'Clones grown from wood: they last far longer than shadow clones.',
  },
  {
    id: 'thousand_hands', name: 'Sage Art: Wood Style: True Several Thousand Hands', school: 'Wood', kekkei: 'wood',
    rank: 5, cost: 200, cd: 90, seals: [], requires: ['wood_dragon'], kind: 'barrage', element: 'wood', size: 4,
    speed: 1.4, damage: 16, radius: 4, explode: 1, count: 3, waves: 8, spread: 30, interval: 5,
    desc: "Hashirama's colossal Buddha of wood rains a thousand hands onto the battlefield.",
  },
  {
    id: 'swallow_snow_storm', name: 'Ice Style: Swallow Snow Storm', school: 'Ice', kekkei: 'ice', rank: 2, cost: 35, cd: 10,
    seals: [], kind: 'barrage', element: 'ice', size: 1, speed: 2.2, damage: 6, count: 3, waves: 4, spread: 16,
    interval: 4, homing: true, effects: [['slowness', 2, 1]], desc: "Haku's flock of ice swallows dives on the enemy.",
  },
  {
    id: 'black_dragon_blizzard', name: 'Ice Style: Black Dragon Blizzard', school: 'Ice', kekkei: 'ice', rank: 4, cost: 90,
    cd: 25, seals: [], kind: 'bolt', element: 'ice', color: '#1a2a4a', size: 6, speed: 1.2, damage: 26, radius: 4,
    effects: [['slowness', 6, 3]], desc: 'A black dragon of ice and wind that freezes everything it bites.',
  },
  {
    id: 'camellia_dance', name: 'Dance of the Camellia', school: 'Bone', kekkei: 'bone', rank: 1, cost: 15, cd: 5, seals: [],
    kind: 'strike', range: 4, damage: 10, element: 'bone', desc: 'A bone sword drawn from your arm, swung in a lightning-fast flurry.',
  },
  {
    id: 'willow_dance', name: 'Dance of the Willow', school: 'Bone', kekkei: 'bone', rank: 2, cost: 25, cd: 8, seals: [],
    kind: 'burst', at: 'self', radius: 3.5, damage: 11, element: 'bone', desc: 'Bones burst from your whole body like willow branches.',
  },
  {
    id: 'clematis_vine', name: 'Dance of the Clematis: Vine', school: 'Bone', kekkei: 'bone', rank: 3, cost: 30, cd: 10,
    seals: [], kind: 'bind', range: 14, damage: 9, pull: true, stun: 1.5, element: 'bone',
    desc: 'A spine-whip that wraps the enemy and drags them in.',
  },
  {
    id: 'clematis_flower', name: 'Dance of the Clematis: Flower', school: 'Bone', kekkei: 'bone', rank: 4, cost: 50, cd: 14,
    seals: [], kind: 'strike', range: 5, damage: 28, knock: 2.2, element: 'bone',
    desc: 'A drill of the densest bone in your body, driven straight through the enemy.',
  },
  {
    id: 'seedling_fern', name: 'Dance of the Seedling Fern', school: 'Bone', kekkei: 'bone', rank: 5, cost: 120, cd: 50,
    seals: [], kind: 'field', at: 'look', radius: 8, duration: 4, interval: 10, damage: 9, element: 'bone',
    desc: "Kimimaro's last dance: a forest of bone erupts from the ground.",
  },
  {
    id: 'great_water_arm', name: 'Water Style: Great Water Arm', school: 'Hozuki', clan: 'hozuki', rank: 3, cost: 35,
    cd: 10, seals: [], kind: 'strike', range: 5, damage: 20, knock: 2.4, element: 'water',
    desc: "Suigetsu pumps water into one arm and swings a fist the size of a boulder.",
  },
  // =============================================================== CLANS
  {
    id: 'shadow_sewing', name: 'Shadow Sewing Technique', school: 'Nara', clan: 'nara', rank: 3, cost: 45, cd: 14, seals: ['Rat'],
    kind: 'bind', radius: 6, at: 'look', range: 16, stun: 2.5, damage: 10, color: '#2a2a34',
    desc: 'Shadow needles rise from the ground and pierce everyone nearby.',
  },
  {
    id: 'partial_expansion', name: 'Partial Expansion Technique', school: 'Akimichi', clan: 'akimichi', rank: 2, cost: 25,
    cd: 9, seals: [], kind: 'strike', range: 5.5, damage: 18, knock: 2.6, color: '#e2a65a',
    desc: 'Swell one arm to giant size and swat the enemy away.',
  },
  {
    id: 'butterfly_bombing', name: 'Butterfly Bullet Bombing', school: 'Akimichi', clan: 'akimichi', rank: 4, cost: 60,
    cd: 40, seals: [], kind: 'strike', range: 6, damage: 48, knock: 3, health: 4, color: '#ffa0d8',
    desc: "Choji's butterfly mode: chakra wings and a single, devastating punch.",
  },
  {
    id: 'mind_body_disturbance', name: 'Mind Body Disturbance Technique', school: 'Yamanaka', clan: 'yamanaka', rank: 2,
    cost: 30, cd: 18, seals: ['Ram'], kind: 'custom', magic: true,
    desc: "Ino's chakra seizes the enemy's body and turns it against its allies.",
    run: (c) => turnAgainst(c, 6, 8),
  },
  {
    id: 'insect_clone', name: 'Insect Clone Technique', school: 'Aburame', clan: 'aburame', rank: 2, cost: 25, cd: 25,
    seals: [], kind: 'summon', entity: 'clone', count: 1, life: 30, color: '#3a4a2a',
    desc: 'A perfect copy of you, made from your swarm.',
  },
  {
    id: 'tunneling_fang', name: 'Tunneling Fang', school: 'Inuzuka', clan: 'inuzuka', rank: 2, cost: 25, cd: 8, seals: [],
    kind: 'dash', speed: 3.4, damage: 12, radius: 3, color: '#c9a46a', desc: 'A drilling spin that tears through the ground and the enemy.',
  },
  {
    id: 'two_headed_wolf', name: 'Two-Headed Wolf', school: 'Inuzuka', clan: 'inuzuka', rank: 3, cost: 35, cd: 30, seals: [],
    requires: ['ninken'], kind: 'aura', upkeep: 4, power: 0.25, color: '#f0f0f0',
    self: [['strength', 2, 1], ['speed', 2, 1], ['resistance', 2, 0]],
    desc: 'You and your ninken fuse into one giant wolf.',
  },
  {
    id: 'vacuum_palm', name: 'Eight Trigrams Vacuum Palm', school: 'Hyuga', clan: 'hyuga', rank: 2, cost: 25, cd: 8,
    seals: [], kind: 'bolt', element: 'wind', color: '#e8f0ff', size: 2, speed: 2.4, damage: 11, knock: 2.2,
    desc: 'A palm strike that hurls compressed chakra across the room.',
  },
  {
    id: 'twin_lion_fists', name: 'Gentle Step Twin Lion Fists', school: 'Hyuga', clan: 'hyuga', rank: 3, cost: 35, cd: 25,
    seals: [], kind: 'aura', upkeep: 5, radius: 2.5, damage: 3, power: 0.15, color: '#7fb8ff',
    self: [['strength', 2, 0]], desc: "Hinata's lion-shaped chakra wraps her fists and burns anyone close.",
  },
  {
    id: 'protective_64', name: 'Protective Eight Trigrams Sixty-Four Palms', school: 'Hyuga', clan: 'hyuga', rank: 3,
    cost: 40, cd: 14, seals: [], kind: 'burst', at: 'self', radius: 5, damage: 10, knock: 2, color: '#7fb8ff',
    desc: 'Threads of chakra from your palms form a shield that cuts down anything entering it.',
  },
  {
    id: 'mountain_crusher', name: 'Eight Trigrams Mountain Crusher', school: 'Hyuga', clan: 'hyuga', rank: 4, cost: 60,
    cd: 18, seals: [], kind: 'cone', range: 11, angle: 50, damage: 22, knock: 3.2, color: '#a8d0ff', element: 'wind',
    desc: 'A palm thrust carrying enough chakra to crush a mountain.',
  },
  {
    id: 'palms_128', name: 'Eight Trigrams One Hundred Twenty-Eight Palms', school: 'Hyuga', clan: 'hyuga', rank: 4,
    cost: 80, cd: 30, seals: [], eyes: BYAKUGAN, requires: ['eight_trigrams'], kind: 'strike', range: 3.5, damage: 36,
    drain: 40, stun: 3, color: '#a8d0ff', desc: 'Double the palms: every chakra point sealed, twice.',
  },
  // =============================================================== SAND (Sand Gourd or Shukaku)
  {
    id: 'sand_shield', name: 'Shield of Sand', school: 'Sand', flag: 'sand', rank: 1, cost: 20, cd: 18, seals: [],
    kind: 'terrain', shape: 'dome', block: 'sand', at: 'self', size: 2, duration: 5, element: 'sand',
    self: [['resistance', 5, 1]], desc: "Gaara's absolute defence: a dome of sand closes around you.",
  },
  {
    id: 'sand_armor', name: 'Armour of Sand', school: 'Sand', flag: 'sand', rank: 2, cost: 25, cd: 15, seals: [],
    kind: 'aura', upkeep: 3, color: '#d8b56a', self: [['resistance', 2, 1]], desc: 'A thin skin of sand that takes blows for you.',
  },
  {
    id: 'sand_coffin', name: 'Sand Binding Coffin', school: 'Sand', flag: 'sand', rank: 2, cost: 30, cd: 12, seals: [],
    kind: 'bind', range: 18, stun: 4, damage: 6, element: 'sand', desc: 'Sand pours over the enemy and holds them in place.',
  },
  {
    id: 'sand_burial', name: 'Sand Waterfall Funeral', school: 'Sand', flag: 'sand', rank: 3, cost: 50, cd: 16, seals: [],
    requires: ['sand_coffin'], kind: 'bind', range: 18, stun: 3, damage: 26, element: 'sand',
    desc: 'Clench your fist and the sand coffin crushes everything inside.',
  },
  {
    id: 'sand_shower', name: 'Sand Shower', school: 'Sand', flag: 'sand', rank: 2, cost: 30, cd: 9, seals: [],
    kind: 'barrage', element: 'sand', size: 1, speed: 2.2, damage: 6, count: 2, waves: 5, spread: 12, interval: 4,
    desc: 'Bullets of hardened sand fired like rain.',
  },
  {
    id: 'quicksand_waterfall', name: 'Quicksand Waterfall Flow', school: 'Sand', flag: 'sand', rank: 4, cost: 80, cd: 30,
    seals: [], kind: 'field', at: 'look', radius: 8, duration: 6, damage: 3, element: 'sand',
    effects: [['slowness', 2, 4]], desc: 'A tidal wave of sand buries the battlefield.',
  },
  // =============================================================== PUPPETRY / EXPLOSION
  {
    id: 'chikamatsu_ten', name: "White Secret Technique: Chikamatsu's Ten Puppets", school: 'Puppetry', flag: 'puppet',
    rank: 4, cost: 100, cd: 60, seals: [], kind: 'summon', entity: 'puppet', count: 3, life: 45,
    desc: "Chiyo's legendary puppets join the fight.",
  },
  {
    id: 'hundred_puppets', name: 'Red Secret Technique: Performance of a Hundred Puppets', school: 'Puppetry',
    flag: 'puppet', rank: 5, cost: 160, cd: 90, seals: [], requires: ['chikamatsu_ten'], kind: 'summon', entity: 'puppet',
    count: 5, life: 50, desc: "Sasori's army of puppets, each one a former shinobi.",
  },
  {
    id: 'iron_sand_drizzle', name: 'Iron Sand: Drizzle', school: 'Puppetry', flag: 'puppet', rank: 3, cost: 50, cd: 14,
    seals: [], kind: 'barrage', element: 'sand', color: '#3a3a44', size: 1, speed: 2.4, damage: 6, count: 3, waves: 5,
    spread: 20, interval: 4, effects: [['poison', 3, 0]],
    desc: "The Third Kazekage's poisoned iron sand falls like rain.",
  },
  {
    id: 'iron_sand_assault', name: 'Iron Sand: Gathering Assault', school: 'Puppetry', flag: 'puppet', rank: 4, cost: 70,
    cd: 20, seals: [], kind: 'bolt', element: 'sand', color: '#3a3a44', size: 5, speed: 1.6, damage: 24, radius: 3,
    knock: 2.5, desc: 'Iron sand gathers into a single massive spiked mass and slams down.',
  },
  {
    id: 'c3', name: 'Explosion Release: C3', school: 'Explosion', flag: 'clay', rank: 4, cost: 100, cd: 40, seals: ['Ram'],
    kind: 'bolt', element: 'earth', color: '#f4efe0', size: 7, speed: 0.8, damage: 34, radius: 7, explode: 4, life: 60,
    desc: "Deidara's giant clay doll: it levels whatever it lands on.",
  },
  // =============================================================== GENJUTSU
  {
    id: 'genjutsu_release', name: 'Genjutsu Release', school: 'Genjutsu', rank: 0, cost: 10, cd: 10, seals: ['Ram'],
    kind: 'cleanse', radius: 8, color: '#ffd0e8', desc: 'Kai! Disrupt your chakra flow and break any illusion on you and your allies.',
  },
  {
    id: 'hell_viewing', name: 'Demonic Illusion: Hell Viewing Technique', school: 'Genjutsu', rank: 1, cost: 20, cd: 14,
    seals: ['Ram'], kind: 'bind', range: 14, magic: true, color: '#c86aa8',
    effects: [['nausea', 8, 0], ['blindness', 3, 0], ['weakness', 8, 0]],
    desc: 'Show the enemy their worst fear until they cannot fight.',
  },
  {
    id: 'mirror_heaven_earth', name: 'Demonic Illusion: Mirror Heaven and Earth Change', school: 'Genjutsu', rank: 2,
    cost: 25, cd: 20, seals: [], kind: 'cleanse', color: '#ffd0e8', self: [['resistance', 10, 0]],
    desc: 'Reflect an illusion back onto its caster and steady yourself.',
  },
  {
    id: 'tree_binding_death', name: 'Demonic Illusion: Tree Binding Death', school: 'Genjutsu', rank: 3, cost: 40, cd: 18,
    seals: ['Ram'], kind: 'bind', range: 16, stun: 4, dot: 3, duration: 4, magic: true, color: '#c86aa8',
    desc: "Kurenai's illusion: a tree binds the enemy while you strike.",
  },
  {
    id: 'temple_nirvana', name: 'Temple of Nirvana Technique', school: 'Genjutsu', rank: 3, cost: 45, cd: 25, seals: [],
    kind: 'field', at: 'self', radius: 9, duration: 6, magic: true, color: '#f4f0f8',
    effects: [['slowness', 2, 3], ['blindness', 2, 0], ['weakness', 2, 1]],
    desc: "Kabuto's feathers fall and everyone who watches them drifts into sleep.",
  },
  // =============================================================== FUINJUTSU
  {
    id: 'flying_thunder_god', name: 'Flying Thunder God Technique', school: 'Fuinjutsu', rank: 4, cost: 40, cd: 2, seals: [],
    kind: 'mark', range: 30, damage: 14, duration: 120, color: '#f2d24a',
    desc: "Minato's space-time seal: mark a place, then flash to it in an instant, striking everything on the way.",
  },
  {
    id: 'five_elements_seal', name: 'Five Elements Seal', school: 'Fuinjutsu', rank: 3, cost: 40, cd: 25, seals: [],
    kind: 'bind', range: 6, drain: 60, stun: 1, magic: true, color: '#8a6ad8',
    effects: [['weakness', 20, 1], ['miningFatigue', 20, 1]],
    desc: "Orochimaru's five-pronged seal that scrambles the enemy's chakra.",
  },
  {
    id: 'five_elements_unseal', name: 'Five Elements Unseal', school: 'Fuinjutsu', rank: 2, cost: 20, cd: 20, seals: [],
    kind: 'cleanse', heal: 4, color: '#c8b8ff', desc: 'Break the seals on your own chakra network.',
  },
  {
    id: 'evil_sealing', name: 'Evil Sealing Method', school: 'Fuinjutsu', rank: 3, cost: 45, cd: 25, seals: [],
    kind: 'bind', range: 8, stun: 3, magic: true, color: '#2a1a2a', effects: [['weakness', 15, 2]],
    desc: 'Ink seals crawl over the enemy and lock their power away.',
  },
  {
    id: 'four_violet_flames', name: 'Four Violet Flames Formation', school: 'Fuinjutsu', rank: 3, cost: 60, cd: 45,
    seals: [], kind: 'terrain', shape: 'cage', block: 'barrier', at: 'self', size: 5, height: 4, duration: 20,
    color: '#8a6ad8', desc: 'Four corners, one barrier: nothing gets in or out for twenty seconds.',
  },
  {
    id: 'reaper_death_seal', name: 'Reaper Death Seal', school: 'Fuinjutsu', rank: 5, cost: 100, cd: 300, seals: [],
    kind: 'custom', magic: true,
    desc: 'Call the Shinigami to seal an enemy\'s soul. Lesser foes are gone; great foes and shinobi lose a quarter of their life. It costs half of yours.',
    run(c) {
      const t = target(c, 10);
      if (!t) return fail(c, 'The Shinigami needs a soul in reach.');
      const h = health(t);
      const great = t.matches({ families: ['shinobi_boss'] }) || t.typeId === 'minecraft:player';
      hurt(t, great ? Math.min(400, (h?.effectiveMax ?? 100) * 0.25) : 9999, c.p, undefined);
      const mine = health(c.p);
      if (mine) hurt(c.p, mine.currentValue * 0.5, undefined, undefined);
      fx(c.dim, PARTICLE.wisp, eyes(t), rgb('#f4f0e8'));
      title(c.p, '§fReaper Death Seal', great ? '§7Part of its soul is sealed away' : '§7The soul is sealed', 40);
      sound(c.dim, SOUND.curse, c.p.location, 0.6, 1);
    },
  },
  // =============================================================== MEDICAL
  {
    id: 'chakra_scalpel', name: 'Chakra Scalpel', school: 'Medical', rank: 2, cost: 25, cd: 7, seals: [],
    kind: 'strike', range: 3.5, damage: 11, color: '#7fe8a8', effects: [['weakness', 10, 1], ['slowness', 6, 1]],
    desc: 'A blade of chakra that cuts muscle and tendon beneath the skin.',
  },
  {
    id: 'poison_mist', name: 'Poison Mist', school: 'Medical', rank: 2, cost: 30, cd: 16, seals: [], kind: 'field',
    at: 'look', radius: 5, duration: 6, color: '#8ad06a', effects: [['poison', 3, 1]],
    desc: "Shizune's cloud of poison: anyone who breathes it in sickens fast.",
  },
  {
    id: 'creation_rebirth', name: 'Creation Rebirth', school: 'Medical', rank: 4, cost: 60, cd: 60, seals: [], kind: 'aura',
    upkeep: 8, heal: 2, color: '#7fe8a8', self: [['regeneration', 2, 1]],
    desc: "Tsunade's Strength of a Hundred released: your cells rebuild themselves as fast as they are hurt.",
  },
  // =============================================================== SENJUTSU (Sage Mode active)
  {
    id: 'frog_kumite', name: 'Sage Art: Frog Kumite', school: 'Senjutsu', rank: 3, cost: 20, cd: 5, seals: [],
    requires: ['sage_mode'], active: 'sage_mode', kind: 'strike', range: 5, damage: 18, knock: 2.6, color: '#ff9a2a',
    desc: 'Natural energy extends your reach: blows land before your fist arrives.',
  },
  {
    id: 'goemon', name: 'Sage Art: Goemon', school: 'Senjutsu', rank: 4, cost: 60, cd: 18, seals: [],
    requires: ['sage_mode'], active: 'sage_mode', kind: 'cone', element: 'fire', range: 14, angle: 60, damage: 20, fire: 7,
    desc: 'Toad oil, sage fire and sage wind combine into a river of flame.',
  },
  {
    id: 'toad_chant', name: 'Sage Art: Demonic Illusion: Toad Confrontation Chant', school: 'Senjutsu', rank: 4, cost: 70,
    cd: 40, seals: [], requires: ['sage_mode'], active: 'sage_mode', kind: 'bind', radius: 9, at: 'self', stun: 4, dot: 2,
    duration: 4, magic: true, color: '#ff9a2a', desc: 'The two great sage toads sing a genjutsu no one can resist.',
  },
  {
    id: 'super_big_ball_rasengan', name: 'Sage Art: Super Big Ball Rasengan', school: 'Senjutsu', rank: 4, cost: 90,
    cd: 22, seals: [], requires: ['sage_mode', 'big_ball_rasengan'], active: 'sage_mode', kind: 'bolt',
    element: 'rasengan', size: 7, speed: 1.0, damage: 30, radius: 5, knock: 3,
    desc: 'A Rasengan as big as a house, charged with natural energy.',
  },
  {
    id: 'many_big_ball_rasengan', name: 'Sage Art: Many Super Big Ball Rasengan', school: 'Senjutsu', rank: 5, cost: 160,
    cd: 45, seals: [], requires: ['super_big_ball_rasengan', 'multi_shadow_clone'], active: 'sage_mode', kind: 'barrage',
    element: 'rasengan', size: 5, speed: 1.1, damage: 20, radius: 3, count: 3, waves: 3, spread: 20, interval: 8,
    desc: 'A crowd of sage clones, each driving a giant Rasengan into the ground.',
  },
  {
    id: 'sage_rasenshuriken', name: 'Sage Art: Wind Style: Rasenshuriken', school: 'Senjutsu', rank: 5, cost: 120, cd: 30,
    seals: [], requires: ['sage_mode', 'rasenshuriken'], active: 'sage_mode', kind: 'bolt', element: 'rasenshuriken',
    size: 6, speed: 1.5, damage: 26, radius: 5, pulses: 6, desc: 'The Rasenshuriken, finally thrown: it expands into a storm of wind blades.',
  },
  // =============================================================== SIX PATHS / JINCHURIKI / TENSEIGAN
  {
    id: 'lava_rasenshuriken', name: 'Lava Release: Rasenshuriken', school: 'Six Paths', rank: 5, cost: 130, cd: 35,
    seals: [], active: 'six_paths_sage', kind: 'bolt', element: 'rasenshuriken', color: '#ff5a1f', size: 6, speed: 1.4,
    damage: 34, radius: 6, pulses: 6, fire: 6, desc: "Naruto's Rasenshuriken mixed with Son Goku's lava.",
  },
  {
    id: 'magnet_rasengan', name: 'Magnet Release: Rasengan', school: 'Six Paths', rank: 5, cost: 110, cd: 30, seals: [],
    active: 'six_paths_sage', kind: 'bolt', element: 'sand', color: '#3a3a44', size: 5, speed: 1.3, damage: 30, radius: 4,
    effects: [['slowness', 6, 4]], desc: "Shukaku's magnet sand wrapped around a Rasengan: whatever it hits is pinned.",
  },
  {
    id: 'super_bijuu_rasenshuriken', name: 'Super Tailed Beast Rasenshuriken', school: 'Jinchuriki', rank: 5, cost: 180,
    cd: 60, seals: [], beast: 'kurama', active: 'tailed_beast_cloak', minSync: 80, kind: 'bolt', element: 'rasenshuriken',
    color: '#ff8a2a', size: 8, speed: 1.2, damage: 48, radius: 7, pulses: 6, explode: 2,
    desc: 'Every tailed beast\'s chakra spun into one Rasenshuriken.',
  },
  {
    id: 'kurama_arms', name: 'Kurama Mode: Chakra Arms', school: 'Jinchuriki', rank: 3, cost: 30, cd: 6, seals: [],
    beast: 'kurama', active: 'tailed_beast_cloak', kind: 'strike', range: 10, damage: 20, knock: 3, color: '#ff8a2a',
    desc: 'Arms of Kurama\'s chakra reach out and grab what your hands cannot.',
  },
  {
    id: 'golden_wheel', name: 'Golden Wheel Rebirth Explosion', school: 'Tenseigan', rank: 4, cost: 140, cd: 60, seals: [],
    eyes: ['tenseigan'], active: 'tenseigan_mode', kind: 'burst', at: 'look', range: 30, radius: 8, delay: 30, damage: 34,
    explode: 3, color: '#7fd8ff', desc: "Toneri's attraction and repulsion collide in a blast that can split the moon.",
  },
  // =============================================================== SHARINGAN / MANGEKYO
  {
    id: 'sharingan_genjutsu', name: 'Sharingan: Genjutsu', school: 'Sharingan', eyes: SHARINGAN, rank: 1, cost: 20, cd: 12,
    seals: [], kind: 'bind', range: 12, stun: 3, magic: true, color: '#d01020', effects: [['nausea', 5, 0]],
    desc: 'A single look traps the enemy in an illusion.',
  },
  {
    id: 'kagutsuchi', name: 'Blaze Release: Kagutsuchi', school: 'Mangekyo', eyes: MS, rank: 3, cost: 60, cd: 18, seals: [],
    strain: 8, kind: 'cone', element: 'amaterasu', range: 10, angle: 50, damage: 14, fire: 8,
    desc: "Sasuke shapes Amaterasu's black flames into blades.",
  },
  {
    id: 'yasaka_magatama', name: 'Susanoo: Yasaka Magatama', school: 'Mangekyo', eyes: MS, rank: 3, cost: 50, cd: 14,
    seals: [], active: 'susanoo', kind: 'barrage', element: 'karma', color: '#d01020', size: 2, speed: 2.0, damage: 10,
    radius: 2, count: 3, waves: 2, spread: 14, interval: 6, desc: "Itachi's Susanoo hurls chained magatama.",
  },
  {
    id: 'totsuka_blade', name: 'Susanoo: Totsuka Blade', school: 'Mangekyo', eyes: MS, rank: 4, cost: 80, cd: 30, seals: [],
    active: 'susanoo', kind: 'strike', range: 9, damage: 30, stun: 4, color: '#d04a3a', effects: [['weakness', 20, 2]],
    desc: 'The sword of sealing: whoever it pierces is drawn into an eternal dream.',
  },
  {
    id: 'indras_arrow', name: "Susanoo: Indra's Arrow", school: 'Mangekyo', eyes: MS, rank: 5, cost: 180, cd: 75, seals: [],
    strain: 15, active: 'susanoo', kind: 'beam', element: 'lightning', color: '#b06aff', length: 40, width: 2.4, damage: 50,
    desc: "Sasuke's arrow of every tailed beast's chakra and natural lightning.",
  },
  {
    id: 'kotoamatsukami', name: 'Kotoamatsukami', school: 'Mangekyo', eyes: MS, rank: 5, cost: 150, cd: 300, seals: [],
    strain: 20, kind: 'custom', magic: true, desc: "Shisui's perfect genjutsu: the enemy fights for you without ever knowing.",
    run: (c) => turnAgainst(c, 10, 20),
  },
  {
    id: 'izanagi', name: 'Izanagi', school: 'Mangekyo', eyes: MS, rank: 5, cost: 100, cd: 600, seals: [], strain: 25,
    kind: 'custom', desc: 'Rewrite reality for thirty seconds: the next blow that would fell you never happened.',
    run(c) {
      rt(c.p).izanagiUntil = system.currentTick + 600;
      title(c.p, '§cIzanagi', '§7Reality bends to your will', 40);
      fx(c.dim, PARTICLE.tomoe, eyes(c.p), rgb('#d01020'));
    },
  },
  {
    id: 'izanami', name: 'Izanami', school: 'Mangekyo', eyes: MS, rank: 4, cost: 90, cd: 120, seals: [], strain: 15,
    kind: 'bind', range: 14, stun: 8, magic: true, color: '#d01020', effects: [['nausea', 10, 0]],
    desc: 'Trap the enemy in a loop of the same moment until they accept the truth.',
  },
  // =============================================================== RINNEGAN: THE SIX PATHS OF PAIN
  {
    id: 'asura_path', name: 'Asura Path: Missiles', school: 'Rinnegan', eyes: RINNEGAN, rank: 3, cost: 60, cd: 16, seals: [],
    kind: 'barrage', element: 'earth', color: '#9aa4b0', size: 2, speed: 1.6, damage: 9, radius: 3, explode: 1, count: 2,
    waves: 3, spread: 16, interval: 8, homing: true, desc: 'Mechanical arms open and launch homing missiles.',
  },
  {
    id: 'preta_path', name: 'Preta Path: Absorption', school: 'Rinnegan', eyes: RINNEGAN, rank: 2, cost: 25, cd: 20,
    seals: [], kind: 'custom', desc: 'For five seconds, every jutsu that hits you is drunk as chakra.',
    run(c) {
      rt(c.p).absorbUntil = system.currentTick + 100;
      fx(c.dim, PARTICLE.sphere, eyes(c.p), rgb('#9a7ad8'));
      title(c.p, ' ', '§5Preta Path: absorbing jutsu', 30);
    },
  },
  {
    id: 'human_path', name: 'Human Path: Soul Removal', school: 'Rinnegan', eyes: RINNEGAN, rank: 3, cost: 45, cd: 18,
    seals: [], kind: 'strike', range: 4, damage: 20, drain: 40, magic: true, color: '#9a7ad8',
    effects: [['weakness', 10, 1], ['slowness', 6, 2]], desc: 'Grip the enemy and tear part of their soul out.',
  },
  {
    id: 'naraka_path', name: 'Naraka Path: King of Hell', school: 'Rinnegan', eyes: RINNEGAN, rank: 3, cost: 50, cd: 40,
    seals: [], kind: 'heal', at: 'target', range: 10, heal: 18, color: '#9a7ad8', self: [['regeneration', 6, 1]],
    desc: 'The King of Hell swallows an ally\'s wounds and spits them out whole.',
  },
  {
    id: 'animal_path', name: 'Animal Path: Summoning', school: 'Rinnegan', eyes: RINNEGAN, rank: 3, cost: 60, cd: 50,
    seals: [], kind: 'summon', entity: 'wolf', count: 3, life: 45, desc: 'Summon a pack of beasts to fight beside you.',
  },
  {
    id: 'limbo', name: 'Limbo: Border Jail', school: 'Rinnegan', eyes: RINNEGAN, rank: 5, cost: 120, cd: 45, seals: [],
    kind: 'field', at: 'target', range: 20, radius: 3.5, duration: 6, interval: 10, damage: 6, magic: true, color: '#2a2440',
    desc: "Madara's invisible shadows strike from the other side of the world.",
  },
  {
    id: 'outer_path', name: 'Outer Path: Samsara of Heavenly Life', school: 'Rinnegan', eyes: RINNEGAN, rank: 5, cost: 200,
    cd: 600, seals: [], kind: 'heal', radius: 24, heal: 40, health: 8, color: '#e8e4ff',
    desc: "Nagato's last technique: restore everyone around you, at a terrible cost to yourself.",
  },
];

forgeAll(SPECS);

/** For docs and tests. */
export const CATALOG_IDS = SPECS.map((s) => s.id);
