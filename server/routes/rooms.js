const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Create room
router.post('/', auth, async (req, res) => {
  try {
    const roomId = uuidv4();
    const { userId } = req.user;

    // Create room in Redis/Memory (создаем объект комнаты)
    const room = {
      id: roomId,
      host: userId,
      players: [userId],
      maxPlayers: 6,
      gameStarted: false,
      cards: [],
      discardPile: [],
      currentPlayer: null
    };

    // Сохраняем комнату в Redis/Memory
    // Здесь можно использовать Redis или другую систему хранения
    // Для простоты используем память
    global.rooms = global.rooms || {};
    global.rooms[roomId] = room;

    res.status(201).json({
      message: 'Room created successfully',
      roomId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating room', error: error.message });
  }
});

// Join room
router.post('/:roomId/join', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.user;

    const room = global.rooms[roomId];
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ message: 'Room is full' });
    }

    if (room.players.includes(userId)) {
      return res.status(400).json({ message: 'Already in room' });
    }

    room.players.push(userId);
    res.json({ message: 'Joined room successfully', room });
  } catch (error) {
    res.status(500).json({ message: 'Error joining room', error: error.message });
  }
});

// Invite user to room
router.post('/:roomId/invite/:userId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.user;
    const invitedUserId = req.params.userId;

    // Проверяем, является ли пользователь хостом
    const room = global.rooms[roomId];
    if (!room || room.host !== userId) {
      return res.status(403).json({ message: 'Only host can invite' });
    }

    // Проверяем, не находится ли пользователь уже в комнате
    if (room.players.includes(invitedUserId)) {
      return res.status(400).json({ message: 'User already in room' });
    }

    // Отправляем приглашение через Socket.IO
    io.to(invitedUserId).emit('roomInvitation', {
      roomId,
      hostId: userId
    });

    res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending invitation', error: error.message });
  }
});

module.exports = router;
