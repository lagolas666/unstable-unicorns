function normalizeWikiUrl(url: string): string {
  try {
    const u = new URL(url);
    // force https
    u.protocol = 'https:';
    // strip tracking params and fragments later (after possible rewrite)
    u.hash = '';
    // collapse duplicate slashes
    let cleanPath = u.pathname.replace(/\/+/g, '/');
    // If domain is unstablegameswiki.com but path does not start with /wiki/, rewrite to /wiki/<Title>
    const isUGW = u.hostname === 'unstablegameswiki.com' || u.hostname.endsWith('.unstablegameswiki.com');
    if (isUGW) {
      const pathHasWiki = /^\/wiki\//.test(cleanPath);
      // Special-case: MediaWiki index.php?title=Page_Name
      const looksLikeIndex = /^\/index\.php$/i.test(cleanPath);
      const params = new URLSearchParams(u.search);
      const qpTitle = params.get('title');
      if (looksLikeIndex && qpTitle) {
        cleanPath = '/wiki/' + encodeURIComponent(qpTitle);
      } else if (!pathHasWiki) {
        const trimmed = cleanPath.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes
        // if path empty, leave as /wiki/ (will rely on name-based candidates elsewhere)
        if (trimmed) {
          cleanPath = '/wiki/' + encodeURIComponent(trimmed);
        } else {
          cleanPath = '/wiki/';
        }
      }
    }
    u.pathname = cleanPath;
    // finally clear search params
    u.search = '';
    return u.toString();
  } catch {
    return url.trim();
  }
}

function buildWikiCandidatesFromName(name: string): string[] {
  const base = 'https://unstablegameswiki.com/wiki/';
  const raw = name.trim();
  // slug variants
  const v1 = raw; // as-is (will be URL-encoded by fetch body consumer)
  const v2 = raw.replace(/\s+/g, '_');
  const v3 = raw.replace(/[^A-Za-z0-9()'!&:\-\s]/g, '').replace(/\s+/g, '_');
  const unique = Array.from(new Set([v1, v2, v3]));
  return unique.map(s => base + encodeURIComponent(s));
}
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import xlsx from 'xlsx';

/*
  Import cards from XLSX.
  Usage:
    ts-node-dev --transpile-only src/scripts/importFromXlsx.ts \
      --file ../../Unicorns/Ссылки на единорогов.filled.xlsx \
      --server http://localhost:3001

  Behavior:
    - Reads first sheet and looks for headers: Name, Type, Card Texts (case-insensitive, supports RU aliases)
    - Short description: substring after first ':' in Card Texts, then until first newline
    - Effects: generated heuristically from the FULL Card Texts text
    - Upsert by exact name against /api/cards
*/

type Row = Record<string, any>;

function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return def ?? '';
}

function detectTypeFromText(name: string, text: string): 'instant' | 'magic' | 'upgrade' | 'downgrade' | null {
  const s = `${name}\n${text}`.toLowerCase().replace(/ё/g, 'е');
  // Instant cues
  if (/(\bneigh\b|супер\s*ней|суперней|ней\b|перехват|intercept|redirect|shield|в качестве реакции|сыграйте эту карту в любой момент)/.test(s)) return 'instant';
  // Upgrade/Downgrade cues
  if (/(upgrade|улучшение|разместите это улучшение|положите это улучшение|повышение)/.test(s)) return 'upgrade';
  if (/(downgrade|понижение|порча|наложите порчу|разместите эту порчу)/.test(s)) return 'downgrade';
  // Magic cues
  if (/(сыграйте эту карту|разыграй(те)? эту карту|сбросьте эту карту после|discard this card after|until end of turn)/.test(s)) return 'magic';
  return null;
}

function normalizeName(s: string): string {
  return (s || '').toString().trim().toLowerCase().replace(/ё/g, 'е');
}

type Override = {
  forceType?: string;
  instantSubtype?: string;
  buildEffects?: (fullText: string) => any[];
};

const CARD_OVERRIDES: Record<string, Override> = {
  // 1) Absorb and Reflect — Instant, intercept
  'absorb and reflect': {
    forceType: 'instant',
    instantSubtype: 'intercept',
    buildEffects: (text) => [
      { trigger: 'immediate', actions: [{ kind: 'text', text }] },
    ],
  },
  // 2) A Cute Attack — Magic: destroy 3 unicorns in a player's stable and replace with 3 babies
  'a cute attack': {
    forceType: 'magic',
    buildEffects: (_text) => [
      {
        trigger: 'immediate',
        actions: [
          {
            kind: 'destroy',
            targets: {
              scope: 'target_player',
              zone: 'stable',
              filters: { card_group: 'unicorn' },
              quantity: { mode: 'exact', value: 3 },
            },
          },
          {
            kind: 'add',
            source: 'nursery',
            destination: 'stable',
            quantity: { mode: 'exact', value: 3 },
          },
        ],
      },
    ],
  },
  // 3) A Little Side Hustle — Upgrade: at start of turn may play an upgrade from hand before draw
  'a little side hustle': {
    forceType: 'upgrade',
    buildEffects: (text) => [
      {
        trigger: 'on_turn_start',
        actions: [
          { kind: 'text', text: 'At the start of your turn, before draw, you may play an Upgrade from your hand.' },
        ],
      },
      // keep original text as reference
      { trigger: 'while_in_stable', actions: [{ kind: 'text', text }] },
    ],
  },
};

const ROOT = process.cwd();
const filePath = path.resolve(ROOT, arg('file', '../Unicorns/Ссылки на единорогов.filled.xlsx'));
const serverBase = arg('server', 'http://localhost:3001');

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_\-: ]/g, '')
    .trim();
}

