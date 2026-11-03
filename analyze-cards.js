const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'unicorns.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== UNICORNS.JSON ANALYSIS ===');
console.log(`Total cards: ${data.count}`);
console.log(`Items in array: ${data.items.length}`);

// Collect all effects and triggers
const triggers = new Map();
const actionKinds = new Map();
const effectExamples = new Map(); // kind -> first card name

data.items.forEach(card => {
  if (card.effects) {
    card.effects.forEach(eff => {
      const trigger = eff.trigger || 'no_trigger';
      triggers.set(trigger, (triggers.get(trigger) || 0) + 1);
      
      if (eff.actions) {
        eff.actions.forEach(action => {
          const kind = action.kind || 'no_kind';
          if (!actionKinds.has(kind)) {
            actionKinds.set(kind, 0);
            effectExamples.set(kind, card.name);
          }
          actionKinds.set(kind, actionKinds.get(kind) + 1);
        });
      }
    });
  }
});

console.log('\n--- TRIGGERS ---');
Array.from(triggers.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n--- ACTION KINDS ---');
Array.from(actionKinds.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k}: ${v} (example: ${effectExamples.get(k)})`));

// Check for cards without effects
const noEffects = data.items.filter(c => !c.effects || c.effects.length === 0);
console.log(`\nCards without effects: ${noEffects.length}`);
if (noEffects.length > 0) {
  console.log('Examples:', noEffects.slice(0, 5).map(c => c.name).join(', '));
}

// Check for cards with targets
const withTargets = data.items.filter(c => 
  c.effects && c.effects.some(e => e.target)
);
console.log(`\nCards with target requirements: ${withTargets.length}`);

// Check for special mechanics
const hasCounterNeigh = data.items.filter(c => 
  c.effects && c.effects.some(e => 
    e.actions && e.actions.some(a => a.kind === 'counter_neigh')
  )
).length;
console.log(`Cards with counter_neigh: ${hasCounterNeigh}`);

const hasSuperNeigh = data.items.filter(c => 
  c.effects && c.effects.some(e => 
    e.actions && e.actions.some(a => a.kind === 'super_neigh')
  )
).length;
console.log(`Cards with super_neigh: ${hasSuperNeigh}`);

// Check for Baby unicorns
const babyUnicorns = data.items.filter(c => 
  c.type && c.type.includes('baby')
).length;
console.log(`Baby unicorns: ${babyUnicorns}`);

// Check for upgrades/downgrades
const upgrades = data.items.filter(c => c.type === 'upgrade').length;
const downgrades = data.items.filter(c => c.type === 'downgrade').length;
console.log(`Upgrades: ${upgrades}`);
console.log(`Downgrades: ${downgrades}`);

// Check for magical cards
const magical = data.items.filter(c => c.type === 'magical').length;
console.log(`Magical cards: ${magical}`);
