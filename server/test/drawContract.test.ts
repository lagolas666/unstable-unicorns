/**
 * Контракт добора карты (задача 6d-2): drawCard через REST /:id/draw и socket draw_card.
 *
 * Эталон — drawCard в server/src/gameService.ts (финальная форма после 6b-3c-2).
 * Проверяем: порядок проверок, коды и тексты отказов, отсутствие мутаций при отказе,
 * details.via для REST и socket, паритет журнала, пустую колоду как не-отказ.
 */
import express from 'express';
import request from 'supertest';
import gameRouter from '../src/routes/game';
import { games } from '../src/gameStore';
import { registerSocketHandlers } from '../src/socket/handlers';

// --- фейковый socket.io (без транспорта) ------------------------------------

class FakeIo {
  public connectionHandler: any = null;
  public broadcasts: { room: string; event: string; payload: any }[] = [];

  on(event: string, handler: any) {
    if (event === 'connection') this.connectionHandler = handler;
    return this;
  }

  to(room: string) {
    return {
      emit: (event: string, payload: any) => {
        this.broadcasts.push({ room, event, payload });
      },
    };
  }

  connect(socket: FakeSocket): FakeSocket {
    this.connectionHandler(socket);
    return socket;
  }

  clear() {
    this.broadcasts = [];
  }
}

class FakeSocket {
  public id: string;
  public handlers = new Map<string, any>();

  constructor(id = 'socket-1') {
    this.id = id;
  }

  on(event: string, handler: any) {
    this.handlers.set(event, handler);
    return this;
  }

  join() {}
  leave() {}
  emit() {
    return this;
  }
  to() {
    return { emit: () => undefined };
  }

  trigger(event: string, payload: any): Promise<any> {
    const handler = this.handlers.get(event);
    if (!handler) return Promise.reject(new Error(`socket handler "${event}" is not registered`));
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
registerSocketHandlers(io as any);

function sock(id = 'socket-1'): FakeSocket {
  return io.connect(new FakeSocket(id));
}

/** Фикстура: p1 — текущий игрок в begin_turn, колода [d1, d2] (pop даёт d2). */
async function seed(turnOver: any = {}, stateOver: any = {}): Promise<string> {
  const state = {
    players: [
      { id: 'p1', deck: [], hand: ['h1'], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
      { id: 'p2', deck: [], hand: ['h2'], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
    ],
    cards: {
      h1: { id: 'h1', name: 'H1', type: 'basic_unicorn', effects: [] },
      h2: { id: 'h2', name: 'H2', type: 'basic_unicorn', effects: [] },
      d1: { id: 'd1', name: 'D1', type: 'basic_unicorn', effects: [] },
      d2: { id: 'd2', name: 'D2', type: 'basic_unicorn', effects: [] },
    },
    turn: { currentPlayerId: 'p1', phase: 'begin_turn', has_drawn: false, ...turnOver },
    deck: ['d1', 'd2'],
    discard: [],
    ...stateOver,
  };
  const res = await request(app).post('/api/game/test/create').send({ state });
  expect(res.status).toBe(200);
  return res.body.id as string;
}

/** Снимок всего, что добор может тронуть: состояние, журнал, pending. */
function snap(gameId: string): string {
  const e = games.get(gameId) as any;
  return JSON.stringify({ state: e.state, logs: e.logs, pending: e.pending });
}

beforeEach(() => {
  games.clear();
  io.clear();
});

// --- тесты ------------------------------------------------------------------

describe('Draw contract: счастливый путь', () => {
  it('D01 REST: добор кладёт карту в руку, has_drawn=true, фаза action, лог via:rest', async () => {
    const id = await seed();
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.players[0].hand).toHaveLength(2);
    expect(e.state.turn.has_drawn).toBe(true);
    expect(e.state.turn.phase).toBe('action');
    const log = e.logs.find((l: any) => l.type === 'draw');
    expect(log.details).toEqual({ mode: 'official', qty: 1, via: 'rest' });
  });

  it('D02 socket: draw_card отвечает ok, фаза action, лог via:socket', async () => {
    const id = await seed();
    const ack = await sock().trigger('draw_card', { gameId: id, playerId: 'p1' });
    expect(ack.ok).toBe(true);
    expect(ack.state.players[0].hand).toHaveLength(2);
    expect(ack.state.turn.phase).toBe('action');
    const log = (games.get(id) as any).logs.find((l: any) => l.type === 'draw');
    expect(log.details).toEqual({ mode: 'official', qty: 1, via: 'socket' });
  });
});

describe('Draw contract: чужой и неизвестный playerId', () => {
  it('D03 REST: чужой playerId → 400 «Not your turn», состояние байт-в-байт прежнее', async () => {
    const id = await seed();
    const before = snap(id);
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p2' });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Not your turn');
    expect(snap(id)).toBe(before);
  });

  it('D04 socket: чужой playerId → NOT_YOUR_TURN, состояние байт-в-байт прежнее', async () => {
    const id = await seed();
    const before = snap(id);
    const ack = await sock().trigger('draw_card', { gameId: id, playerId: 'p2' });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('NOT_YOUR_TURN');
    expect(snap(id)).toBe(before);
  });

  it('D05 REST: неизвестный playerId → 404 «Player not found», без мутаций', async () => {
    const id = await seed();
    const before = snap(id);
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'ghost' });
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Player not found');
    expect(snap(id)).toBe(before);
  });

  it('D06 socket: неизвестный playerId → BAD_REQUEST «Player not found», без мутаций', async () => {
    const id = await seed();
    const before = snap(id);
    const ack = await sock().trigger('draw_card', { gameId: id, playerId: 'ghost' });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('Player not found');
    expect(snap(id)).toBe(before);
  });

  it('D07 чужой ход отсекается до мутаций: рука и колода не меняются, has_drawn=false', async () => {
    const id = await seed();
    await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p2' });
    const e = games.get(id) as any;
    expect(e.state.players[0].hand).toHaveLength(1);
    expect(e.state.deck).toHaveLength(2);
    expect(e.state.turn.has_drawn).toBe(false);
    expect(e.logs).toHaveLength(0);
  });
});

