import { Router } from 'express';
import LobbyStore from '../lobbyStore';

const router = Router();

// List all lobby rooms
router.get('/rooms', (req, res) => {
  res.json(LobbyStore.getRooms());
});

// Create a new lobby room
router.post('/create', (req, res) => {
  const { name, maxPlayers } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const room = LobbyStore.createRoom(String(name), Number(maxPlayers) || 8);
  res.json(room);
});

// Join a room
router.post('/join', (req, res) => {
  const { roomId, playerId } = req.body || {};
  if (!roomId || !playerId) return res.status(400).json({ error: 'roomId and playerId required' });
  const room = LobbyStore.joinRoom(String(roomId), String(playerId));
  if (!room) return res.status(400).json({ error: 'Unable to join room' });
  res.json(room);
});

// Leave a room
router.post('/leave', (req, res) => {
  const { roomId, playerId } = req.body || {};
  if (!roomId || !playerId) return res.status(400).json({ error: 'roomId and playerId required' });
  const room = LobbyStore.leaveRoom(String(roomId), String(playerId));
  if (!room) return res.status(400).json({ error: 'Unable to leave room' });
  res.json(room);
});

// Start a game in the lobby
router.post('/start', (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  const room = LobbyStore.startRoom(String(roomId));
  if (!room) return res.status(400).json({ error: 'Unable to start' });
  res.json(room);
});

export default router;
