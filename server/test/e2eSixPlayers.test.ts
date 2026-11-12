// E2E партия на 6 игроков: каталог v2 в рантайме, порог победы 6, лимит руки 7,
// фазы хода, окно Neigh, пустая колода. Только публичные REST-входы, без моков движка.
//
// Кейсы A3 и A5 приведены к рулингам Аналитика (06.11.2026):
//   BUG-01 (A3): при руке 8 ход не передаётся, открывается окно выбора await_choice/hand_limit,
//                рука и сброс меняются только после выбора игрока — автосброса нет.
//   BUG-02 (A5): отменённая Neigh карта возвращается в руку вместо сброса.
// Ожидания в них написаны по правилам, а не по факту: после фикса движка они зеленеют.
import request from 'supertest';
import app from '../src/testApp';
import { createGame, getState, reactNeigh, resolvePending } from './helpers/api';
import { baseTurn, gameState, player, unicorn } from './helpers/state';

const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

// Малыш — тоже единорог и засчитывается к победе (countUnicornsForWin), поэтому
// при n базовых единорогах в стойле счёт равен n + 1.
// Колода непустая намеренно: при пустых колоде и сбросе checkWin (L234) включает
// тай-брейкер по числу единорогов и выдаёт победителя в обход порога.
const sixPlayersWith = (basic: number) => {
  const stable = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].slice(0, basic);
  const cards: Record<string, any> = {
    baby1: { id: 'baby1', type: 'baby_unicorn', name: 'Малыш', source_zone: 'nursery_only' },
    u9: unicorn('u9'),
    filler: { id: 'filler', type: 'magic', name: 'filler' },
  };
  for (const id of stable) cards[id] = unicorn(id);
  return gameState({
    players: [
      player({ id: 'p1', stable: [...stable, 'baby1'] }),
      player({ id: 'p2', stable: ['u9'] }),
      player({ id: 'p3' }),
      player({ id: 'p4' }),
      player({ id: 'p5' }),
      player({ id: 'p6' }),
    ],
    cards,
    turn: baseTurn('p1', 'action', true),
    deck: ['filler', 'filler'],
  });
};

