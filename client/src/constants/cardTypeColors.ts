/**
 * Цвета типов карт.
 *
 * Это НЕ палитра интерфейса из макета (та живёт в theme/tokens.ts), а цветовая
 * кодировка категорий, заданная заказчиком. Держим в одном месте, чтобы
 * CardTemplate и Playtest не расходились: раньше hex был продублирован в двух файлах.
 */

/** Основные категории карт → hex. */
export const CARD_TYPE_COLORS: Record<string, string> = {
  baby_unicorn: '#c47fac', // Детёныш единорога
  basic_unicorn: '#6966a9', // Обычный единорог
  magical_unicorn: '#37a1e0', // Магический единорог
  ultimate_unicorn: '#2c292f', // Ультимативный единорог
  magic: '#91bc5a', // Магия
  instant: '#d62e3b', // Мгновенная
  upgrade: '#e47b39', // Улучшение
  downgrade: '#f6cd3f', // Ухудшение
};

/** Общий ярлык для всех единорогов, когда конкретный тип неизвестен. */
export const UNICORN_FALLBACK_COLOR = '#6966a9';

/** Цвет нейтральной карты, если тип не распознан. */
export const CARD_TYPE_FALLBACK_COLOR = '#455a64';

/** Русские подписи категорий для бейджей и фильтров. */
export const CARD_TYPE_LABELS: Record<string, string> = {
  baby_unicorn: 'Детёныш единорога',
  basic_unicorn: 'Обычный единорог',
  magical_unicorn: 'Магический единорог',
  ultimate_unicorn: 'Ультимативный единорог',
  magic: 'Магия',
  instant: 'Мгновенная',
  upgrade: 'Улучшение',
  downgrade: 'Ухудшение',
  unicorn: 'Единорог',
};

/** Цвет по типу карты с учётом алиаса unicorn и запасного значения. */
export function cardTypeColor(type: string | undefined | null): string {
  if (!type) return CARD_TYPE_FALLBACK_COLOR;
  if (type === 'unicorn') return UNICORN_FALLBACK_COLOR;
  return CARD_TYPE_COLORS[type] ?? CARD_TYPE_FALLBACK_COLOR;
}
