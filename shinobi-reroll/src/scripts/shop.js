import { ITEM, SOUND } from './ids.js';
import { countItem, give, ping, takeItem, tell } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

/** What the village quartermaster sells, priced in Ryo. */
export const OFFERS = [
  { item: ITEM.kunai, count: 4, price: 2, name: 'Kunai ×4' },
  { item: ITEM.shuriken, count: 16, price: 2, name: 'Shuriken ×16' },
  { item: ITEM.explosiveTag, count: 4, price: 3, name: 'Explosive Tag ×4' },
  { item: ITEM.smokeBomb, count: 2, price: 2, name: 'Smoke Bomb ×2' },
  { item: ITEM.ramen, count: 1, price: 2, name: 'Ichiraku Ramen' },
  { item: ITEM.soldierPill, count: 2, price: 3, name: 'Soldier Pill ×2' },
  { item: ITEM.cartridge, count: 8, price: 4, name: 'Jutsu Scroll Cartridge ×8' },
  { item: ITEM.leafHeadband, count: 1, price: 8, name: 'Leaf Forehead Protector' },
  { item: ITEM.flakVest, count: 1, price: 12, name: 'Chunin Flak Jacket' },
  { item: ITEM.sealingScroll, count: 1, price: 12, name: 'Sealing Scroll' },
  { item: ITEM.blueprintTraining, count: 1, price: 10, name: 'Blueprint: Training Ground' },
  { item: ITEM.blueprintRamen, count: 1, price: 15, name: 'Blueprint: Ichiraku Ramen Stand' },
  { item: ITEM.blueprintGate, count: 1, price: 25, name: 'Blueprint: Leaf Village Gate' },
  { item: ITEM.toadContract, count: 1, price: 25, name: 'Toad Summoning Contract' },
  { item: ITEM.slugContract, count: 1, price: 30, name: 'Slug Summoning Contract' },
  { item: ITEM.puppetScroll, count: 1, price: 30, name: 'Puppet Technique Scroll' },
  { item: ITEM.reroll, count: 1, price: 40, name: 'Clan Reroll Scroll' },
];

/** What the quartermaster buys back. */
export const BUYBACK = [
  { item: ITEM.crystal, count: 2, pay: 1, name: 'Chakra Crystal ×2' },
  { item: 'shinobi:zetsu_spore', count: 3, pay: 1, name: 'White Zetsu Spore ×3' },
];

/** @param {Player} p */
export const wallet = (p) => countItem(p, ITEM.ryo);

/** @param {Player} p @param {number} index */
export function buy(p, index) {
  const o = OFFERS[index];
  if (!o) return false;
  if (wallet(p) < o.price) {
    tell(p, `§cNot enough Ryo (${wallet(p)}/${o.price}).`);
    ping(p, SOUND.deny, 0.6);
    return false;
  }
  takeItem(p, ITEM.ryo, o.price);
  give(p, o.item, o.count);
  ping(p, SOUND.coins, 1.3);
  tell(p, `§aBought ${o.name} for ${o.price} Ryo.`);
  return true;
}

/** Sell as many bundles of an item as the player has. @param {Player} p @param {number} index */
export function sell(p, index) {
  const b = BUYBACK[index];
  if (!b) return 0;
  const bundles = Math.floor(countItem(p, b.item) / b.count);
  if (!bundles) {
    tell(p, `§cYou need at least ${b.count} to sell.`);
    return 0;
  }
  takeItem(p, b.item, bundles * b.count);
  give(p, ITEM.ryo, bundles * b.pay);
  ping(p, SOUND.coins, 1.0);
  tell(p, `§aSold ${bundles * b.count} for ${bundles * b.pay} Ryo.`);
  return bundles;
}
