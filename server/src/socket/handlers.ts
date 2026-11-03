// Socket-слой полного движка (задача 6b-3b).
// Единственный вход: registerSocketHandlers(io). Ни Express, ни app здесь нет.
// Состояние — только из ../gameStore (общий Map с REST), действия — только из ../gameService.
// Своей игровой логики модуль не содержит: валидация payload + маппинг ошибок в коды.

import { Server as SocketIOServer } from 'socket.io';
import { GameState } from '../engine/state';
import { LogEntry, getGame } from '../gameStore';
import {
  playCard,
  endTurn,
  drawCard,
  RouteOutcome,
  reactNeigh,
  reactSuperNeigh,
  reactRedirect,
  reactShield,
  reactRewind,
  reactHypnorog,
  reactPrevent,
  reactIgnoreTarget,
  reactIntercept,
  reactInterceptSteal,
  reactCounterNeigh,
  reactFrankencornIntercept,
  reactPlayAsInstant,
  reactObjection,
  resolvePendingNow,
} from '../gameService';

// Коды ошибок заморожены под docs/socket-contract.md
export type SocketErrorCode =
  | 'GAME_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'NO_ACTION_POINTS'
  | 'WRONG_PHASE'
  | 'PENDING_ACTION';

export type SocketAck =
  | { ok: true; state?: GameState; pending?: any; logs?: LogEntry[] }
  | { ok: false; code: SocketErrorCode; message: string; extra?: any };

// --- вспомогательное -------------------------------------------------------

function fail(code: SocketErrorCode, message: string, extra?: any): SocketAck {
  // extra пробрасываем клиенту как есть: по needTargetPlayer/options он открывает
  // окно выбора цели вместо общего «Некорректный запрос» (409 downgrade без цели).
  const res: SocketAck = { ok: false, code, message };
  if (extra && typeof extra === 'object') (res as any).extra = extra;
  return res;
}

/** Безопасный ответ клиенту: клиент мог не передать ack. */
function reply(ack: unknown, res: SocketAck): void {
  if (typeof ack === 'function') {
    (ack as (r: SocketAck) => void)(res);
  }
}

/** Разослать обновление в комнату игры: сначала state_update, потом logs_update. */
function broadcastState(io: SocketIOServer, gameId: string, state: GameState, logs: LogEntry[]): void {
  try {
    const room = `game:${gameId}`;
    io.to(room).emit('state_update', state);
    io.to(room).emit('logs_update', logs.slice(-100));
  } catch {
    // транспорт не поднят (юнит-тесты) — молча пропускаем, состояние уже в сторе
  }
}

