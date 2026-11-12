import React from 'react';
import type { Action, ActionKind, TargetSelector, Zone, Scope, Quantity } from '../../../shared/src/types';

/**
 * Конфигурация билдера действий.
 * Заменяет if/else цепочку в addActionToCurrentGroup / meAddActionToCurrentGroup.
 * Каждый kind знает свои поля — какие селекторы и кнопки показать.
 */

export type KindMeta = {
  /** Readable label */
  label: string;
  /** Which zone selector fields to show in the UI */
  fields: {
    /** Show source zone picker (deck/hand/discard/stable) */
    srcZone?: boolean;
    /** Show destination zone picker */
    dstZone?: boolean;
    /** Show from-zone for move/steal/give/return/transfer */
    fromZone?: boolean;
    /** Show to-zone for move/steal/give/return/transfer */
    toZone?: boolean;
    /** Show scope picker (self/opponent/any_player/all_players) */
    scope?: boolean;
    /** Show card group filter */
    groupFilter?: boolean;
    /** Show quantity input */
    quantity?: boolean;
    /** Show allowSelf toggle (for any_player/all_players) */
    allowSelf?: boolean;
    /** Show phase picker (for skip_phase, extra_action, limit_actions) */
    phase?: boolean;
    /** Show value input (for extra_action, limit_actions) */
    value?: boolean;
    /** Show flag name input (for set_flag) */
    flagName?: boolean;
    /** Show target selection for destroy/sacrifice/discard */
    targets?: boolean;
    /** Toggle optional checkbox */
    optional?: boolean;
    /** Toggle requires_success_of_previous */
    requirePrev?: boolean;
    /** Show cancel priority (for cancel/prevent) */
    cancelPriority?: boolean;
    /** Show target player picker (self/opponent/chosen/all) */
    targetPlayer?: boolean;
    /** Show destination player */
    dstPlayer?: boolean;
  };
  /** Category for EffectChip color/icon */
  category: EffectCategory;
  /** How to build an Action from form fields */
  build: (fields: BuilderFields) => Action | null;
};

export type EffectCategory =
  | 'destroy'     // destroy, sacrifice → 🔴
  | 'move'        // move, return, transfer, pull, give, swap → 🟡
  | 'draw'        // draw, draw_conditional, draw_until_limit, search → 🟢
  | 'steal'       // steal → 🟠
  | 'discard'     // discard, force_discard → 🔵
  | 'cancel'      // cancel, prevent, restrict_action, redirect_target → 🟣
  | 'phase'       // skip_phase, goto_end_turn, skip_turn, extra_action → ⚪
  | 'force'       // force_play, force_discard, modify_action, limit_actions → 🔘
  | 'deck'        // shuffle_deck, mega_shuffle, reorder_top, peek, mill_until, scry → 🟤
  | 'immunity'    // protect, grant_immunity → 🟩
  | 'flag'        // set_flag, modify_win_condition, modify_hand_limit → ⬜
  | 'special';    // add, reactive_trigger, choice, copy_effects, return_to_hand, pass_hands, conditional_loop, choose_card_type, choose_players → ☆

export type BuilderFields = {
  kind: ActionKind;
  srcZone: Zone;
  dstZone: Zone;
  fromZone: Zone;
  toZone: Zone;
  scope: Scope;
  groupFilter: string;
  quantity: number;
  allowSelf: boolean;
  phase: string;
  value: number;
  flagName: string;
  optional: boolean;
  requirePrev: boolean;
  cancelPriority: number;
  targetPlayer: string;
  dstPlayer: string;
  /** Function to build a TargetSelector */
  buildSelector: (zone: Zone, scope: Scope, qty?: number) => TargetSelector;
};

/** Build TargetSelector helper — matches the existing function in Admin.tsx */
function buildSelector(zone: Zone, scope: Scope, qty?: number, groupFilter?: string, allowSelf?: boolean): TargetSelector {
  const sel: TargetSelector = { scope, zone };
  if (groupFilter && groupFilter !== 'any') {
    sel.filters = { card_group: groupFilter as any };
  }
  if (qty && qty > 0) {
    sel.quantity = { mode: 'exact', value: qty };
  }
  if ((scope === 'any_player' || scope === 'all_players') && allowSelf !== undefined) {
    sel.allow_self = allowSelf;
  }
  return sel;
}

