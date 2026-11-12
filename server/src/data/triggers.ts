import type { CatalogTrigger, LegacyTrigger } from '../../../shared/src/types';

/**
 * Канонический список триггеров для схемы Mongoose и сверок.
 * Порядок и состав совпадают с server/data/catalog.v2.json (19) плюс legacy (8).
 * Источник истины по составу — каталог; список сверяется скриптом _be_b6_2_verify.js.
 */
export const CATALOG_TRIGGERS = [
  'on_any_unicorn_sacrificed_or_destroyed',
  'on_enter_stable',
  'on_leave_stable',
  'on_opponent_play',
  'on_opponent_plays_neigh',
  'on_opponent_plays_spell',
  'on_opponent_plays_unicorn',
  'on_opponent_plays_upgrade_downgrade',
  'on_opponent_pull_baby',
  'on_opponent_sacrifices',
  'on_opponent_unicorn_effect',
  'on_opponent_would_draw',
  'on_play',
  'on_turn_end',
  'on_turn_start',
  'on_would_be_destroyed',
  'on_would_be_destroyed_or_sacrificed',
  'when_destroyed',
  'while_in_stable',
] as const satisfies readonly CatalogTrigger[];

/** Legacy-триггеры, которые всё ещё читает движок; запрещены к использованию в новых данных. */
export const LEGACY_TRIGGERS = [
  'immediate',
  'on_discard',
  'on_destroy',
  'when_other_plays',
  'after_resolve',
  'on_sacrifice',
  'when_other_unicorn_would_be_sacrificed_or_returned',
  'when_other_brings_baby_from_nursery',
] as const satisfies readonly LegacyTrigger[];

/** Полный допустимый набор для схемы: каталог + legacy. */
export const TRIGGERS = [...CATALOG_TRIGGERS, ...LEGACY_TRIGGERS] as const;
