import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';

// Компоненты
import Auth from './components/Auth';
import Profile from './components/Profile';
import Rooms from './components/Rooms';
import Game from './components/Game';
import Admin from './components/Admin';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6c5ce7',
    },
    secondary: {
      main: '#a8e063',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/game/:roomId" element={<Game />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/" element={<Rooms />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