/** Категория → Material Icon name (для EffectChip) */
export const CATEGORY_ICONS: Record<EffectCategory, string> = {
  destroy:    'DeleteForever',
  move:       'SwapHoriz',
  draw:       'FileDownload',
  steal:      'Handshake',
  discard:    'DeleteSweep',
  cancel:     'Block',
  phase:      'SkipNext',
  force:      'Lock',
  deck:       'Shuffle',
  immunity:   'Shield',
  flag:       'Flag',
  special:    'AutoAwesome',
};

export const CATEGORY_COLORS: Record<EffectCategory, string> = {
  destroy:    '#e53935', // red
  move:       '#fdd835', // yellow/gold
  draw:       '#43a047', // green
  steal:      '#fb8c00', // orange
  discard:    '#1e88e5', // blue
  cancel:     '#8e24aa', // purple
  phase:      '#e0e0e0', // white/light gray
  force:      '#78909c', // blue gray
  deck:       '#6d4c41', // brown
  immunity:   '#00bfa5', // teal/green
  flag:       '#3949ab', // indigo
  special:    '#f06292', // pink
};

export const CATEGORY_LABELS: Record<EffectCategory, string> = {
  destroy:    'Уничтожение',
  move:       'Перемещение',
  draw:       'Получение',
  steal:      'Кража',
  discard:    'Сброс',
  cancel:     'Отмена',
  phase:      'Фазы',
  force:      'Принуждение',
  deck:       'Колода',
  immunity:   'Иммунитет',
  flag:       'Флаги',
  special:    'Особые',
};

/**
 * Конфигурация всех ActionKind.
 * Каждая запись знает:
 * - какие поля формы показывать
 * - как построить Action из полей билдера
 */
