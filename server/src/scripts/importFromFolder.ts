/*
  Batch import images -> cards using a manifest mapping.
  Usage:
    ts-node-dev --transpile-only src/scripts/importFromFolder.ts --dir ../../Unicorns --manifest ../../Unicorns/import-manifest.json --server http://localhost:3001 --copy-to ../../client/public/cards

  Notes:
    - manifest JSON format:
      {
        "files": {
          "123.png": { "name": "Hypnorog", "wiki": "https://unstablegameswiki.com/wiki/Hypnocorn", "type": "magical_unicorn", "description": "..." },
          "nested/456.jpg": { "name": "Rainbow Lasso", "wiki": "https://unstablegameswiki.com/wiki/Rainbow_Lasso", "type": "magic" }
        }
      }
    - If wiki is present and --use-wiki is true (default), the script will query /import/wiki to auto-generate effects and description.
    - The image will be copied into --copy-to folder (default: ../../client/public/cards), and card.image will be set to "/cards/<filename>".
*/

import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const args: Record<string, string | boolean> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.substring(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    args[k] = v === 'true' ? true : v === 'false' ? false : v;
  }
}

const ROOT = process.cwd();
const dir = path.resolve(ROOT, String(args.dir || '../../Unicorns'));
const manifestPath = path.resolve(ROOT, String(args.manifest || path.join(dir, 'import-manifest.json')));
const copyTo = path.resolve(ROOT, String(args['copy-to'] || '../../client/public/cards'));
const serverBase = String(args.server || 'http://localhost:3001');
const useWiki = (typeof args['use-wiki'] === 'undefined') ? true : Boolean(args['use-wiki']);

function isImage(p: string) {
  return /\.(png|jpg|jpeg|webp)$/i.test(p);
}

function walk(dirPath: string, base = ''): string[] {
  const out: string[] = [];
  const list = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const d of list) {
    const rel = path.join(base, d.name);
    const abs = path.join(dirPath, d.name);
    if (d.isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(dir)) {
    console.error(`[import] Directory not found: ${dir}`);
    process.exit(1);
  }
  if (!fs.existsSync(copyTo)) fs.mkdirSync(copyTo, { recursive: true });

  let manifest: any = { files: {} };
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {
      console.warn(`[import] Failed to read manifest at ${manifestPath}. Using empty mapping.`);
    }
  } else {
    console.warn(`[import] Manifest not found at ${manifestPath}. Only files present in manifest will be imported.`);
  }

  const all = walk(dir);
  const images = all.filter(isImage);
  console.log(`[import] Found ${images.length} files under ${dir}`);

  let created = 0, updated = 0, skipped = 0, failed = 0, copied = 0;

  for (const rel of images) {
    const map = manifest.files?.[rel] || manifest.files?.[rel.replace(/\\/g, '/')] || null;
    if (!map || !map.name) {
      console.log(`- skip (no manifest entry or name): ${rel}`);
      skipped++;
      continue;
    }

    const srcAbs = path.join(dir, rel);
    const basename = path.basename(rel);
    const dstAbs = path.join(copyTo, basename);
    try {
      fs.copyFileSync(srcAbs, dstAbs);
      copied++;
    } catch (e) {
      console.warn(`  ! failed to copy image ${rel} -> ${dstAbs}: ${(e as any)?.message || e}`);
    }

    const imageUrl = `/cards/${basename}`;
    const name = String(map.name);

    // Try to enrich with wiki
    let payload: any = { name, image: imageUrl };
    if (useWiki && map.wiki) {
      try {
        const r = await fetch(`${serverBase}/import/wiki`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: map.wiki })
        });
        if (r.ok) {
          const j: any = await r.json();
          payload = {
            name: name || j.name,
            type: map.type || j.type,
            description: map.description || j.description,
            effects: Array.isArray(map.effects) ? map.effects : j.effects,
            play_requirements: map.play_requirements || j.play_requirements,
            image: imageUrl,
            source: map.wiki
          };
        } else {
          console.warn(`  ! wiki import failed ${r.status} for ${name}`);
        }
      } catch (e) {
        console.warn(`  ! wiki fetch error for ${name}: ${(e as any)?.message || e}`);
      }
    } else {
      // fill minimal
      payload.type = map.type || 'magical_unicorn';
      if (map.description) payload.description = map.description;
      if (Array.isArray(map.effects)) payload.effects = map.effects;
      if (map.play_requirements) payload.play_requirements = map.play_requirements;
    }

    // Lookup existing card exact name
    try {
      const q = await fetch(`${serverBase}/api/cards?q=${encodeURIComponent(name)}`);
      let existingId: string | null = null;
      if (q.ok) {
        const cards: any[] = await q.json();
        const exact = cards.find(c => (c?.name || '').trim().toLowerCase() === name.trim().toLowerCase());
        if (exact) existingId = String(exact._id);
      }

      if (existingId) {
        const u = await fetch(`${serverBase}/api/cards/${existingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (u.ok) { updated++; console.log(`✓ updated: ${name}`); }
        else { failed++; console.warn(`✗ update failed ${u.status}: ${name}`); }
      } else {
        const c = await fetch(`${serverBase}/api/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (c.ok) { created++; console.log(`+ created: ${name}`); }
        else { failed++; console.warn(`✗ create failed ${c.status}: ${name}`); }
      }
    } catch (e) {
      failed++; console.warn(`✗ error for ${name}: ${(e as any)?.message || e}`);
    }
  }

  console.log(`\n[import] Done. copied=${copied}, created=${created}, updated=${updated}, skipped=${skipped}, failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
