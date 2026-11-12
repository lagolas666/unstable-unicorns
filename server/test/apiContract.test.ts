/**
 * Контракт REST + socket (docs/API_CONTRACT.md, обновление 11.11.2026).
 *
 * Принцип: тест фиксирует то, что сервер РЕАЛЬНО отдаёт. Тела ответов сняты пробником
 * 11.11.2026 с живого Express + routes/game.ts, а не переписаны из документа.
 * Места, где документ расходится с кодом, помечены «РАСХОЖДЕНИЕ D-n» — они утверждают
 * факт кода, а не текст документа. Править код или документ — решение Аналитика.
 *
 * Фикстуры: deck непустой (['z1','z2']), иначе правило «колода и сброс пусты → победа»
 * (engine/leader.ts) выставит winnerId сразу и сломает сценарий.
 */
import express from 'express';
import request from 'supertest';
import gameRouter from '../src/routes/game';
import { games } from '../src/gameStore';
import { registerSocketHandlers } from '../src/socket/handlers';

// --- фейковый socket.io (как в socketAckExtra.test.ts) ----------------------

class FakeIo {
  public connectionHandler: ((socket: FakeSocket) => void) | null = null;
  on(event: string, handler: (socket: FakeSocket) => void) {
    if (event === 'connection') this.connectionHandler = handler;
    return this;
  }
  to(_room: string) {
    return { emit: (_e: string, _p: any) => undefined };
  }
  connect(socket: FakeSocket): FakeSocket {
    if (!this.connectionHandler) throw new Error('no connection handler');
    this.connectionHandler(socket);
    return socket;
  }
}

class FakeSocket {
  public id: string;
  public rooms = new Set<string>();
  public handlers = new Map<string, (...args: any[]) => void>();
  constructor(id = 'socket-1') {
    this.id = id;
  }
  on(event: string, handler: (...args: any[]) => void) {
    this.handlers.set(event, handler);
    return this;
  }
  join(room: string) {
    this.rooms.add(room);
  }
  leave(room: string) {
    this.rooms.delete(room);
  }
  emit() {
    return this;
  }
  to() {
    return { emit: () => undefined };
  }
  trigger(event: string, payload: any): Promise<any> {
    const handler = this.handlers.get(event);
    if (!handler) return Promise.reject(new Error(`handler "${event}" not registered`));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`ack timeout for "${event}"`)), 2000);
      try {
        handler(payload, (res: any) => {
          clearTimeout(timer);
          resolve(res);
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }
}

// --- тестовое приложение ----------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/game', gameRouter);
const io = new FakeIo();
(app as any).set('io', io);

/** Коды, реально пришедшие в ack за прогон — база для проверки union (см. последний describe). */
const observedCodes = new Set<string>();

// Карты: копии эффектов из server/data/catalog.v2.json (поля name_en/md_num опущены).
const BASIC = 'c_basic_1';
const DOWNGRADE = 'c_down_1';
const POISON = 'unicorn_poison_spell';
const SWAP = 'dirty_deal_spell';
const VICTIM = 'u_victim_1';

const POISON_CARD = {
  id: POISON,
  name: 'Яд для единорогов',
  type: 'magic',
  effects: [
    {
      trigger: 'on_play',
      actions: [
        {
          kind: 'destroy',
          target_player: 'chosen',
          target: { scope: 'any', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { value: 1 } },
        },
      ],
    },
  ],
};

const SWAP_CARD = {
  id: SWAP,
  name: 'Нечестная сделка',
  type: 'magic',
  effects: [
    {
      trigger: 'on_play',
      actions: [
        {
          kind: 'swap',
          target_player: 'self',
          target: { scope: 'self', zone: 'hand', filters: { card_group: 'any' }, quantity: { value: 99 } },
          destination_player: 'chosen',
          destination: 'hand',
        },
      ],
    },
  ],
};

function player(id: string, over: Partial<any> = {}) {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    stable: [],
    nursery: [],
    field: [],
    action_points: 1,
    ...over,
  };
}

