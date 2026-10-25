# Shinobi Reroll: Naruto · Shippuden · Boruto for Minecraft Bedrock

A full-scale **Bedrock add-on (`.mcaddon`)** that rebuilds the Java-edition Naruto/Boruto mod
experience (Forge / NeoForge / Fabric / LiteLoader, Mixin-based) natively on the Bedrock Script API.
It includes chakra, ranks, **clan rerolls**, nature releases and kekkei genkai, **229 jutsu in 41 schools**, dojutsu
evolution, all nine tailed beasts plus the Ten-Tails, Akatsuki and Otsutsuki bosses, the Karma, a
**mission board with a Ryo economy**, village blueprints, ninja tools, legendary swords and pills, and
**the Inner Path**: your Nindo, Resolve, bonds, a private journal and the Waterfall of Truth. v1.3 adds the
**Boruto era** (Code, Claw Grime, Isshiki) and **HD textures** throughout. v2.0 is **the Great Catalogue**:
128 more canon techniques, refined chakra shapes, rounder tailed beasts, and an **extension API** so
other add-ons can add their own jutsu.

> Unofficial fan work. *Naruto* and *Boruto* belong to Masashi Kishimoto / Shueisha / Studio Pierrot.
> This project is not affiliated with them, Mojang or Microsoft. All code and every texture and model
> here is original: generated procedurally by `tools/gen`. No code or assets from existing mods are used.

**Download:** [`dist/ShinobiReroll-v2.0.0.mcaddon`](dist/ShinobiReroll-v2.0.0.mcaddon), with separate
`.mcpack` files alongside it, plus an optional example add-on (`ShinobiReroll_ExampleJutsu-v2.0.0.mcpack`)
that shows how to add your own jutsu.
**Requires:** Minecraft Bedrock **1.21.90 or newer** (Script API `@minecraft/server` 2.0.0, stable).
No experimental toggles.

---

## Install

1. Open the `.mcaddon` file (or both `.mcpack` files). Minecraft imports both packs.
2. Create or edit a world → **Behavior Packs** → activate **Shinobi Reroll Behavior**. The resource pack is added automatically.
3. Join. You are born into a random clan and receive a **Shinobi Scroll**, a **Chakra Focus**, kunai, shuriken and ramen.

## Controls

| Action | How |
|---|---|
| Cast the selected jutsu | Use the **Chakra Focus** |
| Next jutsu in your loadout | Sneak + use the Chakra Focus |
| Charge chakra (×3 regen) / gather natural energy for Sage Mode | Sneak and stand still holding the Chakra Focus |
| Menus: profile, loadout, learn jutsu, natures, **missions**, **shop**, dojutsu, tailed beast, settings, codex | Use the **Shinobi Scroll** |
| Mission desk | Talk to a **Leaf Shinobi**, or Shinobi Scroll › Missions |
| Build a village structure | Use a **Blueprint** scroll (builds only into empty space) |
| Quick jutsu wheel | Sneak + use the Shinobi Scroll |
| Toggle your dojutsu | **Sneak + jump** |
| Throw kunai / shuriken / senbon / fuma / smoke bombs | Use them (sneak with shuriken at Genin+ = triple throw) |

Hand seals are woven automatically before each jutsu (shown on the HUD). The Sharingan and your rank speed this up.

## Progression

* **Ranks:** Academy Student → Genin (100 XP) → Chunin (600) → Jonin (2000) → Sannin (5000) → Kage (10000).
  Each rank gives +3 Jutsu Points, more max chakra and more loadout slots. You get extra **nature slots**
  at Chunin, Jonin, Sannin and Kage.
* **XP** comes from defeating enemies, casting, and training on a **Training Post** (until Jonin).
  Every 250 XP also gives a Jutsu Point.
* **Jutsu Points** buy techniques in *Learn Jutsu*. The full list is in [docs/JUTSU.md](docs/JUTSU.md),
  which is generated from the code.
* **Missions:** every in-game day the desk offers three D- to S-rank missions scaled to your rank: hunts,
  deliveries, training and jutsu practice. They pay **Ryo**, XP and sometimes Jutsu Points. Spend Ryo in the
  **Ninja Shop** (tools, pills, contracts, reroll scrolls, blueprints) and sell crystals and Zetsu spores back.

