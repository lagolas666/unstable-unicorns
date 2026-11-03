/**
 * resolve_pending: закрывать окно реакции может только его актор (дефект класса #50).
 *
 * Зачем файл. До него гейт не краснел ни на одной из двух строк:
 *   - handlers.ts L257  if (!playerId) return reply(ack, fail('BAD_REQUEST','playerId is required'));
 *   - handlers.ts L262  body.byPlayerId = playerId;
 *   - gameService.ts L1891  if (byPlayerId && pending.actorId !== byPlayerId) -> 400 'Not your reaction window'
 * S19/S20 в socket.test.ts держат только успешный путь и «нет окна»: они всегда
 * передают playerId: 'p1', поэтому отказ без playerId и отказ постороннему
 * не проверялись.
 *
 * Транспорт не поднимаем (socket.io-client нет в зависимостях сервера):
 * фейковый io + FakeSocket, как в socket.test.ts / socketAckExtra.test.ts.
 * Игра создаётся через POST /api/game/test/create, окно реакции выставляется
 * прямо в сторе (тот же приём, что seedNeighWindow), снимок состояния берём
 * из стора, потому что ack при отказе состояние не несёт.
 */
import express from 'express';
import request from 'supertest';
import gameRouter from '../src/routes/game';
import { games } from '../src/gameStore';
import { registerSocketHandlers } from '../src/socket/handlers';

// --- фейковый socket.io -----------------------------------------------------

class FakeIo {
  public connectionHandler: ((socket: FakeSocket) => void) | null = null;

  on(event: string, handler: (socket: FakeSocket) => void) {
    if (event === 'connection') this.connectionHandler = handler;
    return this;
  }

  to(_room: string) {
    return { emit: (_event: string, _payload: any) => undefined };
  }

  connect(socket: FakeSocket): FakeSocket {
    if (!this.connectionHandler) {
      throw new Error('registerSocketHandlers did not register a "connection" handler');
    }
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
    if (!handler) {
      return Promise.reject(new Error(`socket handler "${event}" is not registered`));
    }
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

const PLAYED = 'c_basic_1';

function makeSocket(id = 'socket-1'): FakeSocket {
  return io.connect(new FakeSocket(id));
}

/** Игра: p1 играет c_basic_1 в action-фазе, окно реакции открыто для p1. */
async function seedOpenWindow(): Promise<string> {
  const state = {
    players: [
      {
        id: 'p1', deck: [], hand: [PLAYED], discard: [],
        stable: [], nursery: [], field: [], action_points: 1,
      },
      {
        id: 'p2', deck: [], hand: [], discard: [],
        stable: [], nursery: [], field: [], action_points: 1,
      },
    ],
    cards: {
      [PLAYED]: { id: PLAYED, name: 'Базовый Единорог', type: 'basic_unicorn', effects: [] },
    },
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true },
    deck: [],
    discard: [],
  };
  const res = await request(app).post('/api/game/test/create').send({ state });
  expect(res.status).toBe(200);
  const gameId = res.body.id as string;

  const entry = games.get(gameId)!;
  entry.pending = {
    kind: 'play', actorId: 'p1', cardId: PLAYED, uncounterable: false,
    cancelLevel: 0, expiresAt: Date.now() + 60000,
  } as any;
  return gameId;
}

/** Снимок значимого состояния: ack при отказе состояние не несёт. */
function snapshot(gameId: string) {
  const entry = games.get(gameId)!;
  const p1 = entry.state.players.find((p: any) => p.id === 'p1')!;
  const pending: any = entry.pending;
  return {
    hand: p1.hand.slice(),
    stable: p1.stable.slice(),
    actionPoints: p1.action_points,
    logs: entry.logs.length,
    pendingKind: pending ? pending.kind : null,
    pendingActor: pending ? pending.actorId : null,
    cancelLevel: pending ? pending.cancelLevel : null,
  };
}

beforeEach(() => {
  games.clear();
});

afterEach(() => {
  // schedulePendingResolution ставит таймер: снимаем, иначе jest не завершится
  for (const e of games.values()) {
    if (e.pendingTimeout) {
      clearTimeout(e.pendingTimeout);
      e.pendingTimeout = undefined;
    }
  }
});

// --- отказы ----------------------------------------------------------------

describe('resolve_pending: владелец окна реакции', () => {
  it('R1 без playerId → BAD_REQUEST "playerId is required", окно и карты не тронуты', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedOpenWindow();
    const socket = makeSocket('s-r1');
    const before = snapshot(gameId);

    const ack = await socket.trigger('resolve_pending', { gameId });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('playerId is required');
    // Отказ до сервиса: состояние байт-в-байт то же
    expect(snapshot(gameId)).toEqual(before);
  });

  it('R2 посторонний (p2) не закрывает окно актёра p1 → отказ, окно открыто', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedOpenWindow();
    const socket = makeSocket('s-r2');
    const before = snapshot(gameId);

    const ack = await socket.trigger('resolve_pending', { gameId, playerId: 'p2' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.message).toBe('Not your reaction window');
    // Ничего не мутировано: карта в руке, стойло пусто, окно на месте
    expect(snapshot(gameId)).toEqual(before);
    expect(before.hand).toEqual([PLAYED]);
    expect(before.stable).toEqual([]);
  });

  it('R3 несуществующая игра → GAME_NOT_FOUND, до сервиса не доходит', async () => {
    registerSocketHandlers(io as any);
    const socket = makeSocket('s-r3');

    const ack = await socket.trigger('resolve_pending', { gameId: 'no-such-game', playerId: 'p1' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('GAME_NOT_FOUND');
  });
});

// --- положительный сценарий ------------------------------------------------

describe('resolve_pending: актор закрывает своё окно', () => {
  it('R4 actorId p1 → ok, окно закрыто, карта уходит из руки в стойло', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedOpenWindow();
    const socket = makeSocket('s-r4');

    const ack = await socket.trigger('resolve_pending', { gameId, playerId: 'p1' });

    expect(ack.ok).toBe(true);
    expect(ack.pending).toBeNull();
    expect(games.get(gameId)!.pending).toBeNull();
    const p1 = games.get(gameId)!.state.players[0];
    expect(p1.stable).toContain(PLAYED);
    expect(p1.hand).not.toContain(PLAYED);
  });

  it('R5 REST-путь без byPlayerId по-прежнему резолвит (условная проверка в сервисе)', async () => {
    const gameId = await seedOpenWindow();

    const res = await request(app).post(`/api/game/${gameId}/resolvePending`).send({});

    expect(res.status).toBe(200);
    expect(games.get(gameId)!.pending).toBeNull();
    const p1 = games.get(gameId)!.state.players[0];
    expect(p1.stable).toContain(PLAYED);
  });
});
