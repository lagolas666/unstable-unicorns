/**
 * Socket-контракт (задача 6b, требование 3).
 *
 * Эталон: docs/socket-contract.md
 * Тест написан ДО реализации `src/socket/handlers.ts` — красный результат
 * означает «Бэкенду есть что делать», а не поломку гейта.
 *
 * Транспорт не поднимаем: socket.io-client не тянем в зависимости.
 * Регистрируем хендлеры фейковым io, дергаем события напрямую с ack.
 */
import express from 'express';
import request from 'supertest';
import gameRouter from '../src/routes/game';
import { games } from '../src/gameStore';
import { registerSocketHandlers } from '../src/socket/handlers';

// --- фейковый socket.io -----------------------------------------------------

type Broadcast = { room: string; event: string; payload: any };

class FakeIo {
  public connectionHandler: ((socket: FakeSocket) => void) | null = null;
  public broadcasts: Broadcast[] = [];

  on(event: string, handler: (socket: FakeSocket) => void) {
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
    if (!this.connectionHandler) {
      throw new Error('registerSocketHandlers did not register a "connection" handler');
    }
    this.connectionHandler(socket);
    return socket;
  }

  clearBroadcasts() {
    this.broadcasts = [];
  }

  /** События, отправленные в комнату [room]. */
  eventsFor(room: string): string[] {
    return this.broadcasts.filter((b) => b.room === room).map((b) => b.event);
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

  /**
   * Вызвать событие и дождаться ack. Если хендлер не зарегистрирован —
   * это провал теста (событие из контракта отсутствует).
   */
  trigger(event: string, payload: any): Promise<any> {
    const handler = this.handlers.get(event);
    if (!handler) {
      return Promise.reject(new Error(`socket handler "${event}" is not registered`));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`ack timeout for "${event}"`)),
        2000
      );
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

function makeSocket(id = 'socket-1'): FakeSocket {
  return io.connect(new FakeSocket(id));
}

/** Детерминированная игра через тестовый REST-эндпоинт. */
async function seedGame(extra?: Partial<{ phase: string; hand: string[]; hasDrawn: boolean }>) {
  const state = {
    players: [
      {
        id: 'p1', deck: [], hand: extra?.hand ?? ['c_basic_1'], discard: [],
        stable: [], nursery: [], field: [], action_points: 1,
      },
      {
        id: 'p2', deck: [], hand: [], discard: [],
        stable: [], nursery: [], field: [], action_points: 1,
      },
    ],
    cards: {
      c_basic_1: { id: 'c_basic_1', name: 'Базовый Единорог', type: 'basic_unicorn', effects: [] },
      c_basic_2: { id: 'c_basic_2', name: 'Базовый Единорог 2', type: 'basic_unicorn', effects: [] },
    },
    turn: { currentPlayerId: 'p1', phase: extra?.phase ?? 'action', has_drawn: extra?.hasDrawn ?? true },
    deck: ['c_basic_2'],
    discard: [],
  };
  const res = await request(app).post('/api/game/test/create').send({ state });
  expect(res.status).toBe(200);
  return res.body.id as string;
}

beforeEach(() => {
  games.clear();
  io.clearBroadcasts();
});

// --- тесты ------------------------------------------------------------------

describe('Socket contract: registration', () => {
  it('S01 registers a "connection" handler', () => {
    registerSocketHandlers(io as any);
    expect(typeof io.connectionHandler).toBe('function');
  });
});

describe('Socket contract: один стор с REST', () => {
  it('S02 join_game для игры, созданной по REST, отвечает ok и заводит socket в комнату', async () => {
    registerSocketHandlers(io as any);
    const create = await request(app)
      .post('/api/game')
      .send({ players: [{ id: 'p1' }, { id: 'p2' }] });
    expect(create.status).toBe(201);
    const gameId = create.body.id;

    const socket = makeSocket();
    const ack = await socket.trigger('join_game', { gameId, playerId: 'p1' });

    expect(ack.ok).toBe(true);
    expect(socket.rooms.has(`game:${gameId}`)).toBe(true);
    expect(ack.state).toBeTruthy();
    expect(ack.state.players.map((p: any) => p.id)).toEqual(['p1', 'p2']);
  });

  it('S03 join_game для несуществующей игры → ok:false + GAME_NOT_FOUND, без исключения', async () => {
    registerSocketHandlers(io as any);
    const socket = makeSocket();
    const ack = await socket.trigger('join_game', { gameId: 'no-such-game' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('GAME_NOT_FOUND');
    expect(typeof ack.message).toBe('string');
  });

  it('S04 play_card кладёт карту в stable, и REST это видит (требование 3)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket();

    const ack = await socket.trigger('play_card', {
      gameId,
      playerId: 'p1',
      cardId: 'c_basic_1',
    });

    expect(ack.ok).toBe(true);

    // socket-состояние
    const p1 = ack.state.players.find((p: any) => p.id === 'p1');
    expect(p1.stable).toContain('c_basic_1');
    expect(p1.hand).not.toContain('c_basic_1');

    // и то же самое через REST — иначе shared state не работает
    const rest = await request(app).get(`/api/game/${gameId}`);
    expect(rest.status).toBe(200);
    const restP1 = rest.body.players.find((p: any) => p.id === 'p1');
    expect(restP1.stable).toContain('c_basic_1');
    expect(restP1.hand).not.toContain('c_basic_1');
  });
});

describe('Socket contract: ошибки play_card', () => {
  it('S05 play_card для несуществующей игры → GAME_NOT_FOUND', async () => {
    registerSocketHandlers(io as any);
    const socket = makeSocket();
    const ack = await socket.trigger('play_card', {
      gameId: 'missing',
      playerId: 'p1',
      cardId: 'c_basic_1',
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('GAME_NOT_FOUND');
  });

  it('S06 play_card картой не из руки → CARD_NOT_IN_HAND, рука не изменилась', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket();

    const ack = await socket.trigger('play_card', {
      gameId,
      playerId: 'p1',
      cardId: 'c_basic_2',
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('CARD_NOT_IN_HAND');

    const rest = await request(app).get(`/api/game/${gameId}`);
    expect(rest.body.players[0].hand).toEqual(['c_basic_1']);
    expect(rest.body.players[0].stable).toEqual([]);
  });
});

describe('Socket contract: ход и broadcast', () => {
  it('S07 end_turn передаёт ход следующему игроку, REST подтверждает', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ hand: [] });
    const socket = makeSocket();

    const ack = await socket.trigger('end_turn', { gameId, playerId: 'p1' });

    expect(ack.ok).toBe(true);
    expect(ack.state.turn.currentPlayerId).toBe('p2');

    const rest = await request(app).get(`/api/game/${gameId}`);
    expect(rest.body.turn.currentPlayerId).toBe('p2');
  });

  it('S13b end_turn без playerId → BAD_REQUEST, ход не передан (задача 6c-1)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket();
    const before = games.get(gameId)!.state.turn.currentPlayerId;

    const ack = await socket.trigger('end_turn', { gameId });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    const after = games.get(gameId)!.state.turn.currentPlayerId;
    expect(after).toBe(before);
    expect(after).toBe('p1');
  });

  it('S13c end_turn с пустым playerId → BAD_REQUEST, ход не передан (задача 6c-1)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket();
    const before = games.get(gameId)!.state.turn.currentPlayerId;

    const ack = await socket.trigger('end_turn', { gameId, playerId: '' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(games.get(gameId)!.state.turn.currentPlayerId).toBe(before);
  });

  it('S08 успешный play_card broadcast-ит state_update в комнату игры', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket();
    io.clearBroadcasts();

    await socket.trigger('play_card', { gameId, playerId: 'p1', cardId: 'c_basic_1' });

    const events = io.eventsFor(`game:${gameId}`);
    expect(events).toContain('state_update');
  });

  it('S09 неуспешный play_card не broadcast-ит state_update', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket();
    io.clearBroadcasts();

    await socket.trigger('play_card', { gameId, playerId: 'p1', cardId: 'c_basic_2' });

    const events = io.eventsFor(`game:${gameId}`);
    expect(events).not.toContain('state_update');
  });
});