function looksLikeUrl(v: unknown): boolean {
  if (!v) return false;
  const s = String(v).trim();
  return /^https?:\/\//i.test(s);
}

function looksLikeWikiUrl(v: unknown): boolean {
  if (!looksLikeUrl(v)) return false;
  try {
    const u = new URL(String(v));
    return (
      u.hostname === 'unstablegameswiki.com' ||
      u.hostname.endsWith('.unstablegameswiki.com')
    );
  } catch {
    return false;
  }
}

const headerAliases: Record<string, string[]> = {
  name: ['name', 'имя', 'название', 'card name', 'карта', 'card'],
  type: ['type', 'тип', 'category', 'категория'],
  card_texts: ['card texts', 'card text', 'описание', 'текст карты', 'cardtexts', 'cardtext'],
  image: ['image', 'img', 'image url', 'картинка', 'изображение'],
  wiki: ['wiki', 'link', 'url', 'ссылка', 'вики', 'wikilink', 'wiki url'],
};

function pick(row: Row, headerMap: Record<string, string>): Row {
  const out: Row = {};
  for (const k of Object.keys(headerMap)) {
    const src = headerMap[k];
    out[k] = row[src];
  }
  return out;
}

function detectHeaders(rows: Row[]): Record<string, string> {
  if (rows.length === 0) throw new Error('Empty XLSX');
  const sample = rows[0];
  const keys = Object.keys(sample);
  const norm = keys.map((k) => ({ k, n: normalizeHeader(k) }));
  const resolve = (wanted: string[]): string | null => {
    for (const w of wanted) {
      const wn = normalizeHeader(w);
      const hit = norm.find((x) => x.n === wn);
      if (hit) return hit.k;
    }
    // fallback: partial contains
    for (const w of wanted) {
      const wn = normalizeHeader(w);
      const hit = norm.find((x) => x.n.includes(wn));
      if (hit) return hit.k;
    }
    return null;
  };
  const name = resolve(headerAliases.name);
  const type = resolve(headerAliases.type);
  const card_texts = resolve(headerAliases.card_texts);
  let image = resolve(headerAliases.image) || undefined;
  let wiki = resolve(headerAliases.wiki) || undefined;

  // Try to auto-detect URL columns if not found or obviously wrong
  // Prefer wiki URLs from unstablegameswiki.com
  if (!wiki || wiki === name) {
    // scan up to first 100 rows to find a column with wiki URLs
    const scanKeys = keys.slice();
    let best: string | null = null;
    for (const k of scanKeys) {
      let hasWiki = false;
      let hasHttp = false;
      for (let i = 0; i < Math.min(rows.length, 100); i++) {
        const v = rows[i][k];
        if (looksLikeWikiUrl(v)) { hasWiki = true; break; }
        if (looksLikeUrl(v)) { hasHttp = true; }
      }
      if (hasWiki) { best = k; break; }
      // fallback candidate: any http(s) if nothing better found yet
      if (!best && hasHttp) best = k;
    }
    if (best) wiki = best;
  }

  // If image column maps to a non-URL column (like name), try to guess image column as any http(s) image-looking
  if (!image || image === name) {
    const scanKeys = keys.slice();
    let imgKey: string | null = null;
    for (const k of scanKeys) {
      let hasImg = false;
      for (let i = 0; i < Math.min(rows.length, 100); i++) {
        const v = rows[i][k];
        if (looksLikeUrl(v) && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(v))) { hasImg = true; break; }
      }
      if (hasImg) { imgKey = k; break; }
    }
    if (imgKey) image = imgKey;
  }
  if (!name || !type || !card_texts) {
    throw new Error(`Missing required columns. Found: ${keys.join(', ')}`);
  }
  return { name, type, card_texts, ...(image ? { image } : {}), ...(wiki ? { wiki } : {}) } as any;
}

