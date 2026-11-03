import { Router } from 'express';
import GameManager from '../game/gameManager';
import { Server as SocketIOServer } from 'socket.io';

const router = Router();

// Simple battle simulation endpoint
router.post('/sim', (req, res) => {
  const io = (req.app as any).get('io') as SocketIOServer | undefined;
  const { bots } = req.body || {};
  const roomId = `SIM_${Date.now()}`;
  const g = GameManager.getOrCreateGame(roomId, io);
  // Clear existing players if any (best effort)
  // Add bots from request or default roaster
  const botsList = Array.isArray(bots) && bots.length > 0 ? bots : [
    { nickname: 'AI-Dragon', difficulty: 'easy' },
  ];
  botsList.forEach((b: any) => {
    const name = b.nickname || 'AI-Dragon';
    const diff = (b.difficulty as 'easy'|'normal'|'hard') || 'easy';
    g.addBotToRoom(name, diff);
  });
  g.start();
  const timeline = g.simulateTimeline(200);
  res.json({ roomId, winner: timeline.winner, turns: timeline.turns, timeline: timeline.timeline });
});

export default router;