/** Ожидается окно реакции: вместо state_update уходит pending_update (как в REST-роутере). */
function broadcastPending(io: SocketIOServer, gameId: string, pending: any, logs: LogEntry[]): void {
  try {
    const room = `game:${gameId}`;
    io.to(room).emit('pending_update', pending);
    io.to(room).emit('logs_update', logs.slice(-100));
  } catch {
    // см. broadcastState
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// --- реакции (6b-3c-2) ------------------------------------------------------

type ReactionFn = (gameId: string, body: any, io?: any) => Promise<RouteOutcome>;

/** Socket-имя реакции -> функция сервиса. Тела живут в gameService. */
const REACTIONS: Record<string, ReactionFn> = {
  neigh: reactNeigh,
  super_neigh: reactSuperNeigh,
  redirect: reactRedirect,
  shield: reactShield,
  rewind: reactRewind,
  hypnorog: reactHypnorog,
  prevent: reactPrevent,
  ignore_target: reactIgnoreTarget,
  intercept: reactIntercept,
  intercept_steal: reactInterceptSteal,
  counter_neigh: reactCounterNeigh,
  frankencorn_intercept: reactFrankencornIntercept,
  play_as_instant: reactPlayAsInstant,
  objection: reactObjection,
};

/**
 * Ответ движка реакции -> socket-ack.
 * Состояние берём из стора: тела реакций уже положили его туда и разослали сами.
 */
function ackFromOutcome(gameId: string, outcome: RouteOutcome): SocketAck {
  const entry = getGame(gameId);
  const state = entry?.state;
  if (!outcome.ok) {
    const code = (outcome.body && (outcome.body.code as SocketErrorCode)) || 'BAD_REQUEST';
    const message = String((outcome.body && outcome.body.message) || 'Reaction failed');
    return fail(code, message, outcome.body?.extra);
  }
  const ack: SocketAck = { ok: true, state };
  if (entry) {
    ack.pending = entry.pending;
    ack.logs = entry.logs.slice(-100);
  }
  return ack;
}

// --- регистрация -----------------------------------------------------------

export function registerSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    // join_game: завести сокет в комнату игры и отдать текущее состояние
    socket.on('join_game', (payload: any, ack?: (r: SocketAck) => void) => {
      try {
        const gameId = asString(payload?.gameId);
        if (!gameId) return reply(ack, fail('BAD_REQUEST', 'gameId is required'));
        const entry = getGame(gameId);
        if (!entry) return reply(ack, fail('GAME_NOT_FOUND', 'Game not found'));
        socket.join(`game:${gameId}`);
        // pending отдаём вместе со state: клиент, вошедший в игру при открытом
        // окне реакции, иначе не увидит его до следующего pending_update.
        reply(ack, {
          ok: true,
          state: entry.state,
          pending: entry.pending,
          logs: entry.logs.slice(-100),
        });
      } catch (err: any) {
        reply(ack, fail('BAD_REQUEST', String(err?.message || err)));
      }
    });

    // leave_game: выйти из комнаты игры
    socket.on('leave_game', (payload: any, ack?: (r: SocketAck) => void) => {
      try {
        const gameId = asString(payload?.gameId);
        if (!gameId) return reply(ack, fail('BAD_REQUEST', 'gameId is required'));
        socket.leave(`game:${gameId}`);
        const entry = getGame(gameId);
        reply(ack, { ok: true, state: entry?.state });
      } catch (err: any) {
        reply(ack, fail('BAD_REQUEST', String(err?.message || err)));
      }
    });

    // play_card: розыгрыш карты через общий сервис, без собственной логики
    socket.on('play_card', async (payload: any, ack?: (r: SocketAck) => void) => {
      try {
        const gameId = asString(payload?.gameId);
        const playerId = asString(payload?.playerId);
        const cardId = asString(payload?.cardId);
        if (!gameId) return reply(ack, fail('BAD_REQUEST', 'gameId is required'));
        if (!playerId) return reply(ack, fail('BAD_REQUEST', 'playerId is required'));
        if (!cardId) return reply(ack, fail('BAD_REQUEST', 'cardId is required'));
        if (!getGame(gameId)) return reply(ack, fail('GAME_NOT_FOUND', 'Game not found'));

        const result = await playCard(gameId, playerId, cardId, {
          targets: Array.isArray(payload?.targets) ? payload.targets : undefined,
          targetPlayerId: payload?.targetPlayerId,
        });
        if (!result.ok) return reply(ack, fail(result.code, result.message, result.extra));

        // Успех — единственный случай, когда уходит broadcast (проверка S09)
        if (result.pending) {
          broadcastPending(io, gameId, result.pending, result.logs);
        } else {
          broadcastState(io, gameId, result.state, result.logs);
        }
        reply(ack, {
          ok: true,
          state: result.state,
          pending: result.pending,
          logs: result.logs.slice(-100),
        });
      } catch (err: any) {
        // Исключения наружу не выпускаем: любая ошибка уходит в ack
        reply(ack, fail('BAD_REQUEST', String(err?.message || err)));
      }
    });

    // draw_card: официальный добор через общий сервис — та же функция, что у REST
    // POST /:id/draw. Собственной логики добора здесь нет (задача 6b-3c-1).
    socket.on('draw_card', async (payload: any, ack?: (r: SocketAck) => void) => {
      try {
        const gameId = asString(payload?.gameId);
        const playerId = asString(payload?.playerId);
        if (!gameId) return reply(ack, fail('BAD_REQUEST', 'gameId is required'));
        if (!playerId) return reply(ack, fail('BAD_REQUEST', 'playerId is required'));
        if (!getGame(gameId)) return reply(ack, fail('GAME_NOT_FOUND', 'Game not found'));

        const result = await drawCard(gameId, playerId, { via: 'socket' });
        if (!result.ok) return reply(ack, fail(result.code, result.message, result.extra));

        broadcastState(io, gameId, result.state, result.logs);
        reply(ack, { ok: true, state: result.state, logs: result.logs.slice(-100) });
      } catch (err: any) {
        reply(ack, fail('BAD_REQUEST', String(err?.message || err)));
      }
    });

    // end_turn: завершение хода через сервис + проверка «свой ли ход» на входе
    socket.on('end_turn', async (payload: any, ack?: (r: SocketAck) => void) => {
      try {
        const gameId = asString(payload?.gameId);
        const playerId = asString(payload?.playerId);
        if (!gameId) return reply(ack, fail('BAD_REQUEST', 'gameId is required'));
        // playerId обязателен: без него проверка «свой ли ход» пропускалась (задача 6c-1)
        if (!playerId) return reply(ack, fail('BAD_REQUEST', 'playerId is required'));
        const entry = getGame(gameId);
        if (!entry) return reply(ack, fail('GAME_NOT_FOUND', 'Game not found'));
        const currentId = entry.state.turn.currentPlayerId;
        if (playerId && playerId !== currentId) {
          return reply(ack, fail('NOT_YOUR_TURN', 'Not your turn'));
        }

        const result = await endTurn(gameId);
        if (!result.ok) return reply(ack, fail(result.code, result.message, result.extra));

        broadcastState(io, gameId, result.state, result.logs);
        reply(ack, { ok: true, state: result.state, logs: result.logs.slice(-100) });
      } catch (err: any) {
        reply(ack, fail('BAD_REQUEST', String(err?.message || err)));
      }
    });

    // resolve_pending: закрытие окна реакции через общий движок (6b-3c-2).
    // Тело обработчика живёт в gameService; здесь только транспорт и ack.
    socket.on('resolve_pending', async (payload: any, ack?: (r: SocketAck) => void) => {
      try {
        const gameId = asString(payload?.gameId);
        if (!gameId) return reply(ack, fail('BAD_REQUEST', 'gameId is required'));
        // playerId обязателен: без него сервис пропускает проверку актора
        // (см. resolvePendingNow) и любой зритель закрывает чужое окно реакции.
        const playerId = asString(payload?.playerId);
        if (!playerId) return reply(ack, fail('BAD_REQUEST', 'playerId is required'));
        const entry = getGame(gameId);
        if (!entry) return reply(ack, fail('GAME_NOT_FOUND', 'Game not found'));

        // Имя вызывающего доезжает до сервиса: окно реакции закрывает только его актор.
        const body: any = { ...(payload?.body ?? payload ?? {}), byPlayerId: playerId };
        const outcome = await resolvePendingNow(gameId, body, io);
        return reply(ack, ackFromOutcome(gameId, outcome));
      } catch (err: any) {
        reply(ack, fail('BAD_REQUEST', String(err?.message || err)));
      }
    });

    // react: Neigh / super_neigh / redirect / shield / rewind / hypnorog / prevent / ignore_target.
    // Сервис сам рассылает state_update/pending_update/logs_update в комнату игры,
    // поэтому socket-слой broadcast не дублирует.
    socket.on('react', async (payload: any, ack?: (r: SocketAck) => void) => {
      try {
        const gameId = asString(payload?.gameId);
        const playerId = asString(payload?.playerId);
        const kind = asString(payload?.kind);
        if (!gameId) return reply(ack, fail('BAD_REQUEST', 'gameId is required'));
        if (!playerId) return reply(ack, fail('BAD_REQUEST', 'playerId is required'));
        if (!kind) return reply(ack, fail('BAD_REQUEST', 'kind is required'));
        const entry = getGame(gameId);
        if (!entry) return reply(ack, fail('GAME_NOT_FOUND', 'Game not found'));

        // Единый конверт: socket-имена полей -> имена, которые читает движок реакций
        const body: any = {
          byPlayerId: playerId,
          instantCardId: payload?.instantCardId,
          discardCardId: payload?.discardCardId,
          targetId: payload?.targetId,
          // redirect целится в игрока — движок ждёт toTargetId
          toTargetId: payload?.toTargetId ?? payload?.targetId,
          receiverPlayerId: payload?.receiverPlayerId,
          cardId: payload?.cardId,
        };

        const fn = REACTIONS[kind];
        if (!fn) {
          return reply(ack, fail('BAD_REQUEST', 'Unknown reaction kind: ' + kind));
        }
        const outcome = await fn(gameId, body, io);
        return reply(ack, ackFromOutcome(gameId, outcome));
      } catch (err: any) {
        reply(ack, fail('BAD_REQUEST', String(err?.message || err)));
      }
    });
  });
}
