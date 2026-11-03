import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { cardSizes, fonts, letterSpacing, palette, radii, shadows, typeScale } from './tokens';

export * from './tokens';

/**
 * Два режима оформления из макета:
 * - «Радужная» — светлый стол (123:3128);
 * - «Мрачная» — тёмный стол (121:7560).
 */
export type ThemeMode = 'rainbow' | 'dark';

interface ModeTokens {
  mode: 'light' | 'dark';
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  divider: string;
  primary: string;
  secondary: string;
  info: string;
  success: string;
  warning: string;
  error: string;
}

/** Палитра режимов собрана только из токенов макета. */
const MODE_TOKENS: Record<ThemeMode, ModeTokens> = {
  rainbow: {
    mode: 'light',
    background: palette.pinkWood,
    surface: palette.cardWhite,
    text: palette.textStrong,
    textSecondary: palette.textMuted,
    divider: 'rgba(150, 117, 134, 0.22)',
    primary: palette.pink,
    secondary: palette.purple,
    info: palette.blue,
    success: palette.green,
    warning: palette.gold,
    error: palette.errorOnLight,
  },
  dark: {
    mode: 'dark',
    background: palette.tableDark,
    surface: palette.tableInk,
    text: palette.textOnDark,
    textSecondary: palette.gold,
    divider: 'rgba(185, 156, 98, 0.25)',
    primary: palette.gold,
    secondary: palette.purple,
    info: palette.blue,
    success: palette.lime,
    warning: palette.goldLight,
    error: palette.errorOnDark,
  },
};

/** Собирает тему MUI на токенах макета. */
export function buildTheme(mode: ThemeMode): Theme {
  const t = MODE_TOKENS[mode];
  const isLight = t.mode === 'light';

  // MUI требует ровно 25 теней: подставляем макетную главную тень.
  const shadowsArray = Array(25).fill(shadows.card) as Theme['shadows'];
  shadowsArray[0] = 'none';

  return createTheme({
    // Размеры карт доступны компонентам как theme.cards.
    cards: cardSizes,
    palette: {
      mode: t.mode,
      primary: { main: t.primary, contrastText: isLight ? palette.cardWhite : palette.deepInk },
      secondary: { main: t.secondary, contrastText: palette.cardWhite },
      info: { main: t.info },
      success: { main: t.success },
      warning: { main: t.warning },
      error: { main: t.error },
      background: { default: t.background, paper: t.surface },
      text: { primary: t.text, secondary: t.textSecondary },
      divider: t.divider,
    },
    shape: { borderRadius: radii.md },
    typography: {
      fontFamily: fonts.body,
      h1: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: letterSpacing.display },
      h2: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: letterSpacing.display },
      h3: { fontFamily: fonts.display, fontWeight: 700 },
      h4: { fontFamily: fonts.display, fontWeight: 700 },
      h5: { fontWeight: 800 },
      h6: { fontWeight: 800 },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      body2: { fontWeight: 400 },
      caption: { fontFamily: fonts.mono, letterSpacing: '0.04em' },
      overline: { fontFamily: fonts.mono, fontWeight: 600, letterSpacing: '0.12em' },
      button: { fontWeight: 700, textTransform: 'none', fontSize: typeScale.bodyLg },
    },
    shadows: shadowsArray,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { background: t.background, color: t.text, fontFamily: fonts.body },
          '::-webkit-scrollbar': { width: 10, height: 10 },
          '::-webkit-scrollbar-thumb': { backgroundColor: t.divider, borderRadius: radii.sm },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', borderRadius: radii.lg, boxShadow: shadows.card },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: radii.lg,
            boxShadow: shadows.card,
            border: `1px solid ${t.divider}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: t.surface,
            color: t.text,
            boxShadow: shadows.card,
            borderBottom: `1px solid ${t.divider}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: radii.sm, minHeight: 36 },
          outlined: { borderColor: t.divider, ':hover': { borderColor: t.primary } },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: radii.sm, fontWeight: 700 },
          outlined: { borderColor: t.divider },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: typeScale.body,
            borderRadius: radii.xs,
            backgroundColor: isLight ? palette.textStrong : palette.goldLight,
            color: isLight ? palette.cardWhite : palette.deepInk,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: radii.lg, boxShadow: shadows.card },
        },
      },
      MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
      MuiSelect: { defaultProps: { variant: 'outlined', size: 'small' } },
    },
  });
}

/** Подписи переключателя на русском. */
export const THEME_LABELS: Record<ThemeMode, string> = {
  rainbow: 'Радужная',
  dark: 'Мрачная',
};

/** Кеш собранных тем: переключение режима не пересобирает тему на каждом рендере. */
const themeCache = new Map<ThemeMode, Theme>();

/** Тема для режима; результат кешируется, объекты тем стабильны между рендерами. */
export function getTheme(mode: ThemeMode): Theme {
  const cached = themeCache.get(mode);
  if (cached) return cached;
  const next = buildTheme(mode);
  themeCache.set(mode, next);
  return next;
}

/** Тема по умолчанию — «Радужная». */
const theme = getTheme('rainbow');

/**
 * Размеры карт прокидываются в тему, чтобы компоненты не дублировали константы.
 * Расширение через declare module, потому что карта добавляется в createTheme.
 */
declare module '@mui/material/styles' {
  interface Theme {
    cards: typeof cardSizes;
  }
  interface ThemeOptions {
    cards?: typeof cardSizes;
  }
}

export default theme;
