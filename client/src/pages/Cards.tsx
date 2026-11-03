import React, { useEffect, useMemo, useState } from 'react';
import { Box, Container, Grid, MenuItem, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import type { Card } from '../../../shared/src/types';
import { api, serverOrigin } from '../api';

export default function Cards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | Card['type']>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const params: any = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    if (query.trim()) params.q = query.trim();
    if (type !== 'all') params.type = type;
    api.get<Card[]>('/cards', { params }).then(async r => {
      setCards(r.data);
      let headerTotal = Number((r as any).headers?.['x-total-count'] ?? (r as any).headers?.['X-Total-Count']);
      if (isNaN(headerTotal) || headerTotal < 0) {
        try {
          const cntParams: any = {};
          if (query.trim()) cntParams.q = query.trim();
          if (type !== 'all') cntParams.type = type;
          const cnt = await api.get<{ total: number }>('/cards/count', { params: cntParams });
          headerTotal = Number(cnt.data?.total ?? 0);
        } catch {}
      }
      setTotal(!isNaN(headerTotal) && headerTotal >= 0 ? headerTotal : r.data.length);
    });
  }, [page, pageSize, query, type]);

  const filtered = useMemo(() => cards, [cards]);

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Поиск"
            placeholder="Название или описание"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            fullWidth
          />
          <TextField select label="Тип" value={type} onChange={e => setType(e.target.value as any)} sx={{ minWidth: 180 }}>
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="unicorn">Единорог</MenuItem>
            <MenuItem value="upgrade">Улучшение</MenuItem>
            <MenuItem value="downgrade">Ухудшение</MenuItem>
            <MenuItem value="instant">Мгновенная</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            Найдено: {total} • Стр. {page} из {Math.max(1, Math.ceil(total / pageSize))}
          </Typography>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {filtered.map((card, idx) => (
          <Grid item key={(card as any)._id || (card as any).id || `${card.name}-${idx}`} xs={12} sm={6} md={4} lg={3}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {card.image ? (
                    <img src={`${serverOrigin}${card.image}`} alt={card.name} style={{ height: 140, objectFit: 'contain' }} />
                  ) : (
                    <Box sx={{ width: '100%', height: 140, bgcolor: '#eee' }} />
                  )}
                </Box>
                <Typography variant="subtitle1">{card.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Тип: {card.type} • Эффектов: {card.effects?.length || 0}
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination
          color="primary"
          page={page}
          count={Math.max(1, Math.ceil(total / pageSize))}
          onChange={(_, p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          showFirstButton
          showLastButton
        />
      </Box>

      {!filtered.length && (
        <Box mt={2}>
          <Typography color="text.secondary">Ничего не найдено</Typography>
        </Box>
      )}
    </Container>
  );
}
