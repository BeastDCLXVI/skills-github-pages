# Extending Shinobi Reroll: add your own jutsu

Since v2.0 every jutsu can be described as **data**. The built-in catalogue
(`src/scripts/jutsu/catalog.js`) uses the same format, and other add-ons can register techniques
at runtime without touching this pack's files.

## Three ways to add a jutsu

1. **From another add-on (recommended).** Make a behavior pack with a script that sends each spec
   through a script event once the world has loaded:

   ```js
   import { system, world } from '@minecraft/server';

   world.afterEvents.worldLoad.subscribe(() => {
     system.sendScriptEvent('shinobi:jutsu', JSON.stringify({
       id: 'my_storm_spear', name: 'Lightning Style: Storm Spear', school: 'Lightning', nature: 'lightning',
       rank: 2, cost: 35, cd: 8, kind: 'beam', element: 'lightning', length: 18, damage: 12,
       desc: 'A spear of lightning that pierces everything in a line.',
     }));
   });
   ```

   A complete, working example ships as `dist/ShinobiReroll_ExampleJutsu-v*.mcpack` (source:
   `examples/custom-jutsu-pack/`). Copy it, change the specs, and you have your own jutsu add-on.
   Its manifest depends on the Shinobi Reroll behavior pack, so Minecraft loads both together.

2. **From chat (operators).** Run `/scriptevent shinobi:jutsu {"id":"my_jutsu","kind":"bolt",...}`.
   Remove a jutsu with `/scriptevent shinobi:jutsu_remove my_jutsu`.

3. **In this repository.** Add a spec to `src/scripts/jutsu/catalog.js`. Catalogue specs may also use
   `kind: 'custom'` with a `run(c, spec)` function for behaviour no archetype covers.

Registered jutsu appear in the Shinobi Scroll's Learn menu, cost Jutsu Points, slot into loadouts
and are cast with the Chakra Focus like any other. External registrations are saved in the world, so
they survive restarts. A world holds at most 64 external jutsu.

## The spec

| Field | Meaning |
|---|---|
| `id` | 3–32 characters, `a-z 0-9 _`, starting with a letter. Must not clash with a built-in jutsu. |
| `name`, `desc`, `school` | Text shown in menus (school defaults to `Custom`). |
| `rank` | 0 Academy · 1 Genin · 2 Chunin · 3 Jonin · 4 Sannin · 5 Kage. Also sets the JP cost (rank + 1). |
| `cost`, `cd` | Chakra cost, cooldown in seconds. |
| `seals` | Hand seals woven before casting: Rat, Ox, Tiger, Hare, Dragon, Snake, Horse, Ram, Monkey, Bird, Dog, Boar. |
| `kind` | The archetype (see below). |

### Requirements (all optional)

| Field | Meaning |
|---|---|
| `nature` / `natures` | A nature, or several that are all required (`["fire","wind"]`): fire, wind, lightning, earth, water. |
| `clan` | A clan id: none, inuzuka, aburame, nara, akimichi, yamanaka, hyuga, uchiha, senju, uzumaki, yuki, terumi, hozuki, kaguya, otsutsuki. |
| `eyes` | Dojutsu that qualify: byakugan, sharingan, mangekyo, rinnegan, rinne_sharingan, tenseigan, jogan. |
| `requires` | Jutsu ids that must be learned first. |
| `active` | A toggle that must be running when casting (e.g. `sage_mode`, `susanoo`, `tailed_beast_cloak`). |
| `minSync` | Minimum tailed-beast sync (0–100). |

### Archetypes (`kind`)

| Kind | What it does | Key fields |
|---|---|---|
| `bolt` | Fires projectile(s) | `element`, `count`, `spread`, `size` 1–8, `speed`, `damage`, `radius`, `explode`, `homing`, `pulses` |
| `barrage` | Waves of projectiles over time | bolt fields + `waves`, `interval` (ticks) |
| `cone` | Hits everything in front of you | `range`, `angle`, `damage`, `knock` |
| `burst` | Area blast | `at` (`self`/`look`/`target`), `range`, `radius`, `delay`, `damage`, `explode` |
| `beam` | A line through everything | `length`, `width`, `damage`, `waves`, `interval` |
| `chain` | Hits a target, then leaps to others | `range`, `jumps`, `damage` |
| `strike` | Close in on the target and hit | `range`, `damage`, `behind` (appear behind it), `radius` (splash) |
| `dash` | Charge forward, hitting what you pass | `speed`, `radius`, `damage` |
| `buff` | Empower yourself | `self` effects, `heal`, `chakra` |
| `aura` | A toggle with upkeep | `upkeep` (chakra/s), `self` effects, `heal`/s, `radius` + `damage` (burns nearby foes), `power` (extra jutsu power, max 1) |
| `heal` | Heal yourself, the ally you look at, or everyone around | `at: 'target'`, `radius`, `heal` |
| `summon` | Allies that fight for you | `entity` (clone, toad, snake, slug, clawGrime, puppet, wolf), `count` ≤ 4, `life` (s) ≤ 120 |
| `terrain` | Temporary blocks (only into air, reverted later) | `shape` (wall, dome, cage, ring, spikes, pillar), `block` (earthWall, wood, ice, sand, barrier), `size`, `height`, `duration` |
| `bind` | Hold one target, or all in a `radius` | `stun` (s), `dot` (damage/s) for `duration`, `pull` |
| `field` | A lingering area | `at`, `radius`, `duration`, `interval`, `damage`, `effects`, `allies` + `heal` |
| `mark` | Flying Thunder God: cast to place a mark, cast again to flash to it | `range`, `damage` (hits along the path), `duration` |
| `cleanse` | Remove harmful effects from you (and players within `radius`) | `heal` |

### Shared hit fields

`damage` (scaled by the caster's jutsu power) · `effects`: `[["slowness", seconds, amplifier], ...]` ·
`self`: effects on the caster · `knock`, `up` · `fire` (seconds) · `stun` (seconds) · `pull` ·
`drain` (steal chakra) · `lifesteal` (0–1) · `health` (the caster pays health, like the Eight Gates) ·
`magic` (genjutsu damage) · `element` · `color` (`#rrggbb`) · `sound` (a key of `SOUND` in `ids.js`).

**Effects** use these keys: speed, slowness, haste, miningFatigue, strength, jumpBoost, nausea,
regeneration, resistance, fireResistance, waterBreathing, invisibility, blindness, nightVision, hunger,
weakness, poison, wither, healthBoost, absorption, levitation, slowFalling, darkness, saturation.

**Elements** (projectile look and impact shape): fire, water, wind, lightning, earth, rasengan,
rasenshuriken, ice, lava, bone, ash_bone, truth, bijuu_bomb, karma, wood, boil, amaterasu, sand, ink.
Each lands with its own particle shape: flame tongues, splashes, wind blades, lightning arcs, debris,
sand grains, ink blots, leaves, shards, or a spinning chakra sphere.

### Safety

Every number is clamped. For example, `damage` tops out at 120, `radius` at 12 and `count` at 12;
effects last at most 60 s at amplifier 4 or lower; summons last at most 120 s. External specs cannot
run code: `custom` is rejected. Entities and blocks come from fixed allow-lists. Unknown fields are
ignored. A rejected spec is reported to the operator who sent it, or to the content log when another
add-on sent it.
