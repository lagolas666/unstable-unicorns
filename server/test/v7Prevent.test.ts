import { playCard } from '../src/gameService';
import { games } from '../src/gameStore';
import { createGame } from './helpers/api';
import catalog from '../data/catalog.v2.json';

afterEach(() => {
  for (const entry of games.values()) if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
  games.clear();
});

test('prevent запрещает разыгрывать базового единорога, пока источник в стойле', async () => {
  const queen: any = (catalog as any[]).find(c => c.id === 'queen_bee_unicorn_magic');
  const basic = { id: 'basic', type: 'basic_unicorn', effects: [] };
  const mkPlayer = (id: string): any => ({ id, deck: [], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1 });
  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  p1.hand = [basic.id];
  p2.stable = [queen.id];
  const id = await createGame({ players: [p1, p2], cards: { [queen.id]: queen, basic }, deck: [], discard: [], turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true } });
  const result = await playCard(id, 'p1', 'basic');
  expect(result.ok).toBe(false);
  expect(games.get(id)!.state.players[0].hand).toContain('basic');
});