## Clans: the reroll

| Clan | Rarity | What it gives |
|---|---|---|
| Clanless | Common | +15% XP, +1 JP per rank |
| Inuzuka · Aburame · Nara · Akimichi · Yamanaka | Uncommon | Ninken / insects / shadows / expansion / mind techniques |
| Hyuga | Rare | Byakugan, Gentle Fist, Rotation, 64 Palms |
| Uchiha | Rare | Sharingan → Mangekyo (Amaterasu, Tsukuyomi, Susanoo, Kamui) |
| Senju | Rare | Wood Release, great vitality |
| Uzumaki | Rare | Huge chakra, −15% jutsu cost, Adamantine Sealing Chains |
| Yuki · Terumi · Hozuki · Kaguya | Rare | Ice / Lava & Boil / Hydrification / Bone techniques |
| Otsutsuki | **Legendary** | Celestial chakra, Byakugan, absorption, Ash Bones, Yomotsu Hirasaka, Daikokuten |

Craft a **Clan Reroll Scroll** to spin again. After 10 rerolls without a Rare, the next one is
guaranteed Rare or better. Clan-only techniques you lose are refunded as Jutsu Points.

## Natures, kekkei genkai and dojutsu

* **Fire, Wind, Lightning, Earth, Water**: from Great Fireball and Chidori up to Great Fire Annihilation, Kirin and Rasenshuriken.
* **Wood** (Senju, or implant **Hashirama Cells**, which have a 25% rejection risk), **Ice** (Yuki), **Lava/Boil** (Terumi), **Bone** (Kaguya).
  Earth walls, timber and ice are **temporary**: they only fill air and crumble back after a while, even across restarts.
* **Byakugan / Jogan** mark enemies through walls (only you see the marks). **Sharingan** matures from 1 to 3 tomoe
  in combat, foresees attacks, weaves seals faster and **copies jutsu** cast near you.
* **Mangekyo**: an Uchiha Jonin with 3 tomoe who sees a companion die (a tamed wolf or Leaf Shinobi) awakens it.
  It causes eye strain until Kage rank (Eternal).
