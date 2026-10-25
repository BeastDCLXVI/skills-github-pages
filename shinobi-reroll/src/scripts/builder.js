import { ENTITY, ITEM, PARTICLE, SOUND } from './ids.js';
import { ground } from './jutsu/core.js';
import { add, consumeHeld, fx, sound, tell, title, v3 } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

// Blueprints are layers from the ground up; each layer lists rows from the
// back of the building (far from the player) to the front, columns left to right.
// Building only ever fills air, so nothing the player built is destroyed.

/** @type {Record<string, string>} */
const PALETTE = {
  G: 'minecraft:green_concrete',
  T: 'minecraft:green_terracotta',
  D: 'minecraft:dark_oak_planks',
  W: 'minecraft:white_concrete',
  r: 'minecraft:red_concrete',
  P: 'minecraft:oak_planks',
  S: 'minecraft:spruce_planks',
  L: 'minecraft:oak_log',
  R: 'minecraft:red_wool',
  B: 'minecraft:barrel',
  U: 'minecraft:cauldron',
  n: 'minecraft:lantern',
  F: 'minecraft:oak_fence',
  H: 'minecraft:hay_block',
};

const PILLAR = 'GG.......GG';

/** @type {Record<string, { name: string, layers: string[][], posts?: Array<[number, number]> }>} */
export const BLUEPRINTS = {
  [ITEM.blueprintGate]: {
    name: 'Leaf Village Gate',
    layers: [
      ...Array.from({ length: 5 }, () => [PILLAR, PILLAR]),
      [PILLAR, 'GG..WWW..GG'],
      [PILLAR, 'GG..WrW..GG'],
      ['TTTTTTTTTTT', 'TTTTTTTTTTT'],
      ['DDDDDDDDDDD', 'DDDDDDDDDDD'],
    ],
  },
  [ITEM.blueprintRamen]: {
    name: 'Ichiraku Ramen Stand',
    layers: [
      ['PPPPPPP', 'PPPPPPP', 'PPPPPPP', 'PPPPPPP', 'PPPPPPP'],
      ['LUBBB.L', '.......', '.......', '.......', 'LSSSSSL'],
      ['L.....L', '.......', '.......', '.......', 'n.....n'],
      ['L.....L', '.......', '.......', '.......', 'LRRRRRL'],
      ['DDDDDDD', 'DDDDDDD', 'DDDDDDD', 'DDDDDDD', 'DDDDDDD'],
    ],
  },
  [ITEM.blueprintTraining]: {
    name: 'Training Ground',
    layers: [
      ['FFFFFFFFF', 'FH.....HF', 'F.......F', 'F.......F', 'F.......F', 'F.......F', 'F.......F', 'FL.....LF', 'FFFF.FFFF'],
      ['.........', '.H.....H.', '.........', '.........', '.........', '.........', '.........', '.L.....L.', '.........'],
    ],
    posts: [[2, 2], [4, 2], [6, 2]],
  },
};

/** Build the blueprint held by the player a few blocks in front of them. @param {Player} p @param {string} itemId */
export function build(p, itemId) {
  const bp = BLUEPRINTS[itemId];
  if (!bp) return false;
  const dir = p.getViewDirection();
  // snap to the nearest cardinal direction
  const fwd = Math.abs(dir.x) > Math.abs(dir.z) ? v3(Math.sign(dir.x), 0, 0) : v3(0, 0, Math.sign(dir.z) || 1);
  const right = v3(-fwd.z, 0, fwd.x);
  const depth = bp.layers[0].length;
  const width = bp.layers[0][0].length;
  const anchor = add(p.location, v3(fwd.x * 3, 0, fwd.z * 3));
  const base = ground(p.dimension, anchor) ?? anchor;
  const origin = v3(Math.floor(base.x), Math.floor(base.y), Math.floor(base.z));
  /** @param {number} col @param {number} row @param {number} y */
  const at = (col, row, y) => {
    const along = depth - 1 - row; // row 0 is the far side
    const side = col - Math.floor(width / 2);
    return v3(origin.x + fwd.x * along + right.x * side, origin.y + y, origin.z + fwd.z * along + right.z * side);
  };
  let placed = 0;
  bp.layers.forEach((layer, y) => {
    layer.forEach((line, row) => {
      [...line].forEach((ch, col) => {
        const id = PALETTE[ch];
        if (!id) return;
        try {
          const block = p.dimension.getBlock(at(col, row, y));
          if (block && block.isAir) {
            block.setType(id);
            placed++;
          }
        } catch {}
      });
    });
  });
  for (const [col, row] of bp.posts ?? []) {
    try {
      p.dimension.spawnEntity(ENTITY.post, add(at(col, row, 0), v3(0.5, 0, 0.5)));
    } catch {}
  }
  if (!placed) {
    tell(p, '§cNo room to build here. Find open, flat ground.');
    return false;
  }
  consumeHeld(p);
  fx(p.dimension, PARTICLE.smoke, add(origin, v3(0, 2, 0)));
  sound(p.dimension, SOUND.build, origin, 0.8, 1.5);
  title(p, ' ', `§aBuilt: ${bp.name} §7(${placed} blocks)`, 40);
  return true;
}
