/**
 * Чистые функции правил игры (задача 3b).
 *
 * Вынесены из `gameInstance.ts`, где одна и та же логика дублировалась
 * по 2–4 раза. Функции намеренно не знают о `this`, игроках и сокетах:
 * только входы → выходы, без побочных эффектов.
 *
 * ВАЖНО: поведение сохранено буквально, включая краевые случаи.
 * Не «улучшать» — см. комментарии у каждой функции.
 */

import type { Player, Phase } from './types';

/** Фиксированный порядок фаз внутри одного хода. */
export const PHASE_ORDER: readonly Phase[] = [
  'start',
  'draw',
  'play',
  'instant',
  'discard',
  'end',
] as const;

/**
 * Ценность хода бота по сложности: сколько единорогов он получает за ход.
 *
 * До выноса эта логика была в трёх видах: тернарник в `_botTurn`,
 * тернарник в `simulateTimeline` и `switch` в `_botMoveValue`.
 * Все три давали одинаковый результат, поэтому эталон сохранён.
 */
export function botMoveValue(difficulty: Player['botDifficulty']): number {
  switch (difficulty) {
    case 'hard':
      return 3;
    case 'normal':
      return 2;
    case 'easy':
    default:
      return 1;
  }
}

/**
 * Индекс следующего игрока по кругу.
 *
 * Буквальная арифметика без guard'ов: при count = 0 возвращается NaN,
 * как и в исходном `(index + 1) % playersArr.length`. Guard вернул бы 0
 * и изменил бы существующее поведение — это не рефакторинг.
 */
export function nextPlayerIndex(index: number, count: number): number {
  return (index + 1) % count;
}

/** Результат перехода между фазами: чистое описание, без мутаций. */
export interface PhaseStep {
  /** Фаза изменилась (false для 'end' и 'finished' — ход завершает endTurn). */
  changed: boolean;
  /** Новое значение фазы, имеет смысл только при changed = true. */
  phase: Phase;
  /** Новый индекс фазы. */
  phaseIndex: number;
  /** Нужно ли двигать currentTurnIndex (ветка wrap-around). */
  advanceTurn: boolean;
  /** Нужно ли эмитить состояние после перехода. */
  emit: boolean;
}

/**
 * Следующая фаза по фиксированному порядку.
 *
 * Семантика скопирована с `GameInstance.nextPhase()` один в один:
 *  - 'end' и 'finished' не двигаются (ранний return в оригинале);
 *  - фаза вне словаря прыгает на первую;
 *  - последняя фаза заворачивается на 'start' и требует сдвига хода.
 *
 * Ветка wrap-around при текущем наборе фаз недостижима: 'end' — последний
 * элемент массива, но его перехватывает проверка выше. Оставлена ради
 * точного совпадения с оригиналом; удалять отдельной задачей.
 */
export function nextPhaseOf(
  current: Phase,
  order: readonly Phase[] = PHASE_ORDER
): PhaseStep {
  if (current === 'finished' || current === 'end') {
    return { changed: false, phase: current, phaseIndex: -1, advanceTurn: false, emit: false };
  }

  const idx = order.indexOf(current);

  if (idx < 0) {
    return { changed: true, phase: order[0], phaseIndex: 0, advanceTurn: false, emit: true };
  }

  if (idx < order.length - 1) {
    return {
      changed: true,
      phase: order[idx + 1],
      phaseIndex: idx + 1,
      advanceTurn: false,
      emit: true,
    };
  }

  return { changed: true, phase: 'start', phaseIndex: 0, advanceTurn: true, emit: true };
}
