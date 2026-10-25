// Example companion add-on for Shinobi Reroll.
//
// It adds three jutsu without touching Shinobi Reroll's files: each technique is a JSON spec sent
// through the `shinobi:jutsu` script event (see docs/EXTENDING.md for every field). Copy this pack,
// change the specs, and you have your own jutsu add-on.
import { system, world } from '@minecraft/server';

/** Your techniques. Each uses one of the forge archetypes: bolt, barrage, cone, burst, beam, ... */
const MY_JUTSU = [
  {
    id: 'ex_crimson_spiral', name: 'Crimson Spiral', school: 'Ninjutsu', rank: 1, cost: 20, cd: 6,
    kind: 'bolt', element: 'rasengan', color: '#ff3a5a', size: 3, speed: 1.8, damage: 10, radius: 2,
    desc: 'A red spiralling sphere, from the example add-on.',
  },
  {
    id: 'ex_frost_ring', name: 'Ice Style: Frost Ring', school: 'Ice', rank: 2, cost: 30, cd: 10,
    kind: 'burst', at: 'self', radius: 5, element: 'ice', damage: 8, effects: [['slowness', 4, 2]],
    desc: 'A ring of frost bursts out around you and slows everything it touches.',
  },
  {
    id: 'ex_guardian_wolves', name: 'Summoning: Guardian Wolves', school: 'Ninjutsu', rank: 2, cost: 40, cd: 45,
    kind: 'summon', entity: 'wolf', count: 2, life: 40, seals: ['Dog', 'Boar'],
    desc: 'Two wolves answer your call and guard you for forty seconds.',
  },
];

world.afterEvents.worldLoad.subscribe(() => {
  for (const spec of MY_JUTSU) system.sendScriptEvent('shinobi:jutsu', JSON.stringify(spec));
});
