import React from 'react';
import { Box, Typography } from '@mui/material';
import { fonts, typeScale } from '../../theme/tokens';
import { usePalette } from '../../hooks/usePalette';

export type ZoneLabelProps = {
  /** Подпись зоны: «КОНЮШНЯ», «РУКА», «СБРОС» */
  title: string;
  /** Значок слева: ReactNode или emoji */
  icon?: React.ReactNode;
  /** Счётчик справа: «3 карты», у руки «5/7» */
  counter?: React.ReactNode;
  /** Приглушённая подпись для неактивной зоны */
  muted?: boolean;
};

/**
 * ZoneLabel — метка зоны стола (123:3268 конюшня, 123:3293 рука).
 * Cormorant Garamond + трекинг, линия-разделитель, счётчик справа.
 */
function ZoneLabelBase({ title, icon, counter, muted }: ZoneLabelProps) {
  // Палитра активной темы: атом перекрашивается при переключении режима.
  const pal = usePalette();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        opacity: muted ? 0.55 : 1,
        userSelect: 'none',
      }}
    >
      {icon ? <Box sx={{ display: 'inline-flex', fontSize: typeScale.body }}>{icon}</Box> : null}
      <Typography
        component="span"
        sx={{
          fontFamily: fonts.display,
          fontSize: typeScale.label,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: pal.textMuted,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Typography>
      <Box sx={{ flexGrow: 1, minWidth: 24, height: 1, backgroundColor: 'divider' }} />
      {counter != null ? (
        <Typography
          component="span"
          sx={{ fontFamily: fonts.mono, fontSize: typeScale.small, fontWeight: 600, color: 'text.secondary' }}
        >
          {counter}
        </Typography>
      ) : null}
    </Box>
  );
}

export default React.memo(ZoneLabelBase);