describe('Socket contract: draw_card', () => {
  it('S10 draw_card в begin_turn кладёт карту в руку и переводит фазу в action', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ phase: 'begin_turn', hasDrawn: false, hand: [] });
    const socket = makeSocket();

    const ack = await socket.trigger('draw_card', { gameId, playerId: 'p1' });

    expect(ack.ok).toBe(true);
    const p1 = ack.state.players.find((p: any) => p.id === 'p1');
    expect(p1.hand).toContain('c_basic_2');
    expect(ack.state.turn.phase).toBe('action');
    expect(ack.state.turn.has_drawn).toBe(true);
  });

  it('S11 повторный draw_card в том же ходу → WRONG_PHASE (не второй добор)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ phase: 'begin_turn', hasDrawn: false, hand: [] });
    const socket = makeSocket();

    const first = await socket.trigger('draw_card', { gameId, playerId: 'p1' });
    expect(first.ok).toBe(true);

    const second = await socket.trigger('draw_card', { gameId, playerId: 'p1' });
    expect(second.ok).toBe(false);
    expect(second.code).toBe('WRONG_PHASE');

    const rest = await request(app).get(`/api/game/${gameId}`);
    const p1 = rest.body.players.find((p: any) => p.id === 'p1');
    expect(p1.hand.filter((c: string) => c === 'c_basic_2')).toHaveLength(1);
  });

  it('S12 draw_card чужим playerId → NOT_YOUR_TURN, рука не тронута (регресс на дыру из отчёта Фронтенда)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ phase: 'begin_turn', hasDrawn: false, hand: [] });
    const socket = makeSocket('socket-intruder');

    const ack = await socket.trigger('draw_card', { gameId, playerId: 'p2' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('NOT_YOUR_TURN');

    const rest = await request(app).get(`/api/game/${gameId}`);
    expect(rest.body.players.find((p: any) => p.id === 'p2').hand).toEqual([]);
    expect(rest.body.turn.phase).toBe('begin_turn');
    expect(rest.body.turn.currentPlayerId).toBe('p1');
  });

  it('S13 draw_card без playerId → BAD_REQUEST (симметрично play_card)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ phase: 'begin_turn', hasDrawn: false, hand: [] });
    const socket = makeSocket();

    const ack = await socket.trigger('draw_card', { gameId });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
  });
});

