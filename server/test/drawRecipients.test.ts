/**
 * Покрытие добора по target_player (В6-3a/3-A) и лимита руки handLimitFor (3-C).
 *
 * Реальные resolveActions / drawRecipients / handLimitFor, без моков движка.
 * Колода общая (state.deck): getZoneArrayWithShared отдаёт state.deck всем владельцам,
 * поэтому число карт в руке каждого игрока и уменьшение колоды проверяются явно.
 *
 * Мутации, которые этот файл обязан ловить:
 *  M1 others -> [player]          (краснит тесты others и optional-пропуска)
 *  M2 all -> [player]             (краснит тест all)
 *  M3 handLimitFor без дельты стойла (краснит тесты delta)
 *  M5 action.optional не читается (краснит тест optional)
 */
import { resolveActions, drawRecipients, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { GameState, PlayerState } from '../src/engine/state';
import { handLimitFor } from '../src/engine/handLimit';
import { Action } from '../../shared/src/types';

function makeGame(playerCount: number, deckSize: number, cards: Record<string, any> = {}) {
  const allCards: Record<string, any> = { ...cards };
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
  return { state, ctx, p1: players[0], p2: players[1], p3: players[2] };
}

function drawAction(targetPlayer: string | undefined, quantity: number, optional?: boolean): Action {
  const a: any = { kind: 'draw', target: { quantity: { value: quantity } } };
  if (targetPlayer !== undefined) a.target_player = targetPlayer;
  if (optional !== undefined) a.optional = optional;
  return a as Action;
}

describe('drawRecipients: получатели добора по target_player', () => {
  it('self -> только актор', () => {
    const { ctx, p1 } = makeGame(3, 5);
    expect(drawRecipients(ctx, p1, 'self').map(p => p.id)).toEqual(['p1']);
  });

  it('others -> все кроме актора (актор не входит)', () => {
    const { ctx, p1 } = makeGame(3, 5);
    expect(drawRecipients(ctx, p1, 'others').map(p => p.id)).toEqual(['p2', 'p3']);
  });

  it('all -> все игроки, включая актора', () => {
    const { ctx, p1 } = makeGame(3, 5);
    expect(drawRecipients(ctx, p1, 'all').map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('chosen без выбора игрока -> [] (ни себе, ни кому-либо)', () => {
    const { ctx, p1 } = makeGame(2, 5);
    expect(drawRecipients(ctx, p1, 'chosen')).toEqual([]);
  });

  it('chosen с выбранным игроком -> только выбранный', () => {
    const { ctx, p1 } = makeGame(3, 5);
    ctx.currentSourceId = 'src1';
    ctx.selectedPlayers = { src1: 'p3' };
    expect(drawRecipients(ctx, p1, 'chosen').map(p => p.id)).toEqual(['p3']);
  });

  it('неизвестный target_player -> [] (не подменяется на self)', () => {
    const { ctx, p1 } = makeGame(2, 5);
    expect(drawRecipients(ctx, p1, 'nobody')).toEqual([]);
  });
});

describe('executeDraw через resolveActions: добор по target_player', () => {
  it('self quantity=2: в руке актора 2 карты, у соперника 0', async () => {
    const { state, ctx, p1, p2 } = makeGame(2, 6);
    const ok = await resolveActions(ctx, p1, [drawAction('self', 2)]);
    expect(ok).toBe(true);
    expect(p1.hand.length).toBe(2);
    expect(p2.hand.length).toBe(0);
    expect(state.deck!.length).toBe(4);
  });

  it('others quantity=1 (2 игрока): актор не добирает, соперник получает ровно 1 карту', async () => {
    const { state, ctx, p1, p2 } = makeGame(2, 6);
    const ok = await resolveActions(ctx, p1, [drawAction('others', 1)]);
    expect(ok).toBe(true);
    expect(p1.hand.length).toBe(0);
    expect(p2.hand.length).toBe(1);
    expect(state.deck!.length).toBe(5);
  });

  it('others quantity=2 (3 игрока): каждый соперник получает по 2, актор не трогается', async () => {
    const { state, ctx, p1, p2, p3 } = makeGame(3, 8);
    const ok = await resolveActions(ctx, p1, [drawAction('others', 2)]);
    expect(ok).toBe(true);
    expect(p1.hand.length).toBe(0);
    expect(p2.hand.length).toBe(2);
    expect(p3.hand.length).toBe(2);
    expect(state.deck!.length).toBe(4);
  });

  it('all quantity=1 (2 игрока): добирают все, включая актора', async () => {
    const { state, ctx, p1, p2 } = makeGame(2, 6);
    const ok = await resolveActions(ctx, p1, [drawAction('all', 1)]);
    expect(ok).toBe(true);
    expect(p1.hand.length).toBe(1);
    expect(p2.hand.length).toBe(1);
    expect(state.deck!.length).toBe(4);
  });

  it('others optional:true на действии: соперник не добирает без согласия, пропуск записан в ctx.optionalSkipped', async () => {
    const { state, ctx, p1, p2 } = makeGame(2, 6);
    ctx.currentSourceId = 'mg1';
    const ok = await resolveActions(ctx, p1, [drawAction('others', 1, true)]);
    expect(ok).toBe(false);
    expect(p1.hand.length).toBe(0);
    expect(p2.hand.length).toBe(0);
    expect(state.deck!.length).toBe(6);
    expect(ctx.optionalSkipped).toEqual([
      { cardId: 'mg1', kind: 'draw', targetPlayer: 'others', playerId: 'p2', quantity: 1 },
    ]);
  });

  it('self optional:true: актор добирает сам, пропуска нет', async () => {
    const { ctx, p1 } = makeGame(2, 6);
    const ok = await resolveActions(ctx, p1, [drawAction('self', 1, true)]);
    expect(ok).toBe(true);
    expect(p1.hand.length).toBe(1);
    expect(ctx.optionalSkipped ?? []).toEqual([]);
  });

  it('chosen без выбора: ничего не добрано, колода цела, resolveActions возвращает false', async () => {
    const { state, ctx, p1, p2 } = makeGame(2, 6);
    const ok = await resolveActions(ctx, p1, [drawAction('chosen', 2)]);
    expect(ok).toBe(false);
    expect(p1.hand.length).toBe(0);
    expect(p2.hand.length).toBe(0);
    expect(state.deck!.length).toBe(6);
  });

  it('chosen с выбором соперника: добирает выбранный, актор не трогается', async () => {
    const { state, ctx, p1, p2 } = makeGame(2, 6);
    ctx.currentSourceId = 'src2';
    ctx.selectedPlayers = { src2: 'p2' };
    const ok = await resolveActions(ctx, p1, [drawAction('chosen', 2)]);
    expect(ok).toBe(true);
    expect(p1.hand.length).toBe(0);
    expect(p2.hand.length).toBe(2);
    expect(state.deck!.length).toBe(4);
  });
});

describe('handLimitFor: лимит руки от стойла игрока', () => {
  const limitCards = {
    up2: { id: 'up2', name: 'Up2', type: 'basic_unicorn', hand_limit_delta: 2 },
    down3: { id: 'down3', name: 'Down3', type: 'basic_unicorn', hand_limit_delta: -3 },
    down10: { id: 'down10', name: 'Down10', type: 'basic_unicorn', hand_limit_delta: -10 },
    plain: { id: 'plain', name: 'Plain', type: 'basic_unicorn' },
    handOnly: { id: 'handOnly', name: 'HandOnly', type: 'basic_unicorn', hand_limit_delta: 2 },
  };

  it('без карт в стойле лимит = 7', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    expect(handLimitFor(state, p1)).toBe(7);
  });

  it('карта +2 в стойле -> лимит 9', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    p1.stable = ['up2'];
    expect(handLimitFor(state, p1)).toBe(9);
  });

  it('карта -3 в стойле -> лимит 4', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    p1.stable = ['down3'];
    expect(handLimitFor(state, p1)).toBe(4);
  });

  it('дельты суммируются: +2 и -3 -> лимит 6', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    p1.stable = ['up2', 'down3'];
    expect(handLimitFor(state, p1)).toBe(6);
  });

  it('лимит не уходит ниже 0', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    p1.stable = ['down10'];
    expect(handLimitFor(state, p1)).toBe(0);
  });

  it('карта без hand_limit_delta не меняет лимит', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    p1.stable = ['plain'];
    expect(handLimitFor(state, p1)).toBe(7);
  });

  it('дельта карты в руке не считается, только стойло', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    p1.hand = ['handOnly'];
    expect(handLimitFor(state, p1)).toBe(7);
  });

  it('карта из стойла, которой нет в state.cards, пропускается без ошибки', () => {
    const { state, p1 } = makeGame(2, 0, limitCards);
    p1.stable = ['ghost'];
    expect(handLimitFor(state, p1)).toBe(7);
  });
});
