// Static game data: ranks, natures, clans, dojutsu, tailed beasts.

export const RANKS = [
  { name: 'Academy Student', xp: 0, color: '§7' },
  { name: 'Genin', xp: 100, color: '§a' },
  { name: 'Chunin', xp: 600, color: '§2' },
  { name: 'Jonin', xp: 2000, color: '§9' },
  { name: 'Sannin', xp: 5000, color: '§5' },
  { name: 'Kage', xp: 10000, color: '§6' },
];

/** Nature slots unlocked per rank (Academy..Kage). */
export const NATURE_SLOTS = [1, 1, 2, 3, 4, 5];

/** @type {Record<string, {name:string, kanji:string, color:string, hex:string}>} */
export const NATURES = {
  fire: { name: 'Fire', kanji: 'Katon', color: '§c', hex: '#ff6a2a' },
  wind: { name: 'Wind', kanji: 'Futon', color: '§a', hex: '#9fe6c4' },
  lightning: { name: 'Lightning', kanji: 'Raiton', color: '§e', hex: '#bfe0ff' },
  earth: { name: 'Earth', kanji: 'Doton', color: '§6', hex: '#a0784a' },
  water: { name: 'Water', kanji: 'Suiton', color: '§9', hex: '#3a8cff' },
};

/** Kekkei genkai: advanced natures granted by clan (or Hashirama Cells for wood). */
export const KEKKEI = {
  wood: { name: 'Wood Release', color: '§2', hex: '#5aa04a' },
  ice: { name: 'Ice Release', color: '§b', hex: '#bfefff' },
  lava: { name: 'Lava Release', color: '§4', hex: '#ff5a1f' },
  bone: { name: 'Shikotsumyaku', color: '§f', hex: '#efe8d8' },
};

/**
 * @typedef {{
 *   name: string, rarity: string, weight: number, color: string, natures: string[],
 *   chakra: number, regen: number, perk: string, dojutsu?: string, kekkei?: string,
 *   costMult?: number, xpMult?: number, lore: string
 * }} Clan
 */

