import request from 'supertest';
import app from '../src/testApp';
import { games } from '../src/gameStore';
import { createGame, getState } from './helpers/api';

// BUG-01: лимит руки. Рука 8 при лимите 7 — endTurn НЕ завершает ход и не сбрасывает
// карту за игрока: открывается окно await_choice purpose 'hand_limit' (gameService
// openHandLimitWindow L835-853), выбор делает только игрок.
//
// Два уровня проверки:
//  1) транспорт — POST /api/game/:id/endTurn отдаёт окно в теле ответа ({pending, state}),
//     иначе клиент не узнаёт, что от него ждут выбора (routes/game.ts L941-943);
//  2) таймер — по истечении окна schedulePendingResolution ветка purpose==='hand_limit'
//     (gameService L77-80) карту не выбирает, окно не закрывает, ход не передаёт.
//
// Таймер ждём 7 с: срок окна — HAND_LIMIT_WINDOW_MS = 5000.

const LIMIT = 7;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

jest.setTimeout(40000);

function buildGame() {
  const hand = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'];
  const cards: Record<string, any> = {};
  for (const id of hand) cards[id] = { id, type: 'upgrade', name: id, effects: [] };
  cards.u1 = { id: 'u1', type: 'basic_unicorn', name: 'U1', effects: [] };
  return {
    players: [
      { id: 'p1', hand: hand.slice(), stable: ['u1'], discard: [], nursery: [], flags: {} },
      { id: 'p2', hand: [], stable: [], discard: [], nursery: [], flags: {} },
    ],
    cards,
    turn: { number: 1, currentPlayerId: 'p1', phase: 'action', action_points: 1, has_drawn: true, skippedPhases: [] },
    deck: ['d1', 'd2', 'd3'],
    discard: [],
    nursery: [],
    flags: {},
  };
}

const pendingOf = (gameId: string) => (games.get(gameId) as any)?.pending;
const playerIn = (state: any, id: string) => state.players.find((p: any) => p.id === id);

describe('BUG-01: лимит руки через REST endTurn и таймер окна', () => {
  test('R1: endTurn при руке 8/7 — 200, окно hand_limit в теле ответа, ход не передан', async () => {
    const gameId = await createGame(buildGame());

    const res = await request(app).post(`/api/game/${gameId}/endTurn`);
    expect(res.status).toBe(200);

    // Транспорт: окно приходит в теле, а не тонет в сторе.
    const pending = res.body.pending;
    expect(pending).toBeTruthy();
    expect(pending.kind).toBe('await_choice');
    expect(pending.purpose).toBe('hand_limit');
    expect(pending.chooserId).toBe('p1');
    expect(pending.remaining).toBe(1);
    expect(Array.isArray(pending.options)).toBe(true);
    expect(pending.options).toHaveLength(8);

    // Состояние в том же ответе уже показывает ход у p1.
    expect(res.body.state.turn.currentPlayerId).toBe('p1');
    expect(playerIn(res.body.state, 'p1').hand).toHaveLength(8);
    expect(playerIn(res.body.state, 'p1').discard).toHaveLength(0);

    // И в сторе то же окно — клиент и сервер не расходятся.
    expect(pendingOf(gameId).purpose).toBe('hand_limit');
  });

  test('R2: таймер окна не сбрасывает карту за игрока и не передаёт ход', async () => {
    const gameId = await createGame(buildGame());
    const res = await request(app).post(`/api/game/${gameId}/endTurn`);
    expect(res.status).toBe(200);

    const entry: any = games.get(gameId);
    const opened = entry.pending;
    expect(opened.purpose).toBe('hand_limit');

    // Срок окна — 5 с. Пережидаем заведомо дольше и убеждаемся, что дедлайн прошёл,
    // иначе проверки ниже были бы пустыми.
    expect(Number(opened.expiresAt)).toBeGreaterThan(0);
    await sleep(7000);
    expect(Date.now()).toBeGreaterThan(Number(opened.expiresAt));

    const state: any = await getState(gameId);
    const p1 = playerIn(state, 'p1');
    expect(p1.hand).toHaveLength(8);
    expect(p1.discard).toHaveLength(0);
    expect(state.turn.currentPlayerId).toBe('p1');
    // Окно живо: таймер его не закрыл.
    expect(pendingOf(gameId)).toBeTruthy();
    expect(pendingOf(gameId).purpose).toBe('hand_limit');
  });

  test('R3: повторный endTurn не дублирует эффекты конца хода и отдаёт то же окно', async () => {
    const gameId = await createGame(buildGame());
    const first = await request(app).post(`/api/game/${gameId}/endTurn`);
    expect(first.status).toBe(200);

    const entry: any = games.get(gameId);
    const endLogs = () => entry.logs.filter((l: any) => l.type === 'end').length;
    const endsAfterFirst = endLogs();

    const second = await request(app).post(`/api/game/${gameId}/endTurn`);
    expect(second.status).toBe(200);
    expect(second.body.pending.purpose).toBe('hand_limit');
    // Окно переоткрывается с теми же параметрами, а не копится новыми.
    expect(second.body.pending.remaining).toBe(1);
    expect(second.body.pending.chooserId).toBe('p1');
    // Эффекты конца хода повторно не исполнялись.
    expect(endLogs()).toBe(endsAfterFirst);
    expect(playerIn(second.body.state, 'p1').hand).toHaveLength(8);
  });

  test('R4: выбор игрока закрывает окно — рука 7, карта в сбросе, ход у p2', async () => {
    const gameId = await createGame(buildGame());
    const opened = await request(app).post(`/api/game/${gameId}/endTurn`);
    expect(opened.status).toBe(200);

    const picked = await request(app)
      .post(`/api/game/${gameId}/resolvePending`)
      .send({ cardId: 'h3' });
    expect(picked.status).toBe(200);

    const state: any = await getState(gameId);
    const p1 = playerIn(state, 'p1');
    expect(p1.hand).toHaveLength(LIMIT);
    expect(p1.hand).not.toContain('h3');
    expect(p1.discard).toEqual(['h3']);
    expect(state.turn.currentPlayerId).toBe('p2');
    expect(pendingOf(gameId)).toBeFalsy();
  });
});
