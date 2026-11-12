// Analyze how routes/game.ts handles ServiceError responses
const fs = require('fs');
const c = fs.readFileSync('D:\\CascadeProjects\\unstable-unicorns-online-new\\server\\src\\routes\\game.ts', 'utf8');
const lines = c.split('\n');
// Find all occurrences where result.code or result.ok is accessed
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  // Look for patterns: .ok, .code, .message after result.
  if (l.includes('result.')) {
    if (l.includes('.ok') || l.includes('.code') || l.includes('.message') || l.includes('.http')) {
      console.log((i+1) + ': ' + l.trim());
    }
  }
  // Look for patterns: res.status(...).json({ or send
  if (l.includes('res.status') && (l.includes('.json') || l.includes('.send'))) {
    console.log((i+1) + ' [res]: ' + l.trim());
  }
}