/** Базовая партия: p1 в фазе action, колода непустая (см. шапку файла). */
async function seedGame(
  over: {
    hand?: string[];
    cards?: Record<string, any>;
    p1?: Partial<any>;
    p2?: Partial<any>;
    turn?: any;
    winnerId?: string;
  } = {}
) {
  const state: any = {
    players: [
      player('p1', { hand: over.hand ?? [], ...(over.p1 ?? {}) }),
      player('p2', { stable: [VICTIM], ...(over.p2 ?? {}) }),
    ],
    cards: over.cards ?? {},
    turn: over.turn ?? { currentPlayerId: 'p1', phase: 'action', has_drawn: true },
    deck: ['z1', 'z2'],
    discard: [],
  };
  if (over.winnerId) state.winnerId = over.winnerId;
  const res = await request(app).post('/api/game/test/create').send({ state });
  expect(res.status).toBe(200);
  return res.body.id as string;
}

/** Обёртка над trigger: запоминает код каждого отказа, чтобы проверить его принадлежность union. */
async function ack(sock: FakeSocket, event: string, payload: any) {
  const res = await sock.trigger(event, payload);
  if (res && res.ok === false && typeof res.code === 'string') observedCodes.add(res.code);
  return res;
}

function basicUnicorn(id: string) {
  return { id, name: id, type: 'basic_unicorn', effects: [] };
}

beforeEach(() => {
  games.clear();
});

// --- 1. REST /play --------------------------------------------------------

describe('REST POST /api/game/:id/play', () => {
  it('успех: тело — голый GameState (без обёртки success/extra)', async () => {
    const gameId = await seedGame({ hand: [BASIC], cards: { [BASIC]: basicUnicorn(BASIC) } });
    const res = await request(app).post(`/api/game/${gameId}/play`).send({ cardId: BASIC });

    expect(res.status).toBe(200);
    // РАСХОЖДЕНИЕ D-1: документ (1.1) заявляет { success:true, extra:{state} }, код отдаёт state.
    expect(res.body.success).toBeUndefined();
    expect(res.body.extra).toBeUndefined();
    expect(Array.isArray(res.body.players)).toBe(true);
    expect(res.body.players[0].stable).toContain(BASIC);
    expect(res.body.turn.phase).toBe('action');
  });

  it('карта не в руке → 400 с code и message', async () => {
    const gameId = await seedGame({ cards: { [BASIC]: basicUnicorn(BASIC) } });
    const res = await request(app).post(`/api/game/${gameId}/play`).send({ cardId: BASIC });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Card not in hand');
    expect(res.body.code).toBe('card_not_in_hand');
  });

  it('не та фаза → 400 «Not in action phase»', async () => {
    const gameId = await seedGame({
      hand: [BASIC],
      cards: { [BASIC]: basicUnicorn(BASIC) },
      turn: { currentPlayerId: 'p1', phase: 'draw', has_drawn: false },
    });
    const res = await request(app).post(`/api/game/${gameId}/play`).send({ cardId: BASIC });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Not in action phase');
  });

  it('downgrade без targetPlayerId → 409, needTargetPlayer на верхнем уровне тела', async () => {
    const gameId = await seedGame({
      hand: [DOWNGRADE],
      cards: { [DOWNGRADE]: { id: DOWNGRADE, name: 'Штраф', type: 'downgrade', effects: [] } },
    });
    const res = await request(app).post(`/api/game/${gameId}/play`).send({ cardId: DOWNGRADE });

    expect(res.status).toBe(409);
    // РАСХОЖДЕНИЕ D-3: документ кладёт needTargets в extra; код кладёт needTargetPlayer в корень тела.
    expect(res.body.needTargetPlayer).toBe(true);
    expect(res.body.kind).toBe('downgrade');
    expect(res.body.options.players).toEqual(['p1', 'p2']);
    expect(res.body.extra).toBeUndefined();
  });

  it('партия окончена → 409 gameOver + winnerId, код GAME_OVER не используется', async () => {
    const gameId = await seedGame({
      hand: [BASIC],
      cards: { [BASIC]: basicUnicorn(BASIC) },
      winnerId: 'p2',
    });
    const res = await request(app).post(`/api/game/${gameId}/play`).send({ cardId: BASIC });

    expect(res.status).toBe(409);
    expect(res.body.gameOver).toBe(true);
    expect(res.body.winnerId).toBe('p2');
    // РАСХОЖДЕНИЕ D-4: документ требует code 'GAME_OVER'; код отдаёт WRONG_PHASE + gameOver (gameService.ts L592).
    expect(res.body.message).toBe('Game is over');
  });

  it('неизвестная игра → 404 «Game not found»', async () => {
    const res = await request(app).post('/api/game/no-such-game/play').send({ cardId: BASIC });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Game not found');
  });

  it('карта с on_play destroy → 200 с pending.kind=play, карта остаётся в руке до резолва', async () => {
    const gameId = await seedGame({
      hand: [POISON],
      cards: { [POISON]: POISON_CARD, [VICTIM]: basicUnicorn(VICTIM) },
    });
    const res = await request(app)
      .post(`/api/game/${gameId}/play`)
      .send({ cardId: POISON, targets: [VICTIM] });

    expect(res.status).toBe(200);
    expect(res.body.pending.kind).toBe('play');
    expect(res.body.pending.actorId).toBe('p1');
    expect(res.body.pending.cardId).toBe(POISON);
    expect(typeof res.body.pending.expiresAt).toBe('number');
    expect(res.body.state.players[0].hand).toContain(POISON);
    // РАСХОЖДЕНИЕ D-5: документ описывает PendingAction полями type/playerId/done/timeout;
    // код отдаёт kind/actorId/expiresAt (epoch-мс). Фиксируем реальные поля.
    expect(res.body.pending.type).toBeUndefined();
  });

  it('swap без кандидатов → 409 noSwapCandidates, без needTargets; карта на руке', async () => {
    const gameId = await seedGame({ hand: [SWAP], cards: { [SWAP]: SWAP_CARD } });
    // соперник без карт на руке — обменивать нечего
    games.get(gameId)!.state.players[1].hand = [];
    const res = await request(app).post(`/api/game/${gameId}/play`).send({ cardId: SWAP });

    expect(res.status).toBe(409);
    expect(res.body.noSwapCandidates).toBe(true);
    expect(res.body.needTargets).toBeUndefined();
    expect(res.body.options).toBeUndefined();
    expect(games.get(gameId)!.state.players[0].hand).toContain(SWAP);
  });
});

