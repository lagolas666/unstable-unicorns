/**
 * Задача 2d — интеграционные тесты на победное условие.
 *
 * Проверяем, что порог победы берётся из getWinningScore (config.ts),
 * а не из хардкода: 2–5 игроков → 7 единорогов, 6–8 → 6.
 *
 * Драйвер: endTurn() в GameInstance начисляет +1 единорог текущему игроку
 * и передаёт ход следующему по кругу. Значит за N ходов каждый игрок
 * получает ровно floor(N / players) единорогов, а победитель — игрок,
 * который ходит первым.
 */
import GameInstance from '../src/game/gameInstance';
import { getWinningScore } from '../src/game/config';

/** Создаёт начатую партию с заданным числом живых (не ботов) игроков. */
function makeGame(roomId: string, playerCount: number): GameInstance {
  const g = new GameInstance(roomId);
  for (let i = 1; i <= playerCount; i++) {
    g.addPlayer(`p${i}`, `P${i}`);
  }
  g.start();
  return g;
}

/** Прогоняет ровно `turns` ходов через публичный endTurn(). */
function drive(g: GameInstance, turns: number): void {
  for (let i = 0; i < turns; i++) {
    g.endTurn();
  }
}

/** Сколько единорогов у игрока по его нику. */
function unicornsOf(g: GameInstance, nickname: string): number {
  const player = g.getState().players.find(p => p.nickname === nickname);
  return player ? player.unicorns : -1;
}

describe('Победное условие: порог зависит от числа игроков', () => {
  test('2–5 игроков: победа на 7-м единороге (партия на 4)', () => {
    const g = makeGame('VICTORY-4P', 4);
    expect(getWinningScore(4)).toBe(7);

    // 24 хода = по 6 единорогов каждому — никто ещё не выиграл
    drive(g, 4 * 6);
    expect(g.winner).toBeUndefined();
    expect(unicornsOf(g, 'P1')).toBe(6);

    // 25-й ход даёт P1 седьмого единорога
    drive(g, 1);
    expect(g.winner).toBe('P1');
    expect(unicornsOf(g, 'P1')).toBe(7);
    expect(g.phase).toBe('finished');
  });

  test('5 игроков — верхняя граница малой партии, порог всё ещё 7', () => {
    const g = makeGame('VICTORY-5P', 5);
    expect(getWinningScore(5)).toBe(7);

    drive(g, 5 * 6); // по 6 единорогов
    expect(g.winner).toBeUndefined();

    drive(g, 1);
    expect(g.winner).toBe('P1');
    expect(unicornsOf(g, 'P1')).toBe(7);
  });

  test('6 игроков: победа на 6-м единороге, а не на 7-м', () => {
    const g = makeGame('VICTORY-6P', 6);
    expect(getWinningScore(6)).toBe(6);

    // 30 ходов = по 5 единорогов — победы быть не должно
    drive(g, 6 * 5);
    expect(g.winner).toBeUndefined();
    expect(unicornsOf(g, 'P1')).toBe(5);

    // 31-й ход даёт P1 шестого — игра обязана закончиться здесь
    drive(g, 1);
    expect(g.winner).toBe('P1');
    expect(unicornsOf(g, 'P1')).toBe(6);
    expect(g.phase).toBe('finished');
  });

  test('8 игроков: победа на 6-м единороге (верхняя граница диапазона)', () => {
    const g = makeGame('VICTORY-8P', 8);
    expect(getWinningScore(8)).toBe(6);

    drive(g, 8 * 5); // по 5 единорогов
    expect(g.winner).toBeUndefined();

    drive(g, 1);
    expect(g.winner).toBe('P1');
    expect(unicornsOf(g, 'P1')).toBe(6);
    expect(g.phase).toBe('finished');
  });

  test('шестая победа не наступает раньше времени: 6 игроков, 5 единорогов — игра идёт', () => {
    const g = makeGame('VICTORY-NO-EARLY', 6);
    for (let turn = 0; turn < 6 * 5; turn++) {
      g.endTurn();
      // до последнего хода победителя быть не может
      if (turn < 6 * 5 - 1) {
        expect(g.winner).toBeUndefined();
      }
    }
    expect(g.phase).not.toBe('finished');
  });
});

describe('Guard в winScore(): состав вне диапазона 2–8 не роняет сервер', () => {
  test('один игрок в партии не вызывает RangeError, порог зажимается до 7', () => {
    const g = new GameInstance('VICTORY-SOLO');
    g.addPlayer('solo', 'Solo');

    expect(() => g.start()).not.toThrow();

    // 6 ходов = 6 единорогов: при зажатом пороге 7 победы ещё нет
    expect(() => drive(g, 6)).not.toThrow();
    expect(g.winner).toBeUndefined();
    expect(unicornsOf(g, 'Solo')).toBe(6);

    // 7-й ход — победа
    expect(() => g.endTurn()).not.toThrow();
    expect(g.winner).toBe('Solo');
    expect(unicornsOf(g, 'Solo')).toBe(7);
  });

  test('9 игроков не вызывают RangeError, порог зажимается до 6', () => {
    const g = makeGame('VICTORY-9P', 9);

    expect(() => drive(g, 9 * 5)).not.toThrow(); // по 5 единорогов
    expect(g.winner).toBeUndefined();

    expect(() => g.endTurn()).not.toThrow();
    expect(g.winner).toBe('P1');
    expect(unicornsOf(g, 'P1')).toBe(6);
  });
});
