// Контракт REST-хвоста POST /api/game/:id/react/objection.
// Движок (reactObjection) был готов и покрыт, роута не существовало —
// вызывать Objection из веб-клиента было нельзя.

import request from 'supertest';
import express from 'express';
import gameRouter from '../src/routes/game';

const app = express();
app.use(express.json());
app.use('/api/game', gameRouter);

function mkState(over: any = {}) {
  return {
    players: ['p1', 'p2'].map((id) => ({
      id, deck: [], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1,
    })),
    cards: {},
    deck: ['z1'],
    discard: [],
    turn: { currentPlayerId: 'p2', phase: 'action', has_drawn: false },
    ...over,
  } as any;
}

async function createGame(state: any, pending?: any): Promise<string> {
  const res = await request(app).post('/api/game/test/create').send({ state });
  if (res.status !== 200) throw new Error('create failed: ' + res.status);
  const id = res.body.id as string;
  if (pending !== undefined) {
    const set = await request(app).post(`/api/game/test/set/${id}`).send({ state: { pending } });
    if (set.status !== 200) throw new Error('set pending failed: ' + set.status);
  }
  return id;
}

describe('POST /api/game/:id/react/objection', () => {
  it('маршрут существует и без окна реакции отказывает 400, а не 404', async () => {
    const id = await createGame(mkState());
    const res = await request(app).post(`/api/game/${id}/react/objection`).send({ byPlayerId: 'p1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No pending action');
  });

  it('неизвестная игра -> 404 (маршрут резолвится в движок, а не в 404 роутера)', async () => {
    const res = await request(app).post('/api/game/no-such/react/objection').send({ byPlayerId: 'p1' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Game not found');
  });

  it('окно есть, но никто не Ржал -> 400 No Neigh to object to', async () => {
    const state = mkState();
    state.cards['m1'] = { id: 'm1', name: 'Plain Magic', type: 'magic', effects: [] };
    const pending = { kind: 'play', actorId: 'p2', cardId: 'm1', cancelLevel: 0, expiresAt: Date.now() + 60000 };
    const id = await createGame(state, pending);
    const res = await request(app).post(`/api/game/${id}/react/objection`).send({ byPlayerId: 'p1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No Neigh to object to');
  });
});
