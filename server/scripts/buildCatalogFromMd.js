const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const MD = path.join(ROOT, 'UNICORNS.md');
const FIX = path.join(ROOT, 'server', 'data', 'catalog.fixture.json');
const OUT = path.join(ROOT, 'server', 'data', 'catalog.v2.json');
const REPORT = path.join(ROOT, 'docs', 'ac-catalog-rebuild.md');
const lines = fs.readFileSync(MD, 'utf8').split(/\r?\n/);
const HEAD = /^\s*\d+[AB]?\.\s+\S.*\([^()]+\)/;

function braceBlock(start) {
  let depth = 0, started = false;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--;
    }
    out.push(lines[i]);
    if (started && depth === 0) return { text: out.join('\n'), end: i };
  }
  return { text: out.join('\n'), end: lines.length - 1 };
}

const sections = [];
let head = null;
for (let i = 0; i < lines.length; i++) {
  if (HEAD.test(lines[i])) {
    const en = lines[i].match(/\(([^()]+)\)/);
    head = { num: lines[i].trim().split('.')[0], nameEn: en ? en[1].trim() : null };
    continue;
  }
  if (lines[i].trim() !== 'json') continue;
  let j = i + 1;
  while (j < lines.length && lines[j].trim() === '') j++;
  if (j >= lines.length || lines[j].trim()[0] !== '{') continue;
  const blk = braceBlock(j);
  i = blk.end;
  let card = null, err = null;
  try { card = JSON.parse(blk.text); } catch (e) { err = e.message; }
  sections.push({ num: head ? head.num : null, nameEn: head ? head.nameEn : null, line: j + 1, card, err });
}

const parsed = sections.filter(s => s.card);
const errors = sections.filter(s => s.err);
const mdCards = parsed.map(s => {
  const c = Object.assign({}, s.card);
  if (c.type === 'spell') c.type = 'magic';
  if (c.type === 'unicorn' && Array.isArray(c.subtype)) {
    if (c.subtype.includes('magic')) c.type = 'magical_unicorn';
    else if (c.subtype.includes('ultimate')) c.type = 'ultimate_unicorn';
  }
  c.name_en = s.nameEn;
  c.md_num = s.num;
  return c;
});

const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const extra = fixture.filter(c => c.type === 'baby_unicorn' || c.type === 'basic_unicorn');
const out = mdCards.concat(extra);

const seen = {};
const dups = [];
for (const c of out) { if (seen[c.id]) dups.push(c.id); seen[c.id] = true; }

const byType = {};
for (const c of out) byType[c.type] = (byType[c.type] || 0) + 1;
const kinds = new Set();
for (const c of mdCards) for (const e of (c.effects || [])) for (const a of (e.actions || [])) if (a.kind) kinds.add(a.kind);
const withFx = mdCards.filter(c => Array.isArray(c.effects) && c.effects.length).length;

const summary = {
  md_sections: sections.length,
  md_parsed: parsed.length,
  md_parse_errors: errors.map(s => (s.num || '?') + ' @L' + s.line + ': ' + s.err),
  md_with_effects: withFx,
  fixture_baby_and_basic: extra.length,
  out_total: out.length,
  id_duplicates: dups,
  types: byType,
  action_kinds: [...kinds].sort()
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, ['# Пересборка каталога карт (catalog.v2.json)', '', '```json', JSON.stringify(summary, null, 2), '```', ''].join('\n'), 'utf8');
console.log(JSON.stringify(summary, null, 2));
