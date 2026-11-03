/**
 * Socket-соединение и действия по контракту 6b-3b/6c.
 *
 * Правила слоя:
 * - никакой игровой логики: только отправка событий и подписка;
 * - КАЖДОЕ действие передаёт ack вторым аргументом, иначе ошибка сервера не видна;
 * - ack с ok:false никогда не проглатывается — он попадает в lastError и в интерфейс.
 */
import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerOrigin } from '../utils/serverOrigin';
import { isPendingAlive, nextPending } from '../utils/pendingFromAck';
import type {
  GameState,
  LogEntry,
  PendingInfo,
  PlayCardPayload,
  ReactExtra,
  SocketAck,
} from '../types/socket';

/** Сколько ждём ack, прежде чем признать, что сервер не ответил. */
const ACK_TIMEOUT_MS = 10000;

/**
 * Отправка события с обязательным ack.
 * Возвращает null, если сервер не ответил за ACK_TIMEOUT_MS (соединение живо, но молчит).
 */
export function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<SocketAck | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ACK_TIMEOUT_MS);

    socket.emit(event, payload, (res: SocketAck) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(res ?? null);
    });
  });
}

export interface SocketErrorInfo {
  event: string;
  code: string;
  message: string;
}

/** Соединение без игровой привязки (нужно лобби и отладочной панели). */
export function useSocketConnection(): { socket: Socket | null; connected: boolean } {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(getServerOrigin(), { transports: ['websocket', 'polling'] });
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, []);

  return { socket, connected };
}

export interface UseGameSocketResult {
  connected: boolean;
  state: GameState | null;
  logs: LogEntry[];
  pending: PendingInfo | null;
  lastError: SocketErrorInfo | null;
  /** Ошибка из ack несёт event — по нему удобно показать, какое действие не прошло. */
  clearError: () => void;
  playCard: (payload: Omit<PlayCardPayload, 'gameId' | 'playerId'>) => Promise<SocketAck | null>;
  drawCard: () => Promise<SocketAck | null>;
  endTurn: () => Promise<SocketAck | null>;
  /** cardId нужен окну await_choice (защитник называет карту); без аргумента — пропуск окна реакции. */
  resolvePending: (extra?: { cardId?: string }) => Promise<SocketAck | null>;
  /** Реакция в открытом окне: поля зависят от вида (см. ReactExtra и handlers.ts). */
  react: (kind: string, extra?: ReactExtra) => Promise<SocketAck | null>;
}

/**
 * Игровая привязка: соединение + вход в комнату игры + состояние.
 * playerId обязателен для действий, но для наблюдения можно не передавать.
 */