// --- реакции через socket (6b-3c-2) ----------------------------------------

const pendingOf = (gameId: string): any => games.get(gameId)!.pending;

/** Окно реакции neigh: p1 играет c_basic_1, у p2 в руке neigh-карта c_neigh_1. */
async function seedNeighWindow(): Promise<string> {
  const gameId = await seedGame();
  const entry = games.get(gameId)!;
  entry.state.cards['c_neigh_1'] = {
    id: 'c_neigh_1', name: 'Неудержимый Neigh', type: 'instant', instant_subtype: 'neigh', effects: [],
  } as any;
  entry.state.players[1].hand.push('c_neigh_1');
  entry.pending = {
    kind: 'play', actorId: 'p1', cardId: 'c_basic_1', uncounterable: false,
    cancelLevel: 0, expiresAt: Date.now() + 60000,
  } as any;
  return gameId;
}

describe('Socket contract: реакции (6b-3c-2)', () => {
  afterEach(() => {
    // schedulePendingResolution ставит таймер на 5 с: снимаем, иначе jest не завершится
    for (const e of games.values()) {
      if (e.pendingTimeout) {
        clearTimeout(e.pendingTimeout);
        e.pendingTimeout = undefined;
      }
    }
  });

  it('S14 react neigh в открытом окне реально исполняется: cancelLevel 0 -> 1, карта уходит из руки реактора', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedNeighWindow();
    expect(pendingOf(gameId).cancelLevel).toBe(0);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'neigh' });

    expect(ack.ok).toBe(true);
    expect(ack.pending.cancelLevel).toBe(1);
    expect(pendingOf(gameId).cancelLevel).toBe(1);
    expect(games.get(gameId)!.state.players[1].hand).not.toContain('c_neigh_1');
    expect(games.get(gameId)!.state.players[1].discard).toContain('c_neigh_1');
  });

  it('S15 react с неизвестным kind → BAD_REQUEST, окно и карты не тронуты', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedNeighWindow();
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'teleport' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toContain('Unknown reaction kind: teleport');
    expect(pendingOf(gameId).cancelLevel).toBe(0);
    expect(games.get(gameId)!.state.players[1].hand).toContain('c_neigh_1');
  });

  it('S16 react без kind → BAD_REQUEST', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedNeighWindow();
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('kind is required');
    expect(pendingOf(gameId).cancelLevel).toBe(0);
  });

  it('S17 react без playerId → BAD_REQUEST, реакция не исполнена', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedNeighWindow();
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, kind: 'neigh' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('playerId is required');
    expect(pendingOf(gameId).cancelLevel).toBe(0);
    expect(games.get(gameId)!.state.players[1].hand).toContain('c_neigh_1');
  });

  it('S18 react для несуществующей игры → GAME_NOT_FOUND', async () => {
    registerSocketHandlers(io as any);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId: 'missing', playerId: 'p2', kind: 'neigh' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('GAME_NOT_FOUND');
  });

  it('S19 resolve_pending без открытого окна → nothing_pending (D-2), без исключения наружу, состояние цело', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket();

    const ack = await socket.trigger('resolve_pending', { gameId, playerId: 'p1' });

    expect(ack.ok).toBe(false);
    // D-2 (решение Аналитика): resolvePending без окна отдаёт code 'nothing_pending'
    expect(ack.code).toBe('nothing_pending');
    expect(ack.message).toBe('Nothing pending');
    expect(games.get(gameId)!.state.players[0].hand).toEqual(['c_basic_1']);
    expect(games.get(gameId)!.state.players[0].stable).toEqual([]);
  });

  it('S20 resolve_pending после neigh закрывает окно; отменённая карта уходит в сброс (BUG-02)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedNeighWindow();
    const socket = makeSocket();
    await socket.trigger('react', { gameId, playerId: 'p2', kind: 'neigh' });

    const ack = await socket.trigger('resolve_pending', { gameId, playerId: 'p1' });

    expect(ack.ok).toBe(true);
    expect(ack.pending).toBeNull();
    expect(pendingOf(gameId)).toBeNull();
    const p1 = games.get(gameId)!.state.players[0];
    // Рулинг BUG-02: «send it to the discard pile» — карта не возвращается в руку.
    expect(p1.hand).not.toContain('c_basic_1');
    expect(p1.discard).toContain('c_basic_1');
    expect(p1.stable).not.toContain('c_basic_1');
  });

  it('S21 успешный react neigh рассылает pending_update, logs_update и state_update в комнату игры', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedNeighWindow();
    const socket = makeSocket();
    io.clearBroadcasts();

    await socket.trigger('react', { gameId, playerId: 'p2', kind: 'neigh' });

    const events = io.eventsFor(`game:${gameId}`);
    expect(events).toContain('state_update');
    expect(events).toContain('pending_update');
    expect(events).toContain('logs_update');
  });

  it('S22 super_neigh без super_neigh-карты в руке → BAD_REQUEST, окно не меняется', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    games.get(gameId)!.pending = {
      kind: 'play', actorId: 'p1', cardId: 'c_basic_1', uncounterable: false,
      cancelLevel: 0, expiresAt: Date.now() + 60000,
    } as any;
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'super_neigh' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('No super_neigh instant in hand to react');
    expect(pendingOf(gameId).cancelLevel).toBe(0);
  });

  it('S23 redirect, когда у реактора только neigh-карта → BAD_REQUEST, карта не списана', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedNeighWindow();
    const socket = makeSocket();

    const ack = await socket.trigger('react', {
      gameId, playerId: 'p2', kind: 'redirect', targetId: 'p1',
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('No redirect instant in hand to react');
    expect(pendingOf(gameId).cancelLevel).toBe(0);
    expect(games.get(gameId)!.state.players[1].hand).toContain('c_neigh_1');
  });
});

