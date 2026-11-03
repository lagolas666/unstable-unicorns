import fs from 'fs';
import path from 'path';
import { Card } from '../../../shared/src/types';

/**
 * Каталог карт для стенда без Mongo.
 *
 * Зачем: без базы routes/game.ts подставлял тест-сид из 4 карт, в котором нет ни одного
 * baby_unicorn и ни одной карты Neigh. Из-за этого нельзя проверить раздачу Nursery (TC-026)
 * и открытие окна реакции на реальных данных.
 *
 * Источник карт (с 03.11.2026): server/data/catalog.v2.json — 329 карт, собран генератором
 * server/scripts/buildCatalogFromMd.js из UNICORNS.md (161 карта с effects, 42 kind) плюс
 * baby_unicorn 95 и basic_unicorn 73 из старой фикстуры. Отчёт: docs/ac-catalog-rebuild.md.
 * Старая фикстура catalog.fixture.json (565 карт) остаётся аварийным запасом в конце списка путей.
 *
 * Базу этот модуль не заменяет: при живом соединении с Mongo карты берутся из Mongo,
 * фикстура подключается только если Mongo пуст или недоступен.
 */

const RELATIVE_CANDIDATES = [
  // ts-node / jest: __dirname = server/src/data
  path.join(__dirname, '..', '..', 'data', 'catalog.v2.json'),
  // скомпилированный вариант и запуск из корня проекта
  path.join(process.cwd(), 'data', 'catalog.v2.json'),
  path.join(process.cwd(), 'server', 'data', 'catalog.v2.json'),
  path.join(__dirname, '..', '..', '..', 'data', 'catalog.v2.json'),
  // аварийный запас: старая фикстура 565 карт, если v2 удалят из репозитория
  path.join(__dirname, '..', '..', 'data', 'catalog.fixture.json'),
];

let cached: Card[] | null = null;
let tried = false;

/** Путь к найденной фикстуре или null. */
export function catalogFixturePath(): string | null {
  for (const p of RELATIVE_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {
      // недоступный путь — пробуем следующий
    }
  }
  return null;
}

/**
 * Карты из фикстуры каталога. Пустой массив, если файла нет или он битый:
 * вызывающая сторона в этом случае остаётся на тест-сиде, поведение прежнее.
 */
export function loadCatalogFixture(): Card[] {
  if (tried) return cached || [];
  tried = true;
  const p = catalogFixturePath();
  if (!p) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    cached = parsed.filter((c: any) => c && c.id && c.name && c.type) as Card[];
    return cached;
  } catch (_) {
    return [];
  }
}

/** Только для тестов: сбросить кеш между прогонами. */
export function resetCatalogFixtureCache(): void {
  cached = null;
  tried = false;
}
