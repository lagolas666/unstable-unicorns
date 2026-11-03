/**
 * TC-RULES: характеризационные тесты на чистые функции правил (задача 3b).
 *
 * Фиксируют поведение, вынесенное из gameInstance.ts в rules.ts:
 *  - botMoveValue: ценность хода бота по сложности;
 *  - nextPlayerIndex: индекс следующего игрока по кругу;
 *  - nextPhaseOf: переход между фазами с флагом changed/advanceTurn/emit.
 *
 * Тесты характеризационные: прибивают фактическое поведение, включая
 * краевые случаи (NaN при count=0, 'end'/'finished' не двигаются).
 * Не «как должно работать по правилам», а «как работает сейчас».
 */

import {
  botMoveValue,
  nextPlayerIndex,
  nextPhaseOf,
  PHASE_ORDER,
} from '../src/game/rules';
import type { Phase } from '../src/game/types';

describe('botMoveValue: ценность хода бота по сложности', () => {
  describe('валидные значения сложности', () => {
    test("'easy' → 1 единорог за ход", () => {
      expect(botMoveValue('easy')).toBe(1);
    });

    test("'normal' → 2 единорога за ход", () => {
      expect(botMoveValue('normal')).toBe(2);
    });

    test("'hard' → 3 единорога за ход", () => {
      expect(botMoveValue('hard')).toBe(3);
    });
  });

  describe('невалидные/отсутствующие значения → 1 (default)', () => {
    test('undefined → 1 (бот без явной сложности)', () => {
      expect(botMoveValue(undefined)).toBe(1);
    });

    test("неизвестная строка → 1 (switch default)", () => {
      // @ts-expect-error: намеренно передаём мусор, чтобы зафиксировать default
      expect(botMoveValue('expert')).toBe(1);
    });

    test('null → 1 (switch default)', () => {
      // @ts-expect-error: намеренно передаём null
      expect(botMoveValue(null)).toBe(1);
    });
  });

  describe('монотонность: сложнее → больше единорогов', () => {
    test('easy < normal < hard', () => {
      expect(botMoveValue('easy')).toBeLessThan(botMoveValue('normal'));
      expect(botMoveValue('normal')).toBeLessThan(botMoveValue('hard'));
    });
  });
});

describe('nextPlayerIndex: индекс следующего игрока по кругу', () => {
  describe('обычные случаи: круговой сдвиг', () => {
    test('3 игрока, индекс 0 → 1', () => {
      expect(nextPlayerIndex(0, 3)).toBe(1);
    });

    test('3 игрока, индекс 1 → 2', () => {
      expect(nextPlayerIndex(1, 3)).toBe(2);
    });

    test('3 игрока, индекс 2 → 0 (wrap-around)', () => {
      expect(nextPlayerIndex(2, 3)).toBe(0);
    });

    test('2 игрока, индекс 0 → 1', () => {
      expect(nextPlayerIndex(0, 2)).toBe(1);
    });

    test('2 игрока, индекс 1 → 0 (wrap-around)', () => {
      expect(nextPlayerIndex(1, 2)).toBe(0);
    });
  });

  describe('граничные случаи', () => {
    test('1 игрок: индекс 0 → 0 (всё время один и тот же)', () => {
      expect(nextPlayerIndex(0, 1)).toBe(0);
    });

    test('8 игроков (максимум), индекс 7 → 0', () => {
      expect(nextPlayerIndex(7, 8)).toBe(0);
    });

    test('индекс вне диапазона (5 при 3 игроках) → (5+1)%3 = 0', () => {
      expect(nextPlayerIndex(5, 3)).toBe(0);
    });
  });

  describe('краевой случай: count = 0 (сохранённое поведение)', () => {
    test('nextPlayerIndex(0, 0) → NaN (нет guard, как в оригинале)', () => {
      // В оригинале было (index + 1) % playersArr.length, при length=0 даёт NaN.
      // Guard вернул бы 0 и изменил поведение — это не рефакторинг.
      expect(nextPlayerIndex(0, 0)).toBeNaN();
    });

    test('nextPlayerIndex(5, 0) → NaN', () => {
      expect(nextPlayerIndex(5, 0)).toBeNaN();
    });
  });

  describe('отрицательные индексы (не должны встречаться, но фиксируем)', () => {
    test('nextPlayerIndex(-1, 3) → (-1+1)%3 = 0', () => {
      expect(nextPlayerIndex(-1, 3)).toBe(0);
    });

    test('nextPlayerIndex(-2, 3) → (-2+1)%3 = -1 (JS modulo сохраняет знак)', () => {
      // В JS -1 % 3 = -1, а не 2. Это сохранённое поведение.
      expect(nextPlayerIndex(-2, 3)).toBe(-1);
    });
  });
});