// --- 2. REST /endTurn -----------------------------------------------------

describe('REST POST /api/game/:id/endTurn', () => {
  it('обычный конец хода → 200, тело — state (передача хода p2)', async () => {
    const gameId = await seedGame({});
    const res = await request(app).post(`/api/game/${gameId}/endTurn`).send({});

    expect(res.status).toBe(200);
    expect(res.body.turn.currentPlayerId).toBe('p2');
    expect(res.body.pending).toBeUndefined();
  });

  it('рука 8 → 200 {pending, state}: окно hand_limit для p1, карта не сброшена сама', async () => {
    const hand = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'];
    const cards: Record<string, any> = {};
    hand.forEach((h) => (cards[h] = basicUnicorn(h)));
    const gameId = await seedGame({ hand, cards });
    const res = await request(app).post(`/api/game/${gameId}/endTurn`).send({});

    expect(res.status).toBe(200);
    expect(res.body.pending.kind).toBe('await_choice');
    expect(res.body.pending.purpose).toBe('hand_limit');
    expect(res.body.pending.chooserId).toBe('p1');
    expect(res.body.pending.remaining).toBe(1);
    expect(res.body.pending.options.sort()).toEqual(hand.slice().sort());
    expect(res.body.state.players[0].hand).toHaveLength(8);
    expect(res.body.state.turn.currentPlayerId).toBe('p1');
  });

  it('партия окончена → 409 WRONG_PHASE с extra.gameOver (код GAME_OVER не используется)', async () => {
    const gameId = await seedGame({ winnerId: 'p2' });
    const res = await request(app).post(`/api/game/${gameId}/endTurn`).send({});

    expect(res.status).toBe(409);
    expect(res.body.gameOver).toBe(true);
    expect(res.body.winnerId).toBe('p2');
  });
});

// --- 3. socket: ack и коды ошибок -------------------------------------------

