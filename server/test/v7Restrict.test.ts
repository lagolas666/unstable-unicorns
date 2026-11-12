import { playCard } from '../src/gameService';
import { games } from '../src/gameStore';
import { createGame } from './helpers/api';
import catalog from '../data/catalog.v2.json';

afterEach(() => {
  for (const entry of games.values()) if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
  games.clear();
});

test('restrict_action запрещает разыгрывать заклинание владельцу источника', async () => {
  const bubble: any = (catalog as any[]).find(c => c.id === 'anti_magic_bubble_downgrade');
  const spell = { id: 'spell', type: 'magic', effects: [] };
  const mkPlayer = (id: string): any => ({ id, deck: [], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1 });
  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  p1.hand = [spell.id];
  p1.stable = [bubble.id];
  const id = await createGame({ players: [p1, p2], cards: { [bubble.id]: bubble, spell }, deck: [], discard: [], turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true } });
  const result = await playCard(id, 'p1', 'spell');
  expect(result.ok).toBe(false);
  expect(games.get(id)!.state.players[0].hand).toContain('spell');
});
