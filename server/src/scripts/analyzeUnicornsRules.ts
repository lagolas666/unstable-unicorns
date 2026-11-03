/*
  Deep analysis of Unicorns/Ссылки на единорогов.filled.xlsx.
  Heuristic scan of columns: Card Texts, Type, Specific Card Rules and Information, URL Image, Name, ссылка.

  Report includes:
    - Types distribution and empty/malformed fields
    - Image status (local vs external), missing images
    - Mechanics detection with rich keyword sets and samples (up to 5)
    - Numeric params (counts: draw/discard/destroy/search N, targets up to N)
    - Triggers (start/end turn, when played/enters/destroyed, instant negation)
    - Targeting scopes (your/opponent/any stable, nursery, discard, hand, deck)
    - Costs (sacrifice, discard, destroy to, pay)
    - Protections/Restrictions (neighproof, cannot be destroyed/targeted, limits)
    - Deck manipulation (shuffle/reorder/top/bottom/scry)
    - Reveal/Look vs Move and Swap/Transfer/Give/Return
    - Conditionals and durations (if you do, may, until end of turn, while in stable)
    - Prevention/Replacement (instead, prevent, cannot)
    - Copy/clone/steal/double effects
    - Potentially unsupported mechanics to review
  Writes a detailed report to Unicorns/unicorns-rules-report.txt
*/

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const INPUT_XLSX = path.join(PROJECT_ROOT, 'Unicorns', 'Ссылки на единорогов.filled.xlsx');
const REPORT_TXT = path.join(PROJECT_ROOT, 'Unicorns', 'unicorns-rules-report.txt');

const COLS = {
  link: 'ссылка',
  text: 'Card Texts',
  type: 'Type',
  rules: 'Specific Card Rules and Information',
  image: 'URL Image',
  name: 'Name', // optional if present in sheet
};