describe('socket ack', () => {
  beforeEach(() => {
    registerSocketHandlers(io as any);
  });

  it('join_game: ack содержит ok/state/pending/logs; pending при открытом окне — null', async () => {
    const gameId = await seedGame({});
    const sock = io.connect(new FakeSocket('s-join'));
    const res = await ack(sock, 'join_game', { gameId, playerId: 'p1' });

    expect(res.ok).toBe(true);
    expect(Object.keys(res).sort()).toEqual(['logs', 'ok', 'pending', 'state']);
    expect(res.pending).toBeNull();
    expect(res.state.turn.currentPlayerId).toBe('p1');
    expect(Array.isArray(res.logs)).toBe(true);
  });

  it('join_game: неизвестная игра → GAME_NOT_FOUND', async () => {
    const sock = io.connect(new FakeSocket('s-nf'));
    const res = await ack(sock, 'join_game', { gameId: 'nope' });
    expect(res).toMatchObject({ ok: false, code: 'GAME_NOT_FOUND', message: 'Game not found' });
  });

  it('play_card без playerId → BAD_REQUEST', async () => {
    const gameId = await seedGame({ hand: [BASIC], cards: { [BASIC]: basicUnicorn(BASIC) } });
    const sock = io.connect(new FakeSocket('s-noplayer'));
    const res = await ack(sock, 'play_card', { gameId, cardId: BASIC });
    expect(res).toMatchObject({ ok: false, code: 'BAD_REQUEST', message: 'playerId is required' });
  });

  it('play_card на оконченной партии → code WRONG_PHASE, а не GAME_OVER', async () => {
    const gameId = await seedGame({ hand: [BASIC], cards: { [BASIC]: basicUnicorn(BASIC) }, winnerId: 'p2' });
    const sock = io.connect(new FakeSocket('s-over'));
    const res = await ack(sock, 'play_card', { gameId, playerId: 'p1', cardId: BASIC });

    expect(res.ok).toBe(false);
    // РАСХОЖДЕНИЕ D-4: документ обещает GAME_OVER; сервер отдаёт WRONG_PHASE + extra.gameOver.
    expect(res.code).toBe('WRONG_PHASE');
    expect(res.code).not.toBe('GAME_OVER');
    expect(res.extra.gameOver).toBe(true);
    expect(res.extra.winnerId).toBe('p2');
  });

  it('play_card успех → ok:true, state в ack', async () => {
    const gameId = await seedGame({ hand: [BASIC], cards: { [BASIC]: basicUnicorn(BASIC) } });
    const sock = io.connect(new FakeSocket('s-ok'));
    const res = await ack(sock, 'play_card', { gameId, playerId: 'p1', cardId: BASIC });
    expect(res.ok).toBe(true);
    expect(res.state.players[0].stable).toContain(BASIC);
  });
});

// --- 4. union кодов ошибок ---------------------------------------------------

describe('union SocketErrorCode (handlers.ts L32-39)', () => {
  it('каждый код, реально пришедший в ack, входит в union из 7 значений', () => {
    // Снято с server/src/socket/handlers.ts L32-39 и gameService.ts L559-566 — оба union идентичны.
    const declared = new Set([
      'GAME_NOT_FOUND',
      'BAD_REQUEST',
      'NOT_YOUR_TURN',
      'CARD_NOT_IN_HAND',
      'NO_ACTION_POINTS',
      'WRONG_PHASE',
      'PENDING_ACTION',
    ]);

    // Прогон выше обязан был реально породить отказы, иначе проверка ничего не стоит.
    expect(observedCodes.size).toBeGreaterThanOrEqual(2);
    for (const code of observedCodes) {
      expect(declared.has(code)).toBe(true);
    }
    // РАСХОЖДЕНИЕ D-6: документ (4.1) объявляет 12 кодов; восемь из них в union отсутствуют.
    // Ключевой для фронтенда случай — GAME_OVER: его не существует, конец партии приходит
    // как WRONG_PHASE + gameOver (см. кейс «партия окончена» выше).
    expect(declared.has('GAME_OVER')).toBe(false);
    expect(declared.has('UNKNOWN_CARD')).toBe(false);
    expect(declared.has('INTERNAL_ERROR')).toBe(false);
    expect(declared.size).toBe(7);
  });
});
