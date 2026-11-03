// D1b: страж правила «партия кончается, только когда пусты И колода, И сброс».
// Правило появилось вместе с фоллбеком checkWin (gameService.ts L239-241):
// раньше пустая колода при непустом сбросе объявляла победу, теперь сначала идёт
// перетасовка сброса в колоду (drawCard L833-842) и партия продолжается.
// Файл держит три вещи, которые легко сломать незаметно:
//   1) checkWin не отдаёт победу, пока сброс не пуст;
//   2) drawCard на пустой колоде с непустым сбросом перетасовывает и НЕ объявляет победителя;
//   3) при обеих пустых зонах победа всё-таки присуждается — по лидеру единорогов.

import { games } from '../src/gameStore';
import { checkWin, drawCard } from '../src/gameService';
import { EventBus } from '../src/engine/events';

function uni(id: string) {
  return { id, type: 'basic_unicorn', name: 'U ' + id, effects: [] };
}

function mkState(over: any = {}) {
  const mkPlayer = (id: string) => ({
    id,
    deck: [],
    hand: [],
    discard: [],
    stable: [],
    nursery: [],
    field: [],
    action_points: 1,
  }) as any;
  const cards: Record<string, any> = {};
  for (const id of ['a1', 'a2', 'a3', 'b1', 'x1', 'x2']) cards[id] = uni(id);
  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  // p1 — лидер по единорогам (3 против 1) при пороге 7: порог не достигнут ни кем,
  // поэтому исход решает именно фоллбек, а не обычное условие победы.
  p1.stable = ['a1', 'a2', 'a3'];
  p2.stable = ['b1'];
  return {
    players: [p1, p2],
    cards,
    deck: [] as string[],
    discard: [] as string[],
    turn: { currentPlayerId: 'p1', phase: 'begin_turn', has_drawn: false },
    ...over,
  } as any;
}

function entryOf(state: any) {
  const id = 'g-fb-' + Math.random().toString(36).slice(2);
  games.set(id, { state, bus: new EventBus(), logs: [], pending: null as any } as any);
  return id;
}

describe('D1b: пустая колода без пустого сброса — партия не кончена', () => {
  it('checkWin: deck пуст, discard непуст -> победы нет (фоллбек не срабатывает)', () => {
    const state = mkState({ discard: ['x1', 'x2'] });
    expect(checkWin(state)).toBeNull();
    expect((state as any).winnerId).toBeUndefined();
  });

  it('checkWin: deck и discard пусты -> победа по лидеру единорогов', () => {
    const state = mkState();
    expect(checkWin(state)).toBe('p1');
  });

  it('drawCard: deck пуст, discard непуст -> перетасовка, добор есть, winnerId не выставлен', async () => {
    const state = mkState({ discard: ['x1', 'x2'] });
    const id = entryOf(state);

    const res = await drawCard(id, 'p1', { via: 'rest' });
    expect(res.ok).toBe(true);

    const s = games.get(id)!.state as any;
    expect(s.turn.has_drawn).toBe(true);
    expect(s.turn.phase).toBe('action');
    // одна карта ушла в руку, вторая осталась в перетасованной колоде
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.discard).toHaveLength(0);
    expect(s.deck).toHaveLength(1);
    // ключевое: партия жива, победителя нет
    expect((s as any).winnerId).toBeUndefined();
    expect(checkWin(s)).toBeNull();
    const reshuffled = games.get(id)!.logs.some((l: any) => l?.details?.event === 'reshuffle');
    expect(reshuffled).toBe(true);
  });

  it('drawCard: deck и discard пусты -> партия завершается, winnerId = лидер', async () => {
    const state = mkState();
    const id = entryOf(state);

    const res = await drawCard(id, 'p1', { via: 'rest' });
    expect(res.ok).toBe(true);

    const s = games.get(id)!.state as any;
    expect(s.players[0].hand).toHaveLength(0);
    expect((s as any).winnerId).toBe('p1');
  });

  it('контроль: непустая колода -> обычный добор без перетасовки и без победы', async () => {
    const state = mkState({ deck: ['x1', 'x2'], discard: ['x2'] });
    const id = entryOf(state);

    const res = await drawCard(id, 'p1', { via: 'rest' });
    expect(res.ok).toBe(true);

    const s = games.get(id)!.state as any;
    expect(s.players[0].hand).toEqual(['x2']); // верх колоды — последний элемент
    expect((s as any).winnerId).toBeUndefined();
    const reshuffled = games.get(id)!.logs.some((l: any) => l?.details?.event === 'reshuffle');
    expect(reshuffled).toBe(false);
  });
});