describe('Draw contract: паритет REST и socket', () => {
  it('D08 одинаковое состояние и одинаковые mode/qty в журнале; различается только via', async () => {
    const restId = await seed();
    const sockId = await seed();
    await request(app).post(`/api/game/${restId}/draw`).send({ playerId: 'p1' });
    await sock().trigger('draw_card', { gameId: sockId, playerId: 'p1' });
    const a = games.get(restId) as any;
    const b = games.get(sockId) as any;
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    const la = a.logs.find((l: any) => l.type === 'draw').details;
    const lb = b.logs.find((l: any) => l.type === 'draw').details;
    expect({ ...la, via: undefined }).toEqual({ ...lb, via: undefined });
    expect(la.via).toBe('rest');
    expect(lb.via).toBe('socket');
  });

  it('D19 REST без playerId берёт текущего игрока (fallback), лог via:rest', async () => {
    const id = await seed();
    const r = await request(app).post(`/api/game/${id}/draw`).send({});
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.players[0].hand).toHaveLength(2);
    expect(e.logs.find((l: any) => l.type === 'draw').details.via).toBe('rest');
  });
});

describe('Draw contract: пустая колода — не отказ', () => {
  it('D09 REST: пустая колода → 200, qty:0 в логе, фаза action', async () => {
    const id = await seed({}, { deck: [] });
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.turn.phase).toBe('action');
    expect(e.state.players[0].hand).toHaveLength(1);
    expect(e.logs.find((l: any) => l.type === 'draw').details).toEqual({ mode: 'official', qty: 0, via: 'rest' });
  });

  it('D10 socket: пустая колода → ok, qty:0 в логе, фаза action', async () => {
    const id = await seed({}, { deck: [] });
    const ack = await sock().trigger('draw_card', { gameId: id, playerId: 'p1' });
    expect(ack.ok).toBe(true);
    expect(ack.state.turn.phase).toBe('action');
    const log = (games.get(id) as any).logs.find((l: any) => l.type === 'draw');
    expect(log.details.qty).toBe(0);
    expect(log.details.via).toBe('socket');
  });
});

describe('Draw contract: повторный добор и фаза', () => {
  it('D11 REST: повторный добор → 400 «Not in begin_turn», состояние не меняется', async () => {
    const id = await seed();
    await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    const after1 = snap(id);
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Not in begin_turn');
    expect(snap(id)).toBe(after1);
  });

  it('D12 socket: повторный добор → WRONG_PHASE «Not in begin_turn», состояние не меняется', async () => {
    const id = await seed();
    const s = sock();
    await s.trigger('draw_card', { gameId: id, playerId: 'p1' });
    const after1 = snap(id);
    const ack = await s.trigger('draw_card', { gameId: id, playerId: 'p1' });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('WRONG_PHASE');
    expect(ack.message).toBe('Not in begin_turn');
    expect(snap(id)).toBe(after1);
  });

  it('D15 фаза action: добор отказан, ноль мутаций', async () => {
    const id = await seed({ phase: 'action' });
    const before = snap(id);
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Not in begin_turn');
    expect(snap(id)).toBe(before);
  });
});