// --- реакции через socket: покрытие оставшихся видов (S24–S34) --------------

type WindowOpts = {
  playEffects?: any[];
  p1Hand?: string[];
  p2Hand?: string[];
  p1Stable?: string[];
  p2Stable?: string[];
  cards?: Record<string, any>;
  pending?: Record<string, any>;
};

/** Окно розыгрыша p1 карты c_basic_1 с настраиваемыми эффектами, руками, стойлами и pending. */
async function seedWindow(opts: WindowOpts = {}): Promise<string> {
  const gameId = await seedGame();
  const entry = games.get(gameId)!;
  const st: any = entry.state;
  st.cards['c_basic_1'].effects = opts.playEffects ?? [];
  for (const [id, card] of Object.entries(opts.cards ?? {})) st.cards[id] = card;
  if (opts.p1Hand) st.players[0].hand = [...opts.p1Hand];
  if (opts.p2Hand) st.players[1].hand = [...opts.p2Hand];
  if (opts.p1Stable) st.players[0].stable = [...opts.p1Stable];
  if (opts.p2Stable) st.players[1].stable = [...opts.p2Stable];
  entry.pending = {
    kind: 'play', actorId: 'p1', cardId: 'c_basic_1', uncounterable: false,
    cancelLevel: 0, expiresAt: Date.now() + 60000, ...(opts.pending ?? {}),
  } as any;
  return gameId;
}