function readRows(file: string) {
  const wb = XLSX.read(fs.readFileSync(file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
}

function norm(s: string) {
  return String(s || '').toLowerCase();
}

type Sample = { name: string; link: string };

const KEYWORDS: Record<string, RegExp[]> = {
  // Core actions
  destroy: [/\bdestroy\b/, /\bразруш/i],
  sacrifice: [/\bsacrifice\b/, /\bпожертв/i],
  discard: [/\bdiscard\b/, /\bсброс/i],
  draw: [/\bdraw\b/, /\bвозьм/i],
  steal: [/\bsteal\b/, /\bукрад/i],
  return: [/\breturn\b/, /\bверн/i],
  revive: [/\bresurrect|revive|return from discard\b/i, /\bвоскреш|из сброса/i],
  search: [/\bsearch\b/, /\bпоиск|найд/i],
  reveal: [/\breveal\b/, /\bпоказ/i],
  look: [/\blook at\b/, /\bпосмотр/i],
  swap: [/\bswap\b|trade/i, /\bобмен|помен/i],
  copy: [/\bcopy\b/, /\bкопир/i],
  double: [/\bdouble\b/, /\bудво/i],

  give: [/\bgive\b/, /\bпередай|дай/i],
  transfer: [/\btransfer\b/, /\bперемест|передач/i],
  returnToHand: [/\breturn to hand\b/i, /\bверн[а-я ]+ в руку/i],

  // Triggers and timings
  beginTurn: [/\bbeginning of your turn\b|start of your turn/i, /\bв начале вашего хода/i],
  endTurn: [/\bend of your turn\b/i, /\bв конце вашего хода/i],
  whenPlayed: [/\bwhen (this card )?is played\b/i, /\bкогда (эта карта )?сыгран/i],
  whenEnters: [/\bwhen.*enters your stable\b/i, /\bкогда.*входит.*стойл/i],
  whenDestroyed: [/\bwhen.*destroyed\b/i, /\bкогда.*разрушен/i],
  interrupt: [/\bneigh\b|counter|cancel/i, /\bотмен|контр/i],

  // Protections / restrictions
  neighproof: [/\bcannot be neigh(?:ed)?\b|uncounterable/i, /\bнельзя отменить/i],
  cannotBeDestroyed: [/\bcannot be destroyed\b/i, /\bнельзя разрушить/i],
  cannotBeTargeted: [/\bcannot be targeted\b/i, /\bнельзя выбирать целью/i],
  limitPerPlayer: [/\blimit 1 per player\b/i, /\bне более 1 на игрока/i],
  bonusWin: [/\byou win the game\b/i, /\bвы выигрываете игру/i],
  babyNursery: [/\bbaby\b|nursery/i, /\bдетеныш|ясли/i],
  actionPoints: [/\bextra action\b|additional action/i, /\bдополнительн[а-я ]+ действие/i],

  // Targeting and zones
  hand: [/\bfrom your hand\b|discard a card from your hand/i, /\bиз руки\b/i],
  deck: [/\bfrom your deck\b|top of your deck|bottom of your deck/i, /\bиз колоды|верх.*колод|низ.*колод/i],
  discardPile: [/\bdiscard pile\b|from the discard/i, /\bсброс(а|)|из сброса/i],
  anyStable: [/\bany stable\b/i, /\bлюб(ое|ой) стойло/i],
  opponentStable: [/\bopponent'?s stable\b/i, /\bстойло противник/i],
  yourStable: [/\byour stable\b/i, /\bваш[е]? стойло/i],

  // Zones / deck
  deckManipulation: [/\btop\b|bottom\b of your deck/i, /\bверх|низ колоды/i],
  exileBanish: [/\bbanish|exile\b/i, /\bизгнан|удали/i],
  shuffle: [/\bshuffle\b/i, /\bперетасуй|перемешай/i],
  reorder: [/\breorder\b|put.*on (top|bottom)/i, /\bупорядоч|положи(ть)? (на верх|вниз)/i],
};

function analyze(rows: any[]) {
  const out: string[] = [];
  const types = new Map<string, number>();
  const mechanics = new Map<string, { count: number; samples: Sample[] }>();
  const empties: Sample[] = [];
  const missingImage: Sample[] = [];
  const externalImage: Sample[] = [];
  const missingType: Sample[] = [];

  const getName = (r: any) => String(r[COLS.name] || r['Name'] || '').trim();
  const getLink = (r: any) => String(r[COLS.link] || '').trim();

  for (const r of rows) {
    const name = getName(r) || '(unknown)';
    const link = getLink(r);
    const text = String(r[COLS.text] || '');
    const type = String(r[COLS.type] || '');
    const rules = String(r[COLS.rules] || '');
    const image = String(r[COLS.image] || '');

    if (!text && !rules) {
      empties.push({ name, link });
    }

    const tkey = type.trim() || '(empty)';
    types.set(tkey, (types.get(tkey) || 0) + 1);
    if (!type.trim()) missingType.push({ name, link });

    if (!image.trim()) missingImage.push({ name, link });
    else if (!/^\/?uploads\//i.test(image) && !/^\/?server\/uploads\//i.test(image)) externalImage.push({ name, link });

    const hay = `${text}\n${rules}`.toLowerCase();
    for (const [key, regs] of Object.entries(KEYWORDS)) {
      if (regs.some(rx => rx.test(hay))) {
        const entry = mechanics.get(key) || { count: 0, samples: [] };
        entry.count++;
        if (entry.samples.length < 5) entry.samples.push({ name, link });
        mechanics.set(key, entry);
      }
    }
  }

  // Sort mechanics by count desc
  const mechArr = Array.from(mechanics.entries()).sort((a,b) => b[1].count - a[1].count);

  out.push('=== Types distribution ===');
  for (const [t, c] of types.entries()) out.push(`- ${t}: ${c}`);

  // Field integrity
  out.push('\n=== Missing fields ===');
  out.push(`- Empty type: ${missingType.length}`);
  out.push(`- Missing image: ${missingImage.length}`);
  out.push(`- External image (not localized): ${externalImage.length}`);
  out.push(`- Empty Card Texts and Rules: ${empties.length}`);

  out.push('\n=== Detected mechanics (by keywords) ===');
  for (const [k, v] of mechArr) {
    out.push(`- ${k}: ${v.count}`);
    for (const s of v.samples) out.push(`   • ${s.name} — ${s.link}`);
  }

  // Numeric patterns
  out.push('\n=== Numeric parameters (samples) ===');
  const numPatterns: [string, RegExp][] = [
    ['draw_N', /\bdraw (\d+)/i],
    ['discard_N', /\bdiscard (\d+)/i],
    ['destroy_up_to_N', /destroy (up to )?(\d+)/i],
    ['search_N', /search .* (\d+) card/i],
    ['choose_up_to_N_targets', /choose (up to )?(\d+) (targets?|cards?)/i],
    ['gain_N', /\+(\d+) (?:power|icons?|points?)/i],
  ];
  for (const [key, rx] of numPatterns) {
    let count = 0; const samples: Sample[] = [];
    for (const r of rows) {
      const name = getName(r) || '(unknown)'; const link = getLink(r);
      const hay = `${r[COLS.text] || ''}\n${r[COLS.rules] || ''}`;
      if (rx.test(hay)) { count++; if (samples.length < 5) samples.push({ name, link }); }
    }
    out.push(`- ${key}: ${count}`);
    for (const s of samples) out.push(`   • ${s.name} — ${s.link}`);
  }

  // Emphasize empties details
  if (empties.length) {
    out.push('\n=== Rows with empty Card Texts and Rules ===');
    for (const r of empties) out.push(`- ${r.name} — ${r.link}`);
  }

  // Heuristic: highlight likely not implemented yet (needs human mapping to engine capabilities)
  const likelyHard = [
    'revive','search','swap','copy','double','cannotBeTargeted','limitPerPlayer','bonusWin',
    'deckManipulation','exileBanish','whenDestroyed','whenEnters','actionPoints','interrupt',
    'give','transfer','returnToHand','shuffle','reorder'
  ];
  out.push('\n=== Potentially unsupported mechanics to review ===');
  for (const k of likelyHard) {
    const v = mechanics.get(k);
    if (v) out.push(`- ${k}: ${v.count} (check engine support)`);
  }

  const report = out.join('\n');
  console.log(report);
  try {
    fs.writeFileSync(REPORT_TXT, report, 'utf8');
    console.log(`\nReport written to: ${REPORT_TXT}`);
  } catch (e) {
    console.warn('Failed to write report file:', e);
  }
}

function main() {
  if (!fs.existsSync(INPUT_XLSX)) {
    console.error(`Filled file not found: ${INPUT_XLSX}`);
    process.exit(1);
  }
  const rows = readRows(INPUT_XLSX);
  analyze(rows);
}

main();