* The **Chakra Fruit** grants Rinnegan (Shinra Tensei, Bansho Ten'in, Amenotejikara, Chibaku Tensei),
  Rinne-Sharingan (Infinite Tsukuyomi) or Tenseigan (Truth-Seeking Balls, Chakra Mode), depending on your clan.

## Tailed beasts, Ten-Tails, Otsutsuki

1. Craft a **Tailed Beast Summoning Scroll** and pick a beast. Shukaku, Matatabi, Isobu, Son Goku, Kokuo,
   Saiken, Chomei, Gyuki and Kurama each have their own model, signature ability and **Tailed Beast Bomb**.
2. Defeat it, or weaken it below 30% and use a **Sealing Scroll** on it, to get its **chakra orb**.
3. Use the orb to become its **Jinchuriki**: Tailed Beast Cloak (sync grows to 100%) and Tailed Beast Bomb.
   Sneak + Sealing Scroll releases it back into an orb.
4. Combine all nine orbs into the **Gedo Statue Core** to revive the **Ten-Tails**. It drops **Chakra Fruit**.
5. A Chakra Fruit goes into the **Otsutsuki Summoning Sigil**, which summons **Momoshiki**. He absorbs
   jutsu while his palms glow. He drops the **Karma Seal**: Karma Activation and Absorbed Release, and
   Uzumaki or Hyuga players without an eye awaken the **Jogan**.

## Akatsuki, Sannin and Kara (v1.1)

* **Itachi Uchiha** casts genjutsu, Amaterasu and crow clones, and raises Susanoo when he is losing.
  He can drop **Itachi's Eyes**: an Uchiha with the Mangekyo who uses them gets the **Eternal Mangekyo**
  (no eye strain). Someone with no dojutsu gets a fully matured Sharingan instead.
* **Kisame Hoshigaki** fires shark bombs and Water Prison, drains you with Samehada and fuses with it at
  half health. He can drop Samehada.
* **Deidara** sends homing C1 birds and C2 explosives, and at low health starts C0: *run*. He drops **Explosive Clay**.
  The first lump you use teaches you **Explosion Release**; after that, each lump is a homing bomb.
* **Orochimaru** summons snakes, lunges with Kusanagi and sheds his skin. He can drop the **Cursed Seal**
  (Stage One / Stage Two; 25% rejection chance), the **Snake Contract** and Kusanagi.
* These four roam at night on Normal difficulty and above.
* **Kinshiki** now arrives with Momoshiki, and Momoshiki absorbs him when he weakens.
  Craft a **Kara Ring** to face **Jigen** (Daikokuten, Sukunahikona, warping, jutsu absorption).

## New arts (v1.1)

* **Eight Gates:** Gate of Opening, Gate of View and Gate of Death cost *health* instead of chakra
  (half for the Clanless). Front Lotus, Morning Peacock, Daytime Tiger, Evening Elephant and Night Guy
  need their gate open.
* **Medical ninjutsu:** Mystical Palm (heals the ally you look at), Cherry Blossom Impact, Strength of a Hundred Seal.
* **Puppetry** (Puppet Technique Scroll): Karasu, a poison-blade puppet, and Iron Maiden.
* **Summons:** Snake contract (giant serpent) and Slug contract (Katsuyu heals you and nearby allies), alongside the toads.
* **Boruto era:** Rasengan Uzuhiko, Karma Shape Transformation (Kawaki's blade), Sukunahikona.
* **Final forms:** **Baryon Mode** (Kurama Jinchuriki at Kage rank, 100% sync, cloak active) burns enemies'
  life with every hit; **Six Paths Sage Mode** (ascended toad sage) adds Truth-Seeking Balls that fight on their own.

## The Inner Path (v1.2)

Naruto is a story about loneliness, bonds and the promises people live by. v1.2 builds that into play
(Shinobi Scroll › **Inner Path**):

* **Nindo (ninja way).** Swear one of eight vows (two from the Boruto era), in your own words if you like. Each grants a boon and
  builds **Resolve** when you live by it. You can change it every three in-game days, but that resets Resolve.

  | Nindo | Boon | Resolve grows when you… |
  |---|---|---|
  | Never Go Back on My Word (Naruto) | +25% mission XP and Ryo | complete missions (abandoning costs Resolve) |
  | Protect Those Precious to Me (Haku) | +25% chakra regen with an ally near | defeat enemies with allies near |
  | The Will of Fire (Hiruzen) | Strength + Resistance near defeat | defeat hostile creatures and great foes |
  | Forge My Own Path (Neji) | double casting XP, Training Post until Sannin | practise and learn jutsu |
  | Break the Cycle of Hatred (Jiraiya) | seal beasts below 40%, faster meditation | meditate, seal tailed beasts |
  | Surpass My Limits (Rock Lee) | Eight Gates −25% health cost, taijutsu −15% chakra | train, use taijutsu |
  | Protect the Village from the Shadows (Boruto) | Speed + Strength when an ally near you is hurt | defeat hostile creatures at night, aid allies |
  | I Will Become Hokage (Sarada) | +10% XP, +1 extra JP per rank-up | rank up, complete missions, keep your journal |

* **Unbreakable Will.** At 100 Resolve, the next blow that drops you below 20% health lifts you back to 60%
  ("I won't give up!") and costs 50 Resolve.
* **Bonds.** Defeating enemies beside other players or your companions forges bonds:
  Acquaintance › Comrade › Trusted Comrade › Precious Person. A Comrade nearby speeds chakra; a Precious
  Person beside you grants Resistance. Fallen companions are remembered.
* **Shinobi Journal** (Book + Chakra Crystal, or 3 Ryo). This is a private daily page, never shown to other
  players: how your chakra feels, what you train today and one small intention. Each focus is one kind of
  smarts mapped to a shinobi art (Body: taijutsu, Mind: sealing, Space: ninjutsu, Rhythm: eye arts, Words:
  missions, Others: teamwork, Self: sage arts, Nature: elements). Your focused arts cost less chakra.
  Two focuses form a *mixed thought* (Self + Nature = Sage's Insight). Every answer gets a kind reply,
  and "Drained" is met with rest, not a penalty.
* **Waterfall of Truth.** At Genin rank or above, with a Nindo sworn, sneak and stay still beside a tall
  waterfall. Your **Dark Reflection** steps out. It cannot be harmed, and every strike makes it stronger
  and angrier. Stay calm for 20 seconds while it whispers, and you gain **Inner Peace**: +3 JP, faster
  chakra and doubled tailed-beast sync.

## Boruto: Code & the Kara (v1.3)

* **Isshiki Otsutsuki.** Below 30% health, Jigen's vessel cracks and Isshiki takes over. He heals, hits
  harder, fires Sukunahikona stakes that swell on impact, and widens his Daikokuten strikes. He drops a
  **Kara Inner Mark**.
* **Code** (use a Kara Inner Mark; craft one from a Kara Ring, Chakra Crystals and Obsidian). He carves claw
  marks around you and blinks through them, delivers White Karma strikes and summons Claw Grime. At half
  health he tears off his limiters. He drops the **White Karma Seal**.
* **Claw Grime.** Black long-clawed beasts that roam at night (normal difficulty and above) and devour the
  chakra of anyone they claw.
* **New jutsu** (101 at v1.3):
  * Wind Style: Gale Palm (Boruto's opener, Genin)
  * Lightning Style: Purple Lightning (Kakashi, Jonin; chains to two more enemies)
  * From the White Karma Seal: **Claw Marks** (carve a mark, cast again to vanish to it, slashing everything
    in between), **White Karma: Limiter Release** and **Claw Grime** summons.
* Missions: B-rank Claw Grime hunts and an S-rank bounty on Code.

## HD textures (v1.3)

Every texture is still *designed* at classic resolution, then rendered in HD by a material-aware renderer
(`tools/gen/hd.py`):

* **Skins** are 4× (256×256): the head is a **32×32×32-texel** cube. Each low-res pixel knows its material,
  so the skins get hair strands, cloth weave, brushed-steel headband plates and soft face shading.
* Eyes (Sharingan tomoe, Byakugan, Rinnegan rings), the village crest, whiskers and Akatsuki clouds are
  redrawn natively at full resolution.
* **Icons** and projectiles are 32×32 (Scale2x plus a light bevel). **Blocks** are drawn natively at 32×32.
* **Tailed beasts and summons** are 2×, with fur, scales or wood grain depending on the creature.
* **Armor layers** are 4×.

Bedrock samples entity textures by normalised UVs, so the vanilla 64×64 humanoid geometry carries the HD
skins unchanged. The validator accepts any power-of-two multiple of a geometry's texture size.

## The Great Catalogue (v2.0)

Every jutsu, with its rank, cost and requirements, is listed in **[docs/JUTSU.md](docs/JUTSU.md)**.
v2.0 adds 128 signature techniques from Naruto, Shippuden, Boruto and the films:

* **Ninjutsu:** Clone Technique, Multi Shadow Clone, Shadow Clone Explosion, Rasengan Barrage, Planetary
  Rasengan, Hiding in Mist and in Camouflage, Super Beast Imitating Drawing, Dance of the Shikigami,
  Striking Shadow Snakes, Summoning: Rashomon.
* **Natures:**
  * Fire: Great Dragon Fire, Dragon Fire, Hiding Ash, Running Fire, Phoenix Flower Nail Crimson, Majestic
    Demolisher Flame.
  * Wind: Sickle Weasel, Great Sickle Weasel, Summoning: Kamatari, Vacuum Great Sphere, Pressure Damage.
  * Lightning: Lightning Cutter, Chidori Stream, Chidori Sharp Spear, Chidori Senbon, Lightning Beast
    Running, Black Panther, False Darkness, Lariat.
  * Earth: Headhunter, Earth Dragon Bullet, Earth Flow River, Swamp of the Underworld, Light Weight Rock and
    Added Weight Rock.
  * Water: Water Clone, Starch Syrup, Water Shark Bomb, Water Formation Wall, Water Fang Bullet, Great
    Waterfall, Exploding Water Colliding Wave, Thousand Feeding Sharks.
* **Kekkei tōta and advanced natures** (several natures at once): Storm Release: Laser Circus (Lightning +
  Water), Scorch Release: Extra Steaming Murder (Fire + Wind), and Dust Release (Earth + Wind + Fire).
* **Bloodlines:**
  * Wood: Four Pillar Prison, Wood Clone, True Several Thousand Hands.
  * Ice: Swallow Snow Storm, Black Dragon Blizzard.
  * The Kaguya dances: Camellia, Willow, Clematis Vine and Flower, Seedling Fern.
  * Hozuki: Great Water Arm.
* **Clans:**
  * Nara: Shadow Sewing.
  * Akimichi: Partial Expansion, Butterfly Bullet Bombing.
  * Yamanaka: Mind Body Disturbance.
  * Aburame: Insect Clone.
  * Inuzuka: Tunneling Fang, Two-Headed Wolf.
  * Hyuga: Vacuum Palm, Twin Lion Fists, Protective 64 Palms, Mountain Crusher, 128 Palms.
* **Sand** (craft a **Sand Gourd**, or have Shukaku sealed inside you): Shield of Sand, Armour of Sand, Sand
  Binding Coffin, Sand Waterfall Funeral, Sand Shower, Quicksand Waterfall Flow.
* **Puppetry and Explosion:** Chikamatsu's Ten Puppets, Performance of a Hundred Puppets, Iron Sand: Drizzle
  and Gathering Assault, C3.
* **Taijutsu:** Dynamic Entry, Leaf Rising Wind, Leaf Gale, Severe Leaf Hurricane, Drunken Fist, Lion Combo,
  Reverse Lotus.
* **Genjutsu:** Genjutsu Release, Hell Viewing, Mirror Heaven and Earth Change, Tree Binding Death, Temple
  of Nirvana.
* **Fuinjutsu:**
  * **Flying Thunder God:** cast once to place a mark, cast again to flash to it.
  * Five Elements Seal and Unseal, Evil Sealing Method, Four Violet Flames Formation.
  * **Reaper Death Seal:** a lesser foe is sealed outright, a great one loses a quarter of its life, and it
    costs you half of yours.
* **Medical:** Chakra Scalpel, Poison Mist, Creation Rebirth.
* **Sage Mode** (while active): Frog Kumite, Goemon, Toad Confrontation Chant, Super Big Ball Rasengan, Many
  Super Big Ball Rasengan, Sage Art: Rasenshuriken.
* **Six Paths:** Lava Release Rasenshuriken, Magnet Release Rasengan.
* **Jinchuriki** (Kurama): Super Tailed Beast Rasenshuriken, Kurama Mode: Chakra Arms.
* **Tenseigan:** Golden Wheel Rebirth Explosion.
* **Sharingan and Mangekyo:** Sharingan Genjutsu, Kagutsuchi, Yasaka Magatama, Totsuka Blade, Indra's Arrow,
  Kotoamatsukami, Izanagi (the next blow that would fell you never happened), Izanami.
* **Rinnegan, the Six Paths of Pain:** Asura (missiles), Preta (absorption), Human (soul removal), Naraka
  (healing), Animal (summoning), Limbo: Border Jail, and Outer Path: Samsara of Heavenly Life.

That covers the signature techniques of the major characters, not literally every named jutsu in the
franchise. That is what the extension API below is for.

### Refined chakra shapes

* **Jutsu projectiles** are drawn natively at 64×64:
  * Fire and Amaterasu are ringed with flame tongues.
  * Lightning crackles with arcs.
  * The Rasenshuriken has curved blades around a Rasengan core.
  * Earth is a faceted boulder; Ice is a cluster of shards.
  * Most have a soft glow.
* **Particles** use a new HD sprite atlas (32 px shapes).
* **Every element lands with its own shape:** flame tongues, water splashes, spinning wind blades,
  lightning arcs, rock debris, sand grains, ink blots, leaves or ice shards.
* **Charged Rasengan:** a spinning sphere of chakra forms in your palm while it charges, and Rasengan
  projectiles keep that sphere in flight.
* **Other shapes:** buffs and cloaks raise a double helix, and area techniques expand a chakra ring.
* **Less smoke:** puffs are smaller, fainter and shorter. Smoke is kept only where the story calls for it
  (summons, Substitution, smoke bombs). Teleports, steam and boss arrivals use chakra wisps and leaves.

### Rounder tailed beasts

* Bodies, heads, snouts, limbs and tail segments are now **rounded boxes**: three overlapping cubes bevel
  every edge, giving octagonal silhouettes.
* Tails have twice as many, shorter segments, so they curl instead of kinking.
* The large beasts carry **4× textures** (Kurama's is 1024×512) with fur, scale or hide detail.

## Extending: add your own jutsu (v2.0)

Every jutsu above is *data*: an archetype plus numbers, built by the **jutsu forge**
(`src/scripts/jutsu/forge.js`). There are 17 archetypes: bolt, barrage, cone, burst, beam, chain, strike,
dash, buff, aura, heal, summon, terrain, bind, field, mark and cleanse. Other add-ons use the same format:

```js
system.sendScriptEvent('shinobi:jutsu', JSON.stringify({
  id: 'my_storm_spear', name: 'Lightning Style: Storm Spear', school: 'Lightning', nature: 'lightning',
  rank: 2, cost: 35, cd: 8, kind: 'beam', element: 'lightning', length: 18, damage: 12,
}));
```

Registered jutsu are learnable from the Shinobi Scroll and saved with the world. Operators can do the same
from chat with `/scriptevent shinobi:jutsu {...}` and remove one with `/scriptevent shinobi:jutsu_remove <id>`.
Every field is validated and clamped, and external specs cannot run code. The full reference is in
**[docs/EXTENDING.md](docs/EXTENDING.md)**. A ready-to-copy example add-on is in `examples/custom-jutsu-pack/`
and ships as `dist/ShinobiReroll_ExampleJutsu-v2.0.0.mcpack`.

## Tools, weapons, food

Kunai, explosive kunai, shuriken, fuma shuriken, senbon, smoke bombs, explosive tags.
**Samehada** eats chakra, **Kubikiribocho** repairs itself, **Kusanagi** channels lightning,
**Chakra Blades** cut with wind, and the **Uchiha Gunbai** reflects jutsu. The Seven Swordsmen's blades:
**Kiba** chains lightning to nearby enemies, **Nuibari** stitches enemies in place, **Shibuki** detonates on hit,
and **Hiramekarei** stores chakra from your hits and releases it as a wave. **Scientific Ninja Tool: Kote** fires
elemental scroll cartridges without chakra. Wearables: Leaf/Rogue forehead protectors, ANBU mask, Kage hat,
Chunin flak jacket, Akatsuki cloak. Food: Ichiraku Ramen, Soldier Pills, the three Akimichi pills
(Chili Pill = Butterfly Mode, with a price), Tri-Color Dango.

NPCs: **Leaf Shinobi** (tame with ramen; they fight and throw shuriken for you), **Rogue Ninja**,
**Akatsuki Rogue** (S-rank jutsu), and **White Zetsu** (they multiply). Chakra Ore generates underground.

## Key recipes

| Item | Recipe |
|---|---|
| Chakra Focus | Chakra Crystal + String + Leather |
| Shinobi Scroll | 3 Paper + Ink Sac |
| Kunai ×4 | Iron Ingot over Stick |
| Shuriken ×8 | 4 Iron Nuggets in a diamond |
| Clan Reroll Scroll | Gold, Chakra Crystals around Paper |
| Tailed Beast Summoning Scroll | Chakra Crystal Blocks + Eyes of Ender + Paper |
| Sealing Scroll | Paper, Ink Sacs, Chakra Crystal |
| Toad Contract | Paper + Slimeball + Chakra Crystal + Ink Sac |
| Ichiraku Ramen | Bowl + Wheat + Egg + Cooked Porkchop |
| Gedo Statue Core | All nine tailed-beast chakra orbs |
| Kara Ring | Gold + Ender Pearls around a Chakra Crystal Block |
| Slug Contract / Puppet Scroll | Paper + Slimeball + Chakra Crystal + Honey / Paper + String + Planks + Chakra Crystal |
| Explosive Clay ×4 | Clay Ball + Gunpowder + Chakra Crystal |
| Kiba · Nuibari · Shibuki · Hiramekarei | Iron sword(s) + Lightning Rod / String / Explosive Tags / Prismarine Crystals + Chakra Crystal Block |
| Shinobi Journal | Book + Chakra Crystal |
| Kara Inner Mark | Kara Ring, 4 Chakra Crystals, 4 Obsidian |
| Sand Gourd | 6 Sand, Leather, Block of Chakra Crystal |

All 49 recipes appear in the recipe book once you hold an ingredient.

## Operator commands

`/scriptevent shinobi:admin help`. Examples: `xp 500`, `rank 3`, `clan uchiha`, `eye mangekyo`,
`bijuu kurama`, `karma`, `ascend`, `eternal`, `contract snake`, `unlock clay`, `ryo 50`, `mission complete`,
`learn all`, `unlock code`, `nindo shadow`, `resolve 100`, `peace`, `journal` (new page today), `trial` (start the
Waterfall trial here), `reset`, `cleanup`. World rules: `griefing on|off`
(jutsu explosions break blocks, off by default), `pvp on|off`, `npcjutsu on|off`, `xprate 2`.

---

## For developers

```
shinobi-reroll/
├─ src/scripts/        Script API gameplay (ES modules, type-checked JS)
│  ├─ main.js          entry: wires every system
│  ├─ jutsu/           229 jutsu: hand-written schools, catalog.js (forge specs), forge.js (archetypes)
│  ├─ extend.js        extension API: shinobi:jutsu script event, validation, persistence
│  ├─ casting.js       cast pipeline, hand seals, toggles, chakra regen, HUD
│  ├─ store.js         persistent shinobi profiles (dynamic properties)
│  ├─ missions.js      daily mission board, progress hooks, rewards
│  ├─ innerpath.js     Nindo, Resolve, bonds, journal, Waterfall of Truth
│  ├─ jutsu/boruto.js  Gale Palm, Purple Lightning, Code's arts
│  ├─ shop.js          Ryo shop and buy-back
│  ├─ builder.js       village blueprints
│  ├─ rogues.js        Akatsuki / Sannin / Otsutsuki mini-boss AI
│  └─ …                dojutsu, combat, bosses, npc, items, ui, terrain, admin
├─ tools/
│  ├─ gen/             generator for every BP/RP file, model, texture, particle, recipe
│  │  └─ hd.py         material-aware HD renderer (4x skins and bosses, 2x models, 32x icons)
│  ├─ build.py         generate → validate → package dist/*.mcaddon
│  ├─ validate.py      cross-reference + optional official-schema validation
│  ├─ preview.py       software renderer for the generated models
│  └─ catalogue.mjs    regenerates docs/JUTSU.md
├─ examples/           custom-jutsu-pack: a companion add-on that registers jutsu through the API
├─ tests/              Node smoke tests against a mock Script API
└─ docs/               JUTSU.md (generated), EXTENDING.md, TRANSFORMATION.md
```

```bash
npm install            # Script API typings, vanilla-data ids, TypeScript
pip install pillow     # texture generation (jsonschema is optional, for --schemas)
npm run check          # tsc + generate & validate + smoke tests
npm run build          # writes build/ and dist/*.mcaddon
# optional: validate against Mojang's official schemas
git clone --depth 1 https://github.com/Mojang/bedrock-samples
python3 tools/build.py --schemas bedrock-samples/metadata/json_schemas
```

See [docs/TRANSFORMATION.md](docs/TRANSFORMATION.md) for how each Java mod-loader technique
(Mixins, capabilities, GeckoLib, keybinds, packets…) maps onto Bedrock, and for what the validation
layers do and don't prove.

**Testing status:** the add-on is type-checked against the official API typings, smoke-tested
(27 scenarios; all 229 jutsu, every item, menu, mission, shop, blueprint, AI loop, the Inner Path, the Boruto bosses and the extension API, with the shipped example add-on, run without errors against a mock API, and HD texture sizes are checked),
cross-reference validated, and checked against Mojang's JSON schemas. It has **not** been play-tested in a live
Minecraft client from the build environment, so please report anything that behaves differently in game.

## Changelog

**2.0.0: The Great Catalogue**
* 128 new canon techniques (229 in total, 41 schools), including multi-nature releases (Storm, Scorch, Dust),
  Sand (new Sand Gourd), Genjutsu, Fuinjutsu (Flying Thunder God, Reaper Death Seal), the Six Paths of Pain,
  Mangekyo techniques (Indra's Arrow, Kotoamatsukami, Izanagi, Izanami) and Sage Art techniques.
* The jutsu forge: a data-driven engine with 17 archetypes. The **extension API** (`shinobi:jutsu`) lets other
  add-ons and operators add jutsu safely; an example companion add-on ships alongside.
* Refined chakra shapes: an HD particle atlas, element-specific impacts, native 64×64 projectile sprites,
  a Rasengan sphere in your palm, helix auras and chakra rings. Much less smoke.
* Rounder tailed beasts (beveled boxes, smoother tails) and 4× textures for the large beasts.
* New temporary blocks: Chakra Sand and Chakra Barrier.

**1.3.0: Boruto & HD**
* HD textures: 4× skins (32×32×32-texel heads) and armor, 2× creature textures, 32×32 icons and blocks, rendered
  by a new material-aware HD renderer with natively redrawn eyes, crests, clouds and whiskers.
* Code of the Kara Inner (boss), Claw Grime (mob and summon), and Jigen's phase two as Isshiki Otsutsuki.
* Kara Inner Mark and White Karma Seal; Claw Marks, White Karma: Limiter Release, Claw Grime summons,
  Gale Palm and Purple Lightning (101 jutsu).
* Boruto-era Nindo: Protect the Village from the Shadows (Boruto) and I Will Become Hokage (Sarada).
* Claw Grime hunts and a Code bounty on the mission board; a Boruto page in the Codex.

**1.2.0: The Inner Path**
* Nindo: six ninja ways with boons, optional private mottos and a three-day oath lock.
* Resolve meter and the Unbreakable Will; a HUD tag when your will is full.
* Bonds with players and companions (four tiers, regen and Resistance auras, remembered companions).
* Shinobi Journal: a private daily check-in (mood, focus, mixed thoughts, intention). Each focus discounts
  its jutsu schools; every one of the 33 schools belongs to exactly one focus.
* Waterfall of Truth trial and the Dark Reflection, an invulnerable entity that only fights if you strike it.
* Codex page "The Inner Path", including a short real-world note on reaching out for support.
* Profiles migrate to v3 automatically.

**1.1.0: Akatsuki & Boruto update**
* Mission board (D–S rank, daily offers, Leaf Shinobi mission desk), Ryo currency, Ninja Shop with buy-back.
* Village blueprints: Leaf Village Gate, Ichiraku Ramen Stand, Training Ground.
* Mini-bosses: Itachi, Kisame, Deidara, Orochimaru (natural night spawns), Kinshiki (with Momoshiki), Jigen (Kara Ring).
* 25 new jutsu (96 total): Eight Gates, Medical ninjutsu, Explosion Release, Puppetry, snake and slug summons,
  Rasengan Uzuhiko, Karma blade, Sukunahikona, Baryon Mode, Six Paths Sage Mode, Cursed Seal stages.
* Seven Swordsmen blades: Kiba, Nuibari, Shibuki, Hiramekarei. Eternal Mangekyo via Itachi's Eyes.
* Summoning contracts are now a list (old saves with the toad contract migrate automatically).

**1.0.0**: first release: chakra, ranks, 15 clans and rerolls, 71 jutsu, dojutsu, nine tailed beasts and the
Ten-Tails, Momoshiki and the Karma, ninja tools, NPCs, ore generation.
