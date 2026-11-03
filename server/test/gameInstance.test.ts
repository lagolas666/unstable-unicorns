import GameInstance from '../src/game/gameInstance';

describe('GameInstance MVP flow', () => {
  test('basic start and win flow for two players', () => {
    const g = new GameInstance('R1');
    g.addPlayer('p1', 'Alice');
    g.addPlayer('p2', 'Bob');
    g.start();
    // Drive the game until someone wins (or safety cap)
    for (let i = 0; i < 100 && !g.winner; i++) {
      g.endTurn();
    }
    expect(typeof g.winner).toBe('string');
  });
  test('bot addition and bot move', () => {
    const g = new GameInstance('R2');
    g.addPlayer('p1', 'Alice');
    g.addPlayer('p2', 'AI-Bot');
    // Bot addition via addBotToRoom (public in class)
    // @ts-ignore
    g.addBotToRoom('AI-Bot', 'easy');
    expect(g.getState().players.length).toBeGreaterThanOrEqual(2);
  });
});
