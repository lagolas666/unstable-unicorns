import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

type UnicornRow = Record<string, any> & {
  Название?: string;
  Type?: string;
  ['Card Texts']?: string;
};

type UnicornsFile = {
  updatedAt: string;
  count: number;
  items: UnicornRow[];
};

function loadUnicorns(): UnicornsFile {
  const p = path.resolve(process.cwd(), 'server', 'data', 'unicorns.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { updatedAt: new Date(0).toISOString(), count: 0, items: [] } as UnicornsFile;
  }
}

// GET /api/unicorns -> list basic info
router.get('/', (_req, res) => {
  const data = loadUnicorns();
  const items = data.items.map((r) => ({
    name: r['Название'] || '',
    type: r['Type'] || '',
    text: r['Card Texts'] || '',
  }));
  res.json({ updatedAt: data.updatedAt, count: data.count, items });
});

// GET /api/unicorns/search?name=... -> find by partial name
router.get('/search', (req, res) => {
  const q = String(req.query.name || '').toLowerCase();
  if (!q) return res.status(400).json({ message: 'name query is required' });
  const data = loadUnicorns();
  const items = data.items
    .filter(r => String(r['Название'] || '').toLowerCase().includes(q))
    .map(r => ({ name: r['Название'] || '', type: r['Type'] || '', text: r['Card Texts'] || '' }));
  res.json({ items });
});

// GET /api/unicorns/complex -> heuristic pick of complex cards (multiple triggers/keywords)
router.get('/complex', (_req, res) => {
  const data = loadUnicorns();
  const keywords = ['SACRIFICE', 'DESTROY', 'STEAL', 'return it to your hand', 'When this card enters', 'If this card is in your Stable'];
  const items = data.items
    .filter(r => {
      const texts = typeof r?.['Card Texts'] === 'string' ? r?.['Card Texts'] : undefined;
      return texts !== undefined && keywords.some(k => texts!.includes(k));
    })
    .slice(0, 50)
    .map(r => ({ name: r['Название'] || '', type: r['Type'] || '', text: r['Card Texts'] || '' }));
  res.json({ items });
});

export default router;
