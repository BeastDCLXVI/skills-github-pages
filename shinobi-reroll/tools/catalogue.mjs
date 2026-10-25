// Generate docs/JUTSU.md from the live jutsu registry (run under the test mocks):
//   node --import ./tests/register.mjs tools/catalogue.mjs > docs/JUTSU.md
const { JUTSU, learnCost } = await import('../src/scripts/jutsu/index.js');
const { RANKS, NATURES, KEKKEI, CLANS, DOJUTSU } = await import('../src/scripts/data.js');

const req = (j) => {
  const out = [];
  if (j.nature) out.push(`${NATURES[j.nature].name} nature`);
  if (j.kekkei) out.push(KEKKEI[j.kekkei].name);
  if (j.clan) out.push(`${CLANS[j.clan].name} clan`);
  if (j.eyes) out.push(j.eyes.map((e) => DOJUTSU[e].name).join(' / '));
  if (j.flag) {
    out.push({ jinchuriki: 'Jinchuriki', karma: 'Karma', ascended: 'Otsutsuki ascension', clay: 'Explosive Clay',
      puppet: 'Puppet Scroll', curse: 'Cursed Seal' }[j.flag]);
  }
  if (j.contract) out.push(`${j.contract[0].toUpperCase()}${j.contract.slice(1)} contract`);
  if (j.beast) out.push(`${j.beast[0].toUpperCase()}${j.beast.slice(1)} sealed`);
  for (const r of j.requires ?? []) out.push(JUTSU.get(r).name);
  if (j.active) out.push(`while ${JUTSU.get(j.active).name} is active`);
  if (j.minSync) out.push(`${j.minSync}% sync`);
  return out.join(', ') || '—';
};

const bySchool = new Map();
for (const j of JUTSU.values()) {
  if (!bySchool.has(j.school)) bySchool.set(j.school, []);
  bySchool.get(j.school).push(j);
}
const lines = [
  '# Jutsu catalogue',
  '',
  `_Generated from \`src/scripts/jutsu/\` by \`tools/catalogue.mjs\` — ${JUTSU.size} techniques._`,
  '',
  'Cost is chakra (before clan/Sage/Otsutsuki discounts). Toggles drain their upkeep every second while active.',
  'Techniques marked **auto** are granted automatically when you meet their requirements.',
  '',
];
for (const [school, list] of bySchool) {
  list.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  lines.push(`## ${school}`, '', '| Jutsu | Rank | Chakra | Cooldown | Learn | Requires | Effect |', '|---|---|---|---|---|---|---|');
  for (const j of list) {
    const cost = j.toggle ? `${j.cost} + ${j.toggle.upkeep}/s` : `${j.cost}`;
    lines.push(`| ${j.name} | ${RANKS[j.rank].name} | ${cost} | ${j.cd}s | ${j.auto ? 'auto' : `${learnCost(j)} JP`} | ${req(j)} | ${j.desc} |`);
  }
  lines.push('');
}
console.log(lines.join('\n'));
