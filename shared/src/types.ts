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

/** Триггеры каталога v2 (ровно 19). Рантайм-список: server/src/data/triggers.ts. */
export type CatalogTrigger =
  | 'on_any_unicorn_sacrificed_or_destroyed'
  | 'on_enter_stable'
  | 'on_leave_stable'
  | 'on_opponent_play'
  | 'on_opponent_plays_neigh'
  | 'on_opponent_plays_spell'
  | 'on_opponent_plays_unicorn'
  | 'on_opponent_plays_upgrade_downgrade'
  | 'on_opponent_pull_baby'
  | 'on_opponent_sacrifices'
  | 'on_opponent_unicorn_effect'
  | 'on_opponent_would_draw'
  | 'on_play'
  | 'on_turn_end'
  | 'on_turn_start'
  | 'on_would_be_destroyed'
  | 'on_would_be_destroyed_or_sacrificed'
  | 'when_destroyed'
  | 'while_in_stable';

/** Legacy-триггеры: движок и импортёр их ещё читают; уйдут в стадии 5 вместе с хардкодом по имени. */
export type LegacyTrigger =
  | 'immediate'
  | 'on_discard'
  | 'on_destroy'
  | 'when_other_plays'
  | 'after_resolve'
  | 'on_sacrifice'
  | 'when_other_unicorn_would_be_sacrificed_or_returned'
  | 'when_other_brings_baby_from_nursery';

export type Trigger = CatalogTrigger | LegacyTrigger;

export type Duration = 'instant' | 'until_end_of_turn' | 'while_in_stable' | 'next_turn' | 'permanent';

export interface Quantity {
  /** Необязательно: в данных каталога часто только value. */
  mode?: 'exact' | 'up_to' | 'random' | 'all';
  value?: number; // required if exact or up_to or random
  /** Выбирает игрок (is_player_choice в каталоге). */
  is_player_choice?: boolean;
  /** Не брать карты с этими тегами (exclude_tags в каталоге). */
  exclude_tags?: string[];
}

export interface TargetFilter {
  card_group?: 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic' | 'any';
  category?: CardCategory | 'any';
  subtype?: string; // free text tag
  name?: string;
  tags?: string[];
  /** Не выбирать саму карту-источник (exclude_self в каталоге). */
  exclude_self?: boolean;
  id?: string;
  /** Тип единорога: basic/magical/ultimate/baby; маска в каталоге v2 пока не используется. */
  unicorn_type?: string;
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

/** Условие в свободной форме, как в каталоге v2 ({type,target}, {rules}, {card_group}...). Поведение не меняет. */
export type LooseCondition = { type?: string; target?: TargetSelector; negate?: boolean; [param: string]: unknown };

/** Виды действий каталога v2: 43 kind (сверено скриптом с catalog.v2.json). */
export type CatalogActionKind =
  | 'add'
  | 'cancel'
  | 'choice'
  | 'choose_card_type'
  | 'choose_players'
  | 'conditional_loop'
  | 'copy_effects'
  | 'destroy'
  | 'discard'
  | 'draw'
  | 'draw_conditional'
  | 'draw_until_limit'
  | 'extra_action'
  | 'force_discard'
  | 'force_play'
  | 'give'
  | 'limit_actions'
  | 'mega_shuffle'
  | 'mill_until'
  | 'modify_action'
  | 'modify_hand_limit'
  | 'modify_win_condition'
  | 'move'
  | 'pass_hands'
  | 'peek'
  | 'prevent'
  | 'pull'
  | 'reactive_trigger'
  | 'redirect_target'
  | 'reorder_top'
  | 'restrict_action'
  | 'return'
  | 'return_to_hand'
  | 'reveal'
  | 'sacrifice'
  | 'scry'
  | 'search'
  | 'set_flag'
  | 'shuffle_deck'
  | 'skip_phase'
  | 'skip_turn'
  | 'steal'
  | 'swap';

/** Legacy-виды, которых каталог не знает; движок исполняет их и сейчас. */
export type LegacyActionKind = 'transfer' | 'protect' | 'grant_immunity' | 'ignore' | 'goto_end_turn';

export type ActionKind = CatalogActionKind | LegacyActionKind;

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
  /** Цель действия в форме каталога (target), а не targets/from. */
  target?: TargetSelector;
  target_player?: string;
  quantity?: Quantity;
  /** Условие исполнения действия (свободная форма каталога). */
  condition?: Condition | LooseCondition;
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
    })
  | (ActionBase & {
      /** Виды каталога без своего варианта выше: параметры свободные, исполняет executor. */
      kind: Exclude<CatalogActionKind, 'add' | 'cancel' | 'destroy' | 'discard' | 'extra_action' | 'give' | 'limit_actions' | 'modify_win_condition' | 'move' | 'prevent' | 'reorder_top' | 'return' | 'reveal' | 'sacrifice' | 'search' | 'set_flag' | 'shuffle_deck' | 'skip_phase' | 'steal' | 'swap'>;
      target?: TargetSelector;
      target_player?: string;
      [param: string]: unknown;
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
  /** Маска единорога (в каталоге v2 пока нет ни одной карты с маской). */
  mask?: string;
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
