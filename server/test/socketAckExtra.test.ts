/**
 * Socket-ack: проброс `extra` до клиента (стража для задачи 6c-2).
 *
 * Зачем этот файл. В `src/socket/handlers.ts` появился проброс `extra`:
 *   - fail() L47-51 кладёт extra, только если это объект;
 *   - play_card L183 / draw_card L214 / end_turn L239 передают result.extra;
 *   - ackFromOutcome L120 передаёт outcome.body?.extra.
 * Клиент (useSocket.ts handleAck) по ack.extra.needTargetPlayer открывает окно
 * выбора цели вместо общего «Некорректный запрос». До этого файла ни один тест
 * в server/test/** проброс не проверял: мутация, снимающая extra, гейт не краснила.
 *
 * Транспорт не поднимаем (socket.io-client не в зависимостях сервера):
 * регистрируем хендлеры фейковым io, как в socket.test.ts.
 *
 * Область честной стражи (проверено по коду, 31.10.2026):
 *   extra порождается ТОЛЬКО в gameService.playCard (L526, L536, L574, L579).
 *   drawCard и endTurn extra не возвращают, и ни одна из 15 функций react*
 *   не отдаёт fail с extra. Поэтому строки L214, L239 и ackFromOutcome (L120)
 *   сегодня эквивалентны при мутации — этот файл фиксирует их текущее
 *   поведение (отказ без лишнего extra), но НЕ заявляет их убитыми.
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

const DOWNGRADE = 'c_down_1';
const BASIC = 'c_basic_1';

function makeSocket(id = 'socket-1'): FakeSocket {
  return io.connect(new FakeSocket(id));
}

/**
 * Детерминированная игра через тестовый REST-эндпоинт.
 * p1 держит downgrade + базового единорога, у p2 пусто, фаза action.
 */
async function seedGame(over?: Partial<{ phase: string; hasDrawn: boolean; current: string }>) {
  const state = {
    players: [
      {
        id: 'p1', deck: [], hand: [DOWNGRADE, BASIC], discard: [],
        stable: [], nursery: [], field: [], action_points: 1,
      },
      {
        id: 'p2', deck: [], hand: [], discard: [],
        stable: [], nursery: [], field: [], action_points: 1,
      },
    ],
    cards: {
      [DOWNGRADE]: { id: DOWNGRADE, name: 'Тестовый Downgrade', type: 'downgrade', effects: [] },
      [BASIC]: { id: BASIC, name: 'Базовый Единорог', type: 'basic_unicorn', effects: [] },
    },
    turn: {
      currentPlayerId: over?.current ?? 'p1',
      phase: over?.phase ?? 'action',
      has_drawn: over?.hasDrawn ?? true,
    },
    deck: [],
    discard: [],
  };
  const res = await request(app).post('/api/game/test/create').send({ state });
  expect(res.status).toBe(200);
  return res.body.id as string;
}

/** Снимок значимого состояния из стора (ack при отказе состояние не несёт). */
function snapshot(gameId: string) {
  const entry = games.get(gameId);
  const p1 = entry!.state.players.find((p: any) => p.id === 'p1')!;
  const p2 = entry!.state.players.find((p: any) => p.id === 'p2')!;
  return {
    hand: p1.hand.slice(),
    actionPoints: p1.action_points,
    stable1: p1.stable.length,
    stable2: p2.stable.length,
    logs: entry!.logs.length,
  };
}

beforeEach(() => {
  games.clear();
});

// --- A. play_card: extra доезжает до клиента --------------------------------

describe('Socket ack: extra в play_card', () => {
  it('A1 downgrade без targetPlayerId → extra.needTargetPlayer, состояние не мутировано', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ phase: 'action' });
    const socket = makeSocket('s-a1');
    const before = snapshot(gameId);

    const ack = await socket.trigger('play_card', {
      gameId,
      playerId: 'p1',
      cardId: DOWNGRADE,
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    // сама стража: без неё клиент видит только текст «Некорректный запрос»
    expect(ack.extra).toBeTruthy();
    expect(ack.extra.needTargetPlayer).toBe(true);
    expect(ack.extra.kind).toBe('downgrade');
    expect(Array.isArray(ack.extra.options.players)).toBe(true);
    expect(ack.extra.options.players).toContain('p1');
    expect(ack.extra.options.players).toContain('p2');

    // отказ не мутирует состояние
    const after = snapshot(gameId);
    expect(after.hand).toContain(DOWNGRADE);
    expect(after.actionPoints).toBe(before.actionPoints);
    expect(after.stable1).toBe(before.stable1);
    expect(after.stable2).toBe(before.stable2);
  });

  it('A2 невалидный targetPlayerId → extra.invalid, карта в руке, очко не списано', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket('s-a2');
    const before = snapshot(gameId);

    const ack = await socket.trigger('play_card', {
      gameId,
      playerId: 'p1',
      cardId: DOWNGRADE,
      targetPlayerId: 'ghost',
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('BAD_REQUEST');
    expect(ack.extra).toBeTruthy();
    expect(ack.extra.invalid).toBe('ghost');
    expect(ack.extra.kind).toBe('downgrade');

    const after = snapshot(gameId);
    expect(after.hand).toContain(DOWNGRADE);
    expect(after.actionPoints).toBe(before.actionPoints);
    expect(after.stable2).toBe(before.stable2);
  });

  it('A3 валидная цель → ok:true и НЕТ ключа extra (окно не открывается ложно)', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame();
    const socket = makeSocket('s-a3');
    const before = snapshot(gameId);

    const ack = await socket.trigger('play_card', {
      gameId,
      playerId: 'p1',
      cardId: DOWNGRADE,
      targetPlayerId: 'p2',
    });

    expect(ack.ok).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(ack, 'extra')).toBe(false);

    const after = snapshot(gameId);
    expect(after.hand).not.toContain(DOWNGRADE);
    expect(after.stable2).toBeGreaterThan(before.stable2);
  });
});

// --- B. отказы без extra: пустой объект не появляется ----------------------

describe('Socket ack: отказ без extra не обрастает пустым объектом', () => {
  it('B1 GAME_NOT_FOUND → ключа extra нет', async () => {
    registerSocketHandlers(io as any);
    const socket = makeSocket('s-b1');

    const ack = await socket.trigger('play_card', {
      gameId: 'no-such-game',
      playerId: 'p1',
      cardId: DOWNGRADE,
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('GAME_NOT_FOUND');
    expect(Object.prototype.hasOwnProperty.call(ack, 'extra')).toBe(false);
  });

  it('B2 draw_card вне фазы begin_turn → WRONG_PHASE без extra', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ phase: 'action', hasDrawn: true });
    const socket = makeSocket('s-b2');

    const ack = await socket.trigger('draw_card', { gameId, playerId: 'p1' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('WRONG_PHASE');
    expect(Object.prototype.hasOwnProperty.call(ack, 'extra')).toBe(false);
  });

  it('B3 end_turn не своим игроком → NOT_YOUR_TURN без extra', async () => {
    registerSocketHandlers(io as any);
    const gameId = await seedGame({ current: 'p1' });
    const socket = makeSocket('s-b3');
    const before = snapshot(gameId);

    const ack = await socket.trigger('end_turn', { gameId, playerId: 'p2' });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('NOT_YOUR_TURN');
    expect(ack.extra).toBeUndefined();
    // ход не переехал
    expect(snapshot(gameId).actionPoints).toBe(before.actionPoints);
  });
});