describe('Draw contract: отказы без игры и без текущего игрока', () => {
  it('D13 GAME_NOT_FOUND: REST 404 и socket GAME_NOT_FOUND, стор не меняется', async () => {
    await seed();
    const size = games.size;
    const r = await request(app).post('/api/game/nope/draw').send({ playerId: 'p1' });
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Game not found');
    const ack = await sock().trigger('draw_card', { gameId: 'nope', playerId: 'p1' });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('GAME_NOT_FOUND');
    expect(games.size).toBe(size);
  });

  it('D14 нет текущего игрока: 400 «Current player not found», ноль мутаций и логов', async () => {
    const id = await seed({ currentPlayerId: 'ghost' });
    const before = snap(id);
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Current player not found');
    expect(snap(id)).toBe(before);
    expect((games.get(id) as any).logs).toHaveLength(0);
  });
});

describe('Draw contract: socket-вещание и валидация входа', () => {
  it('D16 успешный socket-добор рассылает state_update и logs_update в комнату game:<id>', async () => {
    const id = await seed();
    io.clear();
    await sock().trigger('draw_card', { gameId: id, playerId: 'p1' });
    const events = io.broadcasts.filter((b) => b.room === `game:${id}`).map((b) => b.event);
    expect(events).toContain('state_update');
    expect(events).toContain('logs_update');
  });

  it('D17 отказ socket-добора ничего не рассылает', async () => {
    const id = await seed();
    io.clear();
    await sock().trigger('draw_card', { gameId: id, playerId: 'p2' });
    expect(io.broadcasts).toHaveLength(0);
  });

  it('D18 socket без playerId → BAD_REQUEST «playerId is required», ноль мутаций', async () => {
    const id = await seed();
    const before = snap(id);
    const ack = await sock().trigger('draw_card', { gameId: id });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('playerId is required');
    expect(snap(id)).toBe(before);
  });
});
describe('Draw contract: тай-брейк пустой колоды (engine/leader.ts)', () => {
  // Единый расчёт победителя; executor-обёртка делегирует ему же, поэтому проверка через drawCard покрывает оба пути.
  const { leaderByUnicorns, maybeEndOnDeckEmpty } = require('../src/engine/leader');

  const uni = (id: string, extra: any = {}) => ({ id, name: id.toUpperCase(), type: 'basic_unicorn', effects: [], ...extra });
  const cardsWith = (extra: Record<string, any>) => ({ h1: uni('h1'), h2: uni('h2'), d1: uni('d1'), d2: uni('d2'), ...extra });
  const players = (p1Stable: string[], p2Stable: string[]) => [
    { id: 'p1', deck: [], hand: ['h1'], discard: [], stable: p1Stable, nursery: [], field: [], action_points: 1 },
    { id: 'p2', deck: [], hand: ['h2'], discard: [], stable: p2Stable, nursery: [], field: [], action_points: 1 },
  ];

  it('D20 counts_as_two: p1 = 2 (counts_as_two) против 1 у p2 — при пустой колоде побеждает p1; без флага тай-брейк по буквам отдал бы победу p2', async () => {
    // Фикстура различает мутацию: без counts_as_two счёт 1:1, и по числу букв ('A' vs 'ZZZZ') побеждает p2.
    const cards = cardsWith({ u2: uni('u2', { counts_as_two: true, name: 'A' }), v1: uni('v1', { name: 'ZZZZ' }) });
    const id = await seed({}, { deck: [], discard: [], players: players(['u2'], ['v1']), cards });
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.winnerId).toBe('p1');
    expect(e.state.turn.has_drawn).toBe(true);
    expect(e.state.turn.phase).toBe('action');
  });

  it('D21 guard: winnerId уже p1, p2 сильнее по единорогам — повторный добор не перезаписывает победителя', async () => {
    const cards = cardsWith({ u1: uni('u1'), v1: uni('v1'), v2: uni('v2'), v3: uni('v3') });
    const id = await seed({}, { deck: [], discard: [], winnerId: 'p1', players: players(['u1'], ['v1', 'v2', 'v3']), cards });
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    // D1: партия окончена — добор отклоняется, победитель не перезаписан
    expect(r.status).toBe(409);
    expect(r.body.gameOver).toBe(true);
    expect((games.get(id) as any).state.winnerId).toBe('p1');
  });

  it('D21b maybeEndOnDeckEmpty не перерешает уже выставленного победителя (вызов дважды)', () => {
    const state: any = {
      players: players(['u1'], ['v1', 'v2', 'v3']),
      cards: cardsWith({ u1: uni('u1'), v1: uni('v1'), v2: uni('v2'), v3: uni('v3') }),
      turn: { currentPlayerId: 'p1', phase: 'action' },
      deck: [],
      discard: [],
      winnerId: 'p1',
    };
    expect(leaderByUnicorns(state)).toBe('p2');
    maybeEndOnDeckEmpty(state);
    maybeEndOnDeckEmpty(state);
    expect(state.winnerId).toBe('p1');
  });

  it('D22 transforms_unicorn: трансформер у p1 не считается — побеждает p2; без флага p1 выиграл бы по числу букв', async () => {
    // У p1 единственный единорог трансформирован. Снимаем флаг — у p1 1 единорог и 19 букв против 1 и 5 у p2, побеждает p1.
    const cards = cardsWith({ t1: uni('t1', { transforms_unicorn: true, name: 'ALONGTRANSFORMERNAME' }), v1: uni('v1', { name: 'SHORT' }) });
    const id = await seed({}, { deck: [], discard: [], players: players(['t1'], ['v1']), cards });
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(200);
    expect((games.get(id) as any).state.winnerId).toBe('p2');
  });

  it('D23 пустая колода + сброс: сброс перетасовывается в колоду, карты не теряются (сравнение мультимножества)', async () => {
    const cards = cardsWith({ x1: uni('x1'), x2: uni('x2'), x3: uni('x3') });
    const id = await seed({}, { deck: [], discard: ['x1', 'x2', 'x3'], cards });
    const before = ['h1', 'x1', 'x2', 'x3'].sort();
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.discard).toHaveLength(0);
    expect(e.state.deck).toHaveLength(2);
    expect(e.state.players[0].hand).toHaveLength(2);
    expect([...e.state.players[0].hand, ...e.state.deck, ...e.state.discard].sort()).toEqual(before);
    expect(e.state.winnerId).toBeUndefined();
    const log = e.logs.find((l: any) => l.type === 'debug' && l.details?.event === 'reshuffle');
    expect(log.details.size).toBe(3);
  });

  it('D24 контроль 2:1: winnerId совпадает с leaderByUnicorns на том же состоянии, спорных флагов нет', async () => {
    const cards = cardsWith({ u1: uni('u1'), u2: uni('u2'), v1: uni('v1') });
    const stable = players(['u1', 'u2'], ['v1']);
    const expected = leaderByUnicorns({ players: stable, cards, turn: { currentPlayerId: 'p1', phase: 'begin_turn' }, deck: [], discard: [] });
    const id = await seed({}, { deck: [], discard: [], players: stable, cards });
    const r = await request(app).post(`/api/game/${id}/draw`).send({ playerId: 'p1' });
    expect(r.status).toBe(200);
    expect(expected).toBe('p1');
    expect((games.get(id) as any).state.winnerId).toBe(expected);
  });
});

