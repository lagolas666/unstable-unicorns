/**
 * Адрес картинки карты — единая точка для всех экранов.
 *
 * Почему отдельный модуль: картинку можно получить из двух источников.
 *   1. `card.image` из словаря состояния — путь, который вернул сервер
 *      (например `/cards/neigh.png` или `/uploads/xyz.webp`). Относительный
 *      путь монтируется на origin API-сервера, абсолютный (http/data) —
 *      отдаётся как есть.
 *   2. Манифест `client/public/cards/manifest.json` — соответствие
 *      «Название карты -> путь в public». Он спасает, когда сервер отдаёт
 *      карты без поля image (так приходит каталог из игры).
 *
 * Пути манифеста начинаются с `/cards/...`, то есть живут на клиентском
 * origin (Vite раздаёт их из public), а не на API-сервере. Это разные базы,
 * поэтому они разведены явно.
 */
import { getServerOrigin } from './serverOrigin';

/** Манифест: имя карты (или ветка examples) -> путь в public/cards. */
export interface CardImageManifest {
  [name: string]: unknown;
  examples?: Record<string, unknown>;
}

/** Минимальные поля карты, нужные для поиска картинки. */
export interface CardImageSource {
  name?: string;
  image?: string;
}

/** Путь из манифеста указывает на public клиента, а не на API. */
function isClientRelative(path: string): boolean {
  return path.startsWith('/cards/');
}

/**
 * Привести путь сервера к абсолютному URL.
 * Абсолютные (http/https/data) не трогаем — они уже полные.
 */
export function resolveServerImagePath(image?: string): string | undefined {
  if (!image || typeof image !== 'string') return undefined;
  const trimmed = image.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${getServerOrigin()}${trimmed}`;
  return `${getServerOrigin()}/uploads/${trimmed}`;
}

/** Достать путь из манифеста по имени карты (с запасной веткой examples). */
function readManifestEntry(manifest: CardImageManifest | null, name?: string): string | undefined {
  if (!manifest || !name) return undefined;
  const direct = manifest[name];
  if (typeof direct === 'string' && direct) return direct;
  const fromExamples = manifest.examples?.[name];
  if (typeof fromExamples === 'string' && fromExamples) return fromExamples;
  return undefined;
}

/**
 * Итоговый адрес картинки карты: сначала поле сервера, потом манифест.
 * `undefined` означает «картинки нет» — вызывающий рисует текстовую заглушку.
 */
export function resolveCardImage(
  card: CardImageSource | undefined,
  manifest: CardImageManifest | null
): string | undefined {
  const fromServer = resolveServerImagePath(card?.image);
  if (fromServer) return fromServer;

  const fromManifest = readManifestEntry(manifest, card?.name);
  if (!fromManifest) return undefined;
  if (/^(https?:|data:|blob:)/i.test(fromManifest)) return fromManifest;
  // Путь из манифеста всегда про public клиента
  return isClientRelative(fromManifest)
    ? fromManifest
    : `/${fromManifest.replace(/^\/+/, '')}`;
}
