import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  TextField,
} from '@mui/material';
import { Add, PersonAdd } from '@mui/icons-material';
import axios from 'axios';
import io from 'socket.io-client';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth';
      return;
    }

    // Подключаемся к Socket.IO
    const newSocket = io('http://localhost:3002');
    setSocket(newSocket);

    // Получаем список комнат
    axios
      .get('http://localhost:3002/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setRooms(response.data);
      })
      .catch((error) => {
        setError(error.response?.data?.message || 'Ошибка при загрузке комнат');
      });

    // Получаем список онлайн пользователей
    axios
      .get('http://localhost:3002/api/users/online', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setOnlineUsers(response.data);
      })
      .catch((error) => {
        setError(error.response?.data?.message || 'Ошибка при загрузке пользователей');
      });

    // Обработчики событий Socket.IO
    newSocket.on('roomUpdate', (room) => {
      setRooms((prevRooms) => [...prevRooms, room]);
    });

    newSocket.on('roomInvitation', (invitation) => {
      if (window.confirm('Вы получили приглашение в комнату. Принять?')) {
        joinRoom(invitation.roomId);
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3002/api/rooms',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      window.location.href = `/game/${response.data.roomId}`;
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при создании комнаты');
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:3002/api/rooms/${roomId}/join`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      window.location.href = `/game/${roomId}`;
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при присоединении к комнате');
    }
  };

  const inviteUser = async (userId, roomId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:3002/api/rooms/${roomId}/invite/${userId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при отправке приглашения');
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
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 800 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4">Комнаты</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={createRoom}
          >
            Создать комнату
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <TextField
          fullWidth
          label="Поиск пользователей"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 3 }}
        />

        <Typography variant="h6" sx={{ mb: 2 }}>Доступные комнаты:</Typography>
        <List>
          {rooms.map((room) => (
            <ListItem
              key={room.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => joinRoom(room.id)}>
                  <PersonAdd />
                </IconButton>
              }
            >
              <ListItemText
                primary={`Комната ${room.id}`}
                secondary={`Игроков: ${room.players.length}/${room.maxPlayers}`}
              />
            </ListItem>
          ))}
        </List>

        <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Онлайн пользователи:</Typography>
        <List>
          {onlineUsers
            .filter((user) =>
              !search || user.username.toLowerCase().includes(search.toLowerCase())
            )
            .map((user) => (
              <ListItem
                key={user.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={() => inviteUser(user.id, rooms[0]?.id)}
                  >
                    <PersonAdd />
                  </IconButton>
                }
              >
                <ListItemAvatar>
                  <Avatar src={user.avatar} />
                </ListItemAvatar>
                <ListItemText primary={user.username} />
              </ListItem>
            ))}
        </List>
      </Paper>
    </Box>
  );
};

export default Rooms;
