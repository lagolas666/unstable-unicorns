import React from 'react';
import { Box, Tooltip, Typography, SxProps, Theme } from '@mui/material';
import { serverOrigin } from '../api';

export type CardData = {
  id: string;
  name: string;
  type: string;
  image?: string;
};

export type CardViewProps = {
  card?: CardData;
  fallbackLabel?: string;
  variant?: 'mini' | 'hand' | 'modal';
  width?: number; // override
  height?: number; // override
  onClick?: () => void;
  sx?: SxProps<Theme>;
  showLabelFallback?: boolean;
};

const VARIANT_SIZE: Record<NonNullable<CardViewProps['variant']>, { w: number; h: number }> = {
  mini: { w: 100, h: 120 },
  hand: { w: 140, h: 180 },
  modal: { w: 300, h: 420 },
};

export default function CardView({ card, fallbackLabel, variant = 'mini', width, height, onClick, sx, showLabelFallback = true }: CardViewProps) {
  const size = VARIANT_SIZE[variant];
  const w = width ?? size.w;
  const h = height ?? size.h;

  const tooltip = card ? (
    <Box whiteSpace="pre">
      {`${card.name}\nТип: ${card.type}\nID: ${card.id}`}
    </Box>
  ) : undefined;

  function resolveImageUrl(img?: string): string | undefined {
    if (!img) return undefined;
    if (/^https?:\/\//i.test(img) || /^data:/i.test(img)) return img;
    // If starts with '/', prefix serverOrigin, otherwise assume uploads path
    if (img.startsWith('/')) return `${serverOrigin}${img}`;
    return `${serverOrigin}/uploads/${img}`;
  }

  function borderColorForType(t?: string): string {
    switch (t) {
      case 'baby_unicorn':     return '#c47fac'; // Малыши единороги
      case 'basic_unicorn':    return '#6966a9'; // Обычные единороги
      case 'ultimate_unicorn': return '#2c292f'; // Высшие единороги
      case 'magical_unicorn':  return '#37a1e0'; // Волшебные единороги
      case 'magic':            return '#91bc5a'; // Магия
      case 'instant':          return '#d62e3b'; // Мгновенная
      case 'upgrade':          return '#e47b39'; // Бонус
      case 'downgrade':        return '#f6cd3f'; // Штраф
      case 'unicorn':          return '#6966a9'; // общий ярлык единорогов
      default: return 'rgba(255,255,255,0.2)';
    }
  }

  const imgSrc = resolveImageUrl(card?.image);
  const borderColor = borderColorForType(card?.type);

  return (
    <Tooltip title={tooltip} arrow disableHoverListener={!card}>
      <Box
        onClick={onClick}
        sx={{
          width: w,
          height: h,
          borderRadius: 1,
          bgcolor: '#101012',
          color: 'white',
          overflow: 'hidden',
          border: `2px solid ${borderColor}`,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
          '&:hover': { transform: 'translateY(-2px) scale(1.03)', boxShadow: 4 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          ...sx,
        }}
      >
        {imgSrc ? (
          <Box component="img" src={imgSrc} alt={card?.name || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          showLabelFallback && (
            <Typography variant="caption" sx={{ px: 1 }} noWrap>
              {card?.name || fallbackLabel || '—'}
            </Typography>
          )
        )}
      </Box>
    </Tooltip>
  );
}
