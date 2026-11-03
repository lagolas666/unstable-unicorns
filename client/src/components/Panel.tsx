import React, { PropsWithChildren, ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

export type PanelProps = PropsWithChildren<{
  title?: ReactNode;
  right?: ReactNode;
  padding?: number;
}>;

/**
 * Parchment-like panel to frame areas (hand, stable, etc.)
 */
export default function Panel({ title, right, padding = 2, children }: PanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        p: padding,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        backgroundImage:
          'radial-gradient(400px 200px at 20% 0%, rgba(255,255,255,0.7), rgba(255,255,255,0) 70%),\
           radial-gradient(600px 300px at 100% 120%, rgba(0,0,0,0.08), rgba(0,0,0,0) 70%)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)',
        border: '1px solid rgba(0,0,0,0.12)'
      }}
    >
      {(title || right) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Box>{right}</Box>
        </Stack>
      )}
      <Box>{children}</Box>
    </Paper>
  );
}
