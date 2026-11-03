import React from 'react';
import { Box, Typography } from '@mui/material';
import { fonts, typeScale } from '../../theme/tokens';
import { usePalette } from '../../hooks/usePalette';

export type StatBlockProps = {
  /** Подпись: «ХОД», «ИГРОКИ», «СТАТУС» */
  label: string;
  /** Значение: «2», «3 / 6», «Ход Варека» */
  value: React.ReactNode;
  /** Акцентный цвет значения, по умолчанию текст макета */
  accent?: string;
  /** Компактный вариант для узких панелей */
  dense?: boolean;
};

/**
 * StatBlock — цифра со подписью из верхней панели партии (123:3134).
 * Подпись — Inter в верхнем регистре, значение — Nunito 800.
 */
function StatBlockBase({ label, value, accent, dense }: StatBlockProps) {
  // Палитра активной темы: атом перекрашивается при переключении режима.
  const pal = usePalette();
  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
      <Typography
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: dense ? typeScale.micro : typeScale.tiny,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: pal.textMuted,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography
        component="span"
        sx={{
          fontFamily: fonts.body,
          fontSize: dense ? typeScale.body : typeScale.subtitle,
          fontWeight: 800,
          color: accent ?? 'text.primary',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default React.memo(StatBlockBase);
