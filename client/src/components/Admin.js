import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Button,
  TextField,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
} from '@mui/material';
import axios from 'axios';

const Admin = () => {
  const [tab, setTab] = useState(0);
  const [cards, setCards] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [newCardDialogOpen, setNewCardDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    id: '',
    name: '',
    type: '',
    effect: '',
    quantity: 1,
    isActive: true,
    attributes: {
      color: '',
      rarity: '',
      special: '',
    },
    image: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth';
      return;
    }

    // Проверяем права администратора
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user.isAdmin) {
      window.location.href = '/profile';
      return;
    }

    // Загружаем данные
    loadCards();
    loadUsers();
  }, []);

  const loadCards = async () => {
    try {
      const response = await axios.get('http://localhost:3002/api/cards');
      setCards(response.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при загрузке карт');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get('http://localhost:3002/api/users/online');
      setUsers(response.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при загрузке пользователей');
    }
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleNewCardDialogOpen = () => {
    setNewCardDialogOpen(true);
  };

  const handleNewCardDialogClose = () => {
    setNewCardDialogOpen(false);
    setNewCard({
      id: '',
      name: '',
      type: '',
      effect: '',
      quantity: 1,
      isActive: true,
      attributes: {
        color: '',
        rarity: '',
        special: '',
      },
      image: '',
    });
  };

  const handleAddCard = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:3002/api/cards',
        newCard,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      handleNewCardDialogClose();
      loadCards();
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при добавлении карты');
    }
  };

  const handleToggleCard = async (cardId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:3002/api/cards/${cardId}/activate`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      loadCards();
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при изменении статуса карты');
    }
  };

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
        <Typography variant="h4" align="center" gutterBottom>
          Административная панель
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
          <Tab label="Управление картами" />
          <Tab label="Управление пользователями" />
        </Tabs>

        {tab === 0 && (
          <>
            <Button
              variant="contained"
              onClick={handleNewCardDialogOpen}
              sx={{ mb: 2 }}
            >
              Добавить карту
            </Button>

            <List>
              {cards.map((card) => (
                <ListItem
                  key={card.id}
                  secondaryAction={
                    <Switch
                      checked={card.isActive}
                      onChange={() => handleToggleCard(card.id)}
                    />
                  }
                >
                  <ListItemText
                    primary={card.name}
                    secondary={`Тип: ${card.type}, Количество: ${card.quantity}`}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {tab === 1 && (
          <List>
            {users.map((user) => (
              <ListItem key={user.id}>
                <ListItemAvatar>
                  <Avatar src={user.avatar} />
                </ListItemAvatar>
                <ListItemText
                  primary={user.username}
                  secondary={`Побед: ${user.wins}, Игр: ${user.gamesPlayed}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Dialog open={newCardDialogOpen} onClose={handleNewCardDialogClose}>
        <DialogTitle>Добавление новой карты</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="ID карты"
            value={newCard.id}
            onChange={(e) =>
              setNewCard({ ...newCard, id: e.target.value })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Название"
            value={newCard.name}
            onChange={(e) =>
              setNewCard({ ...newCard, name: e.target.value })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Тип"
            value={newCard.type}
            onChange={(e) =>
              setNewCard({ ...newCard, type: e.target.value })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Эффект"
            value={newCard.effect}
            onChange={(e) =>
              setNewCard({ ...newCard, effect: e.target.value })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Количество"
            type="number"
            value={newCard.quantity}
            onChange={(e) =>
              setNewCard({ ...newCard, quantity: parseInt(e.target.value) })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Цвет"
            value={newCard.attributes.color}
            onChange={(e) =>
              setNewCard({
                ...newCard,
                attributes: { ...newCard.attributes, color: e.target.value },
              })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Редкость"
            value={newCard.attributes.rarity}
            onChange={(e) =>
              setNewCard({
                ...newCard,
                attributes: { ...newCard.attributes, rarity: e.target.value },
              })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Особенность"
            value={newCard.attributes.special}
            onChange={(e) =>
              setNewCard({
                ...newCard,
                attributes: { ...newCard.attributes, special: e.target.value },
              })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Изображение"
            value={newCard.image}
            onChange={(e) =>
              setNewCard({ ...newCard, image: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNewCardDialogClose}>Отмена</Button>
          <Button onClick={handleAddCard} variant="contained">
            Добавить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Admin;