describe('E2E: партия на 6 игроков (каталог v2)', () => {
  it('A1. Стартовая раздача: у каждого Малыш из Ясель, по 5 карт в руке, Малышей нет в основной колоде', async () => {
    const res = await request(app)
      .post('/api/game')
      .send({ players: ids.map((id) => ({ id })) });
    expect(res.status).toBe(201);
    const { state } = res.body;

    expect(state.players).toHaveLength(6);
    for (const p of state.players) {
      expect(p.stable).toHaveLength(1);
      expect(state.cards[p.stable[0]].source_zone).toBe('nursery_only');
      expect(p.hand).toHaveLength(5);
    }
    // Один и тот же экземпляр Малыша не может стоять у двух игроков.
    const babies = state.players.map((p: any) => p.stable[0]);
    expect(new Set(babies).size).toBe(6);
    // Карты Ясель не попадают ни в колоду добора, ни в стартовые руки.
    for (const cid of state.deck) expect(state.cards[cid].source_zone).not.toBe('nursery_only');
    for (const p of state.players) {
      for (const cid of p.hand) expect(state.cards[cid].source_zone).not.toBe('nursery_only');
    }
    // Каталог v2 в рантайме, а не тест-сид из 5 карт.
    expect(Object.keys(state.cards).length).toBeGreaterThan(300);
  });

  it('A2. Порог победы на 6 игроков: 6 засчитанных единорогов — победа, 5 — нет', async () => {
    // 5 базовых + Малыш = 6 при пороге 6 → победа.
    const win = await createGame(sixPlayersWith(5));
    const resWin = await request(app).post(`/api/game/${win}/endTurn`).send();
    expect(resWin.status).toBe(200);
    expect(resWin.body.winnerId).toBe('p1');

    // 4 базовых + Малыш = 5 при пороге 6 → победы нет.
    const noWin = await createGame(sixPlayersWith(4));
    const resNoWin = await request(app).post(`/api/game/${noWin}/endTurn`).send();
    expect(resNoWin.status).toBe(200);
    expect(resNoWin.body.winnerId).toBeUndefined();
  });

  it('A3. Лимит руки 7: открывается окно выбора, автосброса нет (BUG-01)', async () => {
    // Рулинг Аналитика: endTurn при руке 8 не сбрасывает карту за игрока и не передаёт ход.
    // Он открывает окно выбора (await_choice / hand_limit, remaining=1), рука и сброс
    // остаются нетронутыми до выбора; после выбора hand=7, выбранная карта в сбросе, ход у p2.
    const hand = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'];
    const cards: Record<string, any> = { filler: { id: 'filler', type: 'magic', name: 'filler' } };
    for (const id of hand) cards[id] = { id, type: 'magic', name: id };
    const gid = await createGame(
      gameState({
        players: [player({ id: 'p1', hand }), player({ id: 'p2' })],
        cards,
        turn: baseTurn('p1', 'end', true),
        deck: ['filler'],
      })
    );

    const res = await request(app).post(`/api/game/${gid}/endTurn`).send();
    expect(res.status).toBe(200);
    // Роут /endTurn отдаёт окно в теле ответа как { pending, state } (routes/game.ts L927-943).
    const window = await request(app).get(`/api/game/test/state/${gid}`).send();
    expect(window.status).toBe(200);
    expect(window.body.pending).toBeTruthy();
    expect(window.body.pending.kind).toBe('await_choice');
    expect(window.body.pending.purpose).toBe('hand_limit');
    expect(window.body.pending.chooserId).toBe('p1');
    expect(window.body.pending.remaining).toBe(1);
    // Транспорт живой: окно приходит в теле ответа /endTurn вместе с состоянием.
    expect(res.body.pending).toBeTruthy();
    expect(res.body.pending.kind).toBe('await_choice');
    expect(res.body.pending.purpose).toBe('hand_limit');
    expect(res.body.pending.chooserId).toBe('p1');
    expect(res.body.pending.remaining).toBe(1);
    expect(res.body.state.turn.currentPlayerId).toBe('p1');
    expect(res.body.state.players[0].hand).toHaveLength(8);

    // До выбора ничего не сброшено и ход не передан.
    const before = await getState(gid);
    expect(before.turn.currentPlayerId).toBe('p1');
    expect(before.players[0].hand).toHaveLength(8);
    expect(before.players[0].discard).toHaveLength(0);

    // Отказ от выбора (resolvePending без cardId) ход не передаёт.
    const declined = await resolvePending(gid);
    expect(declined.status).toBe(400);
    const afterDecline = await getState(gid);
    expect(afterDecline.turn.currentPlayerId).toBe('p1');
    expect(afterDecline.players[0].hand).toHaveLength(8);

    // Выбор карты закрывает окно: hand=7, выбранная карта в сбросе, ход у p2.
    const chosen = await request(app)
      .post(`/api/game/${gid}/resolvePending`)
      .send({ cardId: 'h8' });
    expect(chosen.status).toBe(200);
    const after = await getState(gid);
    expect(after.turn.currentPlayerId).toBe('p2');
    expect(after.players[0].hand).toHaveLength(7);
    expect(after.players[0].hand).not.toContain('h8');
    expect(after.players[0].discard).toContain('h8');
  });

  it('A4. Фазы: повторный добор после добора запрещён', async () => {
    const cards: Record<string, any> = {
      h1: { id: 'h1', type: 'magic', name: 'h1' },
      d1: { id: 'd1', type: 'magic', name: 'd1' },
      d2: { id: 'd2', type: 'magic', name: 'd2' },
    };
    const gid = await createGame(
      gameState({
        players: [player({ id: 'p1', hand: ['h1'] }), player({ id: 'p2' })],
        cards,
        turn: baseTurn('p1', 'begin_turn', false),
        deck: ['d1', 'd2'],
      })
    );
    const first = await request(app).post(`/api/game/${gid}/draw`).send({ playerId: 'p1' });
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/game/${gid}/draw`).send({ playerId: 'p1' });
    // Добор разрешён только в begin_turn, после первого добора фаза уже action.
    expect(second.status).toBe(400);
    expect(String(second.body.message)).toMatch(/begin_turn/i);

    const state = await getState(gid);
    expect(state.players[0].hand).toHaveLength(2); // второй карты не прибавилось
    expect(state.turn.phase).toBe('action');
  });

  it('A5. Окно Neigh: отменённая карта уходит в сброс и не попадает в стойло (BUG-02)', async () => {
    // Neigh: «Stop that player's card from being played and send it to the discard pile» —
    // то есть отменённая карта идёт в сброс владельца, а не возвращается в руку.
    // Факт: таймер окна и resolvePending (gameService.ts L71-77) карту не переносят,
    // она остаётся в руке актора: hand=["u1"], discard=[].
    const cards: Record<string, any> = {
      u1: unicorn('u1'),
      neigh: { id: 'neigh', type: 'instant', name: 'Neigh', instant_subtype: 'neigh' },
    };
    const gid = await createGame(
      gameState({
        players: [
          player({ id: 'p1', hand: ['u1'] }),
          player({ id: 'p2', hand: ['neigh'] }),
        ],
        cards,
        turn: baseTurn('p1', 'action', true),
        deck: ['filler'],
      })
    );
    const played = await request(app).post(`/api/game/${gid}/playWithWindow`).send({ cardId: 'u1' });
    expect(played.status).toBe(200);
    expect(played.body.pending).toBeTruthy();
    expect(played.body.pending.uncounterable).toBe(false);

    const neighed = await reactNeigh(gid, 'p2', 'neigh');
    expect(neighed.status).toBe(200);
    expect(neighed.body.pending.cancelLevel).toBe(1);

    // Окно закрывается по таймеру или явным resolvePending.
    const closed = await resolvePending(gid);
    expect(closed.status).toBe(200);

    const state = await getState(gid);
    expect(state.players[0].stable).not.toContain('u1');
    expect(state.players[0].discard).toContain('u1');
    expect(state.players[0].hand).not.toContain('u1');
    expect(state.players[1].discard).toContain('neigh'); // Neigh израсходован
  });

  it('A6. Пустая колода и пустой сброс: победитель — игрок с максимумом единорогов', async () => {
    const cards: Record<string, any> = { u1: unicorn('u1'), u2: unicorn('u2') };
    const gid = await createGame(
      gameState({
        players: [
          player({ id: 'p1', stable: ['u1'] }),
          player({ id: 'p2', stable: ['u2'] }),
          player({ id: 'p3' }),
        ],
        cards,
        turn: baseTurn('p2', 'begin_turn', false),
        deck: [],
        discard: [],
      })
    );
    const res = await request(app).post(`/api/game/${gid}/draw`).send({ playerId: 'p2' });
    expect(res.status).toBe(200);
    const state = await getState(gid);
    // p1 и p2 равны по единорогам — победителем объявлен один из лидеров, но не p3.
    expect(['p1', 'p2']).toContain(state.winnerId);
  });
});
