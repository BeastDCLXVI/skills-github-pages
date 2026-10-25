# Shinobi Reroll: Naruto · Shippuden · Boruto for Minecraft Bedrock

A full-scale **Bedrock add-on (`.mcaddon`)** that rebuilds the Java-edition Naruto/Boruto mod
experience (Forge / NeoForge / Fabric / LiteLoader, Mixin-based) natively on the Bedrock Script API.
It includes chakra, ranks, **clan rerolls**, nature releases and kekkei genkai, **96 jutsu**, dojutsu
evolution, all nine tailed beasts plus the Ten-Tails, Akatsuki and Otsutsuki bosses, the Karma, a
**mission board with a Ryo economy**, village blueprints, ninja tools, legendary swords and pills, and
**the Inner Path**: your Nindo, Resolve, bonds, a private journal and the Waterfall of Truth.

> Unofficial fan work. *Naruto* and *Boruto* belong to Masashi Kishimoto / Shueisha / Studio Pierrot.
> This project is not affiliated with them, Mojang or Microsoft. All code and every texture and model
> here is original: generated procedurally by `tools/gen`. No code or assets from existing mods are used.

**Download:** [`dist/ShinobiReroll-v1.2.0.mcaddon`](dist/ShinobiReroll-v1.2.0.mcaddon), with separate
`.mcpack` files alongside it.
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

* **Nindo (ninja way).** Swear one of six vows, in your own words if you like. Each grants a boon and
  builds **Resolve** when you live by it. You can change it every three in-game days, but that resets Resolve.

  | Nindo | Boon | Resolve grows when you… |
  |---|---|---|
  | Never Go Back on My Word (Naruto) | +25% mission XP and Ryo | complete missions (abandoning costs Resolve) |
  | Protect Those Precious to Me (Haku) | +25% chakra regen with an ally near | defeat enemies with allies near |
  | The Will of Fire (Hiruzen) | Strength + Resistance near defeat | defeat hostile creatures and great foes |
  | Forge My Own Path (Neji) | double casting XP, Training Post until Sannin | practise and learn jutsu |
  | Break the Cycle of Hatred (Jiraiya) | seal beasts below 40%, faster meditation | meditate, seal tailed beasts |
  | Surpass My Limits (Rock Lee) | Eight Gates −25% health cost, taijutsu −15% chakra | train, use taijutsu |

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

All 47 recipes appear in the recipe book once you hold an ingredient.

## Operator commands

`/scriptevent shinobi:admin help`. Examples: `xp 500`, `rank 3`, `clan uchiha`, `eye mangekyo`,
`bijuu kurama`, `karma`, `ascend`, `eternal`, `contract snake`, `unlock clay`, `ryo 50`, `mission complete`,
`learn all`, `nindo word`, `resolve 100`, `peace`, `journal` (new page today), `trial` (start the
Waterfall trial here), `reset`, `cleanup`. World rules: `griefing on|off`
(jutsu explosions break blocks, off by default), `pvp on|off`, `npcjutsu on|off`, `xprate 2`.

---

## For developers

```
shinobi-reroll/
├─ src/scripts/        Script API gameplay (ES modules, type-checked JS)
│  ├─ main.js          entry: wires every system
│  ├─ jutsu/           96 jutsu in 7 files + registry/requirements
│  ├─ casting.js       cast pipeline, hand seals, toggles, chakra regen, HUD
│  ├─ store.js         persistent shinobi profiles (dynamic properties)
│  ├─ missions.js      daily mission board, progress hooks, rewards
│  ├─ innerpath.js     Nindo, Resolve, bonds, journal, Waterfall of Truth
│  ├─ shop.js          Ryo shop and buy-back
│  ├─ builder.js       village blueprints
│  ├─ rogues.js        Akatsuki / Sannin / Otsutsuki mini-boss AI
│  └─ …                dojutsu, combat, bosses, npc, items, ui, terrain, admin
├─ tools/
│  ├─ gen/             generator for every BP/RP file, model, texture, particle, recipe
│  ├─ build.py         generate → validate → package dist/*.mcaddon
│  ├─ validate.py      cross-reference + optional official-schema validation
│  ├─ preview.py       software renderer for the generated models
│  └─ catalogue.mjs    regenerates docs/JUTSU.md
├─ tests/              Node smoke tests against a mock Script API
└─ docs/               JUTSU.md (generated), TRANSFORMATION.md
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
(21 scenarios; every jutsu, item, menu, mission, shop, blueprint, AI loop and the Inner Path runs without errors against a mock API),
cross-reference validated, and checked against Mojang's JSON schemas. It has **not** been play-tested in a live
Minecraft client from the build environment, so please report anything that behaves differently in game.

## Changelog

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
