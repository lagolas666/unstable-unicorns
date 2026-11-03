/*
  Fills unicorn metadata in the spreadsheet Unicorns/Ссылки на единорогов.xlsx
  Input column: B named "ссылка"
  Output columns (create/update):
    - Card Texts
    - Type
    - Specific Card Rules and Information
    - URL Image
  Writes a new file Unicorns/Ссылки на единорогов.filled.xlsx (does not overwrite source)
*/

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import * as cheerio from 'cheerio';
import { guessTypeFromText, saveImageToUploads } from '../utils/wiki';

// Node >=18 has global fetch; fallback if needed
const doFetch: typeof fetch = (global as any).fetch ?? require('node-fetch');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const INPUT_XLSX = path.join(PROJECT_ROOT, 'Unicorns', 'Ссылки на единорогов.xlsx');
const OUTPUT_XLSX = path.join(PROJECT_ROOT, 'Unicorns', 'Ссылки на единорогов.filled.xlsx');
const FAILS_TXT = path.join(PROJECT_ROOT, 'Unicorns', 'unicorns-fetch-failures.txt');

const COL_LINK_HEADER = 'ссылка';
const OUT_COLS = {
  text: 'Card Texts',
  type: 'Type',
  rules: 'Specific Card Rules and Information',
  image: 'URL Image',
};

