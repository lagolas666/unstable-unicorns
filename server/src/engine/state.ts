import { Card, Zone } from '../../../shared/src/types';

export interface PlayerState {
  id: string;
  deck: string[]; // card ids, top at end
  hand: string[];
  discard: string[];
  stable: string[];
  nursery: string[]; // baby unicorns
  field: string[]; // temporary area if needed
  action_points: number;
  noNeighUntilEndOfTurn?: boolean; // Objection: владелец Ржания не может играть Ржание до конца своего хода
}

export interface CardDictionary {
  [cardId: string]: Card;
}

export interface GameState {
  players: PlayerState[];
  turn: {
    currentPlayerId: string;
    phase: 'begin_turn' | 'draw' | 'action' | 'end_turn';
    has_drawn?: boolean; // whether the official draw for the turn has occurred
    // Б1: фазы, пропущенные в ЭТОМ ходу ('draw' | 'play' | 'action' | 'end').
    // Сбрасывается в endTurn при передаче хода: пропуск живёт один ход, а не всю партию.
    skippedPhases?: string[];
  };
  cards: CardDictionary;
  // Shared piles for the whole table
  deck?: string[]; // top at end
  discard?: string[];
  winnerId?: string; // защёлка победы: победитель объявляется один раз и не перезаписывается
  nursery?: string[]; // общая колода Яслей: baby-единороги не попадают в deck, из неё выдаётся начальный малыш
  // flags and continuous effects can be added later
}

export function getZoneArray(player: PlayerState, zone: Zone): string[] {
  switch (zone) {
    case 'deck':
      return player.deck;
    case 'hand':
      return player.hand;
    case 'discard':
      return player.discard;
    case 'stable':
      return player.stable;
    case 'nursery':
      return player.nursery;
    case 'field':
      return player.field;
    default:
      throw new Error(`Unsupported concrete zone for player view: ${zone}`);
  }
}