// open item #50: пустой byPlayerId в draw_card на REST-пути.
// Роут подставляет текущего игрока (routes/game.ts L362), поэтому анонимный добор
// всегда достаётся текущему, а не отправителю: «добери за любого» через пустой id нет.
describe('Draw contract: пустой byPlayerId не даёт добрать за другого', () => {
  it('D25 REST: playerId = "" → добор текущему p1, рука p2 не тронута', async () => {
    const id = await seed();
    const r = await request(app).post('/api/game/' + id + '/draw').send({ playerId: '' });
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.players[0].hand).toHaveLength(2);
    expect(e.state.players[1].hand).toHaveLength(1);
    expect(e.state.deck).toHaveLength(1);
    const log = e.logs.find((l: any) => l.type === 'draw');
    expect(log.playerId).toBe('p1');
    expect(log.details.via).toBe('rest');
    expect(e.state.turn.has_drawn).toBe(true);
  });

  it('D26 REST: playerId = "" при текущем p2 → карта уходит p2, p1 не получает', async () => {
    const id = await seed({ currentPlayerId: 'p2' });
    const r = await request(app).post('/api/game/' + id + '/draw').send({ playerId: '' });
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.players[1].hand).toHaveLength(2);
    expect(e.state.players[0].hand).toHaveLength(1);
    expect(e.logs.find((l: any) => l.type === 'draw').playerId).toBe('p2');
  });

  it('D27 REST: playerId = null → как пустой, отказом не считается и не даёт добрать за другого', async () => {
    const id = await seed();
    const r = await request(app).post('/api/game/' + id + '/draw').send({ playerId: null });
    expect(r.status).toBe(200);
    const e = games.get(id) as any;
    expect(e.state.players[0].hand).toHaveLength(2);
    expect(e.state.players[1].hand).toHaveLength(1);
  });
});
