// Card categories per wiki (RU/EN mapped to identifiers)
export type CardCategory =
  | 'baby_unicorn'
  | 'basic_unicorn'
  | 'magical_unicorn'
  | 'ultimate_unicorn'
  | 'magic'
  | 'instant'
  | 'upgrade'
  | 'downgrade'
  // backward-compat generic types (used by older UI)
  | 'unicorn'
  ;

export type Phase = 'draw' | 'play' | 'instant' | 'discard' | 'end';
export type Zone = 'hand' | 'deck' | 'discard' | 'stable' | 'field' | 'nursery' | 'any';
export type Scope = 'self' | 'opponent' | 'any_player' | 'all_players';

export type Trigger =
  | 'immediate'
  | 'on_play'
  | 'on_discard'
  | 'on_destroy'
  | 'on_turn_start'
  | 'on_turn_end'
  | 'while_in_stable'
  | 'when_other_plays'
  | 'after_resolve'
  | 'on_enter_stable'
  | 'on_sacrifice'
  // custom triggers used by importer/game rules
  | 'when_other_unicorn_would_be_sacrificed_or_returned'
  | 'when_other_brings_baby_from_nursery';

export type Duration = 'instant' | 'until_end_of_turn' | 'while_in_stable' | 'next_turn' | 'permanent';

export interface Quantity {
  mode: 'exact' | 'up_to' | 'random' | 'all';
  value?: number; // required if exact or up_to or random
}

export interface TargetFilter {
  card_group?: 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic' | 'any';
  category?: CardCategory | 'any';
  subtype?: string; // free text tag
  name?: string;
  tags?: string[];
}

export interface TargetSelector {
  scope: Scope;
  zone: Zone;
  filters?: TargetFilter;
  quantity?: Quantity; // default exact 1
  allow_self?: boolean; // for players scope
  unique_per_player?: boolean;
}

export type Comparator = '>=' | '>' | '==' | '<=' | '<' | '!=';

export type Condition =
  | { kind: 'count_in_zone'; player: Scope; zone: Zone; filter?: TargetFilter; op: Comparator; value: number }
  | { kind: 'has_card'; player: Scope; zone: Zone; filter: TargetFilter }
  | { kind: 'flag'; name: string; value?: boolean };

export type ActionKind =
  | 'add' // move from source to dest (e.g., draw)
  | 'move' // general move between zones/players
  | 'transfer' // explicit from one player zone to another
  | 'destroy'
  | 'sacrifice'
  | 'discard'
  | 'return'
  | 'steal'
  | 'give'
  | 'swap'
  | 'search'
  | 'reveal'
  | 'shuffle_deck'
  | 'reorder_top'
  | 'protect'
  | 'grant_immunity'
  | 'prevent'
  | 'ignore'
  | 'cancel'
  | 'skip_phase'
  | 'goto_end_turn' // Б1: Носорогорог - немедленный переход к последней фазе хода
  | 'extra_action'
  | 'limit_actions'
  | 'modify_win_condition'
  | 'set_flag';

export interface ActionBase {
  kind: ActionKind;
  optional?: boolean;
  repeat?: number; // repeat N times
  duration?: Duration;
  /**
   * If true, this action only executes if the previous action in the same effect chain succeeded.
   * Use to represent "then"/"if you do" semantics from card text.
   */
  requires_success_of_previous?: boolean;
}

