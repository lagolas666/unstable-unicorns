// D1b-2 (задание Аналитика): защита правила «партия кончается, только когда пусты И колода, И сброс»
// на пути executor -> maybeEndOnDeckEmpty. С 08.11.2026 пути draw / draw_conditional /
// draw_until_limit перетасовывают сброс в колоду (executor.ts reshuffleDiscardIntoDeck),
// поэтому ложную победу держит правило «колода И сброс пусты».
//
// Зачем отдельный файл. Правило живёт в двух местах:
//   * gameService.ts checkWin L241 — его держит winFallbackDeckEmpty.test.ts;
//   * engine/leader.ts L65-66 maybeEndOnDeckEmpty — до этого файла не держал никто.
// Мутация «удалить L66 в leader.ts» (мутация A3 Аналитика) проходила полный jest зелёной,
// хотя maybeEndOnDeckEmpty вызывается из executor.ts L881 (добор), L966, L1118, L1188
// (перенос карт из колоды) и L1637. На этих путях сброс перетасовывается, и партию от
// ложной победы держит проверка «и колода, и сброс пусты».
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
  for (const id of ['a1', 'a2', 'a3', 'b1', 'x1', 'x2', 'x3']) cards[id] = card(id);

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

// ctx.logs нужен: решафл пишет в него запись event:'reshuffle' (executor.ts reshuffleDiscardIntoDeck).
function makeCtx(state: any): ResolveContext {
  return { state, bus: new EventBus(), logs: [] } as any;
}

const drawTwo = [
  { kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 2 } } },
] as unknown as Action[];

describe('executor: пустая колода при непустом сбросе — решафл вместо конца партии', () => {
  // Сброс из 3 карт при доборе 2: после решафла остаётся 1 карта в колоде,
  // поэтому партия продолжается. Случай «после решафла колода снова опустела»
  // корректно завершает игру по лидеру единорогов — это отдельный сценарий.
  it('draw на deck=[] discard=[x1,x2,x3]: true, сброс перетасован в колоду, рука 2, карта в колоде, winnerId не выставлен', async () => {
    const { state, player } = makeState([], ['x1', 'x2', 'x3']);
    const ctx = makeCtx(state);

    const ok = await resolveActions(ctx, player, drawTwo);

    // решафл делает добор возможным
    expect(ok).toBe(true);
    // обе карты сброса ушли в руку
    expect(player.hand).toHaveLength(2);
    expect(player.hand.every((c: string) => ['x1', 'x2', 'x3'].includes(c))).toBe(true);
    // ключевое: сброс поднят в колоду и опустошён, остатка не осталось
    expect(state.discard).toEqual([]);
    expect(state.deck).toHaveLength(1);
    // решафл записан в журнал партии ровно один раз
    const resh = (ctx.logs || []).filter((l: any) => l?.details?.event === 'reshuffle');
    expect(resh).toHaveLength(1);
    expect((resh[0] as any).details.size).toBe(3);
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
