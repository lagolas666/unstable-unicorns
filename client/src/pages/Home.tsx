import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

export default function Home() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Нестабильные единороги — панель управления
        </Typography>
        <Typography color="text.secondary">
          Используйте навигацию сверху, чтобы просматривать созданные карты или добавить новые в админке.
        </Typography>
      </Paper>
    </Container>
  );
}
