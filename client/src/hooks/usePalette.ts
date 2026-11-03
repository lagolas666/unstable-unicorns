/**
 * Хук палитры активной темы.
 *
 * Почему хук, а не просто функция: компоненты стола должны перерисоваться при
 * переключении «Радужная» / «Мрачная». Хук подписан на ThemeModeContext и
 * возвращает новый объект только при смене режима (useMemo), поэтому
 * React.memo остаётся полезным.
 */
import React from 'react';
import type { ThemeMode } from '../theme';
import { useThemeMode } from './useThemeMode';
import { getTablePalette, type TablePalette } from '../theme/tablePalette';

/** Палитра стола для текущего режима темы. */
export function usePalette(): TablePalette {
  const { mode } = useThemeMode();
  return React.useMemo(() => getTablePalette(mode), [mode]);
}

/** Режим темы строкой — удобно для data-атрибутов и проверок. */
export function useThemeModeName(): ThemeMode {
  return useThemeMode().mode;
}
