// ТЗ docs/tz-nursery-zone.md: Ясли и стартовый стойл определяются признаком данных
// card.source_zone === 'nursery_only', а не типом baby_unicorn (у 42 карт-действий type=baby_unicorn).
// Тест идёт через публичный REST POST /api/game и читает состояние из gameStore.

import request from 'supertest';
import app from '../src/testApp';
import * as store from '../src/gameStore';

const NURSERY_FLAG = 'nursery_only';

function isFlagged(cardId: string, state: any): boolean {
  const card = state.cards?.[cardId];
  return !!card && String(card.source_zone || '') === NURSERY_FLAG;
}

async function createGame(): Promise<{ id: string; state: any }> {
  const res = await request(app)
    .post('/api/game')
    .send({ players: [{ id: 'p1' }, { id: 'p2' }] });
  expect(res.status).toBe(201);
  const id: string = res.body.id || res.body.gameId || res.body.game?.id;
  expect(typeof id).toBe('string');
  const entry: any = store.games.get(id);
  expect(entry).toBeDefined();
  return { id, state: entry.state };
}

describe('Ясли и стартовый стойл по флагу source_zone=nursery_only', () => {
  beforeEach(() => store.games.clear());

  it('(а) в Яслях нет карт без source_zone=nursery_only', async () => {
    const { state } = await createGame();
    const bad = (state.nursery as string[]).filter((cid) => !isFlagged(cid, state));
    expect(bad).toEqual([]);
  });

  it('(б) стартовый стойл каждого игрока — только карты с source_zone=nursery_only', async () => {
    const { state } = await createGame();
    for (const ps of state.players) {
      const bad = (ps.stable as string[]).filter((cid) => !isFlagged(cid, state));
      expect({ player: ps.id, bad }).toEqual({ player: ps.id, bad: [] });
    }
  });

  it('(в) в основной колоде нет карт с source_zone=nursery_only', async () => {
    const { state } = await createGame();
    const bad = (state.deck as string[]).filter((cid) => isFlagged(cid, state));
    expect(bad).toEqual([]);
  });
});