export function useGameSocket(gameId: string | undefined, playerId: string | undefined): UseGameSocketResult {
  const { socket, connected } = useSocketConnection();
  const [state, setState] = useState<GameState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState<PendingInfo | null>(null);
  const [lastError, setLastError] = useState<SocketErrorInfo | null>(null);

  // Подписки: state_update / logs_update / pending_update
  useEffect(() => {
    if (!socket) return;

    const onState = (payload: any) => {
      // Сервер может прислать как сам GameState, так и { id, state } при создании игры
      const st = payload?.players && payload?.turn ? payload : payload?.state;
      if (st) setState(st as GameState);
    };
    const onLogs = (entries: unknown) => {
      if (Array.isArray(entries)) setLogs(entries as LogEntry[]);
    };
    // pending_update с null закрывает окно реакции
    const onPending = (value: unknown) => {
      setPending((value as PendingInfo) ?? null);
    };

    socket.on('state_update', onState);
    socket.on('logs_update', onLogs);
    socket.on('pending_update', onPending);

    return () => {
      socket.off('state_update', onState);
      socket.off('logs_update', onLogs);
      socket.off('pending_update', onPending);
    };
  }, [socket]);

  // Вход в комнату игры: join_game {gameId, playerId?} + ack, при выходе — leave_game {gameId}
  useEffect(() => {
    if (!socket || !gameId) return;
    let cancelled = false;

    (async () => {
      const res = await emitWithAck(socket, 'join_game', { gameId, playerId });
      if (cancelled) return;
      if (!res) {
        setLastError({ event: 'join_game', code: 'NO_ACK', message: 'Сервер не ответил на вход в игру' });
        return;
      }
      if (res.ok) {
        if (res.state) setState(res.state);
        if (res.logs) setLogs(res.logs);
        // pending из ack — снимок окна на момент входа.
        // Явный null закрывает окно, отсутствие поля ничего не меняет,
        // а уже истёкшее окно не показываем: пока шло переподключение,
        // таймер реакции мог выйти в ноль.
        setPending((current) => {
          const next = nextPending(current, res.pending);
          return isPendingAlive(next) ? next : null;
        });
      } else {
        setLastError({ event: 'join_game', code: res.code, message: res.message });
      }
    })();

    return () => {
      cancelled = true;
      // Выход из комнаты с ack: сервер ответит даже если игры уже нет
      void emitWithAck(socket, 'leave_game', { gameId });
    };
  }, [socket, gameId, playerId]);

  /** Общий обработчик ответа: успех/ошибка/молчание сервера. */
  const handleAck = useCallback((event: string, res: SocketAck | null): SocketAck | null => {
    if (!res) {
      setLastError({ event, code: 'NO_ACK', message: 'Сервер не ответил' });
      return null;
    }
    if (res.ok) {
      if (res.state) setState(res.state);
      // pending === null значит "окно закрыто" и обязан сбросить модалку;
      // отсутствующее поле значит "сервер не сообщал" - состояние не трогаем,
      // иначе draw_card/end_turn закрывали бы чужое открытое окно.
      setPending((current) => nextPending(current, res.pending));
      if (res.logs) setLogs(res.logs);
      setLastError(null);
    } else {
      setLastError({ event, code: res.code, message: res.message });
    }
    return res;
  }, []);

  const playCard = useCallback(
    async (payload: Omit<PlayCardPayload, 'gameId' | 'playerId'>) => {
      if (!socket || !gameId || !playerId) return null;
      const res = await emitWithAck(socket, 'play_card', { gameId, playerId, ...payload });
      return handleAck('play_card', res);
    },
    [socket, gameId, playerId, handleAck]
  );

  const drawCard = useCallback(async () => {
    if (!socket || !gameId || !playerId) return null;
    const res = await emitWithAck(socket, 'draw_card', { gameId, playerId });
    return handleAck('draw_card', res);
  }, [socket, gameId, playerId, handleAck]);

  const endTurn = useCallback(async () => {
    if (!socket || !gameId || !playerId) return null;
    const res = await emitWithAck(socket, 'end_turn', { gameId, playerId });
    return handleAck('end_turn', res);
  }, [socket, gameId, playerId, handleAck]);

  // resolve_pending и react обслуживает движок: server/src/socket/handlers.ts (L239 и L256).
  // Успех несёт state/pending/logs, отказ — код и текст; окно реакции показывает отказ, не закрываясь.
  const resolvePending = useCallback(async (extra?: { cardId?: string }) => {
    // playerId обязателен: сервер сверяет его с владельцем окна (guard в gameService).
    // Без него пропуск закрывал бы чужое окно реакции и лишал соперников права на Neigh.
    if (!socket || !gameId || !playerId) return null;
    const res = await emitWithAck(socket, 'resolve_pending', {
      gameId,
      playerId,
      ...(extra?.cardId ? { cardId: extra.cardId } : {}),
    });
    return handleAck('resolve_pending', res);
  }, [socket, gameId, playerId, handleAck]);

  const react = useCallback(
    async (kind: string, extra?: ReactExtra) => {
      if (!socket || !gameId || !playerId) return null;
      // Пустые поля не отправляем: сервер отличает отсутствие от пустой строки
      const clean: Record<string, string> = {};
      if (extra) {
        for (const [key, value] of Object.entries(extra)) {
          if (typeof value === 'string' && value !== '') clean[key] = value;
        }
      }
      const res = await emitWithAck(socket, 'react', { gameId, playerId, kind, ...clean });
      return handleAck('react', res);
    },
    [socket, gameId, playerId, handleAck]
  );

  const clearError = useCallback(() => setLastError(null), []);

  return {
    connected,
    state,
    logs,
    pending,
    lastError,
    clearError,
    playCard,
    drawCard,
    endTurn,
    resolvePending,
    react,
  };
}