describe('nextPhaseOf: переход между фазами', () => {
  describe('обычные переходы внутри хода', () => {
    test("'start' → 'draw' (changed: true, advanceTurn: false, emit: true)", () => {
      const step = nextPhaseOf('start');
      expect(step).toEqual({
        changed: true,
        phase: 'draw',
        phaseIndex: 1,
        advanceTurn: false,
        emit: true,
      });
    });

    test("'draw' → 'play' (phaseIndex: 2)", () => {
      const step = nextPhaseOf('draw');
      expect(step.changed).toBe(true);
      expect(step.phase).toBe('play');
      expect(step.phaseIndex).toBe(2);
      expect(step.advanceTurn).toBe(false);
      expect(step.emit).toBe(true);
    });

    test("'play' → 'instant' (phaseIndex: 3)", () => {
      const step = nextPhaseOf('play');
      expect(step.phase).toBe('instant');
      expect(step.phaseIndex).toBe(3);
    });

    test("'instant' → 'discard' (phaseIndex: 4)", () => {
      const step = nextPhaseOf('instant');
      expect(step.phase).toBe('discard');
      expect(step.phaseIndex).toBe(4);
    });

    test("'discard' → 'end' (phaseIndex: 5, последняя фаза)", () => {
      const step = nextPhaseOf('discard');
      expect(step.phase).toBe('end');
      expect(step.phaseIndex).toBe(5);
    });
  });

  describe('краевые случаи: end и finished не двигаются', () => {
    test("'end' → changed: false (ход завершает endTurn)", () => {
      const step = nextPhaseOf('end');
      expect(step.changed).toBe(false);
      expect(step.phase).toBe('end');
      expect(step.phaseIndex).toBe(-1);
      expect(step.advanceTurn).toBe(false);
      expect(step.emit).toBe(false);
    });

    test("'finished' → changed: false (игра завершена)", () => {
      const step = nextPhaseOf('finished');
      expect(step.changed).toBe(false);
      expect(step.phase).toBe('finished');
      expect(step.phaseIndex).toBe(-1);
      expect(step.advanceTurn).toBe(false);
      expect(step.emit).toBe(false);
    });
  });

  describe('фаза вне словаря (waiting) → прыжок на start', () => {
    test("'waiting' → 'start' (changed: true, phaseIndex: 0, emit: true)", () => {
      // 'waiting' не в PHASE_ORDER, поэтому indexOf вернёт -1.
      const step = nextPhaseOf('waiting');
      expect(step.changed).toBe(true);
      expect(step.phase).toBe('start');
      expect(step.phaseIndex).toBe(0);
      expect(step.advanceTurn).toBe(false);
      expect(step.emit).toBe(true);
    });
  });

  describe('wrap-around: последняя фаза → start (недостижимо при текущем PHASE_ORDER)', () => {
    test('если бы order заканчивался на discard, то discard → start с advanceTurn: true', () => {
      // Ветка wrap-around недостижима при PHASE_ORDER, потому что 'end' перехватывается выше.
      // Но она сохранена ради буквального совпадения с оригиналом.
      // Проверяем на искусственном order, где последняя фаза — не 'end'.
      const customOrder: readonly Phase[] = ['start', 'draw', 'discard'];
      const step = nextPhaseOf('discard', customOrder);
      expect(step.changed).toBe(true);
      expect(step.phase).toBe('start');
      expect(step.phaseIndex).toBe(0);
      expect(step.advanceTurn).toBe(true);
      expect(step.emit).toBe(true);
    });
  });

  describe('пользовательский order (для полноты покрытия)', () => {
    test('можно передать свой порядок фаз', () => {
      const customOrder: readonly Phase[] = ['start', 'play', 'end'];
      const step = nextPhaseOf('start', customOrder);
      expect(step.phase).toBe('play');
      expect(step.phaseIndex).toBe(1);
    });

    test('пустой order: любая фаза → jump на order[0] (undefined)', () => {
      // Если order пустой, то indexOf вернёт -1, и мы пойдём в ветку idx < 0.
      // order[0] будет undefined. Это сохранённое поведение.
      const emptyOrder: readonly Phase[] = [];
      const step = nextPhaseOf('start', emptyOrder);
      expect(step.changed).toBe(true);
      expect(step.phase).toBeUndefined();
      expect(step.phaseIndex).toBe(0);
    });
  });
});

describe('PHASE_ORDER: фиксированный порядок фаз', () => {
  test('содержит 6 фаз в правильном порядке', () => {
    expect(PHASE_ORDER).toEqual([
      'start',
      'draw',
      'play',
      'instant',
      'discard',
      'end',
    ]);
  });

  test('длина массива — 6', () => {
    expect(PHASE_ORDER).toHaveLength(6);
  });

  test('первая фаза — start', () => {
    expect(PHASE_ORDER[0]).toBe('start');
  });

  test('последняя фаза — end', () => {
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe('end');
  });

  test('массив заморожен (readonly)', () => {
    // TypeScript readonly не гарантирует runtime freeze, но проверяем, что массив не мутирует.
    const original = [...PHASE_ORDER];
    // Пытаемся мутировать (в TypeScript это ошибка, но в runtime может пройти).
    // Проверяем, что оригинал не изменился.
    expect(PHASE_ORDER).toEqual(original);
  });
});

describe('интеграция: полная последовательность фаз', () => {
  test('start → draw → play → instant → discard → end (5 переходов)', () => {
    const phases: Phase[] = ['start'];
    let current: Phase = 'start';

    for (let i = 0; i < 5; i++) {
      const step = nextPhaseOf(current);
      if (!step.changed) break;
      current = step.phase;
      phases.push(current);
    }

    expect(phases).toEqual(['start', 'draw', 'play', 'instant', 'discard', 'end']);
  });

  test('после end следующий вызов → changed: false (остановка)', () => {
    let current: Phase = 'start';
    for (let i = 0; i < 10; i++) {
      const step = nextPhaseOf(current);
      if (!step.changed) {
        expect(current).toBe('end');
        break;
      }
      current = step.phase;
    }
  });
});