function cleanText(s: string): string {
  return (s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutizeUrl(base: string, url?: string): string | '' {
  if (!url) return '';
  try {
    const u = new URL(url, base);
    return u.href;
  } catch {
    return '';
  }
}

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function fetchHtml(url: string, maxRetries = 4): Promise<string> {
  let attempt = 0;
  let lastErr: any;
  while (attempt <= maxRetries) {
    try {
      const res = await doFetch(url, { headers: { 'User-Agent': 'uu-scraper/1.0' } as any });
      if (!res.ok) {
        const retryable = [429, 500, 502, 503, 504].includes(res.status);
        if (!retryable) throw new Error(`Fetch failed ${res.status} ${res.statusText}`);
        throw new Error(`Retryable ${res.status} ${res.statusText}`);
      }
      return await res.text();
    } catch (e: any) {
      lastErr = e;
      if (attempt === maxRetries) break;
      const delay = Math.min(2000 * Math.pow(2, attempt), 15000); // 2s,4s,8s,15s
      await sleep(delay);
      attempt++;
    }
  }
  throw lastErr ?? new Error('Unknown fetch error');
}

function extractByLabel($: cheerio.CheerioAPI, label: string): string {
  // Generic table label extractor: find th or td with label text; get sibling td
  const el = $("table").find('th, td').filter((_, e) => cleanText($(e).text()).toLowerCase() === label.toLowerCase()).first();
  if (el.length) {
    // Prefer next cell in same row
    const cell = el.closest('tr').find('td').not(el).first();
    if (cell && cell.length) return cleanText(cell.text());
  }
  return '';
}

function extractSection($: cheerio.CheerioAPI, titles: string[]): string {
  const titleSet = titles.map(t => t.trim().toLowerCase());
  // Find heading matching any title
  const heading = $('h1, h2, h3, h4').filter((_, e) => titleSet.includes(cleanText($(e).text()).toLowerCase())).first();
  if (!heading.length) return '';
  const chunks: string[] = [];
  let n = heading.next();
  while (n && n.length) {
    const tag = String(n.prop('tagName') || '').toLowerCase();
    if (['h1','h2','h3','h4'].includes(tag)) break;
    if (tag === 'p' || tag === 'ul' || tag === 'ol' || tag === 'table') {
      chunks.push(cleanText(n.text()));
    }
    n = n.next();
  }
  return cleanText(chunks.join('\n'));
}

function extractImage($: cheerio.CheerioAPI, baseUrl: string): string {
  // Try infobox image
  let img = $('.infobox img').first().attr('src') || $('.infobox img').first().attr('data-src') || '';
  if (!img) img = $('table.infobox img').first().attr('src') || '';
  if (!img) img = $('img').filter((_, e) => /\/images\//.test($(e).attr('src') || $(e).attr('data-src') || '')).first().attr('src') || '';
  return absolutizeUrl(baseUrl, img) || '';
}

function extractCardText($: cheerio.CheerioAPI): string {
  // Try by table label
  let val = extractByLabel($, 'Card Text');
  if (!val) val = extractByLabel($, 'Card Texts');
  // Try by section
  if (!val) val = extractSection($, ['Card Text', 'Card Texts', 'Card text']);
  // Fallback: first bold paragraph or quote-like block
  if (!val) {
    const p = $('p').filter((_, e) => /\w/.test($(e).text())).first();
    val = cleanText(p.text());
  }
  // Pick only primary description: preferably the one after '2nd Edition:', otherwise first item
  const primary = pickPrimaryCardText(val);
  return primary;
}

function extractType($: cheerio.CheerioAPI): string {
  let val = extractByLabel($, 'Type');
  if (!val) val = extractByLabel($, 'Card Type');
  if (!val) {
    // Sometimes the title contains the type in an infobox definition list
    const t = $('.infobox').text();
    const m = t.match(/Type\s*[:|-]\s*([A-Za-z _-]+)/i);
    if (m) val = cleanText(m[1]);
  }
  return val;
}

function normalizeWikiType(raw: string): string {
  const t = (raw || '').toLowerCase();
  // Specific unicorn subtypes first
  if (/\bbaby\b/.test(t) || /baby\s*unicorn/.test(t)) return 'baby_unicorn';
  if (/\bbasic\b/.test(t) || /basic\s*unicorn/.test(t)) return 'basic_unicorn';
  if (/magical\s*unicorn/.test(t) || /\bmagical\b/.test(t)) return 'magical_unicorn';
  if (/ultimate\s*unicorn/.test(t) || /\bultimate\b/.test(t)) return 'ultimate_unicorn';
  // Action types
  if (/\binstant\b/.test(t)) return 'instant';
  if (/\bupgrade\b/.test(t)) return 'upgrade';
  if (/\bdowngrade\b/.test(t)) return 'downgrade';
  if (/(^|\b)magic(\b|$)/.test(t)) return 'magic';
  // Generic unicorn
  if (/unicorn/.test(t)) return 'unicorn';
  return t || '';
}

function pickPrimaryCardText(text: string): string {
  const s = (text || '').replace(/\u00A0/g, ' ').replace(/\r/g, '').trim();
  if (!s) return s;
  // Prefer "2nd Edition: ..."
  const secondEdLine = s.split(/\n+/).find(line => /2nd\s*Edition\s*:/i.test(line));
  if (secondEdLine) {
    const after = secondEdLine.replace(/^.*2nd\s*Edition\s*:\s*/i, '').trim();
    if (after) return after;
  }
  // If next line after label holds the text
  const lines = s.split(/\n+/);
  for (let i = 0; i < lines.length; i++) {
    if (/2nd\s*Edition\s*:?/i.test(lines[i])) {
      const next = (lines[i + 1] || '').trim();
      if (next) return next;
    }
  }
  // Otherwise take the first bullet/semicolon-separated part
  const firstLine = lines.find(l => l && /\w/.test(l)) || s;
  const firstPart = firstLine.split(/\s*[•;]\s+|\s*\u2022\s*|\s*\|\s*|\s*\/\s*/).filter(Boolean)[0];
  return (firstPart || firstLine).trim();
}

function extractRules($: cheerio.CheerioAPI): string {
  let val = extractSection($, [
    'Specific Card Rules and Information',
    'Specific Card Rules',
    'Rules',
    'Rulings',
    'Notes',
    'Official Rulings',
  ]);
  return val;
}

async function parseWiki(url: string) {
  const html = await fetchHtml(url);
  const $root = cheerio.load(html);
  const $ = $root as unknown as cheerio.CheerioAPI;
  const pageText = $('body').text() || '';
  const result = {
    text: extractCardText($),
    type: '',
    rules: extractRules($),
    image: '',
  };
  // Тип: строго из поля Type в инфобоксе; при его отсутствии — эвристика
  const typeRaw = extractType($);
  result.type = typeRaw ? normalizeWikiType(typeRaw) : guessTypeFromText(pageText);
  // Картинка: найти URL и попытаться сохранить локально
  let imgUrl = extractImage($, url);
  if (imgUrl) {
    try {
      const local = await saveImageToUploads(imgUrl);
      if (local) result.image = local; else result.image = imgUrl;
    } catch {
      result.image = imgUrl;
    }
  }
  return result;
}

async function main() {
  if (!fs.existsSync(INPUT_XLSX)) {
    console.error(`Input file not found: ${INPUT_XLSX}`);
    process.exit(1);
  }
  const wb = XLSX.read(fs.readFileSync(INPUT_XLSX));
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Determine indexes and ensure output headers exist
  const header: string[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })[0] as any;
  const linkColIdx = header.findIndex(h => String(h).trim().toLowerCase() === COL_LINK_HEADER);
  if (linkColIdx === -1) {
    console.error(`Column '${COL_LINK_HEADER}' not found in sheet header`);
    process.exit(1);
  }

  const filled: any[] = [];
  const failures: string[] = [];
  let processed = 0;
  for (const row of rows) {
    const link = String(row[header[linkColIdx]] || '').trim();
    if (!link) { filled.push(row); continue; }
    try {
      const data = await parseWiki(link);
      row[OUT_COLS.text] = data.text;
      row[OUT_COLS.type] = data.type;
      row[OUT_COLS.rules] = data.rules;
      row[OUT_COLS.image] = data.image;
      processed++;
      if (processed % 5 === 0) console.log(`Processed ${processed}...`);
    } catch (e: any) {
      console.warn(`Failed to parse ${link}: ${e?.message || e}`);
      failures.push(`${link}\t${e?.message || e}`);
    }
    filled.push(row);
  }

  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.json_to_sheet(filled);
  XLSX.utils.book_append_sheet(outWb, outWs, sheetName || 'Sheet1');
  XLSX.writeFile(outWb, OUTPUT_XLSX);
  console.log(`Done. Wrote ${OUTPUT_XLSX}. Processed: ${processed}/${rows.length}`);
  try {
    if (failures.length) {
      fs.writeFileSync(FAILS_TXT, failures.join('\n'), 'utf8');
      console.log(`Failures written to ${FAILS_TXT} (${failures.length})`);
    } else if (fs.existsSync(FAILS_TXT)) {
      fs.unlinkSync(FAILS_TXT);
    }
  } catch (e) {
    console.warn(`Could not write failures file: ${e}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
