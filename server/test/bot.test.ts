import GameManager from '../src/game/gameManager';
import GameInstance from '../src/game/gameInstance';

describe('Bot integration', () => {
  test('add bot to room and ensure it exists in state', () => {
    const roomId = 'R_BOT';
    const g = GameManager.getOrCreateGame(roomId);
    g.addBotToRoom('AI-Goblin', 'easy');
    const players = Array.from((g as any).players.values()) as any[];
    expect(players.some(p => p.isBot)).toBe(true);
  });
});