function shortDescriptionFromCardTexts(text: string): string {
  if (!text) return '';
  const t = String(text);
  const afterColon = t.includes(':') ? t.split(':').slice(1).join(':') : t;
  const firstLine = afterColon.split(/\r?\n/)[0];
  return firstLine.trim();
}

function toCardType(raw: string): { type: string; reason?: string } {
  const s = (raw || '').toString().trim().toLowerCase().replace(/ё/g, 'е');
  const exactMap: Record<string, string> = {
    // EN exact values with spaces
    'baby unicorn': 'baby_unicorn',
    'basic unicorn': 'basic_unicorn',
    'magical unicorn': 'magical_unicorn',
    'ultimate unicorn': 'ultimate_unicorn',
    'magic': 'magic',
    'instant': 'instant',
    'upgrade': 'upgrade',
    'downgrade': 'downgrade',
    // EN exact values with underscores (as в XLSX гистограмме)
    'baby_unicorn': 'baby_unicorn',
    'basic_unicorn': 'basic_unicorn',
    'magical_unicorn': 'magical_unicorn',
    'ultimate_unicorn': 'ultimate_unicorn',
    // RU
    'малыш-единорог': 'baby_unicorn',
    'малыш единорог': 'baby_unicorn',
    'малыш': 'baby_unicorn',
    'базовый единорог': 'basic_unicorn',
    'магический единорог': 'magical_unicorn',
    'единорог': 'magical_unicorn',
    'ультимативный единорог': 'ultimate_unicorn',
    'ультимативный': 'ultimate_unicorn',
    'магия': 'magic',
    'мгновенная': 'instant',
    'инстант': 'instant',
    'улучшение': 'upgrade',
    'понижение': 'downgrade',
    'порча': 'downgrade',
  };
  if (exactMap[s]) return { type: exactMap[s] };
  // Prefer mapping any 'unicorn' mention to magical_unicorn before checking 'magic'
  if (s.includes('unicorn') || s.includes('единорог')) return { type: 'magical_unicorn', reason: 'contains unicorn' };
  // fuzzy contains with word boundaries where applicable to avoid matching 'magical' as 'magic'
  if (s.includes('baby')) return { type: 'baby_unicorn', reason: 'contains baby' };
  if (s.includes('basic')) return { type: 'basic_unicorn', reason: 'contains basic' };
  if (s.includes('ultimate')) return { type: 'ultimate_unicorn', reason: 'contains ultimate' };
  if (/(^|\b)magic(\b|$)/.test(s)) return { type: 'magic', reason: 'word magic' };
  if (s.includes('instant') || s.includes('мгнов')) return { type: 'instant', reason: 'contains instant' };
  if (s.includes('upgrade') || s.includes('улучш')) return { type: 'upgrade', reason: 'contains upgrade' };
  if (s.includes('downgrade') || s.includes('понижен') || s.includes('порч')) return { type: 'downgrade', reason: 'contains downgrade' };
  return { type: 'magical_unicorn', reason: 'fallback' };
}

