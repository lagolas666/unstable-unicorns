/**
 * Чистая логика окна реакций: какие строки (кнопки + селекты) показать игроку.
 * Правил игры здесь нет: флаги карт живут на сервере (canReact). Клиент только
 * предлагает варианты, а отказ сервера выводит модалка, не закрывая её.
 */
import type { GameState, PendingInfo } from '../types/socket';

/** Поля payload'а react, которые игрок может выбрать в окне. */
export type ReactField =
  | 'instantCardId'
  | 'discardCardId'
  | 'targetId'
  | 'toTargetId'
  | 'receiverPlayerId'
  | 'cardId';

export type ReactGroup = 'cancel' | 'defense' | 'instant' | 'effect';

/** Одна строка окна: кнопка действия и селекты для нужных полей. */
export interface ReactRow {
  kind: string;
  label: string;
  group: ReactGroup;
  fields: ReactField[];
  /** Карты из руки для полей instantCardId / discardCardId / cardId. */
  cards: string[];
  /** Игроки-цели для полей targetId / toTargetId / receiverPlayerId (кроме себя). */
  targets: string[];
}

interface KindSpec {
  label: string;
  group: ReactGroup;
  fields: ReactField[];
  /** Подтип мгновенной карты (instant_subtype) для фильтра руки. */
  subtype?: string;
  /** Нужна только при отменённой игре (cancelLevel > 0). */
  needsCancel?: boolean;
}

/** Описание видов реакций. Состав полей взят из матрицы payload'ов задачи 6c. */
const SPEC: Record<string, KindSpec> = {
  neigh: { label: 'Ржание', group: 'cancel', fields: ['instantCardId'], subtype: 'neigh' },
  super_neigh: { label: 'Супер Ржание', group: 'cancel', fields: ['instantCardId'], subtype: 'super_neigh' },
  counter_neigh: { label: 'Контр-Ржание', group: 'cancel', fields: ['instantCardId'], subtype: 'counter_neigh', needsCancel: true },
  objection: { label: 'Возражение', group: 'cancel', fields: ['discardCardId'], needsCancel: true },
  hypnorog: { label: 'Гипнорог', group: 'cancel', fields: ['discardCardId'] },
  shield: { label: 'Щит', group: 'defense', fields: ['instantCardId'], subtype: 'shield' },
  rewind: { label: 'Перемотка', group: 'defense', fields: ['instantCardId'], subtype: 'rewind' },
  redirect: { label: 'Перенаправление', group: 'defense', fields: ['instantCardId', 'toTargetId'], subtype: 'redirect' },
  play_as_instant: { label: 'Сыграть как мгновенную', group: 'instant', fields: ['cardId'] },
  prevent: { label: 'Предотвратить', group: 'effect', fields: ['targetId'] },
  // ignore_target карту из руки не тратит: сервер в reactIgnoreTarget требует только targetId
  ignore_target: { label: 'Игнорировать цель', group: 'effect', fields: ['targetId'] },
  intercept: { label: 'Перехват', group: 'effect', fields: ['receiverPlayerId'] },
  intercept_steal: { label: 'Перехват с кражей', group: 'effect', fields: ['instantCardId', 'receiverPlayerId'], subtype: 'intercept_steal' },
  frankencorn_intercept: { label: 'Франкенкорн: перехват', group: 'effect', fields: [] },
};

/** Виды, которые показываем при розыгрыше карты (pending.kind === 'play'). */
const PLAY_KINDS = ['neigh', 'super_neigh', 'counter_neigh', 'objection', 'hypnorog', 'shield', 'rewind', 'redirect', 'play_as_instant'];
/** Виды, которые показываем при эффекте карты (trigger_effect / turn_start_effect). */
const EFFECT_KINDS = ['prevent', 'ignore_target', 'redirect', 'intercept', 'intercept_steal', 'frankencorn_intercept', 'play_as_instant'];
/** При uncounterable отменяющие виды не предлагаем (сервер всё равно вернёт отказ). */
const BLOCKED_WHEN_UNCOUNTERABLE = ['prevent', 'ignore_target', 'hypnorog'];

const TARGET_FIELDS: ReactField[] = ['targetId', 'toTargetId', 'receiverPlayerId'];

/** Поля, которые выбираются из руки, а не из списка игроков. */
export function isTargetField(field: ReactField): boolean {
  return TARGET_FIELDS.includes(field);
}

/** Подтип мгновенной карты из словаря игры (поле instant_subtype). */
function subtypeOf(state: GameState, cardId: string): string {
  const card = state.cards[cardId] as { instant_subtype?: unknown } | undefined;
  return typeof card?.instant_subtype === 'string' ? card.instant_subtype : '';
}

/** Карта — мгновенная по типу (для play_as_instant). */
function isInstantType(state: GameState, cardId: string): boolean {
  return (state.cards[cardId]?.type ?? '').toLowerCase().includes('instant');
}

/**
 * Строки окна реакций для моего игрока.
 * Пустой массив: окна нет, я — актёр розыгрыша или у меня нет подходящих карт/целей.
 */
export function buildReactRows(
  pending: PendingInfo | null,
  mePlayerId: string | undefined,
  state: GameState | null
): ReactRow[] {
  if (!pending || !mePlayerId || !state) return [];
  // Актёр свою карту не отменяет: ему показываем только текст ожидания
  if (pending.actorId === mePlayerId) return [];
  const me = state.players.find((p) => p.id === mePlayerId);
  if (!me) return [];

  const kinds =
    pending.kind === 'play' ? PLAY_KINDS : pending.kind === 'trigger_effect' || pending.kind === 'turn_start_effect' ? EFFECT_KINDS : [];
  const cancelLevel = typeof pending.cancelLevel === 'number' ? pending.cancelLevel : 0;
  const uncounterable = pending.uncounterable === true;
  const hasLastCancel = typeof pending.lastCancelCardId === 'string' && pending.lastCancelCardId !== '';
  const targets = state.players.filter((p) => p.id !== mePlayerId).map((p) => p.id);

  const rows: ReactRow[] = [];
  for (const kind of kinds) {
    const spec = SPEC[kind];
    if (!spec) continue;
    if (uncounterable && (spec.group === 'cancel' || BLOCKED_WHEN_UNCOUNTERABLE.includes(kind))) continue;
    if (spec.needsCancel && cancelLevel <= 0) continue;
    if (kind === 'objection' && !hasLastCancel) continue;

    // Карты: для мгновенных — по подтипу, для discard — вся рука, для play_as_instant — мгновенные по типу
    let cards: string[] = [];
    if (spec.fields.includes('instantCardId')) {
      cards = me.hand.filter((id) => (spec.subtype ? subtypeOf(state, id) === spec.subtype : true));
    } else if (spec.fields.includes('cardId')) {
      cards = me.hand.filter((id) => isInstantType(state, id));
    } else if (spec.fields.includes('discardCardId')) {
      cards = me.hand;
    }
    const needsCard = spec.fields.some((f) => f === 'instantCardId' || f === 'cardId' || f === 'discardCardId');
    if (needsCard && cards.length === 0) continue;

    const needsTarget = spec.fields.some((f) => isTargetField(f));
    if (needsTarget && targets.length === 0) continue;

    rows.push({ kind, label: spec.label, group: spec.group, fields: spec.fields, cards, targets });
  }
  return rows;
}