/** @type {Record<string, Clan>} */
export const CLANS = {
  none: {
    name: 'Clanless', rarity: 'Common', weight: 24, color: '§f', natures: ['fire', 'wind', 'lightning', 'earth', 'water'],
    chakra: 0, regen: 0, xpMult: 1.15, perk: '+15% XP and +1 Jutsu Point on every rank-up.',
    lore: 'No bloodline, no limits. Hard work beats genius.',
  },
  inuzuka: {
    name: 'Inuzuka', rarity: 'Uncommon', weight: 9, color: '§6', natures: ['earth', 'wind'], chakra: 10, regen: 0.2,
    perk: 'Ninken summons; Speed while sprinting.', lore: 'Beast-like ninja who fight beside their ninken.',
  },
  aburame: {
    name: 'Aburame', rarity: 'Uncommon', weight: 9, color: '§8', natures: ['earth', 'wind'], chakra: 20, regen: 0.2,
    perk: 'Insect jutsu; your hits drain enemy chakra.', lore: 'Hosts of the kikaichu that feed on chakra.',
  },
  nara: {
    name: 'Nara', rarity: 'Uncommon', weight: 9, color: '§7', natures: ['earth', 'fire'], chakra: 10, regen: 0.3,
    costMult: 0.9, perk: 'Shadow jutsu; -10% jutsu cooldowns.', lore: 'Strategists who bind foes with shadows.',
  },
  akimichi: {
    name: 'Akimichi', rarity: 'Uncommon', weight: 9, color: '§c', natures: ['earth', 'fire'], chakra: 30, regen: 0.2,
    perk: 'Expansion jutsu; food restores 50% more chakra.', lore: 'Calories become chakra, chakra becomes might.',
  },
  yamanaka: {
    name: 'Yamanaka', rarity: 'Uncommon', weight: 8, color: '§d', natures: ['wind', 'water'], chakra: 15, regen: 0.4,
    perk: 'Mind jutsu; sense hostiles in a wide radius.', lore: 'Telepaths who enter the minds of their foes.',
  },
  hyuga: {
    name: 'Hyuga', rarity: 'Rare', weight: 6, color: '§f', natures: ['fire', 'wind', 'water'], chakra: 20, regen: 0.4,
    dojutsu: 'byakugan', perk: 'Byakugan and the Gentle Fist.', lore: 'The noblest clan of the Leaf; nothing escapes their eyes.',
  },
  uchiha: {
    name: 'Uchiha', rarity: 'Rare', weight: 5, color: '§4', natures: ['fire', 'lightning'], chakra: 20, regen: 0.3,
    dojutsu: 'sharingan', perk: 'Sharingan: dodge, copy jutsu, awaken the Mangekyo.', lore: 'Bearers of the Sharingan and its curse of hatred.',
  },
  senju: {
    name: 'Senju', rarity: 'Rare', weight: 4, color: '§2', natures: ['earth', 'water'], chakra: 60, regen: 1.0,
    kekkei: 'wood', perk: 'Wood Release, great vitality.', lore: 'Descendants of Hashirama, the God of Shinobi.',
  },
  uzumaki: {
    name: 'Uzumaki', rarity: 'Rare', weight: 5, color: '§6', natures: ['wind', 'water'], chakra: 80, regen: 1.6,
    costMult: 0.85, perk: 'Huge chakra, sealing chains, -15% jutsu cost.', lore: 'Sealing masters with legendary life force.',
  },
  yuki: {
    name: 'Yuki', rarity: 'Rare', weight: 3, color: '§b', natures: ['wind', 'water'], chakra: 25, regen: 0.4,
    kekkei: 'ice', perk: 'Ice Release.', lore: 'Snow-born wielders of crystal ice.',
  },
  terumi: {
    name: 'Terumi', rarity: 'Rare', weight: 3, color: '§4', natures: ['earth', 'fire', 'water'], chakra: 30, regen: 0.4,
    kekkei: 'lava', perk: 'Lava and Boil Release.', lore: 'The Mizukage\'s line of molten chakra.',
  },
  hozuki: {
    name: 'Hozuki', rarity: 'Rare', weight: 3, color: '§3', natures: ['water'], chakra: 25, regen: 0.5,
    perk: 'Hydrification makes your body liquid.', lore: 'Swordsmen of the Mist who turn to water.',
  },
  kaguya: {
    name: 'Kaguya', rarity: 'Rare', weight: 2, color: '§f', natures: ['earth'], chakra: 30, regen: 0.6,
    kekkei: 'bone', perk: 'Shikotsumyaku bone manipulation.', lore: 'Warriors whose bones are their weapons.',
  },
  otsutsuki: {
    name: 'Otsutsuki', rarity: 'Legendary', weight: 0.6, color: '§5', natures: ['fire', 'wind', 'lightning'],
    chakra: 150, regen: 2.0, dojutsu: 'byakugan', perk: 'Celestial chakra, absorption and space-time jutsu.',
    lore: 'Celestial beings who travel the stars for chakra fruit.',
  },
};

export const RARITY_COLOR = { Common: '§f', Uncommon: '§a', Rare: '§b', Legendary: '§5§l' };

/**
 * @typedef {{ name: string, color: string, drain: number, hex: string, stages?: string[] }} Dojutsu
 */
/** @type {Record<string, Dojutsu>} */
export const DOJUTSU = {
  byakugan: { name: 'Byakugan', color: '§f', drain: 1, hex: '#d8d0f0' },
  sharingan: { name: 'Sharingan', color: '§c', drain: 1.5, hex: '#d01020', stages: ['1 Tomoe', '2 Tomoe', '3 Tomoe'] },
  mangekyo: { name: 'Mangekyo Sharingan', color: '§4', drain: 3, hex: '#a00010' },
  rinnegan: { name: 'Rinnegan', color: '§5', drain: 2, hex: '#9a7ad8' },
  rinne_sharingan: { name: 'Rinne-Sharingan', color: '§4§l', drain: 3, hex: '#c01030' },
  tenseigan: { name: 'Tenseigan', color: '§b', drain: 2, hex: '#7fd8ff' },
  jogan: { name: 'Jogan', color: '§9', drain: 1.5, hex: '#6fa8ff' },
};

/**
 * @typedef {{ key: string, name: string, tails: number, hex: string, element: string, ability: string, title: string }} Bijuu
 */
