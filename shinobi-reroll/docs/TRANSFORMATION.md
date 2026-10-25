# Java mod loaders → Bedrock add-on: the transformation map

Naruto/Boruto mods on Java Edition are built on Forge, NeoForge, Fabric/Quilt or LiteLoader.
They lean on library mods (Fabric API, Architectury, GeckoLib, Cloth Config and similar), and on
Mixin to patch the game's bytecode. Bedrock has none of that: no JVM, no mod loader, no bytecode
patching. An add-on is a **behavior pack** (data plus JavaScript on the Script API) paired with a
**resource pack** (models, textures, animations, particles, text).

Shinobi Reroll is therefore a clean-room **re-implementation** of the *concept*. It does not port
any mod's source code. Each Java-side technique maps onto a native Bedrock mechanism:

| Java edition technique | Shinobi Reroll on Bedrock | Where |
|---|---|---|
| Mod entrypoint (`@Mod`, `ModInitializer`, `LiteMod`) | Script module declared in the BP manifest → `scripts/main.js` | `tools/build.py` (manifest), `src/scripts/main.js` |
| `DeferredRegister` / `Registry.register` for items, blocks, entities | Data-driven JSON definitions emitted by a generator | `tools/gen/items.py`, `blocks.py`, `entities.py` |
| Data generators (models, lang, loot, recipes) | Same idea, run at build time: one Python generator writes every JSON, PNG and lang file | `tools/gen/*`, `tools/build.py` |
| Player capabilities / attachments / Cardinal Components (chakra, clan, jutsu…) | Player **dynamic properties** (`sr:data` JSON profile + `sr:chakra`) with a write-behind cache | `src/scripts/store.js` |
| World `SavedData` | World dynamic properties (settings, pending temporary terrain) | `util.js` (`settings`), `terrain.js` |
| Mixins into `LivingEntity#hurt`, `Player#attack`, `Projectile#onHit`… | Script API events: `entityHurt`, `entityHitEntity`, `entityDie`, `projectileHitEntity/Block`, `itemUse`, `itemCompleteUse`, `playerInteractWithBlock` | `combat.js`, `projectiles.js`, `items.js` |
| Server tick events | `system.runInterval` loops (regen/HUD every 5 ticks, upkeep every 20, AI every 20–40) | `casting.js`, `dojutsu.js`, `bosses.js`, `npc.js` |
| Key bindings (`KeyMapping`) for hand seals / jutsu wheel | Items with touch-friendly interact buttons (Chakra Focus, Shinobi Scroll), sneak modifiers, `playerButtonInput` (sneak + jump = dojutsu) | `items.js`, `dojutsu.js` |
| Client↔server packets (`SimpleChannel`, Fabric networking) | Not needed: scripts run server-side; UI via forms, titles and the action bar | `ui.js`, `casting.js` (HUD) |
| GUI screens & HUD overlays (`RenderGuiOverlayEvent`) | `@minecraft/server-ui` Action/Modal/Message forms + action-bar chakra HUD | `ui.js`, `casting.js` |
| HD resource packs (32x/64x textures) | Designs at 16/64 px rendered 2–4× by a material-aware renderer; Bedrock samples by normalised UVs, so vanilla and generated geometry carry HD textures unchanged | `tools/gen/hd.py` |
| GeckoLib animated entities | Bedrock geometry + animation + render-controller JSON, generated from parametric box models | `tools/gen/models.py` |
| Custom renderers for projectiles | Billboarded `geometry.item_sprite` with a property-driven texture array (one entity renders 20 jutsu elements) | `entities.py` (`jutsu_orb`), render controller |
| Particle types & client particle factories | Particle-effect JSON with Molang colour variables (`variable.color`) set from scripts | `tools/gen/extras.py`, `util.fx()` |
| Biome modifiers / placed features (ore gen) | `features/` + `feature_rules/` (chakra ore in stone and deepslate) | `tools/gen/blocks.py` |
| Global loot modifiers | Entity and block loot tables | `entities.py`, `blocks.py` |
| Entity AI goals (`Goal`, `Brain`) | Behavior components (melee/ranged/tame/follow-owner) plus scripted "brains" that cast jutsu | `entities.py`, `bosses.js`, `npc.js` |
| Invulnerable "trial" entities via cancelled damage events | `minecraft:damage_sensor` with `deals_damage: "no"` firing an entity event, read through `dataDrivenEntityTrigger` | `entities.py` (`dark_reflection`), `innerpath.js` |
| Config files (ForgeConfigSpec, Cloth Config) | World settings stored in a dynamic property; HUD toggle per player | `util.js`, `ui.js` |
| Brigadier commands | `/scriptevent shinobi:admin …` (operators only) | `admin.js` |
| Armor models / layers | Attachables on vanilla armor geometry + generated 64×32 layers | `tools/gen/extras.py` |
| Mixin crash guards, loader compatibility shims | Not applicable; replaced by build-time validation and API type-checking | `tools/validate.py`, `tsconfig.json` |

## What Bedrock cannot do (and the substitute used)

| Java-only capability | Substitute |
|---|---|
| Rescaling the player model (Akimichi Expansion, Susanoo) | Status effects + particles (strength, resistance, health boost, aura rings) |
| Arbitrary key bindings | Use / sneak + use on dedicated items; sneak + jump for eyes; menu wheel |
| Custom sound files without audio assets | Curated vanilla sound events, each validated against `sound_definitions.json` |
| Cancelling damage before it applies | `entityHurt` restores health immediately (Sharingan dodge, Kamui, Karma absorption) |
| Persistent world edits from jutsu | Temporary custom blocks placed only into air and reverted on a timer (persisted across restarts) |

## Validation instead of a running client

Java ports are validated by booting the game. This repository validates in layers, each catching
what the previous one cannot:

1. **Type-check**: `tsc --checkJs` against the official `@minecraft/server` 2.0.0 / `server-ui` 2.0.0 typings.
2. **Smoke tests**: the real scripts run in Node against an in-memory mock of the Script API. They cover
   spawn, admin commands, **every one of the 101 jutsu**, all items, menus, missions, the shop, blueprints, bosses,
   mini-bosses (Code, Isshiki), NPCs, terrain, persistence, the Inner Path (Nindo, journal, bonds, Waterfall trial)
   and the HD texture sizes of the built pack.
3. **Cross-reference validation**: every icon, texture, geometry, animation, render controller, loot table,
   recipe ingredient, lang key, component name and script identifier must resolve
   (vanilla ids come from `@minecraft/vanilla-data`).
4. **Official schemas** (optional, `--schemas`): item components, blocks and particles are validated against
   Mojang's JSON schemas from `Mojang/bedrock-samples`.
5. **Model preview**: `tools/preview.py` software-renders every generated model, using Bedrock's bone
   conventions, for visual review.

The last mile, playing it in a real client, is still yours to do.
