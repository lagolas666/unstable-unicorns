import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import App from './App';
import { getTheme, type ThemeMode } from './theme';
import { ThemeModeContext } from './hooks/useThemeMode';

/** Ключ хранения выбранной темы в localStorage */
const STORAGE_KEY = 'uu_theme_mode';

function readMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'dark' || saved === 'rainbow' ? saved : 'rainbow';
}

/** Корень приложения: держит режим темы и отдаёт его через контекст */
function Root() {
  const [mode, setMode] = React.useState<ThemeMode>(readMode);

  const value = React.useMemo(
    () => ({
      mode,
      setMode: (next: ThemeMode) => {
        setMode(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [mode],
  );

  const theme = React.useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
