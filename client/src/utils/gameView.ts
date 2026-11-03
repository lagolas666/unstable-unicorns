/**
 * Приведение GameState с сервера к виду, удобному для UI.
 * Никакой игровой логики здесь нет: только чтение счётчиков и подписей.
 */
import type { GameState, TurnPhase } from '../types/socket';

/** Тип карты — единорог? (baby/basic/magical/ultimate/... все содержат 'unicorn') */
export function isUnicornType(type: string | undefined): boolean {
  if (!type) return false;
  return type.toLowerCase().includes('unicorn');
}

export interface PlayerSeat {
  id: string;
  label: string;
  unicorns: number;
  handCount: number;
  isCurrent: boolean;
  isMe: boolean;
}

export interface GameView {
  players: PlayerSeat[];
  phase: TurnPhase;
  currentPlayerId: string;
  deckCount: number;
  discardCount: number;
  myHand: string[];
  winnerId?: string;
  /** Карта уже добрана в этом ходу (state.turn.has_drawn). */
  hasDrawn: boolean;
  /** Имя карты по id из словаря игры. */
  cardName: (cardId: string) => string;
}

export interface NormalizeOptions {
  /** id моего игрока — для подсветки «ваш ход» и собственной руки. */
  playerId?: string;
  /** Подписи игроков по id (никнеймы хранятся только на клиенте). */
  nicknames?: Record<string, string>;
}

/** Собрать счётчики и подписи из состояния движка. */
export function toGameView(state: GameState | null, options: NormalizeOptions = {}): GameView | null {
  if (!state?.players || !state.turn) return null;
  const { playerId, nicknames = {} } = options;
  const currentPlayerId = state.turn.currentPlayerId;

  const players: PlayerSeat[] = state.players.map((p) => {
    // Единороги в стойле: типы берём из словаря карт
    const unicorns = p.stable.filter((cid) => isUnicornType(state.cards?.[cid]?.type)).length;
    return {
      id: p.id,
      label: nicknames[p.id] || (p.id === playerId ? 'Вы' : p.id),
      unicorns,
      handCount: p.hand.length,
      isCurrent: p.id === currentPlayerId,
      isMe: p.id === playerId,
    };
  });

  const me = state.players.find((p) => p.id === playerId);

  return {
    players,
    phase: state.turn.phase,
    currentPlayerId,
    deckCount: state.deck?.length ?? 0,
    discardCount: state.discard?.length ?? 0,
    myHand: me?.hand ?? [],
    winnerId: state.winnerId,
    hasDrawn: state.turn.has_drawn === true,
    cardName: (cardId: string) => state.cards?.[cardId]?.name || cardId,
  };
}

/** Подпись фазы для интерфейса. */
export const PHASE_LABELS: Record<TurnPhase, string> = {
  begin_turn: 'Начало хода',
  draw: 'Добор карты',
  action: 'Фаза действий',
  end_turn: 'Конец хода',
};
