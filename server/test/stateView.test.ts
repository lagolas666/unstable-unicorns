/**
 * stateView.test.ts
 * Тесты чистой функции buildStateView (вынесена из gameInstance.getState).
 *
 * Покрытие:
 *  - базовая сборка view (roomId, phase, players, currentTurn, winner)
 *  - wrap-around currentTurnIndex
 *  - пустая карта игроков
 *  - одиночный игрок
 *  - winner передаётся как есть
 *  - поля players (unicorns, isHost) пробрасываются без мутаций
 */

import { buildStateView } from '../src/game/stateView';
import type { Player, Phase } from '../src/game/types';

function makePlayer(overrides: Partial<Player> & { id: string; nickname: string }): Player {
  return {
    hand: [],
    unicorns: 0,
    isHost: false,
    ...overrides,
  } as Player;
}

function makePlayers(...entries: Array<{ id: string; nickname: string; unicorns?: number; isHost?: boolean }>): Map<string, Player> {
  const map = new Map<string, Player>();
  for (const e of entries) {
    map.set(e.id, makePlayer({
      id: e.id,
      nickname: e.nickname,
      unicorns: e.unicorns ?? 0,
      isHost: e.isHost ?? false,
    }));
  }
  return map;
}

describe('buildStateView: базовая сборка', () => {
  test('roomId и phase пробрасываются как есть', () => {
    const players = makePlayers({ id: 'p1', nickname: 'Алиса' });
    const view = buildStateView('room-42', 'draw', players, 0);
    expect(view.roomId).toBe('room-42');
    expect(view.phase).toBe('draw');
  });

  test('players: сохраняются id, nickname, unicorns, isHost', () => {
    const players = makePlayers(
      { id: 'p1', nickname: 'Алиса', unicorns: 3, isHost: true },
      { id: 'p2', nickname: 'Борис', unicorns: 5, isHost: false },
    );
    const view = buildStateView('r', 'play', players, 0);
    expect(view.players).toEqual([
      { id: 'p1', nickname: 'Алиса', unicorns: 3, isHost: true },
      { id: 'p2', nickname: 'Борис', unicorns: 5, isHost: false },
    ]);
  });

  test('players view — копия, не исходные объекты (без мутаций)', () => {
    const players = makePlayers({ id: 'p1', nickname: 'Алиса', unicorns: 1 });
    const view = buildStateView('r', 'play', players, 0);
    // Изменение view не должно влиять на исходную Map
    view.players[0].unicorns = 999;
    const original = Array.from(players.values())[0];
    expect(original.unicorns).toBe(1);
  });

  test('currentTurn = nickname игрока по индексу', () => {
    const players = makePlayers(
      { id: 'p1', nickname: 'Алиса' },
      { id: 'p2', nickname: 'Борис' },
      { id: 'p3', nickname: 'Вика' },
    );
    expect(buildStateView('r', 'play', players, 0).currentTurn).toBe('Алиса');
    expect(buildStateView('r', 'play', players, 1).currentTurn).toBe('Борис');
    expect(buildStateView('r', 'play', players, 2).currentTurn).toBe('Вика');
  });

  test('winner передаётся как есть', () => {
    const players = makePlayers({ id: 'p1', nickname: 'Алиса' });
    const view = buildStateView('r', 'end', players, 0, 'Алиса');
    expect(view.winner).toBe('Алиса');
  });

  test('winner undefined → поле отсутствует или undefined', () => {
    const players = makePlayers({ id: 'p1', nickname: 'Алиса' });
    const view = buildStateView('r', 'play', players, 0);
    expect(view.winner).toBeUndefined();
  });
});

describe('buildStateView: wrap-around currentTurnIndex', () => {
  test('индекс = длине игроков → wrap к первому', () => {
    const players = makePlayers(
      { id: 'p1', nickname: 'Алиса' },
      { id: 'p2', nickname: 'Борис' },
    );
    // 2 % 2 = 0 → Алиса
    expect(buildStateView('r', 'play', players, 2).currentTurn).toBe('Алиса');
  });

  test('индекс > длины → корректный wrap', () => {
    const players = makePlayers(
      { id: 'p1', nickname: 'Алиса' },
      { id: 'p2', nickname: 'Борис' },
      { id: 'p3', nickname: 'Вика' },
    );
    // 5 % 3 = 2 → Вика
    expect(buildStateView('r', 'play', players, 5).currentTurn).toBe('Вика');
    // 4 % 3 = 1 → Борис
    expect(buildStateView('r', 'play', players, 4).currentTurn).toBe('Борис');
  });
});

describe('buildStateView: граничные случаи', () => {
  test('пустая карта игроков → currentTurn undefined, players = []', () => {
    const players = new Map<string, Player>();
    const view = buildStateView('r', 'start', players, 0);
    expect(view.players).toEqual([]);
    expect(view.currentTurn).toBeUndefined();
  });

  test('один игрок: любой индекс → тот же игрок', () => {
    const players = makePlayers({ id: 'p1', nickname: 'Алиса' });
    expect(buildStateView('r', 'play', players, 0).currentTurn).toBe('Алиса');
    expect(buildStateView('r', 'play', players, 1).currentTurn).toBe('Алиса');
    expect(buildStateView('r', 'play', players, 100).currentTurn).toBe('Алиса');
  });

  test('отрицательный индекс: JS modulo сохраняет знак → undefined (последний не берётся)', () => {
    const players = makePlayers(
      { id: 'p1', nickname: 'Алиса' },
      { id: 'p2', nickname: 'Борис' },
    );
    // -1 % 2 = -1 в JS → playersArr[-1] = undefined → ?.nickname = undefined
    expect(buildStateView('r', 'play', players, -1).currentTurn).toBeUndefined();
  });

  test('все фазы из PHASE_ORDER пробрасываются корректно', () => {
    const players = makePlayers({ id: 'p1', nickname: 'Алиса' });
    const phases: Phase[] = ['start', 'draw', 'play', 'instant', 'discard', 'end'];
    for (const phase of phases) {
      const view = buildStateView('r', phase, players, 0);
      expect(view.phase).toBe(phase);
    }
  });
});

describe('buildStateView: интеграция с gameInstance.getState', () => {
  test('view совпадает с тем, что вернул бы старый getState (2 игрока)', () => {
    // Эмуляция поведения GameInstance.getState() до выноса
    const players = makePlayers(
      { id: 'p1', nickname: 'Алиса', unicorns: 2, isHost: true },
      { id: 'p2', nickname: 'Борис', unicorns: 4, isHost: false },
    );
    const view = buildStateView('room-7', 'discard', players, 1, undefined);
    expect(view).toEqual({
      roomId: 'room-7',
      phase: 'discard',
      players: [
        { id: 'p1', nickname: 'Алиса', unicorns: 2, isHost: true },
        { id: 'p2', nickname: 'Борис', unicorns: 4, isHost: false },
      ],
      currentTurn: 'Борис',
      winner: undefined,
    });
  });

  test('view при победе (winner задан)', () => {
    const players = makePlayers(
      { id: 'p1', nickname: 'Алиса', unicorns: 7 },
      { id: 'p2', nickname: 'Борис', unicorns: 3 },
    );
    const view = buildStateView('room-7', 'end', players, 0, 'Алиса');
    expect(view.winner).toBe('Алиса');
    expect(view.phase).toBe('end');
  });
});