/** Полный снимок для проверки «отказ не меняет состояние». */
const snapshotOf = (gameId: string): string => {
  const e = games.get(gameId)!;
  return JSON.stringify({ state: e.state, pending: e.pending, logs: e.logs.length });
};

const SHIELD = { id: 'c_shield_1', name: 'Shield', type: 'instant', instant_subtype: 'shield', effects: [] };
const REWIND = { id: 'c_rewind_1', name: 'Rewind', type: 'instant', instant_subtype: 'rewind', effects: [] };
const INTERCEPT = { id: 'c_icpt_1', name: 'Intercept', type: 'instant', instant_subtype: 'intercept', effects: [] };
const COUNTER = { id: 'c_counter_1', name: 'Counter-Neigh', type: 'instant', instant_subtype: 'counter_neigh', effects: [] };
const JUNK = { id: 'c_junk', name: 'Junk', type: 'basic_unicorn', effects: [] };
const PLAIN = { id: 'c_plain_2', name: 'Plain', type: 'basic_unicorn', effects: [] };
const ELUSIVE = { id: 'c_elusive', name: 'Elusive Oceloticorn', type: 'magical_unicorn', blocks_neigh_for_others: true, effects: [] };
const FRANK = { id: 'c_frank', name: 'Frankencorn', type: 'basic_unicorn', effects: [] };
const OBJECTION = { id: 'c_obj_1', name: 'Objection', type: 'instant', effects: [] };
const NEIGH = { id: 'c_neigh_1', name: 'Неудержимый Neigh', type: 'instant', instant_subtype: 'neigh', effects: [] };
const DRAW_ON_PLAY = [{ trigger: 'on_play', actions: [{ kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 1 } } }] }];
const STEAL_ON_PLAY = [{ trigger: 'on_play', actions: [{ kind: 'steal', targets: { scope: 'opponent', zone: 'stable', quantity: { value: 1 } } }] }];

