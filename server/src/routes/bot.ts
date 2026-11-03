import { Router } from 'express';
import gameManager from '../game/gameManager';

const router = Router();

// Add a bot to an existing room
router.post('/add', (req, res) => {
  const { roomId, nickname, difficulty } = req.body || {};
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  const name = nickname || 'AI-Dragon';
  const diff = (difficulty as 'easy'|'normal'|'hard') || 'easy';
  // Ensure the game exists and bot is added
  const io = (req.app as any).get('io') as any;
  const g = gameManager.getOrCreateGame(roomId, io);
  g.addBotToRoom(name, diff);
  res.json({ roomId, bot: name, difficulty: diff });
});

export default router;
