// Хранилище игр и типы pending-состояния для полного движка.
// Задача 6b: вынесено из routes/game.ts, чтобы REST и socket работали с одним и тем же Map.
// ВНИМАНИЕ: объект games экспортируется целиком (не обёртка), чтобы 37 обращений в routes/game.ts
// остались без изменений.

import { GameState } from './engine/state';
import { EventBus } from './engine/events';
import { TurnStartPrompt } from './engine/executor';

// Запись журнала игры (структурно совпадает с LogEntry в routes/game.ts)
export type LogEntry = { t: number; type: 'draw' | 'play' | 'end' | 'react' | 'discard' | 'turn_start_effect' | 'trigger_effect' | 'debug'; playerId?: string; details?: any };

export type PendingPlayCore = { kind: 'play'; actorId: string; cardId: string; expiresAt?: number; uncounterable?: boolean };
export type PendingPrompt = { kind: 'prompt'; actorId: string; prompts: TurnStartPrompt[] };
export type PendingPlay = (PendingPlayCore & {
  redirects?: { toTargetId?: string };
  intercept?: { receiverPlayerId?: string };
  cancelLevel?: number;
  lastCancelBy?: string;
  hypnorog?: { cancel?: boolean; by?: string; discardCardId?: string };
}) | null;
export type PendingTurnStartEffect = {
  kind: 'turn_start_effect';
  actorId: string; // current player (whose start-of-turn effect it is)
  sourceCardId: string;
  effectIdx: number;
  expiresAt?: number;
  uncounterable?: boolean;
  // сохранение предварительно выбранных целей/получателя (если UI передал)
  preTargets?: string[];
  preTargetPlayerId?: string;
  hypnorog?: { cancel?: boolean; by?: string; discardCardId?: string };
} | null;
export type PendingTriggerEffect = {
  kind: 'trigger_effect';
  trigger: 'when_destroyed' | 'when_enters';
  actorId: string;
  sourceCardId: string;
  effectIdx: number;
  expiresAt?: number;
  uncounterable?: boolean;
  allow_intercept?: boolean;
  // сохранение предварительно выбранных целей/получателя (если UI или executor передал)
  preTargets?: string[];
  preTargetPlayerId?: string;
  redirects?: { toTargetId?: string };
  intercept?: { receiverPlayerId?: string };
  cancelLevel?: number;
  lastCancelBy?: string;
  hypnorog?: { cancel?: boolean; by?: string; discardCardId?: string };
} | null;
export type Pending = PendingPlay | PendingPrompt | PendingTurnStartEffect | PendingTriggerEffect | null;

// Полное состояние одной игры в памяти процесса
export type GameEntry = { state: GameState; bus: EventBus; logs: LogEntry[]; pending: Pending; pendingTimeout?: any };

// Единственное хранилище игр. Общий объект для REST-роутов и socket-слоя.
export const games = new Map<string, GameEntry>();

// --- Тонкие accessors для socket-слоя: чтобы он не зависел от формы Map ---

/** Получить игру по id (или undefined, если игры нет). */
export function getGame(gameId: string): GameEntry | undefined {
  return games.get(gameId);
}

/** Сохранить игру по id. */
export function setGame(gameId: string, entry: GameEntry): void {
  games.set(gameId, entry);
}

/** Проверить наличие игры. */
export function hasGame(gameId: string): boolean {
  return games.has(gameId);
}

/** Удалить игру и снять её таймер, чтобы не текли хэндлы. */
export function deleteGame(gameId: string): boolean {
  const entry = games.get(gameId);
  if (!entry) return false;
  if (entry.pendingTimeout) {
    try { clearTimeout(entry.pendingTimeout); } catch { /* таймер уже снят */ }
  }
  return games.delete(gameId);
}

/** Список живых игр (только для отладки и админки). */
export function listGames(): { gameId: string; players: number; pendingKind: string | null }[] {
  const out: { gameId: string; players: number; pendingKind: string | null }[] = [];
  for (const [gameId, entry] of games.entries()) {
    out.push({
      gameId,
      players: entry.state?.players?.length ?? 0,
      pendingKind: entry.pending ? (entry.pending as any).kind ?? null : null,
    });
  }
  return out;
}

/** Тип доступа к хранилищу — для socket-обработчиков. */
export type GamesMap = Map<string, GameEntry>;
