import React from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Stack,
  Button,
  useMediaQuery,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Cards from './pages/Cards';
import Playtest from './pages/Playtest';
import Lobby from './pages/Lobby';
import GameRoom from './pages/GameRoom';
import './styles/animations.css';
import { useThemeMode } from './hooks/useThemeMode';
import { fonts } from './theme/tokens';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import BuildCircleRoundedIcon from '@mui/icons-material/BuildCircleRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';

const drawerWidth = 260;

export default function App() {
  const isSm = useMediaQuery('(max-width:900px)');
  const [open, setOpen] = React.useState(!isSm);
  const { mode, setMode } = useThemeMode();
  const location = useLocation();

  /** Навигационная ссылка бокового меню */
  const NavLink = React.memo(function NavLink(props: { to: string; icon: React.ReactNode; text: string }) {
    return (
      <ListItemButton
        component={Link}
        to={props.to}
        selected={location.pathname === props.to}
        sx={{ borderRadius: 1, mx: 1 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{props.icon}</ListItemIcon>
        <ListItemText primary={props.text} />
      </ListItemButton>
    );
  });

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant={isSm ? 'temporary' : 'permanent'}
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: { width: drawerWidth, borderRight: (t) => `1px solid ${t.palette.divider}` },
        }}
      >
        <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="h5" sx={{ fontFamily: fonts.display, letterSpacing: '0.06em' }}>
            Неудержимые
          </Typography>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            единороги · онлайн
          </Typography>
        </Box>
        <Divider />
        <List sx={{ py: 1 }}>
          <NavLink to="/" icon={<DashboardRoundedIcon />} text="Главная" />
          <NavLink to="/cards" icon={<StyleRoundedIcon />} text="Карты" />
          <NavLink to="/admin" icon={<BuildCircleRoundedIcon />} text="Админка" />
          <NavLink to="/playtest" icon={<ViewModuleRoundedIcon />} text="Плейтест" />
          <NavLink to="/lobby" icon={<DashboardRoundedIcon />} text="Комнаты" />
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Макет Figma · UNICORNS
          </Typography>
        </Box>
      </Drawer>

      <Box sx={{ flexGrow: 1, ml: { md: `${drawerWidth}px` } }}>
        <AppBar position="sticky" color="transparent" elevation={0}>
          <Toolbar>
            {isSm && (
              <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }}>
                <DashboardRoundedIcon />
              </IconButton>
            )}
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton color="inherit" aria-label="Поиск">
                <SearchRoundedIcon />
              </IconButton>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                onChange={(_e, next) => next && setMode(next)}
                aria-label="Тема оформления"
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 1,
                    py: 0.25,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '&.Mui-selected': { color: 'primary.main', bgcolor: 'action.selected' },
                  },
                }}
              >
                <ToggleButton value="rainbow" aria-label="Радужная тема">
                  <LightModeRoundedIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="dark" aria-label="Мрачная тема">
                  <DarkModeRoundedIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
              <Tooltip title="Уведомления">
                <IconButton color="inherit" aria-label="Уведомления">
                  <NotificationsNoneRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Профиль">
                <IconButton color="inherit" aria-label="Профиль">
                  <AccountCircleRoundedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/playtest" element={<Playtest />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/room/:roomId" element={<GameRoom />} />
          </Routes>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={Link} to="/" variant="outlined">
              Главная
            </Button>
            <Button component={Link} to="/cards" variant="outlined">
              Карты
            </Button>
            <Button component={Link} to="/admin" variant="outlined">
              Админка
            </Button>
            <Button component={Link} to="/playtest" variant="contained">
              Плейтест
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
