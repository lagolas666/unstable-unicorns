/**
 * D-2: каждый 4xx-ответ REST несёт строковое поле `code` в lowercase snake_case.
 *
 * Согласованный формат (Бэкенд, 11.11.2026): lowercase snake_case, т.е.
 * ServiceErrorCode 'NOT_YOUR_TURN' -> 'not_your_turn', 'CARD_NOT_IN_HAND' -> 'card_not_in_hand',
 * 'WRONG_PHASE' -> 'wrong_phase'. Guard'ы routes/game.ts уже пишут так.
 *
 * Тесты сверяют status, точное значение code и сохранение message/extra/gameOver/winnerId.
 */
import request from 'supertest';
import app from '../src/testApp';
import { games } from '../src/gameStore';

const uni = (id: string) => ({ id, name: id.toUpperCase(), type: 'basic_unicorn', effects: [] as any[] });

function state(over: any = {}) {
  return {
    players: [
      { id: 'p1', deck: [], hand: ['h1'], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
      { id: 'p2', deck: [], hand: ['h2'], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
    ],
    cards: { h1: uni('h1'), h2: uni('h2'), d1: uni('d1'), d2: uni('d2') },
    turn: { currentPlayerId: 'p1', phase: 'begin_turn', has_drawn: false },
    deck: ['d1', 'd2'],
    discard: [],
    ...over,
  };
}

async function seed(over: any = {}): Promise<string> {
  const r = await request(app).post('/api/game/test/create').send({ state: state(over) });
  if (r.status !== 200) throw new Error('seed failed ' + r.status + ' ' + JSON.stringify(r.body));
  return r.body.id as string;
}

beforeEach(() => {
  games.clear();
});

describe('D-2 REST: code в телах 4xx', () => {
  // Guard-путь роутов: уже работает, значения фиксируются как контракт.
  it('R01 game_not_found: 404 с code=game_not_found и message сохранён', async () => {
    const r = await request(app).post('/api/game/nope/draw').send({ playerId: 'p1' });
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('game_not_found');
    expect(r.body.message).toBe('Game not found');
  });

  it('R02 need_at_least_2_players: 400 с code и message', async () => {
    const r = await request(app).post('/api/game').send({ players: [{ id: 'solo' }] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('need_at_least_2_players');
    expect(r.body.message).toBe('Need at least 2 players');
  });

  it('R03 game_is_over: 409 с code, gameOver и winnerId сохранены', async () => {
    const id = await seed({ winnerId: 'p1' });
    const r = await request(app).post(`/api/game/${id}/endTurn`).send({});
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('game_is_over');
    expect(r.body.gameOver).toBe(true);
    expect(r.body.winnerId).toBe('p1');
  });

  // RED: сервисный путь fail() теряет code (gameService.ts:613 -> NOT_YOUR_TURN).
  it('R04 draw чужим игроком: 400, code=not_your_turn и message сохранён', async () => {
    const id = await seed();
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p2' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('not_your_turn');
    expect(r.body.message).toBe('Not your turn');
  });

  // RED: gameService.ts:629 -> CARD_NOT_IN_HAND.
  it('R05 play карты не из руки: 400, code=card_not_in_hand и message сохранён', async () => {
    const id = await seed({ turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true } });
    const r = await request(app).post(`/api/game/${id}/play`).send({ cardId: 'zzz' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('card_not_in_hand');
    expect(r.body.message).toBe('Card not in hand');
  });

  // RED: gameService.ts:619 -> WRONG_PHASE.
  it('R06 play не в action-фазе: 400, code=wrong_phase и message сохранён', async () => {
    const id = await seed();
    const r = await request(app).post(`/api/game/${id}/play`).send({ cardId: 'h1' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('wrong_phase');
    expect(r.body.message).toBe('Not in action phase');
  });

  // RED: gameService.ts:2252 отвечает напрямую, минуя fail(). Прямого ServiceErrorCode
  // у ветки нет; решением Аналитика 11.11.2026 введён code nothing_pending
  // (bad_request слишком общий, PENDING_ACTION означало бы "есть окно, которое мешает").
  it('R07 resolvePending без окна: 400, code=nothing_pending и message сохранён', async () => {
    const id = await seed();
    const r = await request(app).post(`/api/game/${id}/resolvePending`).send({});
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('nothing_pending');
    expect(r.body.message).toBe('Nothing pending');
  });

  // Контроль: guard-путь, code уже литералом; статус и тело не должны измениться.
  it('R08 discard в неверной фазе: 400 с code=discard_not_in_action_or_end_turn (контроль)', async () => {
    const id = await seed();
    const r = await request(app).post(`/api/game/${id}/discard`).send({ cardId: 'h1' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('discard_not_in_action_or_end_turn');
    expect(typeof r.body.message).toBe('string');
  });

  // Контроль: успешный ответ не обзаводится code.
  // Добор разрешён только в фазе begin_turn (draw вне неё -> 400 'Not in begin_turn').
  it('R09 успешный draw: 200 без поля code (контроль)', async () => {
    const id = await seed();
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(200);
    expect(r.body.code).toBeUndefined();
  });
});
