const fs = require('fs');
const files = ['game.ts','unicorns.ts','bot.ts','cards.ts','lobby.ts','upload.ts','sim.ts','import.ts','gallery.ts','health.ts'];
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f+': MISSING'); continue; }
  const c = fs.readFileSync(f, 'utf8');
  const codeCount = (c.match(/\bcode\b/g) || []).length;
  const errorCount = (c.match(/["']error["']/g) || []).length;
  const messageCount = (c.match(/["']message["']/g) || []).length;
  const hasResJson = (c.match(/res\.(status)?\s*\.\s*json/g) || []).length;
  console.log(f+': code='+codeCount+' error='+errorCount+' message='+messageCount+' res.json()='+hasResJson);
}