describe('Socket contract: реакции — покрытие видов S24–S34', () => {
  afterEach(() => {
    for (const e of games.values()) {
      if (e.pendingTimeout) {
        clearTimeout(e.pendingTimeout);
        e.pendingTimeout = undefined;
      }
    }
  });

  it('S24 shield от актёра: uncounterable=true, карта уходит из руки в сброс', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_shield_1: SHIELD }, p1Hand: ['c_basic_1', 'c_shield_1'] });
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p1', kind: 'shield', instantCardId: 'c_shield_1' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).uncounterable).toBe(true);
    const p1 = games.get(gameId)!.state.players[0];
    expect(p1.hand).not.toContain('c_shield_1');
    expect(p1.discard).toContain('c_shield_1');
  });

  it('S24b shield от не-актёра → «Only actor can shield their action», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_shield_1: SHIELD }, p2Hand: ['c_shield_1'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'shield', instantCardId: 'c_shield_1' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('Only actor can shield their action');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S24c shield у актёра без shield-карты → «No shield instant in hand to react», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_junk: JUNK }, p1Hand: ['c_basic_1', 'c_junk'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p1', kind: 'shield' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('No shield instant in hand to react');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S25 hypnorog: сброс карты из руки реактора, pending.hypnorog.cancel=true', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ playEffects: DRAW_ON_PLAY, cards: { c_junk: JUNK }, p2Hand: ['c_junk'] });
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'hypnorog', discardCardId: 'c_junk' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).hypnorog.cancel).toBe(true);
    const p2 = games.get(gameId)!.state.players[1];
    expect(p2.hand).not.toContain('c_junk');
    expect(p2.discard).toContain('c_junk');
  });

  it('S25b hypnorog без discardCardId → «discardCardId required», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ playEffects: DRAW_ON_PLAY, cards: { c_junk: JUNK }, p2Hand: ['c_junk'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'hypnorog' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('discardCardId required');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S25c hypnorog на розыгрыш не-единорога с on_play → отказ, карта не сброшена', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ playEffects: [], cards: { c_junk: JUNK }, p2Hand: ['c_junk'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'hypnorog', discardCardId: 'c_junk' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('Pending card is not a unicorn with on_play/immediate effects');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S26 rewind: cancelLevel 0→1, lastCancelCardId=Rewind, карта уходит из руки реактора', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_rewind_1: REWIND }, p2Hand: ['c_rewind_1'] });
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'rewind', instantCardId: 'c_rewind_1' });

    expect(ack.ok).toBe(true);
    const pend = pendingOf(gameId);
    expect(pend.cancelLevel).toBe(1);
    expect(pend.lastCancelCardId).toBe('c_rewind_1');
    expect(pend.lastCancelBy).toBe('p2');
    expect(pend.rewindPlayCancel).toBe(true);
    const p2 = games.get(gameId)!.state.players[1];
    expect(p2.hand).not.toContain('c_rewind_1');
    expect(p2.discard).toContain('c_rewind_1');
  });

  it('S26b rewind без rewind-карты в руке → «No rewind instant in hand to react», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_junk: JUNK }, p2Hand: ['c_junk'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'rewind' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('No rewind instant in hand to react');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S27 intercept_steal: при steal-эффекте интерцепт сохраняется, по умолчанию получатель — реактор', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ playEffects: STEAL_ON_PLAY, cards: { c_icpt_1: INTERCEPT }, p2Hand: ['c_icpt_1'] });
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'intercept_steal', instantCardId: 'c_icpt_1' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).intercept.receiverPlayerId).toBe('p2');
    const p2 = games.get(gameId)!.state.players[1];
    expect(p2.hand).not.toContain('c_icpt_1');
    expect(p2.discard).toContain('c_icpt_1');
  });

  it('S27b intercept_steal без steal-эффекта → «Pending card has no steal to intercept», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ playEffects: [], cards: { c_icpt_1: INTERCEPT }, p2Hand: ['c_icpt_1'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'intercept_steal', instantCardId: 'c_icpt_1' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('Pending card has no steal to intercept');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S28 play_as_instant: карта без can_be_played_as_instant → «Card cannot be played as instant», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_plain_2: PLAIN }, p2Hand: ['c_plain_2'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'play_as_instant', cardId: 'c_plain_2' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('Card cannot be played as instant');
    expect(games.get(gameId)!.state.players[1].hand).toContain('c_plain_2');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S28b play_as_instant без cardId → «byPlayerId and cardId are required», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_plain_2: PLAIN }, p2Hand: ['c_plain_2'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'play_as_instant' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('byPlayerId and cardId are required');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S28c play_as_instant: карта с can_be_played_as_instant разыгрывается реактором из окна', async () => {
    registerSocketHandlers(io as any);
    const CHRONO = { id: 'c_chrono', name: 'Chronocorn', type: 'magical_unicorn', can_be_played_as_instant: true, effects: [] };
    const gameId = await seedWindow({ cards: { c_chrono: CHRONO }, p2Hand: ['c_chrono'] });
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'play_as_instant', cardId: 'c_chrono' });

    expect(ack.ok).toBe(true);
    const p2 = games.get(gameId)!.state.players[1];
    expect(p2.hand).not.toContain('c_chrono');
    expect(p2.stable.concat(p2.discard)).toContain('c_chrono');
  });

  it('S33c frankencorn_intercept: Frankencorn принесён в жертву, розыгрыш перехвачен реактором', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_frank: FRANK }, p1Hand: ['c_basic_1'], p2Stable: ['c_frank'] });
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'frankencorn_intercept' });

    expect(ack.ok).toBe(true);
    const st = games.get(gameId)!.state;
    expect(st.players[1].stable).not.toContain('c_frank');
    expect(st.players[1].discard).toContain('c_frank');
    expect(st.players[0].hand).not.toContain('c_basic_1');
    expect(games.get(gameId)!.pending).toBeNull();
  });

  it('S29 prevent: pending.preventEffects помечает розыгрыш, окно продлевается', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow();
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'prevent' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).preventEffects).toEqual({ c_basic_1: true });
  });

  it('S29b prevent при uncounterable → «Uncounterable: reactions are disabled», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ pending: { uncounterable: true } });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'prevent' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('Uncounterable: reactions are disabled');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S30 ignore_target: цель попадает в pending.ignoreTargets[источник]', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow();
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'ignore_target', targetId: 'p1' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).ignoreTargets).toEqual({ c_basic_1: ['p1'] });
  });

  it('S30b ignore_target без targetId → «targetId required», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow();
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'ignore_target' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('targetId required');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S31 intercept: получатель записан в pending.intercept', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow();
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'intercept', receiverPlayerId: 'p1' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).intercept).toEqual({ receiverPlayerId: 'p1' });
  });

  it('S31b intercept без receiverPlayerId → «receiverPlayerId required», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow();
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'intercept' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('receiverPlayerId required');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S31c intercept на несуществующего получателя → «receiverPlayerId not found», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow();
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'intercept', receiverPlayerId: 'ghost' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('receiverPlayerId not found');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S32 counter_neigh: cancelLevel 1→0, карта списана из руки реактора', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_counter_1: COUNTER }, p2Hand: ['c_counter_1'], pending: { cancelLevel: 1 } });
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'counter_neigh', instantCardId: 'c_counter_1' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).cancelLevel).toBe(0);
    const p2 = games.get(gameId)!.state.players[1];
    expect(p2.hand).not.toContain('c_counter_1');
    expect(p2.discard).toContain('c_counter_1');
  });

  it('S32b counter_neigh при Elusive Oceloticorn у соперника → «Counter-Neigh is blocked by Elusive Oceloticorn», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({
      cards: { c_elusive: ELUSIVE, c_counter_1: COUNTER }, p1Stable: ['c_elusive'], p2Hand: ['c_counter_1'], pending: { cancelLevel: 1 },
    });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'counter_neigh', instantCardId: 'c_counter_1' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('Counter-Neigh is blocked by Elusive Oceloticorn');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S33 frankencorn_intercept от актёра на собственный розыгрыш → отказ, состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_frank: FRANK } });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p1', kind: 'frankencorn_intercept' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('Actor cannot use Frankencorn on own play');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S33b frankencorn_intercept без Frankencorn в стойле реактора → «Frankencorn not in stable», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_frank: FRANK } });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p2', kind: 'frankencorn_intercept' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('Frankencorn not in stable');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S34 objection: Neigh возвращается владельцу в руку, cancelLevel 1→0, цена списана', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({
      cards: { c_obj_1: OBJECTION, c_junk: JUNK, c_neigh_1: NEIGH },
      p1Hand: ['c_basic_1', 'c_obj_1', 'c_junk'],
      pending: { cancelLevel: 1, lastCancelBy: 'p2', lastCancelCardId: 'c_neigh_1' },
    });
    games.get(gameId)!.state.players[1].discard.push('c_neigh_1');
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p1', kind: 'objection', instantCardId: 'c_obj_1', discardCardId: 'c_junk' });

    expect(ack.ok).toBe(true);
    expect(pendingOf(gameId).cancelLevel).toBe(0);
    const st = games.get(gameId)!.state;
    expect(st.players[1].hand).toContain('c_neigh_1');
    expect(st.players[1].discard).not.toContain('c_neigh_1');
    expect(st.players[0].hand).not.toContain('c_obj_1');
    expect(st.players[0].hand).not.toContain('c_junk');
  });

  it('S34b objection без активной отмены → «No Neigh to object to», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({ cards: { c_obj_1: OBJECTION }, p1Hand: ['c_basic_1', 'c_obj_1'] });
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p1', kind: 'objection', instantCardId: 'c_obj_1' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('No Neigh to object to');
    expect(snapshotOf(gameId)).toBe(before);
  });

  it('S34c objection без карты Objection у держателя → «No Objection in hand to react», состояние неизменно', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedWindow({
      cards: { c_junk: JUNK, c_neigh_1: NEIGH }, p1Hand: ['c_basic_1', 'c_junk'],
      pending: { cancelLevel: 1, lastCancelBy: 'p2', lastCancelCardId: 'c_neigh_1' },
    });
    games.get(gameId)!.state.players[1].discard.push('c_neigh_1');
    const before = snapshotOf(gameId);
    const socket = makeSocket();

    const ack = await socket.trigger('react', { gameId, playerId: 'p1', kind: 'objection', discardCardId: 'c_junk' });

    expect(ack.ok).toBe(false);
    expect(ack.message).toBe('No Objection in hand to react');
    expect(snapshotOf(gameId)).toBe(before);
  });
});
