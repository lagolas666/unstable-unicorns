/**
 * Покрытие публикации следа пропущенных optional-действий в состояние партии (В6-3a-2).
 *
 * Проверяется именно state.optionalSkipped (то, что уходит клиенту), а не ctx.optionalSkipped:
 * старое поведение ctx уже держит drawRecipients.test.ts, оно здесь не дублируется.
 *
 * Мутации, которые этот файл обязан ловить (нумерация приёмки Аналитика):
 *  M2 цикл публикации вырожден (for i=from; i<from)   -> краснит тест 1 и 3
 *  M3 дедупликация снята (const from = 0)             -> краснит тест 2
 *  M4 убран flush в resolveEffect (executor L846)     -> краснит тест 1
 *  M5 убран flush в resolveActions (executor L869)    -> краснит тест 3
 */
import { resolveActions, resolveEffect, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { GameState, PlayerState } from '../src/engine/state';
import { Action } from '../../shared/src/types';

function makeGame(playerCount: number, deckSize: number) {
  const allCards: Record<string, any> = {};
  const deck: string[] = [];
  for (let i = 0; i < deckSize; i++) {
    const id = `d${i}`;
    allCards[id] = { id, name: `Deck ${i}`, type: 'basic_unicorn' };
    deck.push(id); // верх колоды — конец массива
  }
  const players: PlayerState[] = [];
  for (let i = 1; i <= playerCount; i++) {
    players.push({
      id: `p${i}`,
      deck: [],
      hand: [],
      discard: [],
      stable: [],
      nursery: [],
      field: [],
      action_points: 1,
    });
  }
  const state: GameState = {
    players,
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    cards: allCards,
    deck,
    discard: [],
  };
  const ctx: ResolveContext = { state, bus: new EventBus() };
  return { state, ctx, p1: players[0], p2: players[1] };
}

/** optional-добор чужому игроку: без окна согласия действие пропускается и обязано оставить след. */
function optionalDrawOthers(quantity = 1): Action {
  return { kind: 'draw', target: { quantity: { value: quantity } }, target_player: 'others', optional: true } as any;
}

describe('state.optionalSkipped: публикация пропуска доезжает до состояния партии', () => {
  it('1. resolveEffect над optional draw others: ровно одна запись с полным контрактом', async () => {
    const { state, ctx, p1, p2 } = makeGame(2, 6);
    await resolveEffect(ctx, p1, 'mg1', { actions: [optionalDrawOthers(1)] } as any);

    expect(p2.hand.length).toBe(0); // без согласия не добрано
    expect(state.optionalSkipped).toBeDefined();
    expect(state.optionalSkipped!.length).toBe(1);

    const rec: any = state.optionalSkipped![0];
    expect(rec.cardId).toBe('mg1');
    expect(rec.kind).toBe('draw');
    expect(rec.targetPlayer).toBe('others');
    expect(rec.playerId).toBe('p2');
    expect(rec.quantity).toBe(1);
    expect(typeof rec.t).toBe('number');
    expect(rec.t).toBeGreaterThan(0);
  });

  it('2. повторный flush на том же ctx не даёт дублей в состоянии', async () => {
    const { state, ctx, p1 } = makeGame(2, 6);

    await resolveActions(ctx, p1, [optionalDrawOthers(1)]);
    expect(state.optionalSkipped!.length).toBe(1);

    await resolveActions(ctx, p1, [optionalDrawOthers(1)]);
    // два уникальных пропуска, а не 1+2=3 от накопленного ctx
    expect(state.optionalSkipped!.length).toBe(2);
    expect(state.optionalSkipped!.map((r: any) => r.t)).toHaveLength(2);
    // ctx при этом не обнуляется: его читает Тестировщик и вызывающий код
    expect(ctx.optionalSkipped!.length).toBe(2);
  });

  it('3. прямой resolveActions с пропуском: запись в состоянии есть', async () => {
    const { state, ctx, p1 } = makeGame(2, 6);
    ctx.currentSourceId = 'src3';

    const ok = await resolveActions(ctx, p1, [optionalDrawOthers(2)]);
    expect(ok).toBe(false); // пропуск — не успешное исполнение
    expect(state.optionalSkipped!.length).toBe(1);
    expect(state.optionalSkipped![0].cardId).toBe('src3');
    expect(state.optionalSkipped![0].quantity).toBe(2);
  });

  it('4. пустой набор пропусков не мусорит в состоянии', async () => {
    const { state, ctx, p1 } = makeGame(2, 6);

    // self optional:true исполняется, пропуска нет
    const ok = await resolveActions(ctx, p1, [
      { kind: 'draw', target: { quantity: { value: 1 } }, target_player: 'self', optional: true } as any,
    ]);
    expect(ok).toBe(true);
    expect(state.optionalSkipped ?? []).toEqual([]);
  });
});
