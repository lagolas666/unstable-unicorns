import React from 'react';
import { Box, Typography } from '@mui/material';
import { fonts, radii, typeScale } from '../../theme/tokens';
import type { TablePalette } from '../../theme/tablePalette';
import { usePalette } from '../../hooks/usePalette';

export type ConnectionState = 'online' | 'connecting' | 'offline';

export type ConnectionPillProps = {
  /** Состояние сокета: соединён / подключается / нет связи */
  online: boolean;
  /** Задержка в миллисекундах, если сервер её присылает */
  latency?: number;
  /** Текст в режиме «подключается» */
  connecting?: boolean;
};

/** Цвет и подпись по состоянию соединения (123:3368). */
function statesOf(pal: TablePalette): Record<ConnectionState, { color: string; text: string }> {
  return {
    online: { color: pal.accent, text: 'НА СВЯЗИ' },
    connecting: { color: pal.gold, text: 'ПОДКЛЮЧЕНИЕ' },
    offline: { color: pal.danger, text: 'НЕТ СВЯЗИ' },
  };
}

/**
 * ConnectionPill — индикатор соединения с сервером.
 * Точка + подпись Inter, задержка показывается только когда соединение живое.
 */
function ConnectionPillBase({ online, latency, connecting }: ConnectionPillProps) {
  // Палитра активной темы: точка связи читается и на светлом, и на тёмном столе.
  const pal = usePalette();
  const key: ConnectionState = online ? 'online' : connecting ? 'connecting' : 'offline';
  const { color, text } = statesOf(pal)[key];
  return (
    <Box
      component="span"
      title={latency != null && online ? `Задержка ${latency} мс` : text}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: `${radii.pill}px`,
        border: `1px solid ${color}`,
        backgroundColor: `${color}1f`,
        color,
      }}
    >
      <Box
        component="span"
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 0 2px ${color}33`,
          animation: key === 'connecting' ? 'pulse 1.4s ease-in-out infinite' : 'none',
        }}
      />
      <Typography
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: typeScale.tiny,
          fontWeight: 700,
          letterSpacing: '0.1em',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
        {online && latency != null ? ` · ${latency} мс` : ''}
      </Typography>
    </Box>
  );
}

export default React.memo(ConnectionPillBase);
