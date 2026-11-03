import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Input Excel path (relative to server/)
const EXCEL_PATH = path.resolve(__dirname, '..', '..', 'Unicorns', 'Ссылки на единорогов.filled.xlsx');
// Output JSON path (inside server/)
const OUT_DIR = path.resolve(__dirname, '..', 'data');
const OUT_PATH = path.join(OUT_DIR, 'unicorns.json');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('[gen:unicorns] Excel file not found:', EXCEL_PATH);
    process.exit(1);
  }

  console.log('[gen:unicorns] Reading', EXCEL_PATH);
  const workbook = XLSX.readFile(EXCEL_PATH);
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    console.error('[gen:unicorns] No sheets found in workbook');
    process.exit(1);
  }

  // Prefer a sheet named 'filled' or use the first sheet
  const preferred = workbook.SheetNames.find(n => /filled/i.test(n)) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[preferred];
  if (!sheet) {
    console.error('[gen:unicorns] Target sheet not found');
    process.exit(1);
  }

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // Basic normalization: trim string fields
  const normalize = (obj: any) => {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') out[k] = v.trim();
      else out[k] = v;
    }
    return out;
  };

  const data = rows.map(normalize);

  ensureDir(OUT_DIR);
  fs.writeFileSync(OUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), count: data.length, items: data }, null, 2), 'utf8');
  console.log('[gen:unicorns] Wrote', OUT_PATH, 'items:', data.length);
}

main();