function generateEffectsFromText(fullText: string, cardType: string): any[] {
  const text = (fullText || '').toString().toLowerCase();
  const effects: any[] = [];

  const add = (trigger: any, actions: any[], conditions: any[] = []) => {
    effects.push({ trigger, conditions, actions });
  };

  // Heuristic patterns (extendable)
  const whileStable = /пока (эта|эта\s+карта|этот|этот\s+единорог)/.test(text) || /while (this|this card)/.test(text);
  const onPlay = /когда (вы|ты) сыгра(ешь|ете)/.test(text) || /when you play/.test(text) || /разыгрываете эту карту/.test(text);
  const enters = /входит в стойло/.test(text) || /enters your stable/.test(text);
  const destroy = /уничтожа(ется|ют)/.test(text) || /is destroyed/.test(text);
  const steal = /украд(и|ите)|steal/.test(text);
  const discard = /сброс(ь|ьте)|discard/.test(text);
  const draw = /возьм(и|ите)\s+(\d+)|draw\s+(\d+)/.exec(text);
  const destroyUnicorns = /(уничтож(ь|ьте)|destroy)\s+(\d+)\s+.*(единорог|unicorn)/.exec(text);
  const replaceWithBabies = /(замени(ть|те)|replace).*(\d+).*(малыш|baby)/.exec(text);
  const searchDeck = /(поиск|найди|search).*(в колоде|deck)/.test(text);
  const returnToHand = /(верн(и|ите).*(в руку)|return.*to hand)/.test(text);
  const give = /(отдай(те)|give)\b/.test(text);
  const swap = /(обменивайся|поменяйся|swap)/.test(text);

  if (whileStable) add('while_in_stable', [{ kind: 'text', text: fullText }]);
  if (onPlay) add('on_play', [{ kind: 'text', text: fullText }]);
  if (enters) add('on_enter_stable', [{ kind: 'text', text: fullText }]);
  if (destroy) add('on_destroy', [{ kind: 'text', text: fullText }]);
  if (steal) add('immediate', [{ kind: 'transfer', from: { scope: 'opponent', zone: 'stable', quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'stable' } }]);
  if (discard) add('on_discard', [{ kind: 'move', from: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'discard' } }]);
  if (draw) {
    const n = Number(draw[1] || draw[2] || 1) || 1;
    add('immediate', [{ kind: 'add', source: 'deck', destination: 'hand', quantity: { mode: 'exact', value: n } }]);
  }
  if (destroyUnicorns) {
    const n = Number(destroyUnicorns[3]) || 1;
    add('immediate', [{ kind: 'destroy', targets: { scope: 'target_player', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: n } } }]);
  }
  if (replaceWithBabies) {
    const n = Number(replaceWithBabies[3]) || 1;
    add('immediate', [{ kind: 'add', source: 'nursery', destination: 'stable', quantity: { mode: 'exact', value: n } }]);
  }
  if (searchDeck) add('immediate', [{ kind: 'search', targets: { scope: 'self', zone: 'deck', quantity: { mode: 'exact', value: 1 } } }]);
  if (returnToHand) add('immediate', [{ kind: 'move', from: { scope: 'self', zone: 'stable', quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'hand' } }]);
  if (give) add('immediate', [{ kind: 'transfer', from: { scope: 'self', zone: 'stable', quantity: { mode: 'exact', value: 1 } }, to: { scope: 'opponent', zone: 'stable' } }]);
  if (swap) add('immediate', [{ kind: 'swap', a: { scope: 'self', zone: 'stable', quantity: { mode: 'exact', value: 1 } }, b: { scope: 'opponent', zone: 'stable', quantity: { mode: 'exact', value: 1 } } }]);

  if (effects.length === 0) {
    // default: preserve text as informational action
    add(cardType === 'instant' ? 'immediate' : 'while_in_stable', [{ kind: 'text', text: fullText }]);
  }
  return effects;
}

