import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Avatar,
  Alert,
} from '@mui/material';
import axios from 'axios';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth';
      return;
    }

    // Получаем профиль пользователя
    axios
      .get('http://localhost:3002/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setUser(response.data);
      })
      .catch((error) => {
        setError(error.response?.data?.message || 'Ошибка при загрузке профиля');
      });
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('username', user.username);
      if (avatar) {
        formData.append('avatar', avatar);
      }

      await axios.put(
        'http://localhost:3002/api/users/profile',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Обновляем профиль в localStorage
      const updatedUser = { ...user, avatar: avatar ? URL.createObjectURL(avatar) : user.avatar };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      // Обновляем статус
      await axios.put(
        'http://localhost:3002/api/users/status',
        { online: true },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка при обновлении профиля');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/auth';
  };

  if (!user) {
    return <div>Loading...</div>;
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
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 600 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Avatar
            src={user.avatar}
            sx={{ width: 100, height: 100, mr: 3 }}
          />
          <Typography variant="h4">{user.username}</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleUpdateProfile}>
          <TextField
            fullWidth
            margin="normal"
            label="Имя"
            name="username"
            value={user.username}
            onChange={(e) => setUser({ ...user, username: e.target.value })}
            required
          />

          <TextField
            fullWidth
            margin="normal"
            label="Аватар"
            type="file"
            onChange={(e) => setAvatar(e.target.files[0])}
            accept="image/*"
          />

          <Button
            type="submit"
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Обновить профиль
          </Button>
        </form>

        <Button
          variant="outlined"
          color="error"
          onClick={handleLogout}
          sx={{ mt: 2 }}
        >
          Выйти из аккаунта
        </Button>

        <Typography variant="h6" sx={{ mt: 4 }}>Статистика</Typography>
        <Typography>Игр сыграно: {user.gamesPlayed}</Typography>
        <Typography>Побед: {user.wins}</Typography>
        <Typography>Поражений: {user.losses}</Typography>
      </Paper>
    </Box>
  );
};

export default Profile;
