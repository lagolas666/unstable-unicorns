const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'server', 'data', 'unicorns.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== UNICORNS.JSON ANALYSIS ===');
console.log(`Total cards: ${data.count}`);
console.log(`Items in array: ${data.items.length}\n`);

const cardTypes = new Map();
data.items.forEach(card => {
  const type = card.Type || 'unknown';
  cardTypes.set(type, (cardTypes.get(type) || 0) + 1);
});

console.log('--- CARD TYPES ---');
Array.from(cardTypes.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

const effectPatterns = {
  'neigh': 0, 'super_neigh': 0, 'counter_neigh': 0,
  'steal': 0, 'sacrifice': 0, 'destroy': 0, 'draw': 0,
  'baby_unicorn': 0, 'upgrade': 0, 'downgrade': 0,
  'shield': 0, 'redirect': 0, 'hypnorog': 0, 'rewind': 0,
  'intercept': 0, 'search_deck': 0, 'nursery': 0,
  'beginning_turn': 0, 'end_turn': 0,
  'when_played': 0, 'when_enter_stable': 0, 'when_leaves_stable': 0
};
const examples = {};

data.items.forEach(card => {
  const text = (card['Card Texts'] || '').toLowerCase();
  const name = card['Название'];
  
  if (text.includes('neigh') && !text.includes('cannot be neigh')) {
    if (text.includes('super neigh') || text.includes('super_neigh')) {
      effectPatterns['super_neigh']++;
      if (!examples['super_neigh']) examples['super_neigh'] = name;
    } else if (text.includes('counter neigh') || text.includes('counter_neigh')) {
      effectPatterns['counter_neigh']++;
      if (!examples['counter_neigh']) examples['counter_neigh'] = name;
    } else {
      effectPatterns['neigh']++;
      if (!examples['neigh']) examples['neigh'] = name;
    }
  }
  if (text.includes('steal')) { effectPatterns['steal']++; if (!examples['steal']) examples['steal'] = name; }
  if (text.includes('sacrifice')) { effectPatterns['sacrifice']++; if (!examples['sacrifice']) examples['sacrifice'] = name; }
  if (text.includes('destroy')) { effectPatterns['destroy']++; if (!examples['destroy']) examples['destroy'] = name; }
  if (text.includes('draw')) { effectPatterns['draw']++; if (!examples['draw']) examples['draw'] = name; }
  if (text.includes('baby unicorn') || text.includes('nursery')) { effectPatterns['baby_unicorn']++; if (!examples['baby_unicorn']) examples['baby_unicorn'] = name; }
  if (text.includes('upgrade')) { effectPatterns['upgrade']++; if (!examples['upgrade']) examples['upgrade'] = name; }
  if (text.includes('downgrade')) { effectPatterns['downgrade']++; if (!examples['downgrade']) examples['downgrade'] = name; }
  if (text.includes('shield') || text.includes('protection')) { effectPatterns['shield']++; if (!examples['shield']) examples['shield'] = name; }
  if (text.includes('redirect')) { effectPatterns['redirect']++; if (!examples['redirect']) examples['redirect'] = name; }
  if (text.includes('hypnorog') || text.includes('take control')) { effectPatterns['hypnorog']++; if (!examples['hypnorog']) examples['hypnorog'] = name; }
  if (text.includes('rewind') || text.includes('previous turn')) { effectPatterns['rewind']++; if (!examples['rewind']) examples['rewind'] = name; }
  if (text.includes('intercept') || text.includes('steal from')) { effectPatterns['intercept']++; if (!examples['intercept']) examples['intercept'] = name; }
  if (text.includes('search') && text.includes('deck')) { effectPatterns['search_deck']++; if (!examples['search_deck']) examples['search_deck'] = name; }
  if (text.includes('beginning') && text.includes('turn')) { effectPatterns['beginning_turn']++; if (!examples['beginning_turn']) examples['beginning_turn'] = name; }
  if (text.includes('end') && text.includes('turn')) { effectPatterns['end_turn']++; if (!examples['end_turn']) examples['end_turn'] = name; }
  if (text.includes('when played') || text.includes('when you play')) { effectPatterns['when_played']++; if (!examples['when_played']) examples['when_played'] = name; }
  if (text.includes('enters') || text.includes('enter your stable')) { effectPatterns['when_enter_stable']++; if (!examples['when_enter_stable']) examples['when_enter_stable'] = name; }
  if (text.includes('leaves') || text.includes('leaves your stable')) { effectPatterns['when_leaves_stable']++; if (!examples['when_leaves_stable']) examples['when_leaves_stable'] = name; }
});

console.log('\n--- EFFECT PATTERNS ---');
Object.entries(effectPatterns)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k}: ${v} (example: ${examples[k] || 'none'})`));

console.log('\n--- SPECIAL MECHANICS ---');
console.log(`Cannot be neighed: ${data.items.filter(c => (c['Card Texts']||'').toLowerCase().includes('cannot be neigh')).length}`);
console.log(`Elusive: ${data.items.filter(c => (c['Card Texts']||'').toLowerCase().includes('elusive')).length}`);
console.log(`Dangerous: ${data.items.filter(c => (c['Card Texts']||'').toLowerCase().includes('dangerous')).length}`);
