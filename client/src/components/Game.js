import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import io from 'socket.io-client';

const Game = ({ match }) => {
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth';
      return;
    }

    const newSocket = io('http://localhost:3002');
    setSocket(newSocket);

    // Подключаемся к комнате
    newSocket.emit('joinRoom', match.params.roomId);

    // Обработчики событий Socket.IO
    newSocket.on('gameState', (state) => {
      setGameState(state);
      setIsMyTurn(state.currentPlayer === localStorage.getItem('user').id);
    });

    newSocket.on('error', (error) => {
      setError(error.message);
    });

    return () => {
      newSocket.close();
    };
  }, [match.params.roomId]);

  const handlePlayCard = (card) => {
    if (!isMyTurn) {
      setError('Не ваш ход');
      return;
    }

    socket.emit('playCard', {
      roomId: match.params.roomId,
      cardId: card.id,
      targetId: selectedCard?.id,
    });
  };

  const handleDiscardCard = (card) => {
    if (!isMyTurn) {
      setError('Не ваш ход');
      return;
    }

    socket.emit('discardCard', {
      roomId: match.params.roomId,
      cardId: card.id,
    });
  };

  const handleEndTurn = () => {
    if (!isMyTurn) {
      setError('Не ваш ход');
      return;
    }

    socket.emit('endTurn', match.params.roomId);
  };

  if (!gameState) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        py: 8,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 1200 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h4" align="center">
              Игра в комнате {match.params.roomId}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6">Текущий игрок: {gameState.currentPlayer}</Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6">Ваша рука:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              {gameState.hand.map((card) => (
                <Paper
                  key={card.id}
                  elevation={3}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    background: selectedCard?.id === card.id ? '#a8e063' : 'white',
                  }}
                  onClick={() => setSelectedCard(card)}
                >
                  <Typography>{card.name}</Typography>
                  <Typography variant="caption">{card.type}</Typography>
                </Paper>
              ))}
            </Box>
          </Grid>

          {isMyTurn && (
            <Grid item xs={12}>
              <Button
                variant="contained"
                onClick={() => handlePlayCard(selectedCard)}
                disabled={!selectedCard}
                sx={{ mr: 2 }}
              >
                Использовать карту
              </Button>
              <Button
                variant="contained"
                onClick={() => handleDiscardCard(selectedCard)}
                disabled={!selectedCard}
                sx={{ mr: 2 }}
              >
                Сбросить карту
              </Button>
              <Button
                variant="contained"
                onClick={handleEndTurn}
                disabled={gameState.hand.length > 7}
              >
                Закончить ход
              </Button>
            </Grid>
          )}

          <Grid item xs={12}>
            <Typography variant="h6">Ваши единороги:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              {gameState.unicornStable.map((card) => (
                <Paper
                  key={card.id}
                  elevation={3}
                  sx={{ p: 2 }}
                >
                  <Typography>{card.name}</Typography>
                  <Typography variant="caption">{card.type}</Typography>
                </Paper>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6">Модификаторы:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              {gameState.modifierStable.map((card) => (
                <Paper
                  key={card.id}
                  elevation={3}
                  sx={{ p: 2 }}
                >
                  <Typography>{card.name}</Typography>
                  <Typography variant="caption">{card.type}</Typography>
                </Paper>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Game;
