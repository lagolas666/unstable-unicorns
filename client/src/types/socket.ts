/**
 * Типы socket-контракта полного движка (задача 6c).
 * Источник истины: server/src/socket/handlers.ts и docs/socket-contract.md.
 *
 * События в snake_case. Каждое действие принимает вторым аргументом ack-колбэк
 * вида (res: SocketAck) => void: без него ошибку с сервера не увидеть.
 */

/** Фаза хода в движке (server/src/engine/state.ts). */
export type TurnPhase = 'begin_turn' | 'draw' | 'action' | 'end_turn';

/** Игрок в состоянии движка. Карты — только id, описания лежат в state.cards. */
export interface PlayerState {
  id: string;
  hand: string[];
  stable: string[];
  discard: string[];
  nursery: string[];
  deck: string[];
  field: string[];
  action_points: number;
}

/** Ход: чей и в какой фазе. */
export interface TurnState {
  currentPlayerId: string;
  phase: TurnPhase;
  has_drawn?: boolean;
}

/** Минимальное описание карты из словаря state.cards. */
export interface CardInfo {
  id: string;
  name?: string;
  type?: string;
  /**
   * Путь к картинке карты от сервера: "/cards/foo.png" (public клиента),
   * "/uploads/bar.webp" (вложения сервера) или абсолютный URL.
   * Поле необязательное — старые состояния приходят без него.
   */
  image?: string;
  /**
   * Текст правила карты (поле description каталога unicorns.json).
   * Нужен для лица карты на столе: иначе на карте только название и тип.
   */
  description?: string;
  /** Подтип мгновенной карты: neigh, super_neigh, shield и т.д. */
  instant_subtype?: string;
  effects?: unknown[];
}

/** Состояние игры, которое сервер рассылает в state_update. */
export interface GameState {
  players: PlayerState[];
  turn: TurnState;
  cards: Record<string, CardInfo>;
  deck?: string[];
  discard?: string[];
  /**
   * Общая колода яслей (nursery) на весь стол — как state.deck.
   * Поле опциональное: старые состояния и фикстуры приходят без него,
   * поэтому на клиенте обязателен guard `state.nursery?.length ?? 0`.
   */
  nursery?: string[];
  /** Проставляется сервисом при победе (gameService.checkWin). */
  winnerId?: string;
}

/** Запись журнала игры. */
export interface LogEntry {
  t: number;
  type: string;
  playerId?: string;
  details?: unknown;
}

/**
 * Окно реакции/промпта (pending из pending_update).
 * Поля взяты из server/src/gameStore.ts; структура шире, поэтому опциональна.
 * expiresAt — epoch в миллисекундах (Date.now() + окно на сервере).
 */
export interface PendingInfo {
  kind?: string;
  actorId?: string;
  sourceCardId?: string;
  cardId?: string;
  expiresAt?: number;
  uncounterable?: boolean;
  /** Сумма отмены: Ржание +1, Супер Ржание +2, Возражение снимает. */
  cancelLevel?: number;
  lastCancelBy?: string;
  lastCancelCardId?: string;
  prompts?: unknown[];
  [key: string]: unknown;
}

/** Коды ошибок, замороженные на сервере. */
export type SocketErrorCode =
  | 'GAME_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'NO_ACTION_POINTS'
  | 'WRONG_PHASE'
  | 'PENDING_ACTION'
  // Требуется игрок-цель (upgrade/downgrade): сервер отдаёт 409 с текстом,
  // код добавлен как страховка для маппинга в UI.
  | 'TARGET_REQUIRED';

/** Ответ сервера в ack. */
/**
 * Дополнительные сведения об отказе. Сервер (handlers.ts, fail(code, message, extra))
 * пробрасывает сюда признаки, по которым клиент открывает нужный диалог, не разбирая текст.
 */
export interface AckExtra {
  /** Сервер требует явную цель игрока (downgrade без targetPlayerId). */
  needTargetPlayer?: boolean;
  /** Тип карты, для которой запрошена цель: 'upgrade' | 'downgrade'. */
  kind?: string;
  /** Цель, которую сервер счёл недопустимой (если пришла и отклонена). */
  invalid?: string;
  /** Кандидаты в цели — id игроков этого же стола. */
  options?: { players?: string[] };
}

export type SocketAck =
  | { ok: true; state?: GameState; pending?: PendingInfo | null; logs?: LogEntry[] }
  | { ok: false; code: SocketErrorCode; message: string; extra?: AckExtra };

/** Идентификаторы, которые игрок вводит сам (локальное состояние клиента). */
export interface LocalIdentity {
  playerId: string;
  nickname: string;
}

/** --- Payload'ы исходящих событий ------------------------------------------ */

export interface JoinGamePayload {
  gameId: string;
  playerId?: string;
}

export interface LeaveGamePayload {
  gameId: string;
}

export interface PlayCardPayload {
  gameId: string;
  playerId: string;
  cardId: string;
  targets?: string[];
  targetPlayerId?: string;
}

export interface DrawCardPayload {
  gameId: string;
  playerId: string;
}

export interface EndTurnPayload {
  gameId: string;
  playerId: string;
}

export interface ResolvePendingPayload {
  gameId: string;
  /** Кто закрывает окно: сервер сверяет с владельцем окна реакции. */
  playerId: string;
  /** Карта, которую защитник выбирает в окне await_choice (для реакций не нужна). */
  cardId?: string;
}

/** Поля реакции, которые зависят от вида (матрица в server/src/socket/handlers.ts). */
export interface ReactExtra {
  instantCardId?: string;
  discardCardId?: string;
  targetId?: string;
  /** redirect: новая цель. */
  toTargetId?: string;
  /** intercept / intercept_steal: получатель. */
  receiverPlayerId?: string;
  /** play_as_instant: карта из руки. */
  cardId?: string;
}

export interface ReactPayload extends ReactExtra {
  gameId: string;
  playerId: string;
  kind: string;
}

/** Ответ REST POST /api/game — создание игры в общем gameStore. */
export interface CreateGameResponse {
  /** id игры в gameStore, по нему открывается /room/:gameId */
  id: string;
  state: GameState;
}

/** Комната лобби (server/src/lobbyStore.ts). Хранилище отдельное от gameStore. */
export interface LobbyRoom {
  id: string;
  name: string;
  maxPlayers: number;
  players: string[];
  status: 'waiting' | 'in_progress';
  createdAt: number;
}
