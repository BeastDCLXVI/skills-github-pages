# Shinobi Reroll: Naruto · Shippuden · Boruto for Minecraft Bedrock

A full-scale **Bedrock add-on (`.mcaddon`)** that rebuilds the Java-edition Naruto/Boruto mod
experience (Forge / NeoForge / Fabric / LiteLoader, Mixin-based) natively on the Bedrock Script API.
It includes chakra, ranks, **clan rerolls**, nature releases and kekkei genkai, **71 jutsu**, dojutsu
evolution, all nine tailed beasts plus the Ten-Tails, Momoshiki Otsutsuki and the Karma, ninja tools,
legendary swords and pills.

> Unofficial fan work. *Naruto* and *Boruto* belong to Masashi Kishimoto / Shueisha / Studio Pierrot.
> This project is not affiliated with them, Mojang or Microsoft. All code and every texture and model
> here is original: generated procedurally by `tools/gen`. No code or assets from existing mods are used.

**Download:** [`dist/ShinobiReroll-v1.0.0.mcaddon`](dist/ShinobiReroll-v1.0.0.mcaddon), with separate
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
| Menus: profile, loadout, learn jutsu, natures, dojutsu, tailed beast, settings, codex | Use the **Shinobi Scroll** |
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

## Tools, weapons, food

Kunai, explosive kunai, shuriken, fuma shuriken, senbon, smoke bombs, explosive tags.
**Samehada** eats chakra, **Kubikiribocho** repairs itself, **Kusanagi** channels lightning,
**Chakra Blades** cut with wind, and the **Uchiha Gunbai** reflects jutsu. **Scientific Ninja Tool: Kote** fires
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

All 38 recipes appear in the recipe book once you hold an ingredient.

## Operator commands

`/scriptevent shinobi:admin help`. Examples: `xp 500`, `rank 3`, `clan uchiha`, `eye mangekyo`,
`bijuu kurama`, `karma`, `ascend`, `learn all`, `reset`, `cleanup`. World rules: `griefing on|off`
(jutsu explosions break blocks, off by default), `pvp on|off`, `npcjutsu on|off`, `xprate 2`.

---

## For developers

```
shinobi-reroll/
├─ src/scripts/        Script API gameplay (ES modules, type-checked JS)
│  ├─ main.js          entry: wires every system
│  ├─ jutsu/           71 jutsu in 4 schools + registry/requirements
│  ├─ casting.js       cast pipeline, hand seals, toggles, chakra regen, HUD
│  ├─ store.js         persistent shinobi profiles (dynamic properties)
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
npm run check          # tsc + smoke tests + generate & validate
npm run build          # writes build/ and dist/*.mcaddon
# optional: validate against Mojang's official schemas
git clone --depth 1 https://github.com/Mojang/bedrock-samples
python3 tools/build.py --schemas bedrock-samples/metadata/json_schemas
```

See [docs/TRANSFORMATION.md](docs/TRANSFORMATION.md) for how each Java mod-loader technique
(Mixins, capabilities, GeckoLib, keybinds, packets…) maps onto Bedrock, and for what the validation
layers do and don't prove.

**Testing status:** the add-on is type-checked against the official API typings, smoke-tested
(every jutsu, item, menu and AI loop runs without errors against a mock API), cross-reference
validated, and checked against Mojang's JSON schemas. It has **not** been play-tested in a live
Minecraft client from the build environment, so please report anything that behaves differently in game.