function detectInstantSubtype(name: string, text: string): string | undefined {
  const s = `${name}\n${text}`.toLowerCase().replace(/ё/g, 'е');
  if (/(super\s*neigh|супер\s*ней|суперней)/.test(s)) return 'super_neigh';
  if (/(\bneigh\b|ней)/.test(s)) return 'neigh';
  if (/(rewind|перемотка|отмотай)/.test(s)) return 'rewind';
  if (/(shield|щит|защита)/.test(s)) return 'shield';
  if (/(redirect|редирект|перенаправ)/.test(s)) return 'redirect';
  if (/(intercept|перехват)/.test(s)) return 'intercept';
  return undefined;
}

async function upsertCard(server: string, payload: any): Promise<'created'|'updated'|'failed'> {
  try {
    const q = await fetch(`${server}/api/cards?q=${encodeURIComponent(payload.name)}`);
    let existingId: string | null = null;
    if (q.ok) {
      const cards: any[] = await q.json();
      const exact = cards.find(c => (c?.name || '').trim().toLowerCase() === payload.name.trim().toLowerCase());
      if (exact) existingId = String(exact._id);
    }
    if (existingId) {
      const u = await fetch(`${server}/api/cards/${existingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return u.ok ? 'updated' : 'failed';
    } else {
      const c = await fetch(`${server}/api/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return c.ok ? 'created' : 'failed';
    }
  } catch (e) {
    return 'failed';
  }
}

async function main() {
  if (!fs.existsSync(filePath)) {
    console.error(`[xlsx] File not found: ${filePath}`);
    process.exit(1);
  }
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: Row[] = xlsx.utils.sheet_to_json(ws, { defval: '' });
  if (!rows.length) {
    console.error('[xlsx] No rows found');
    process.exit(1);
  }
  const headers = detectHeaders(rows);
  console.log('[xlsx] Resolved headers ->', headers);

  let created = 0, updated = 0, failed = 0, skipped = 0, unknownType = 0;
  const typeHistogram = new Map<string, number>();

  let debugPrinted = 0;
  let wikiTried = 0, wikiOk = 0, wiki404 = 0, wikiOther = 0;

  for (const raw of rows) {
    const r = pick(raw, headers);
    const name = String(r.name || '').trim();
    const typeRaw = String(r.type || '').trim();
    typeHistogram.set(typeRaw, (typeHistogram.get(typeRaw) || 0) + 1);
    const cardTexts = String(r.card_texts || '').trim();
    if (!name || !typeRaw || !cardTexts) { skipped++; continue; }

    const key = normalizeName(name);
    const ov = CARD_OVERRIDES[key];
    const mapped = toCardType(typeRaw);
    const type = ov?.forceType || mapped.type;
    if (debugPrinted < 15) {
      console.log(`[xlsx][sample] name="${name}" | typeRaw="${typeRaw}" | mapped="${mapped.type}" (${mapped.reason || 'exact'})`);
      debugPrinted++;
    }
    if (mapped.reason === 'fallback') unknownType++;
    const shortDesc = shortDescriptionFromCardTexts(cardTexts);

    // Optional: enrich via /import/wiki if wiki URL is present in XLSX
    let wikiData: any = null;
    const rawWiki = r.wiki ? String(r.wiki) : '';
    const wikiUrl = rawWiki ? normalizeWikiUrl(rawWiki) : '';
    const candidates: string[] = [];
    if (wikiUrl) {
      // If it's UGW domain, try the raw link first (may contain index.php?title=... which is valid)
      try {
        const ur = new URL(rawWiki);
        const isUGWraw = ur.hostname === 'unstablegameswiki.com' || ur.hostname.endsWith('.unstablegameswiki.com');
        if (isUGWraw) {
          if (!candidates.includes(rawWiki)) candidates.push(rawWiki);
          // If title param exists and starts with 'UU_-_', also try without the prefix
          const params = new URLSearchParams(ur.search);
          const title = params.get('title') || '';
          if (title && /^UU_\-_/.test(title)) {
            const noPrefix = title.replace(/^UU_\-_/, '');
            const alt = `${ur.origin}/index.php?title=${encodeURIComponent(noPrefix)}`;
            if (!candidates.includes(alt)) candidates.push(alt);
            // Try /wiki/<noPrefix> and variants with underscores/spaces
            const wikiNoPrefix = `${ur.origin}/wiki/${encodeURIComponent(noPrefix)}`;
            if (!candidates.includes(wikiNoPrefix)) candidates.push(wikiNoPrefix);
            const noPrefixSpaces = noPrefix.replace(/_/g, ' ');
            const wikiNoPrefixSpaces = `${ur.origin}/wiki/${encodeURIComponent(noPrefixSpaces)}`;
            if (!candidates.includes(wikiNoPrefixSpaces)) candidates.push(wikiNoPrefixSpaces);
          }
        }
      } catch {}
      candidates.push(wikiUrl);
      // If normalized form differs when enforcing /wiki/, add it too
      try {
        const u = new URL(wikiUrl);
        const isUGW = u.hostname === 'unstablegameswiki.com' || u.hostname.endsWith('.unstablegameswiki.com');
        if (isUGW && !/^\/wiki\//.test(u.pathname)) {
          const trimmed = u.pathname.replace(/^\/+|\/+$/g, '');
          const rewritten = trimmed ? `${u.origin}/wiki/${encodeURIComponent(trimmed)}` : `${u.origin}/wiki/`;
          if (!candidates.includes(rewritten)) candidates.push(rewritten);
        }
      } catch {}
    } else {
      candidates.push(...buildWikiCandidatesFromName(name));
    }

    if (debugPrinted <= 10) {
      console.log(`[xlsx][wiki] name="${name}" rawWiki="${rawWiki}" normWiki="${wikiUrl}"`);
      console.log(`[xlsx][wiki] candidates=`, candidates);
    }

    for (const url of candidates) {
      try {
        wikiTried++;
        const wr = await fetch(`${serverBase}/import/wiki`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        if (debugPrinted <= 10) {
          console.log(`[xlsx][wiki] -> POST /import/wiki url=${url} status=${wr.status}`);
        }
        if (wr.ok) {
          wikiData = await wr.json();
          wikiOk++;
          break;
        } else {
          if (wr.status === 404) wiki404++; else wikiOther++;
        }
      } catch {
        wikiOther++;
      }
    }

    // Build effects: prefer wiki effects when available; else use overrides/generator
    const generatedEffects = ov?.buildEffects ? ov.buildEffects(cardTexts) : generateEffectsFromText(cardTexts, type);
    const effects = Array.isArray(wikiData?.effects) && wikiData.effects.length > 0 ? wikiData.effects : generatedEffects;

    // Merge type: prefer XLSX-mapped (or override). If mapping was a generic fallback, use wiki type when present
    let finalType = type;
    if (mapped.reason === 'fallback' && wikiData?.type) {
      finalType = wikiData.type;
    }

    const payload: any = {
      name,
      type: finalType,
      description: shortDesc || wikiData?.description || '',
      effects,
    };
    if (finalType === 'instant') {
      const sub = detectInstantSubtype(name, cardTexts);
      payload.instant_subtype = ov?.instantSubtype || sub;
    }
    if (r.image) payload.image = String(r.image).trim();

    const res = await upsertCard(serverBase, payload);
    if (res === 'created') created++; else if (res === 'updated') updated++; else failed++;
  }

  console.log(`[xlsx] Done. created=${created}, updated=${updated}, skipped=${skipped}, failed=${failed}, unknownType=${unknownType}`);
  if (wikiTried > 0) {
    console.log(`[xlsx] Wiki summary: tried=${wikiTried}, ok=${wikiOk}, not_found=${wiki404}, other_errors=${wikiOther}`);
  }
  // Print histogram of raw Type values to help adjust mapping
  console.log('[xlsx] Type histogram:');
  for (const [k, v] of typeHistogram.entries()) {
    console.log(`  - ${k}: ${v}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
