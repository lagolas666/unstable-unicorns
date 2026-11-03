/**
 * TC-CONFIG: порог победы зависит от числа игроков.
 *
 * Официальные правила Unstable Unicorns:
 *  - 2–5 игроков → 7 единорогов в стойле;
 *  - 6–8 игроков → 6 единорогов в стойле.
 *
 * До этой задачи порог был захардкожен как `>= 7` в четырёх местах
 * gameInstance.ts, поэтому партия на 6–8 игроков не могла завершиться
 * по правилам (победа объявлялась только на 7-м единороге).
 */

import {
  getWinningScore,
  WINNING_SCORE_SMALL_GAME,
  WINNING_SCORE_LARGE_GAME,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from '../src/game/config';

describe('getWinningScore: порог победы по числу игроков', () => {
  describe('партия на 2–5 игроков → 7 единорогов', () => {
    test.each([2, 3, 4, 5])('%i игрока → 7', (count) => {
      expect(getWinningScore(count)).toBe(7);
    });
  });

  describe('партия на 6–8 игроков → 6 единорогов', () => {
    test.each([6, 7, 8])('%i игроков → 6', (count) => {
      expect(getWinningScore(count)).toBe(6);
    });
  });

  describe('граничные значения диапазона', () => {
    test('2 игрока — нижняя граница, порог 7', () => {
      expect(getWinningScore(MIN_PLAYERS)).toBe(7);
    });

    test('5 игроков — последняя партия малого состава, порог 7', () => {
      expect(getWinningScore(5)).toBe(7);
    });

    test('6 игроков — первая партия большого состава, порог 6', () => {
      expect(getWinningScore(6)).toBe(6);
    });

    test('8 игроков — верхняя граница, порог 6', () => {
      expect(getWinningScore(MAX_PLAYERS)).toBe(6);
    });

    test('на стыке 5 → 6 порог меняется ровно на единицу', () => {
      expect(getWinningScore(5) - getWinningScore(6)).toBe(1);
    });
  });

  describe('функция монотонна: больше игроков — не выше порог', () => {
    test('порог не возрастает во всём диапазоне 2–8', () => {
      for (let count = MIN_PLAYERS; count < MAX_PLAYERS; count += 1) {
        expect(getWinningScore(count + 1)).toBeLessThanOrEqual(
          getWinningScore(count)
        );
      }
    });
  });

  describe('негативные сценарии: невалидное число игроков', () => {
    test.each([
      ['ноль', 0],
      ['один игрок', 1],
      ['отрицательное', -1],
      ['больше максимума', 9],
      ['дробное', 2.5],
      ['NaN', NaN],
      ['Infinity', Infinity],
    ])('%s → RangeError', (_label, count) => {
      expect(() => getWinningScore(count as number)).toThrow(RangeError);
    });

    test('сообщение об ошибке содержит допустимый диапазон', () => {
      expect(() => getWinningScore(9)).toThrow(/2.*8/);
    });
  });

  describe('константы модуля', () => {
    test('пороги равны 7 и 6', () => {
      expect(WINNING_SCORE_SMALL_GAME).toBe(7);
      expect(WINNING_SCORE_LARGE_GAME).toBe(6);
    });

    test('границы состава — 2 и 8 игроков', () => {
      expect(MIN_PLAYERS).toBe(2);
      expect(MAX_PLAYERS).toBe(8);
    });
  });
});
