require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/unstable-unicorns', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
  seedUsers();
})
.catch(err => console.error('MongoDB connection error:', err));

async function seedUsers() {
  try {
    // Хешируем пароли
    const hashedPassword = await bcrypt.hash('password123', 10);
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);

    // Тестовые пользователи
    const users = [
      {
        username: 'test_user1',
        email: 'test1@example.com',
        password: hashedPassword,
        avatar: 'https://via.placeholder.com/150',
        wins: 5,
        losses: 2,
        gamesPlayed: 7,
        achievements: ['first_game', 'first_win']
      },
      {
        username: 'test_user2',
        email: 'test2@example.com',
        password: hashedPassword,
        avatar: 'https://via.placeholder.com/150',
        wins: 3,
        losses: 4,
        gamesPlayed: 7,
        achievements: ['first_game']
      },
      {
        username: 'test_user3',
        email: 'test3@example.com',
        password: hashedPassword,
        avatar: 'https://via.placeholder.com/150',
        wins: 4,
        losses: 3,
        gamesPlayed: 7,
        achievements: ['first_game', 'first_win']
      },
      {
        username: 'admin',
        email: 'admin@example.com',
        password: hashedAdminPassword,
        avatar: 'https://via.placeholder.com/150',
        isAdmin: true,
        wins: 10,
        losses: 0,
        gamesPlayed: 10,
        achievements: ['first_game', 'first_win', 'admin']
      }
    ];

    // Удаляем существующих пользователей
    await User.deleteMany({});

    // Создаем тестовых пользователей
    const createdUsers = await User.insertMany(users);

    console.log('Тестовые пользователи успешно созданы:', createdUsers);
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при создании тестовых пользователей:', error);
    process.exit(1);
  }
}

async function seedUsers() {
  try {
    // Хешируем пароли
    const hashedPassword = await bcrypt.hash('password123', 10);
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);

    // Тестовые пользователи
    const users = [
      {
        username: 'test_user1',
        email: 'test1@example.com',
        password: hashedPassword,
        avatar: 'https://via.placeholder.com/150',
        wins: 5,
        losses: 2,
        gamesPlayed: 7
      },
      {
        username: 'test_user2',
        email: 'test2@example.com',
        password: hashedPassword,
        avatar: 'https://via.placeholder.com/150',
        wins: 3,
        losses: 4,
        gamesPlayed: 7
      },
      {
        username: 'test_user3',
        email: 'test3@example.com',
        password: hashedPassword,
        avatar: 'https://via.placeholder.com/150',
        wins: 4,
        losses: 3,
        gamesPlayed: 7
      },
      {
        username: 'admin',
        email: 'admin@example.com',
        password: hashedAdminPassword,
        avatar: 'https://via.placeholder.com/150',
        isAdmin: true,
        wins: 10,
        losses: 0,
        gamesPlayed: 10
      }
    ];

    // Удаляем существующих пользователей
    await User.deleteMany({});

    // Создаем тестовых пользователей
    const createdUsers = await User.insertMany(users);

    console.log('Тестовые пользователи успешно созданы:', createdUsers);
  } catch (error) {
    console.error('Ошибка при создании тестовых пользователей:', error);
  }
}

// Запускаем скрипт при импорте
seedUsers();