/** @type {Bijuu[]} */
export const BIJUU = [
  { key: 'shukaku', name: 'Shukaku', tails: 1, hex: '#d8b56a', element: 'sand', ability: 'sand', title: 'One-Tail' },
  { key: 'matatabi', name: 'Matatabi', tails: 2, hex: '#3a6fe0', element: 'fire', ability: 'blue_fire', title: 'Two-Tails' },
  { key: 'isobu', name: 'Isobu', tails: 3, hex: '#6f8a7a', element: 'water', ability: 'coral', title: 'Three-Tails' },
  { key: 'son_goku', name: 'Son Goku', tails: 4, hex: '#c0322a', element: 'lava', ability: 'lava', title: 'Four-Tails' },
  { key: 'kokuo', name: 'Kokuo', tails: 5, hex: '#ece6dc', element: 'boil', ability: 'charge', title: 'Five-Tails' },
  { key: 'saiken', name: 'Saiken', tails: 6, hex: '#cfe0c4', element: 'boil', ability: 'acid', title: 'Six-Tails' },
  { key: 'chomei', name: 'Chomei', tails: 7, hex: '#7fb04a', element: 'wind', ability: 'scales', title: 'Seven-Tails' },
  { key: 'gyuki', name: 'Gyuki', tails: 8, hex: '#6a5a7e', element: 'ink', ability: 'ink', title: 'Eight-Tails' },
  { key: 'kurama', name: 'Kurama', tails: 9, hex: '#e2701f', element: 'fire', ability: 'roar', title: 'Nine-Tails' },
];

/** @param {string} key */
export const bijuuByKey = (key) => BIJUU.find((b) => b.key === key);

export const SEALS = ['Rat', 'Ox', 'Tiger', 'Hare', 'Dragon', 'Snake', 'Horse', 'Ram', 'Monkey', 'Bird', 'Dog', 'Boar'];

// ------------------------------------------------------------------ v1.2: The Inner Path

/**
 * A shinobi's Nindo (ninja way): a vow chosen once, with a boon and the deeds that build Resolve.
 * @typedef {{ name: string, who: string, color: string, boon: string, way: string, era?: string }} Nindo
 */
/** @type {Record<string, Nindo>} */
export const NINDO = {
  word: {
    name: 'Never Go Back on My Word', who: 'Naruto Uzumaki', color: '§6',
    boon: 'Missions reward 25% more XP and Ryo.',
    way: 'Complete missions (+20 Resolve). Abandoning one costs 15.',
  },
  bonds: {
    name: 'Protect Those Precious to Me', who: 'Haku', color: '§b',
    boon: 'Chakra regenerates 25% faster while an ally fights beside you.',
    way: 'Defeat enemies with an ally nearby (+3 Resolve).',
  },
  fire: {
    name: 'The Will of Fire', who: 'Hiruzen Sarutobi', color: '§c',
    boon: 'When you are close to defeat, your will flares: Strength and Resistance (once a minute).',
    way: 'Defeat hostile creatures (+1) and great foes (+15 Resolve).',
  },
  path: {
    name: 'Forge My Own Path', who: 'Neji Hyuga', color: '§a',
    boon: 'Casting jutsu earns double XP, and the Training Post teaches you until Sannin.',
    way: 'Practise jutsu (+1 every 5 casts) and learn new ones (+5 Resolve).',
  },
  peace: {
    name: 'Break the Cycle of Hatred', who: 'Jiraiya', color: '§d',
    boon: 'Seal tailed beasts below 40% health, and meditation charges chakra faster.',
    way: 'Meditate with the Chakra Focus (+1 every 5 s) and seal tailed beasts (+30 Resolve).',
  },
  limits: {
    name: 'Surpass My Limits', who: 'Rock Lee', color: '§2',
    boon: 'The Eight Gates cost 25% less health; taijutsu costs 15% less chakra.',
    way: 'Train at the Training Post (+1) and use taijutsu (+2 Resolve).',
  },
  // v1.3: the Boruto era
  shadow: {
    name: 'Protect the Village from the Shadows', who: 'Boruto Uzumaki', color: '§9', era: 'Boruto',
    boon: 'When an ally near you is hurt, you strike back from the shadows: Speed and Strength (every 10 s).',
    way: 'Defeat hostile creatures at night (+2) and come to an ally\'s aid (+1 Resolve).',
  },
  hokage: {
    name: 'I Will Become Hokage', who: 'Sarada Uchiha', color: '§4', era: 'Boruto',
    boon: '10% more XP from everything, and every rank-up grants an extra Jutsu Point.',
    way: 'Rank up (+30), complete missions (+8) and keep your journal (+3 Resolve).',
  },
};