export type Action =
  | (ActionBase & {
      kind: 'add';
      source: Zone;
      destination: Zone;
      targets?: TargetSelector; // optional for zone-wide adds like draw
      quantity?: Quantity;
    })
  | (ActionBase & {
      kind: 'move' | 'steal' | 'give' | 'return' | 'transfer';
      from: TargetSelector;
      to?: TargetSelector; // not needed for destroy/discard
      /**
       * Optional: if moving a card into a stable, treat it as if it has just been played/entered.
       * Used by effects like "put a unicorn from discard into your stable, triggering its enter effects".
       */
      on_enter_mode?: 'as_on_play' | 'none';
    })
  // swap alternative shape (used by server normalization): select 1 card from A and 1 from B and swap
  | (ActionBase & {
      kind: 'swap';
      a: TargetSelector;
      b: TargetSelector;
    })
  | (ActionBase & {
      kind: 'destroy' | 'sacrifice' | 'discard';
      targets: TargetSelector;
    })
  | (ActionBase & {
      kind: 'search' | 'reveal';
      targets: TargetSelector;
      /** Where to put the found card(s). Default: hand */
      place?: 'hand' | 'stable' | 'top_deck' | 'play_now';
      /** Whether to reveal found card to table or actor; UI-defined */
      reveal?: boolean;
      /** Shuffle deck after search. Should be set only if card text says so. */
      shuffle_after?: boolean;
    })
  | (ActionBase & {
      kind: 'shuffle_deck';
      targets?: TargetSelector; // usually player's deck; if omitted, infer from context
    })
  | (ActionBase & {
      kind: 'reorder_top';
      targets: TargetSelector; // cards to reorder on top of a deck
      quantity?: Quantity; // how many to reorder
    })
  | (ActionBase & {
      kind: 'protect' | 'grant_immunity';
      targets: TargetSelector;
      immunity_to?: Array<'destroy' | 'downgrade' | 'cancel' | 'steal' | 'discard'>;
    })
  | (ActionBase & {
      kind: 'prevent' | 'ignore' | 'cancel';
      cancel_priority?: number;
      immune_to_cancel?: boolean;
      targets?: TargetSelector; // e.g., cancel someone’s play
    })
  | (ActionBase & {
      kind: 'skip_phase';
      phase: Phase;
    })
  | (ActionBase & {
      // Б1: "немедленно перейдите к последней фазе хода" (Носорогорог).
      // Ход не передаётся: движок ставит phase='end_turn', игрок жмёт "Завершить ход".
      kind: 'goto_end_turn';
    })
  | (ActionBase & {
      kind: 'extra_action' | 'limit_actions';
      phase: Phase;
      value: number; // add or limit number
    })
  | (ActionBase & {
      kind: 'modify_win_condition';
      counts_for_win?: boolean;
    })
  | (ActionBase & {
      kind: 'set_flag';
      name: string;
      value: boolean;
    });

export interface Effect {
  trigger: Trigger;
  conditions?: Condition[];
  actions: Action[];
  /** If true, player may choose to skip executing this effect when it triggers. */
  optional?: boolean;
  /** If true, this effect cannot be countered by instant cancels (global blocks may still prevent). */
  uncounterable?: boolean;
  /** Restrict effect to operate only while the source card is in the specified zone (e.g., stable). */
  while_source_in?: Zone;
  /** If current phase is in this list of skipped phases for the player, do not trigger the effect. */
  blocked_by_phase_skip?: Phase[];
}

export interface Card {
  id?: string;
  name: string;
  // kept as "type" for backward compatibility with existing UI; but values now include categories
  type: CardCategory;
  subtype?: string;
  description?: string;
  image?: string;
  // Admin controls
  active?: boolean;
  deck_count?: number;
  counts_for_win?: boolean;
  blocks_unicorn_effects?: boolean;
  skip_phases?: Phase[];
  instant_subtype?: 'neigh' | 'super_neigh' | 'rewind' | 'shield' | 'redirect' | 'intercept';
  /** Супер Нет: эту карту нельзя отменить обычным Neigh и Counter-Neigh. */
  cannot_be_neighed?: boolean;
  /** Элюсивный Окелотикорн: в стойле запрещает другим игрокам играть отмены. */
  blocks_neigh_for_others?: boolean;
  /** Бонус-запрет: владелец запрещает соперникам мгновенные карты против себя (имя карты уточняется). */
  blocks_instants_against_owner?: boolean;
  tags?: string[];
  /** Requirements to play this card: conditions must hold; costs are actions executed prior to on_play. */
  play_requirements?: {
    conditions?: Condition[];
    costs?: Action[];
  };
  effects: Effect[];
}
