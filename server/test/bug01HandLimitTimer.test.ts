import { games } from '../src/gameStore';
import { endTurn } from '../src/gameService';
import { EventBus } from '../src/engine/events';

function mkPlayer(id: string, extra: any = {}) {
  return {
    id, deck: [], hand: [], discard: [], stable: [], nursery: [], field: [],
    action_points: 1, ...extra,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

jest.setTimeout(30000);

// Страж BUG-01, ветка таймера schedulePendingResolution (gameService.ts L72-75):
// окно purpose 'hand_limit' по истечении срока карту за игрока НЕ выбирает,
// окно не закрывает и ход не передаёт. Регресс сюда проходил бы при зелёном гейте,
// потому что ни один другой сьют не пережидает 5-секундный таймер окна.
test('BUG-01: таймер окна hand_limit не автоподбирает карту и не передаёт ход', async () => {
  const state: any = {
    players: [mkPlayer('p1', { hand: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }), mkPlayer('p2')],
    cards: { filler: { id: 'filler', type: 'magic', name: 'filler' } },
    deck: ['filler'], discard: [],
    turn: { currentPlayerId: 'p1', phase: 'end', has_drawn: false },
  };
  const id = 'g-bug01-timer-' + Math.random().toString(36).slice(2);
  games.set(id, { state, bus: new EventBus(), logs: [], pending: null } as any);
  const entry: any = games.get(id);

  // Рука 8 при лимите 7: ход не должен завершиться без выбора игрока.
  const res: any = await endTurn(id);
  expect(res.ok).toBe(true);
  expect(entry.pending).toBeTruthy();
  expect(entry.pending.purpose).toBe('hand_limit');
  expect(entry.pending.remaining).toBe(1);
  expect(entry.pending.chooserId).toBe('p1');

  // Срок окна — 5000 мс. Пережидаем заведомо дольше и убеждаемся,
  // что дедлайн действительно прошёл (иначе проверка ниже была бы пустой).
  const deadline = Number(entry.pending.expiresAt);
  expect(deadline).toBeGreaterThan(0);
  await sleep(6000);
  expect(Date.now()).toBeGreaterThan(deadline);

  // Окно живо: карта не выбрана, ход никому не передан.
  expect(entry.pending).toBeTruthy();
  expect(entry.pending.purpose).toBe('hand_limit');
  expect(entry.pending.remaining).toBe(1);
  expect(entry.state.players[0].hand).toHaveLength(8);
  expect(entry.state.players[0].discard).toHaveLength(0);
  expect(entry.state.turn.currentPlayerId).toBe('p1');

  // Окно осталось рабочим: выбор игрока по-прежнему проходит штатным путём.
  const { resolvePendingNow } = await import('../src/gameService');
  const picked: any = await resolvePendingNow(id, { playerId: 'p1', cardId: 'h' });
  expect(picked.ok).toBe(true);
  expect(entry.pending).toBeFalsy();
  expect(entry.state.players[0].hand).toHaveLength(7);
  expect(entry.state.players[0].discard).toEqual(['h']);
  expect(entry.state.turn.currentPlayerId).toBe('p2');
});