/** Schools that count as taijutsu for the Surpass My Limits nindo. */
export const TAIJUTSU_SCHOOLS = ['Taijutsu', 'Eight Gates'];

/**
 * Shinobi Journal focuses: one way of being clever per shinobi art (after the theory of
 * multiple intelligences). Every jutsu school belongs to exactly one focus.
 * @typedef {{ name: string, art: string, mind: string, schools: string[], perk: string }} Focus
 */
/** @type {Record<string, Focus>} */
export const FOCI = {
  body: {
    name: 'Body', art: 'Taijutsu', mind: 'body smarts', perk: '',
    schools: ['Taijutsu', 'Eight Gates', 'Hyuga', 'Akimichi', 'Inuzuka'],
  },
  logic: {
    name: 'Mind', art: 'Strategy & sealing', mind: 'logic smarts', perk: '',
    schools: ['Nara', 'Uzumaki', 'Puppetry', 'Cursed Seal'],
  },
  space: {
    name: 'Space', art: 'Ninjutsu shaping', mind: 'picture smarts', perk: '',
    schools: ['Ninjutsu', 'Explosion', 'Otsutsuki'],
  },
  rhythm: {
    name: 'Rhythm', art: 'Eyes & illusions', mind: 'music smarts', perk: '',
    schools: ['Mangekyo', 'Rinnegan', 'Rinne-Sharingan', 'Tenseigan', 'Yamanaka'],
  },
  words: {
    name: 'Words', art: 'Missions & diplomacy', mind: 'word smarts', schools: [],
    perk: 'Missions pay 15% more today.',
  },
  others: {
    name: 'Others', art: 'Teamwork, medicine & beasts', mind: 'people smarts',
    schools: ['Medical', 'Aburame', 'Jinchuriki'], perk: 'Bonds grow twice as fast today.',
  },
  self: {
    name: 'Self', art: 'Meditation & sage arts', mind: 'self smarts',
    schools: ['Senjutsu', 'Six Paths', 'Karma', 'Kara'], perk: 'Resolve grows 50% faster today.',
  },
  nature: {
    name: 'Nature', art: 'Elemental releases', mind: 'nature smarts', perk: '',
    schools: ['Fire', 'Wind', 'Lightning', 'Earth', 'Water', 'Wood', 'Ice', 'Lava', 'Bone', 'Hozuki'],
  },
};

/** Two focuses held together ("mixed thoughts"): key is both ids sorted and joined by '+'. */
export const MIXED = {
  'body+self': "Lee's Discipline",
  'nature+self': "Sage's Insight",
  'logic+others': "Shikamaru's Strategy",
  'logic+space': "Minato's Formula",
  'others+words': "Hokage's Voice",
  'rhythm+self': "Itachi's Calm",
  'body+nature': 'Springtime of Youth',
  'others+rhythm': 'Mind Link',
};

/** Journal moods, each answered kindly. */
export const MOODS = [
  { name: 'Overflowing', color: '§e', reply: 'Channel it well, and share it with your team.' },
  { name: 'Steady', color: '§a', reply: 'Steady chakra is the strongest kind.' },
  { name: 'Flickering', color: '§6', reply: 'Even a flicker can light the Will of Fire.' },
  { name: 'Drained', color: '§9', reply: 'Rest is training too. Be gentle with yourself today.' },
];

export const BOND_TIERS = [
  { min: 0, name: 'Acquaintance', color: '§7' },
  { min: 10, name: 'Comrade', color: '§a' },
  { min: 40, name: 'Trusted Comrade', color: '§b' },
  { min: 100, name: 'Precious Person', color: '§6' },
];

/** @param {number} pts */
export const bondTier = (pts) => BOND_TIERS.reduce((t, b, i) => (pts >= b.min ? i : t), 0);