export const KIND_BUILDERS: Record<ActionKind, KindMeta> = {
  // ---- add ----
  add: {
    label: 'Добавить/Выложить',
    fields: { srcZone: true, dstZone: true, quantity: true, optional: true, requirePrev: true, groupFilter: true },
    category: 'special',
    build: (f) => ({
      kind: 'add',
      source: f.srcZone,
      destination: f.dstZone,
      quantity: { mode: 'exact', value: Math.max(1, f.quantity) },
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- destroy ----
  destroy: {
    label: 'Уничтожить',
    fields: { scope: true, targets: true, quantity: true, optional: true, requirePrev: true, groupFilter: true, allowSelf: true },
    category: 'destroy',
    build: (f) => ({
      kind: 'destroy',
      targets: buildSelector('stable', f.scope, Math.max(1, f.quantity), f.groupFilter, f.allowSelf),
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- sacrifice ----
  sacrifice: {
    label: 'Пожертвовать',
    fields: { targets: true, quantity: true, optional: true, requirePrev: true, groupFilter: true },
    category: 'destroy',
    build: (f) => ({
      kind: 'sacrifice',
      targets: buildSelector('stable', 'self', Math.max(1, f.quantity), f.groupFilter),
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- discard ----
  discard: {
    label: 'Сбросить',
    fields: { scope: true, targets: true, quantity: true, optional: true, requirePrev: true, groupFilter: true, allowSelf: true },
    category: 'discard',
    build: (f) => ({
      kind: 'discard',
      targets: buildSelector('hand', f.scope, Math.max(1, f.quantity), f.groupFilter, f.allowSelf),
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- move ----
  move: {
    label: 'Переместить',
    fields: { fromZone: true, toZone: true, scope: true, quantity: true, optional: true, requirePrev: true, groupFilter: true, allowSelf: true },
    category: 'move',
    build: (f) => ({
      kind: 'move',
      from: buildSelector(f.fromZone, f.scope, Math.max(1, f.quantity), f.groupFilter, f.allowSelf),
      to: { scope: 'self', zone: f.toZone },
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- steal ----
  steal: {
    label: 'Украсть',
    fields: { fromZone: true, toZone: true, scope: true, quantity: true, optional: true, requirePrev: true, groupFilter: true, allowSelf: true },
    category: 'steal',
    build: (f) => ({
      kind: 'steal',
      from: buildSelector(f.fromZone, f.scope, Math.max(1, f.quantity), f.groupFilter, f.allowSelf),
      to: { scope: 'self', zone: f.toZone },
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- give ----
  give: {
    label: 'Подарить',
    fields: { fromZone: true, toZone: true, quantity: true, optional: true, requirePrev: true, groupFilter: true },
    category: 'move',
    build: (f) => ({
      kind: 'give',
      from: buildSelector(f.fromZone, 'self', Math.max(1, f.quantity), f.groupFilter),
      to: { scope: 'opponent', zone: f.toZone },
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- return ----
  return: {
    label: 'Вернуть',
    fields: { fromZone: true, toZone: true, scope: true, quantity: true, optional: true, requirePrev: true, groupFilter: true, allowSelf: true },
    category: 'move',
    build: (f) => ({
      kind: 'return',
      from: buildSelector(f.fromZone, f.scope, Math.max(1, f.quantity), f.groupFilter, f.allowSelf),
      to: f.toZone === 'hand'
        ? { scope: 'self', zone: 'hand' }
        : { scope: 'self', zone: 'deck' },
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- transfer ----
  transfer: {
    label: 'Передать',
    fields: { fromZone: true, toZone: true, quantity: true, optional: true, requirePrev: true, groupFilter: true, dstPlayer: true },
    category: 'move',
    build: (f) => ({
      kind: 'transfer',
      from: buildSelector(f.fromZone, 'self', Math.max(1, f.quantity), f.groupFilter),
      to: { scope: (f.dstPlayer as Scope) || 'opponent', zone: f.toZone },
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- swap ----
  swap: {
    label: 'Обменять',
    fields: { scope: true, groupFilter: true, quantity: true, allowSelf: true },
    category: 'move',
    build: (f) => {
      const filters = f.groupFilter !== 'any' ? { card_group: f.groupFilter as any } : undefined;
      return {
        kind: 'swap',
        a: { scope: 'self', zone: 'stable', ...(filters ? { filters } : {}), quantity: { mode: 'exact', value: 1 } },
        b: { scope: f.scope, zone: 'stable', ...(filters ? { filters } : {}), quantity: { mode: 'exact', value: 1 } },
      } as any;
    },
  },

  // ---- search ----
  search: {
    label: 'Найти',
    fields: { quantity: true, optional: true, requirePrev: true, groupFilter: true },
    category: 'draw',
    build: (f) => ({
      kind: 'search',
      targets: buildSelector('deck', 'self', Math.max(1, f.quantity), f.groupFilter),
      place: 'hand',
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- reveal ----
  reveal: {
    label: 'Показать',
    fields: { quantity: true, optional: true, groupFilter: true },
    category: 'draw',
    build: (f) => ({
      kind: 'reveal',
      targets: buildSelector('deck', 'self', Math.max(1, f.quantity), f.groupFilter),
      optional: f.optional,
    }),
  },

  // ---- shuffle_deck ----
  shuffle_deck: {
    label: 'Перетасовать колоду',
    fields: { optional: true, requirePrev: true },
    category: 'deck',
    build: (f) => ({
      kind: 'shuffle_deck',
      targets: { scope: 'self', zone: 'deck' },
      optional: f.optional,
      requires_success_of_previous: f.requirePrev,
    }),
  },

  // ---- reorder_top ----
  reorder_top: {
    label: 'Переупорядочить верх колоды',
    fields: { quantity: true, optional: true },
    category: 'deck',
    build: (f) => ({
      kind: 'reorder_top',
      targets: buildSelector('deck', 'self', Math.max(1, f.quantity)),
      optional: f.optional,
    }),
  },

  // ---- protect ----
  protect: {
    label: 'Защитить',
    fields: { scope: true, optional: true, groupFilter: true },
    category: 'immunity',
    build: (f) => ({
      kind: 'protect',
      targets: buildSelector('stable', f.scope, 1, f.groupFilter),
    }),
  },

  // ---- grant_immunity ----
  grant_immunity: {
    label: 'Даровать иммунитет',
    fields: { scope: true, groupFilter: true },
    category: 'immunity',
    build: (f) => ({
      kind: 'grant_immunity',
      targets: buildSelector('stable', f.scope, 1, f.groupFilter),
    }),
  },

  // ---- prevent ----
  prevent: {
    label: 'Предотвратить',
    fields: { optional: true, cancelPriority: true },
    category: 'cancel',
    build: (f) => ({
      kind: 'prevent',
      cancel_priority: f.cancelPriority || 0,
      optional: f.optional,
    }),
  },

  // ---- ignore ----
  ignore: {
    label: 'Игнорировать',
    fields: { optional: true },
    category: 'cancel',
    build: (f) => ({
      kind: 'ignore',
      optional: f.optional,
    }),
  },

  // ---- cancel ----
  cancel: {
    label: 'Отменить',
    fields: { cancelPriority: true, optional: true },
    category: 'cancel',
    build: (f) => ({
      kind: 'cancel',
      cancel_priority: f.cancelPriority || 0,
      optional: f.optional,
    }),
  },

  // ---- skip_phase ----
  skip_phase: {
    label: 'Пропустить фазу',
    fields: { phase: true, optional: true },
    category: 'phase',
    build: (f) => ({
      kind: 'skip_phase',
      phase: f.phase as any || 'play',
    }),
  },

  // ---- goto_end_turn ----
  goto_end_turn: {
    label: 'Завершить ход',
    fields: {},
    category: 'phase',
    build: () => ({ kind: 'goto_end_turn' }),
  },

  // ---- skip_turn ----
  skip_turn: {
    label: 'Пропустить ход',
    fields: {},
    category: 'phase',
    build: () => ({ kind: 'skip_turn' } as any),
  },

  // ---- extra_action ----
  extra_action: {
    label: 'Дополнительное действие',
    fields: { phase: true, value: true },
    category: 'phase',
    build: (f) => ({
      kind: 'extra_action',
      phase: f.phase as any || 'play',
      value: f.value || 1,
    }),
  },

  // ---- limit_actions ----
  limit_actions: {
    label: 'Ограничить действия',
    fields: { phase: true, value: true, optional: true },
    category: 'force',
    build: (f) => ({
      kind: 'limit_actions',
      phase: f.phase as any || 'play',
      value: f.value || 1,
      optional: f.optional,
    }),
  },

  // ---- modify_win_condition ----
  modify_win_condition: {
    label: 'Изменить условие победы',
    fields: { optional: true },
    category: 'flag',
    build: (f) => ({
      kind: 'modify_win_condition',
      counts_for_win: true,
      optional: f.optional,
    }),
  },

  // ---- set_flag ----
  set_flag: {
    label: 'Установить флаг',
    fields: { flagName: true, optional: true },
    category: 'flag',
    build: (f) => ({
      kind: 'set_flag',
      name: f.flagName || 'my_flag',
      value: true,
      optional: f.optional,
    }),
  },

  // ---- draw ----
  draw: {
    label: 'Взять карту',
    fields: { quantity: true, optional: true },
    category: 'draw',
    build: (f) => ({
      kind: 'draw',
      quantity: { mode: 'exact', value: Math.max(1, f.quantity) },
      optional: f.optional,
    } as any),
  },

  // ---- draw_conditional ----
  draw_conditional: {
    label: 'Взять карту при условии',
    fields: { quantity: true, optional: true, groupFilter: true },
    category: 'draw',
    build: (f) => ({
      kind: 'draw_conditional',
      quantity: { mode: 'exact', value: Math.max(1, f.quantity) },
      targets: buildSelector('deck', 'self', Math.max(1, f.quantity), f.groupFilter),
      optional: f.optional,
    } as any),
  },

  // ---- draw_until_limit ----
  draw_until_limit: {
    label: 'Добирать до лимита',
    fields: {},
    category: 'draw',
    build: () => ({ kind: 'draw_until_limit' }),
  },

  // ---- force_discard ----
  force_discard: {
    label: 'Заставить сбросить',
    fields: { scope: true, quantity: true, groupFilter: true, allowSelf: true },
    category: 'discard',
    build: (f) => ({
      kind: 'force_discard',
      targets: buildSelector('hand', f.scope, Math.max(1, f.quantity), f.groupFilter, f.allowSelf),
    } as any),
  },

  // ---- force_play ----
  force_play: {
    label: 'Заставить разыграть',
    fields: { targetPlayer: true, groupFilter: true },
    category: 'force',
    build: (f) => ({
      kind: 'force_play',
      target_player: f.targetPlayer || 'opponent',
      targets: buildSelector('hand', 'any_player', 1, f.groupFilter),
    } as any),
  },

  // ---- mega_shuffle ----
  mega_shuffle: {
    label: 'Перемешать всё в колоду',
    fields: { groupFilter: true, optional: true },
    category: 'deck',
    build: (f) => ({
      kind: 'mega_shuffle',
      targets: f.groupFilter !== 'any' ? buildSelector('stable', 'self', undefined, f.groupFilter) : undefined,
      optional: f.optional,
    } as any),
  },

  // ---- mill_until ----
  mill_until: {
    label: 'Сбрасывать до условия',
    fields: { groupFilter: true },
    category: 'deck',
    build: (f) => ({
      kind: 'mill_until',
      targets: buildSelector('deck', 'self', undefined, f.groupFilter),
    } as any),
  },

  // ---- peek ----
  peek: {
    label: 'Посмотреть карты',
    fields: { quantity: true },
    category: 'deck',
    build: (f) => ({
      kind: 'peek',
      quantity: { mode: 'exact', value: Math.max(1, f.quantity) },
    } as any),
  },

  // ---- modify_action ----
  modify_action: {
    label: 'Изменить действие',
    fields: { groupFilter: true, optional: true },
    category: 'force',
    build: (f) => ({
      kind: 'modify_action',
      targets: f.groupFilter !== 'any' ? buildSelector('stable', 'self', 1, f.groupFilter) : undefined,
      optional: f.optional,
    } as any),
  },

  // ---- modify_hand_limit ----
  modify_hand_limit: {
    label: 'Изменить лимит руки',
    fields: { value: true, optional: true },
    category: 'flag',
    build: (f) => {
      if (!f.value) return null;
      return {
        kind: 'modify_hand_limit',
        value: f.value,
        optional: f.optional,
      } as any;
    },
  },

  // ---- reactive_trigger ----
  reactive_trigger: {
    label: 'Ответная реакция',
    fields: { optional: true },
    category: 'special',
    build: (f) => ({
      kind: 'reactive_trigger',
      optional: f.optional,
    } as any),
  },

  // ---- redirect_target ----
  redirect_target: {
    label: 'Перенаправить цель',
    fields: {},
    category: 'cancel',
    build: () => ({ kind: 'redirect_target' } as any),
  },

  // ---- restrict_action ----
  restrict_action: {
    label: 'Запретить действие',
    fields: { groupFilter: true, optional: true },
    category: 'cancel',
    build: (f) => ({
      kind: 'restrict_action',
      targets: f.groupFilter !== 'any' ? buildSelector('hand', 'any_player', undefined, f.groupFilter) : undefined,
      optional: f.optional,
    } as any),
  },

  // ---- return_to_hand ----
  return_to_hand: {
    label: 'Вернуть в руку',
    fields: { optional: true },
    category: 'move',
    build: (f) => ({
      kind: 'return_to_hand',
      targets: buildSelector('stable', 'self', 1),
      optional: f.optional,
    } as any),
  },

  // ---- pull ----
  pull: {
    label: 'Забрать из Яслей',
    fields: { quantity: true, groupFilter: true },
    category: 'move',
    build: (f) => ({
      kind: 'pull',
      targets: buildSelector('nursery', 'self', Math.max(1, f.quantity), f.groupFilter),
    } as any),
  },

  // ---- scry ----
  scry: {
    label: 'Просмотрерх карт',
    fields: { quantity: true },
    category: 'deck',
    build: (f) => ({
      kind: 'scry',
      quantity: { mode: 'exact', value: Math.max(1, f.quantity) },
    } as any),
  },

  // ---- pass_hands ----
  pass_hands: {
    label: 'Передать руку',
    fields: {},
    category: 'move',
    build: () => ({ kind: 'pass_hands' } as any),
  },

  // ---- choice ----
  choice: {
    label: 'Выбор варианта',
    fields: { optional: true },
    category: 'special',
    build: (f) => ({
      kind: 'choice',
      options: [],
      optional: f.optional,
    } as any),
  },

  // ---- choose_card_type ----
  choose_card_type: {
    label: 'Выбрать тип карты',
    fields: { groupFilter: true },
    category: 'special',
    build: (f) => ({
      kind: 'choose_card_type',
      options: f.groupFilter !== 'any' ? [f.groupFilter] : ['unicorn'],
    } as any),
  },

  // ---- choose_players ----
  choose_players: {
    label: 'Выбрать игроков',
    fields: { quantity: true },
    category: 'special',
    build: (f) => ({
      kind: 'choose_players',
      quantity: Math.max(1, f.quantity),
    } as any),
  },

  // ---- conditional_loop ----
  conditional_loop: {
    label: 'Цикл с условием',
    fields: { optional: true },
    category: 'special',
    build: (f) => ({
      kind: 'conditional_loop',
      optional: f.optional,
    } as any),
  },

  // ---- copy_effects ----
  copy_effects: {
    label: 'Скопировать эффекты',
    fields: {},
    category: 'special',
    build: () => ({ kind: 'copy_effects' } as any),
  },
};
