/**
 * Палитра стола по режиму оформления.
 *
 * Зачем отдельный файл: tokens.ts — статичные константы макета, он не знает про режим.
 * Компоненты стола должны читать цвета активной темы («Радужная» / «Мрачная»),
 * иначе переключатель в сайдбаре меняет только MUI-тему, а сукно и панели остаются прежними.
 *
 * Правило: значения берутся ТОЛЬКО из palette в tokens.ts, новых hex здесь нет.
 */
import type { ThemeMode } from './index';
import { palette, shadows } from './tokens';

/** Набор цветов стола. Одинаковый набор ключей у обоих режимов — компоненты не ветвятся. */
export interface TablePalette {
  /** Фон страницы вокруг сцены */
  pageBg: string;
  /** Кромка (борт) стола */
  frame: string;
  /** Сукно стола */
  felt: string;
  /** Панель на столе: журнал, памятка, управление ходом */
  surface: string;
  /** Тёмная подложка: колода, конюшни соперников, трекер */
  surfaceAlt: string;
  /** Основной текст на светлой поверхности */
  text: string;
  /** Вторичный текст на светлой поверхности */
  textMuted: string;
  /** Текст на сукне и на тёмной подложке */
  onFelt: string;
  /** Приглушённый текст на сукне */
  onFeltMuted: string;
  /** Акцент: «Сейчас», ход, ссылка */
  accent: string;
  /** Границы конюшен и рамок */
  border: string;
  /** Золото камня, кнопок и заголовков */
  gold: string;
  /** Лицо карты, если картинки нет */
  cardFace: string;
  /** Камень рубашки и колоды */
  stone: string;
  /** Тень камня рубашки и колоды */
  stoneDeep: string;
  /** Ошибка и предупреждение */
  danger: string;
  /** Тень панелей */
  shadow: string;
}

/** «Радужная» — светлый стол: розовое дерево, инкрустация, тёмный текст. */
const RAINBOW: TablePalette = {
  pageBg: palette.atlasPinkWood,
  frame: palette.atlasInlay,
  felt: palette.atlasPinkWood,
  surface: palette.cardWhite,
  surfaceAlt: palette.softLight,
  text: palette.atlasInk,
  textMuted: palette.atlasMuted,
  onFelt: palette.atlasInk,
  onFeltMuted: palette.atlasMuted,
  accent: palette.atlasViolet,
  border: palette.atlasBronze,
  gold: palette.atlasGold,
  cardFace: palette.cardWhite,
  stone: palette.stone,
  stoneDeep: palette.stoneDeep,
  danger: palette.errorOnLight,
  shadow: shadows.card,
};

/** «Мрачная» — тёмное сукно, кремовый текст, то же золото и сирень. */
const DARK: TablePalette = {
  pageBg: palette.atlasFelt,
  frame: palette.atlasSurfaceDark,
  felt: palette.atlasFelt,
  surface: palette.atlasSurfaceDark,
  surfaceAlt: palette.tableInk,
  text: palette.atlasCream,
  textMuted: palette.atlasMutedDark,
  onFelt: palette.atlasCream,
  onFeltMuted: palette.atlasMutedDark,
  accent: palette.atlasViolet,
  border: palette.atlasBronze,
  gold: palette.atlasGoldText,
  cardFace: palette.atlasCream,
  stone: palette.stone,
  stoneDeep: palette.stoneDeep,
  danger: palette.errorOnDark,
  shadow: shadows.dark,
};

/** Палитры по режимам. */
export const TABLE_PALETTES: Record<ThemeMode, TablePalette> = {
  rainbow: RAINBOW,
  dark: DARK,
};

/** Палитра по режиму; неизвестный режим даёт «Радужную». */
export function getTablePalette(mode: ThemeMode | string | undefined): TablePalette {
  return mode === 'dark' ? DARK : RAINBOW;
}
