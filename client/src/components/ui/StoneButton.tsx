import React from 'react';
import { Button, Typography } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import { fonts, radii, shadows } from '../../theme/tokens';
import type { TablePalette } from '../../theme/tablePalette';
import { usePalette } from '../../hooks/usePalette';

export type StoneButtonVariant = 'stone' | 'primary' | 'ghost';

export type StoneButtonProps = Omit<ButtonProps, 'variant' | 'color'> & {
  /** Вид: каменная (основная в макете), розовый акцент, прозрачная */
  variant?: StoneButtonVariant;
  /** Подпись-подсказка снизу, например «[ ПРОБЕЛ ] завершить ход» */
  hint?: string;
};

/** Фон кнопки по виду: камень собирается из CSS-градиента, скрытые векторы макета не нужны. */
function surfaceOf(pal: TablePalette): Record<StoneButtonVariant, React.CSSProperties> {
  return {
    stone: {
      background: `linear-gradient(180deg, ${pal.stone} 0%, ${pal.stoneDeep} 100%)`,
      color: pal.cardFace,
      border: `1px solid ${pal.gold}`,
    },
    primary: {
      background: `linear-gradient(180deg, ${pal.accent} 0%, ${pal.stoneDeep} 100%)`,
      color: pal.cardFace,
      border: `1px solid ${pal.accent}`,
    },
    ghost: {
      background: 'transparent',
      color: pal.text,
      border: `1px solid ${pal.textMuted}`,
    },
  };
}

/**
 * StoneButton — кнопка макета «Неудержимые единороги» (121:8470–8472).
 * Каменная фактура сделана градиентом, сверху внутренняя подсветка.
 */
function StoneButtonBase({ variant = 'stone', hint, children, sx, ...rest }: StoneButtonProps) {
  // Палитра активной темы: камень и акцент перекрашиваются вместе с режимом.
  const pal = usePalette();
  const surface = surfaceOf(pal);
  const isGhost = variant === 'ghost';
  return (
    <Button
      disableElevation
      {...rest}
      sx={[
        {
          borderRadius: `${radii.sm}px`,
          fontFamily: fonts.body,
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '0.02em',
          textTransform: 'none',
          minHeight: 38,
          px: 2.5,
          boxShadow: isGhost ? 'none' : shadows.card,
          textShadow: isGhost ? 'none' : '0 1px 0 rgba(0, 0, 0, 0.25)',
          transition: 'transform 120ms ease, filter 120ms ease',
          '&:hover': { filter: 'brightness(1.06)' },
          '&:active': { transform: 'translateY(1px)' },
          '&.Mui-disabled': { filter: 'grayscale(0.7)', opacity: 0.55 },
        },
        surface[variant],
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {hint ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span>{children}</span>
          <Typography
            component="span"
            sx={{ fontFamily: fonts.mono, fontSize: 9, opacity: 0.85, letterSpacing: '0.06em' }}
          >
            {hint}
          </Typography>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

/** Кнопка перерисовывается только при смене пропсов. */
export default React.memo(StoneButtonBase);
