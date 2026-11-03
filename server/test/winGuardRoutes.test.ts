// Хвосты победы на уровне REST-роутов (routes/game.ts).
// Две точки писали winnerId безусловно:
//   L332 turnStart       — после эффектов начала хода
//   L831 playWithTargets — после розыгрыша с целями
// Фикстура: winnerId уже выставлен за p1, у p2 ровно порог единорогов.
// checkWin(state) возвращает 'p2' — незащищённая запись затирает p1.
//
// Почему отдельный файл: winGuard.test.ts бьёт по сервисному уровню (gameService),
// а эти две точки живут только в роутере и сервисным тестом не достигаются.

import request from 'supertest';
import express from 'express';
import gameRouter from '../src/routes/game';
import { checkWin } from '../src/gameService';

const app = express();
app.use(express.json());
app.use('/api/game', gameRouter);

const THRESHOLD = 7; // 2 игрока -> WIN_UNICORNS_BASE

function uni(id: string) {
  return { id, name: id.toUpperCase(), type: 'basic_unicorn', effects: [] };
}

function mkState(winnerId?: string) {
  const players = ['p1', 'p2'].map((id): any => ({
    id,
    deck: [],
    hand: [],
    discard: [],
    stable: [],
    nursery: [],
    field: [],
    action_points: 1,
  }));
  const cards: Record<string, any> = {};
  for (let i = 1; i <= 5; i++) {
    cards['a' + i] = uni('a' + i);
    players[0].stable.push('a' + i);
  }
  for (let i = 1; i <= THRESHOLD; i++) {
    cards['b' + i] = uni('b' + i);
    players[1].stable.push('b' + i);
  }
  return {
    players,
    cards,
    deck: ['z1', 'z2'], // непустая колода: отсекаем тайбрейк пустой колоды
    discard: [],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    ...(winnerId ? { winnerId } : {}),
  } as any;
}

async function createGame(state: any): Promise<string> {
  const res = await request(app).post('/api/game/test/create').send({ state });
  if (res.status !== 200) throw new Error('create failed: ' + res.status);
  return res.body.id as string;
}

afterEach(async () => {
  // чистим записи этого файла через собственный маркер id невозможно (id генерит сервер),
  // поэтому просто не накапливаем: каждая игра живёт до конца прогона, store in-memory
});

describe('Хвосты победы на REST-роутах: winnerId — защёлка (L332/L831)', () => {
  it('подготовка: checkWin на такой фикстуре отдаёт победу p2', () => {
    expect(checkWin(mkState('p1'))).toBe('p2');
  });

  it('L332 turnStart: p1 объявлен победителем, p2 догнал порог — winnerId остаётся p1', async () => {
    const state = mkState('p1');
    state.turn.phase = 'begin_turn';
    const id = await createGame(state);

    const res = await request(app).post(`/api/game/${id}/turnStart`).send({});
    // D1b: роутерный gameOverGate отсекает мёртвую партию до обработчика -> 409
    expect(res.status).toBe(409);
    expect(res.body.gameOver).toBe(true);
    expect(res.body.winnerId).toBe('p1');
  });

  it('L332 позитив: winnerId пуст — победа записывается', async () => {
    const state = mkState();
    state.turn.phase = 'begin_turn';
    const id = await createGame(state);

    const res = await request(app).post(`/api/game/${id}/turnStart`).send({});
    expect(res.status).toBe(200);
    expect(res.body.state.winnerId).toBe('p2');
  });

  it('L831 playWithTargets: p1 объявлен победителем, p2 догнал порог — winnerId остаётся p1', async () => {
    const state = mkState('p1');
    state.cards['c1'] = { id: 'c1', name: 'Plain Magic', type: 'magic', effects: [] };
    state.players[0].hand = ['c1'];
    const id = await createGame(state);

    const res = await request(app).post(`/api/game/${id}/playWithTargets`).send({ cardId: 'c1', targets: [] });
    // D1b: gameOverGate отдаёт 409 { gameOver, winnerId } до вызова обработчика
    expect(res.status).toBe(409);
    expect(res.body.gameOver).toBe(true);
    expect(res.body.winnerId).toBe('p1');
  });

  it('L831 позитив: winnerId пуст — победа записывается', async () => {
    const state = mkState();
    state.cards['c1'] = { id: 'c1', name: 'Plain Magic', type: 'magic', effects: [] };
    state.players[0].hand = ['c1'];
    const id = await createGame(state);

    const res = await request(app).post(`/api/game/${id}/playWithTargets`).send({ cardId: 'c1', targets: [] });
    expect(res.status).toBe(200);
    expect(res.body.winnerId).toBe('p2');
  });
});
