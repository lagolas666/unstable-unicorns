import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function guessTypeFromText(text: string): string {
  const t = (text || '').toLowerCase();
  // Specific unicorn subtypes first
  if (t.includes('baby unicorn')) return 'baby_unicorn';
  if (t.includes('basic unicorn')) return 'basic_unicorn';
  if (t.includes('magical unicorn')) return 'magical_unicorn';
  if (t.includes('ultimate unicorn')) return 'ultimate_unicorn';
  // Then action card types
  if (t.includes('instant')) return 'instant';
  if (t.includes('upgrade')) return 'upgrade';
  if (t.includes('downgrade')) return 'downgrade';
  if (/(^|\b)magic(\b|$)/.test(t)) return 'magic';
  // Generic unicorn last
  if (t.includes('unicorn')) return 'unicorn';
  // Default
  return 'magic';
}

// Сохраняет внешнее изображение в локальную папку /uploads/wiki и возвращает публичный URL
export async function saveImageToUploads(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': 'https://unstablegameswiki.com/'
    }
  });
  if (!res.ok) throw new Error(`download image failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  let ext = '.jpg';
  if (ct.includes('png')) ext = '.png';
  else if (ct.includes('webp')) ext = '.webp';
  else if (ct.includes('jpeg')) ext = '.jpg';
  else if (ct.includes('gif')) ext = '.gif';

  const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const wikiDir = path.join(uploadsRoot, 'wiki');
  if (!fs.existsSync(wikiDir)) fs.mkdirSync(wikiDir, { recursive: true });
  const fileName = `${hash}${ext}`;
  const filePath = path.join(wikiDir, fileName);
  fs.writeFileSync(filePath, buf);
  return `/uploads/wiki/${fileName}`;
}
