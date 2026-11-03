/**
 * Сборка фикстуры каталога карт для стенда без Mongo.
 *
 * Вход:  server/data/unicorns.json — сырьё импорта (русские ключи, без id и deck_count).
 * Выход: server/data/catalog.fixture.json — массив Card в форме shared/src/types.ts.
 *
 * Зачем: без Mongo routes/game.ts подставляет сид из 4 карт, где нет ни одного baby_unicorn
 * и ни одной карты Neigh. Из-за этого TC-026 (раздача Nursery) не проверяется, а окно
 * реакции не воспроизводится на реальных данных.
 *
 * Запуск: node server/scripts/buildCatalogFixture.js
 */
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..');
const SRC = path.join(SERVER, 'data', 'unicorns.json');
const OUT = path.join(SERVER, 'data', 'catalog.fixture.json');

const VALID_TYPES = new Set([
  'baby_unicorn', 'basic_unicorn', 'magical_unicorn', 'ultimate_unicorn',
  'magic', 'instant', 'upgrade', 'downgrade', 'unicorn',
]);

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/[^a-z0-9а-я]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'card';
}

/** Подтип мгновенной карты по точному имени. Источник истины — canReactFlags.ts и правила Даниила. */
function instantSubtype(name) {
  const n = String(name || '').trim().toLowerCase();
  if (n === 'neigh' || n === 'neigh means neigh') return n === 'neigh means neigh' ? 'super_neigh' : 'neigh';
  if (n.startsWith('super neigh')) return 'super_neigh';
  if (n === 'rewind' || n.includes('rewind')) return 'rewind';
  return undefined;
}

const IGNORE_KEYS = new Set(['Название', 'Ссылка', 'Card Texts', 'Type', 'Specific Card Rules and Information', 'URL Image', 'effects']);

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const items = raw.items || [];
  if (!items.length) throw new Error('пустой unicorns.json');

  const seen = new Set();
  const cards = [];
  const stats = { total: 0, skipped: 0, withEffects: 0, byType: {}, subtypes: {} };

  for (const it of items) {
    const name = String(it['Название'] || '').trim();
    const type = String(it['Type'] || '').trim();
    if (!name || !VALID_TYPES.has(type)) { stats.skipped++; continue; }

    let id = slug(name);
    if (seen.has(id)) { let i = 2; while (seen.has(id + '_' + i)) i++; id = id + '_' + i; }
    seen.add(id);

    const card = {
      id,
      name,
      type,
      description: String(it['Card Texts'] || '').trim(),
      image: String(it['URL Image'] || '').trim() || undefined,
      active: true,
      deck_count: 1,
      effects: Array.isArray(it.effects) ? it.effects : [],
    };
    const st = instantSubtype(name);
    if (st) { card.instant_subtype = st; stats.subtypes[st] = (stats.subtypes[st] || 0) + 1; }

    stats.total++;
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    if (card.effects.length) stats.withEffects++;
    cards.push(card);
  }

  fs.writeFileSync(OUT, JSON.stringify(cards, null, 1), 'utf8');

  // Проверка результата
  const back = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const ids = new Set(back.map(c => c.id));
  const babies = back.filter(c => c.type === 'baby_unicorn').length;
  const neigh = back.filter(c => c.instant_subtype === 'neigh').length;
  const noId = back.filter(c => !c.id).length;
  const noName = back.filter(c => !c.name).length;
  const badType = back.filter(c => !VALID_TYPES.has(c.type)).length;

  console.log('OUT=' + path.relative(process.cwd(), OUT) + ' bytes=' + fs.statSync(OUT).size);
  console.log('карт=' + back.length + ' уникальных id=' + ids.size + ' пропущено=' + stats.skipped);
  console.log('byType=' + JSON.stringify(stats.byType));
  console.log('baby_unicorn=' + babies + ' neigh=' + neigh + ' instant_subtype=' + JSON.stringify(stats.subtypes));
  console.log('с effects=' + stats.withEffects + ' без effects=' + (back.length - stats.withEffects));
  console.log('битые поля: noId=' + noId + ' noName=' + noName + ' badType=' + badType);
  const txt = fs.readFileSync(OUT, 'utf8');
  console.log('U+FFFD=' + ((txt.match(/\uFFFD/g) || []).length));
  if (ids.size !== back.length || noId || noName || badType) { console.log('ПРОВАЛ ВАЛИДАЦИИ'); process.exit(1); }
  console.log('OK');
}

main();
