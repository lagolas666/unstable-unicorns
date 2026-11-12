import { Effect, Trigger, Action } from '../../../shared/src/types';

export type GamePhase = 'begin_turn' | 'draw' | 'action' | 'end_turn';

export interface PlayerRef {
  id: string;
}

export interface CardRef {
  id: string;
}

export type GameEvent =
  | { type: 'phase_started'; phase: GamePhase; player: PlayerRef }
  | { type: 'card_played'; card: CardRef; player: PlayerRef }
  | { type: 'effect_triggered'; effect: Effect; source: CardRef; trigger: Trigger; player: PlayerRef }
  | { type: 'action_resolved'; action: Action; success: boolean }
  // Решафл сброса в колоду при доборе эффектом (правило UU): size — размер новой колоды.
  | { type: 'reshuffle'; size: number };

export interface EventListener {
  (event: GameEvent): void;
}

export class EventBus {
  private listeners: Set<EventListener> = new Set();

  on(listener: EventListener) {
    this.listeners.add(listener);
  }

  off(listener: EventListener) {
    this.listeners.delete(listener);
  }

  emit(event: GameEvent) {
    for (const l of this.listeners) l(event);
  }
}
