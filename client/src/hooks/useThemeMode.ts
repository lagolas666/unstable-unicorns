import React from 'react';
import type { ThemeMode } from '../theme';

export type ThemeModeContextValue = {
  /** Текущий режим: «Радужная» или «Мрачная» */
  mode: ThemeMode;
  /** Переключение режима с сохранением в localStorage */
  setMode: (next: ThemeMode) => void;
};

/** Контекст режима темы. Значение задаёт Root в main.tsx. */
export const ThemeModeContext = React.createContext<ThemeModeContextValue>({
  mode: 'rainbow',
  setMode: () => undefined,
});

/** Доступ к текущему режиму темы и его переключению */
export function useThemeMode(): ThemeModeContextValue {
  return React.useContext(ThemeModeContext);
}
