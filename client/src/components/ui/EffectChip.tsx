import React from 'react';
import { Box, Typography } from '@mui/material';
import { effectColors, fonts, radii, type EffectKind } from '../../theme/tokens';

/** Русские подписи эффектов из легенды 123:3162. */
export const EFFECT_LABELS: Record<EffectKind, string> = {
  steal: 'КРАЖА',
  discard: 'СБРОСИТЬ',
  draw: 'ВЗЯТЬ',
  search: 'НАЙТИ',
  destroy: 'УНИЧТОЖИТЬ',
  cancel: 'ОТМЕНИТЬ',
};

export type EffectChipProps = {
  /** Код эффекта из карты */
  effect: EffectKind;
  /** Размер: компактный для легенды, обычный для карты */
  size?: 'sm' | 'md';
  /** Перебить подпись, если текст пришёл с сервера */
  label?: string;
};

/**
 * EffectChip — чип эффекта (легенда 123:3162, 6 штук).
 * Цвет берётся из effectColors, форма — общая для всех чипов.
 */
function EffectChipBase({ effect, size = 'sm', label }: EffectChipProps) {
  const color = effectColors[effect];
  const small = size === 'sm';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: small ? 0.75 : 1.25,
        py: small ? 0.125 : 0.375,
        borderRadius: `${radii.xs}px`,
        border: `1px solid ${color}`,
        backgroundColor: `${color}22`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
      <Typography
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: small ? 9 : 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1.2,
        }}
      >
        {label ?? EFFECT_LABELS[effect]}
      </Typography>
    </Box>
  );
}

export default React.memo(EffectChipBase);
