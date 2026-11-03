// D1b-2 (задание Аналитика): защита правила «партия кончается, только когда пусты И колода, И сброс»
// на пути executor -> maybeEndOnDeckEmpty, где перетасовки сброса НЕТ.
//
// Зачем отдельный файл. Правило живёт в двух местах:
//   * gameService.ts checkWin L241 — его держит winFallbackDeckEmpty.test.ts;
//   * engine/leader.ts L65-66 maybeEndOnDeckEmpty — до этого файла не держал никто.
// Мутация «удалить L66 в leader.ts» (мутация A3 Аналитика) проходила полный jest зелёной,
// хотя maybeEndOnDeckEmpty вызывается из executor.ts L881 (добор), L966, L1118, L1188
// (перенос карт из колоды) и L1637 — там сброс не перетасовывается, и партию от ложной
// победы держит именно проверка непустого сброса.
//
// Тест идёт через публичный resolveActions (executor.ts L746) и реальный EventBus, без моков.

import { resolveActions, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { Action } from '../../shared/src/types';

function card(id: string, name = id) {
  return { id, name, type: 'basic_unicorn', effects: [] } as any;
}

// p1 — лидер по единорогам (3 против 1) при пороге победы 7:
// порог не достигнут ни одним игроком, поэтому выставление winnerId здесь может быть
// только работой фоллбека «колода кончилась», а не обычного условия победы.
function makeState(deckIds: string[], discardIds: string[]) {
  const cards: Record<string, any> = {};
  for (const id of ['a1', 'a2', 'a3', 'b1', 'x1', 'x2']) cards[id] = card(id);

  const mkPlayer = (id: string, stable: string[]) => ({
    id,
    deck: [],
    hand: [],
    discard: [],
    stable: [...stable],
    nursery: [],
    field: [],
    action_points: 1,
  }) as any;

  const state = {
    players: [mkPlayer('p1', ['a1', 'a2', 'a3']), mkPlayer('p2', ['b1'])],
    cards,
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    deck: [...deckIds],
    discard: [...discardIds],
  } as any;

  return { state, player: state.players[0] };
}

function makeCtx(state: any): ResolveContext {
  return { state, bus: new EventBus() } as any;
}

const drawTwo = [
  { kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 2 } } },
] as unknown as Action[];

describe('executor: пустая колода при непустом сбросе не завершает партию', () => {
  it('draw на deck=[] discard=[x1,x2]: false, рука 0, сброс не тронут, winnerId не выставлен', async () => {
    const { state, player } = makeState([], ['x1', 'x2']);
    const ctx = makeCtx(state);

    const ok = await resolveActions(ctx, player, drawTwo);

    // добор невозможен: колода пуста
    expect(ok).toBe(false);
    expect(player.hand).toEqual([]);
    // ключевое: сброс остался на месте, перетасовки на этом пути нет
    expect(state.discard).toEqual(['x1', 'x2']);
    // и партия жива — победитель не объявлен, хотя p1 лидер по единорогам (3 против 1)
    expect((state as any).winnerId).toBeUndefined();
  });

  it('контроль: draw на deck=[] discard=[] — winnerId всё-таки выставляется по лидеру единорогов', async () => {
    const { state, player } = makeState([], []);
    const ctx = makeCtx(state);

    const ok = await resolveActions(ctx, player, drawTwo);

    expect(ok).toBe(false);
    expect(player.hand).toEqual([]);
    // обе зоны пусты — обычный конец игры по пустой колоде
    expect((state as any).winnerId).toBe('p1');
  });
});
