/**
 * Хук манифеста картинок карт (client/public/cards/manifest.json).
 *
 * Почему модульный кэш, а не useState в каждом компоненте: манифест один на
 * всё приложение, а карт на столе десятки. Первый запрос кэшируется в
 * промис уровня модуля — остальные компоненты получают тот же результат без
 * повторного fetch и без мигания заглушек.
 *
 * Ошибка сети не ломает интерфейс: манифест просто остаётся null, карты
 * рисуются по полю `card.image` или текстовой заглушкой.
 */
import { useEffect, useState } from 'react';
import type { CardImageManifest } from '../utils/cardImage';

/** Путь манифеста относительно origin клиента (файл лежит в public/cards). */
const MANIFEST_URL = '/cards/manifest.json';

let manifestPromise: Promise<CardImageManifest | null> | null = null;

/** Загрузить манифест один раз на всё приложение. */
function loadManifest(): Promise<CardImageManifest | null> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (!data || typeof data !== 'object') return null;
      return data as CardImageManifest;
    } catch {
      return null;
    }
  })();
  return manifestPromise;
}

/**
 * Манифест картинок. `null` — ещё грузится или недоступен;
 * различать эти случаи вызывающему не нужно, оба состояния дают заглушку.
 */
export function useCardImages(): CardImageManifest | null {
  const [manifest, setManifest] = useState<CardImageManifest | null>(() => null);

  useEffect(() => {
    let alive = true;
    void loadManifest().then((data) => {
      if (alive) setManifest(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return manifest;
}

/** Сброс кэша — только для тестов и SSR-проверок. */
export function resetCardImageCache(): void {
  manifestPromise = null;
}
