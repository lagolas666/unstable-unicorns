/**
 * Регрессионный тест вида действия 'draw' и явного отказа нереализованных видов
 * в server/src/engine/executor.ts (resolveActions -> executeAction).
 *
 * Реальный resolveActions и EventBus, без моков движка. console.warn перехватывается,
 * чтобы вывод оставался чистым и проверялся сам факт предупреждения.
 *
 * pull / force_discard / return_to_hand реализованы в executor.ts (executePull,
 * executeForceDiscard, executeReturnToHand); их проверяем на успех, явную цель и пустую цель.
 */
import { resolveActions, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { GameState, PlayerState } from '../src/engine/state';
import { Action } from '../../shared/src/types';

function makeState(deckSize: number, handIds: string[] = [], stableIds: string[] = []) {
  const cards: Record<string, any> = {};
  const deck: string[] = [];
  for (let i = 0; i < deckSize; i++) {
    const id = `d${i}`;
    cards[id] = { id, name: `Deck ${i}`, type: 'basic_unicorn' };
    deck.push(id); // верх колоды — конец массива
  }
  const player: PlayerState = {
    id: 'p1',
    deck: [],
    hand: [...handIds],
    discard: [],
    stable: [...stableIds],
    nursery: [],
    field: [],
    action_points: 1,
  };
  const opp: PlayerState = {
    id: 'p2',
    deck: [],
    hand: [],
    discard: [],
    stable: [],
    nursery: [],
    field: [],
    action_points: 1,
  };
  for (const id of [...handIds, ...stableIds]) {
    cards[id] = cards[id] || { id, name: id, type: 'basic_unicorn' };
  }
  const state: GameState = {
    players: [player, opp],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    cards,
    deck,
    discard: [],
  };
  return { state, player };
}

function makeCtx(state: GameState): ResolveContext {
  return { state, bus: new EventBus() };
}

function snapshot(state: GameState, player: PlayerState) {
  return JSON.stringify({
    hand: [...player.hand],
    deck: [...(state.deck ?? [])],
    stable: [...player.stable],
    discard: [...(state.discard ?? [])],
    winnerId: (state as any).winnerId ?? null,
  });
}

// Полный снимок всех игроков: нужен для проверки, что соперники и их зоны не изменились.
function fullSnapshot(state: GameState) {
  return JSON.stringify({
    players: state.players.map(p => ({
      id: p.id,
      hand: [...p.hand],
      deck: [...p.deck],
      discard: [...p.discard],
      stable: [...p.stable],
      field: [...p.field],
    })),
    deck: [...(state.deck ?? [])],
    discard: [...(state.discard ?? [])],
  });
}

describe('executor: draw и явный отказ нереализованных видов', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // Пункт 1: draw на 3 карты
  it('draw quantity=3: true, в руке 3 карты с верха колоды, колода уменьшилась на 3', async () => {
    const { state, player } = makeState(5);
    const ctx = makeCtx(state);
    const actions = [{ kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 3 } } }] as unknown as Action[];

    const ok = await resolveActions(ctx, player, actions);

    expect(ok).toBe(true);
    expect(player.hand.length).toBe(3);
    expect(state.deck!.length).toBe(2);
    // состав: верхние три карты (конец массива) d4, d3, d2
    expect([...player.hand].sort()).toEqual(['d2', 'd3', 'd4']);
    expect(state.deck).toEqual(['d0', 'd1']);
  });

  // Пункт 2: draw на 1 карту
  it('draw quantity=1: true, в руке ровно верхняя карта, колода 2 из 3', async () => {
    const { state, player } = makeState(3);
    const ctx = makeCtx(state);
    const actions = [{ kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 1 } } }] as unknown as Action[];

    const ok = await resolveActions(ctx, player, actions);

    expect(ok).toBe(true);
    expect(player.hand).toEqual(['d2']);
    expect(state.deck).toEqual(['d0', 'd1']);
  });

  // Пункт 3: quantity отсутствует — дефолт 1
  it('draw без quantity: дефолт 1 карта, не падает', async () => {
    const { state, player } = makeState(3);
    const ctx = makeCtx(state);
    const actions = [{ kind: 'draw', targets: { scope: 'self', zone: 'deck' } }] as unknown as Action[];

    const ok = await resolveActions(ctx, player, actions);

    expect(ok).toBe(true);
    expect(player.hand).toEqual(['d2']);
    expect(state.deck!.length).toBe(2);
  });

  // Пункт 4: пустая колода — без исключения, рука 0, наблюдаемый эффект winnerId
  it('draw на пустой колоде: не бросает, рука 0, false и winnerId выставлен по единорогам', async () => {
    const { state, player } = makeState(0, [], ['u1']);
    // у p1 один единорог на столе, у p2 ничего => победитель p1
    (state.cards as any)['u1'] = { id: 'u1', name: 'Unicorn A', type: 'basic_unicorn' };
    state.players[1].stable = [];
    const ctx = makeCtx(state);
    const actions = [{ kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 2 } } }] as unknown as Action[];

    let ok: boolean | undefined;
    await expect(
      (async () => {
        ok = await resolveActions(ctx, player, actions);
      })(),
    ).resolves.toBeUndefined();

    expect(ok).toBe(false);
    expect(player.hand.length).toBe(0);
    expect((state as any).winnerId).toBe('p1');
  });

  // Пункт 5: choice и counter не реализуются намеренно — явный отказ, состояние не меняется
  // (counter: механика живёт в окнах реакций gameService.ts; choice: требует UI await_choice).
  const unimplemented = ['choice', 'counter'];
  for (const kind of unimplemented) {
    it(`вид ${kind}: resolveActions=false, состояние не меняется, есть предупреждение`, async () => {
      const { state, player } = makeState(3, ['h1'], ['u1']);
      (state.cards as any)['u1'] = { id: 'u1', name: 'Unicorn A', type: 'basic_unicorn' };
      (state.cards as any)['h1'] = { id: 'h1', name: 'Hand 1', type: 'basic_unicorn' };
      const before = snapshot(state, player);
      const ctx = makeCtx(state);
      const actions = [{ kind, targets: { scope: 'self', zone: 'hand', quantity: { value: 1 } } }] as unknown as Action[];

      const ok = await resolveActions(ctx, player, actions);

      expect(ok).toBe(false);
      expect(snapshot(state, player)).toBe(before);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(`unhandled action kind: ${kind}`));
    });
  }

  // Пункт 6: совсем неизвестный вид
  it('неизвестный вид definitely_not_a_kind: false, состояние не меняется', async () => {
    const { state, player } = makeState(3, ['h1'], ['u1']);
    (state.cards as any)['u1'] = { id: 'u1', name: 'Unicorn A', type: 'basic_unicorn' };
    (state.cards as any)['h1'] = { id: 'h1', name: 'Hand 1', type: 'basic_unicorn' };
    const before = snapshot(state, player);
    const ctx = makeCtx(state);
    const actions = [{ kind: 'definitely_not_a_kind', targets: {} }] as unknown as Action[];

    const ok = await resolveActions(ctx, player, actions);

    expect(ok).toBe(false);
    expect(snapshot(state, player)).toBe(before);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unhandled action kind: definitely_not_a_kind'));
  });

  // pull: 1 случайная карта из руки выбранного соперника в руку владельца
  describe('pull: реализован, отказа нет', () => {
    const pullAction = [{ kind: 'pull', targets: { scope: 'opponents', quantity: { value: 1 } } }] as unknown as Action[];

    it('успех без явной цели: одна карта уходит от соперника с непустой рукой к владельцу', async () => {
      const { state, player } = makeState(0);
      state.players[1].hand = ['o1', 'o2'];
      const ctx = makeCtx(state);

      const ok = await resolveActions(ctx, player, pullAction);

      expect(ok).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(state.players[1].hand.length).toBe(1);
      expect([...player.hand, ...state.players[1].hand].sort()).toEqual(['o1', 'o2']);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('unhandled action kind'));
    });

    it('явная цель: карта тянется у выбранного соперника, рука другого соперника не меняется', async () => {
      const { state, player } = makeState(0);
      state.players[1].hand = ['o1', 'o2'];
      state.players.push({
        id: 'p3', deck: [], hand: ['x1'], discard: [], stable: [], nursery: [], field: [], action_points: 1,
      } as PlayerState);
      const ctx = makeCtx(state);
      (ctx as any).currentSourceId = 'src';
      (ctx as any).selectedPlayers = { src: 'p3' };

      const ok = await resolveActions(ctx, player, pullAction);

      expect(ok).toBe(true);
      expect(player.hand).toEqual(['x1']);
      expect(state.players[2].hand).toEqual([]);
      expect(state.players[1].hand).toEqual(['o1', 'o2']);
    });

    it('пустые руки соперников: false, состояние не меняется, предупреждения о виде нет', async () => {
      const { state, player } = makeState(0, ['h1']);
      const before = fullSnapshot(state);
      const ctx = makeCtx(state);

      const ok = await resolveActions(ctx, player, pullAction);

      expect(ok).toBe(false);
      expect(fullSnapshot(state)).toBe(before);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('unhandled action kind'));
    });
  });

  // force_discard: соперник сбрасывает 1 случайную карту из руки
  describe('force_discard: реализован, отказа нет', () => {
    const forceAction = [{ kind: 'force_discard', targets: { scope: 'opponents', quantity: { value: 1 } } }] as unknown as Action[];

    it('успех: у соперника -1 карта в руке и +1 в сбросе, рука владельца не меняется', async () => {
      const { state, player } = makeState(0, ['h1']);
      state.players[1].hand = ['o1', 'o2', 'o3'];
      const ctx = makeCtx(state);

      const ok = await resolveActions(ctx, player, forceAction);

      expect(ok).toBe(true);
      expect(state.players[1].hand.length).toBe(2);
      expect(state.players[1].discard.length).toBe(1);
      expect([...state.players[1].hand, ...state.players[1].discard].sort()).toEqual(['o1', 'o2', 'o3']);
      expect(player.hand).toEqual(['h1']);
    });

    it('пустые руки соперников: false, состояние не меняется, предупреждения о виде нет', async () => {
      const { state, player } = makeState(0, ['h1']);
      const before = fullSnapshot(state);
      const ctx = makeCtx(state);

      const ok = await resolveActions(ctx, player, forceAction);

      expect(ok).toBe(false);
      expect(fullSnapshot(state)).toBe(before);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('unhandled action kind'));
    });
  });

  // return_to_hand: карта возвращается из сброса владельца в руку, только если выбрана явно
  describe('return_to_hand: реализован, отказа нет', () => {
    const returnAction = [{ kind: 'return_to_hand', targets: { scope: 'self', zone: 'discard', quantity: { value: 1 } } }] as unknown as Action[];

    it('успех: выбранная карта из сброса переходит в руку владельца', async () => {
      const { state, player } = makeState(0);
      player.discard = ['g1', 'g2'];
      const ctx = makeCtx(state);
      (ctx as any).currentSourceId = 'src';
      (ctx as any).selectedTargets = { src: ['g1'] };

      const ok = await resolveActions(ctx, player, returnAction);

      expect(ok).toBe(true);
      expect(player.hand).toEqual(['g1']);
      expect(player.discard).toEqual(['g2']);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('unhandled action kind'));
    });

    it('без выбранной цели при непустом сбросе: false, состояние не меняется (контракт selectedTargets)', async () => {
      const { state, player } = makeState(0);
      player.discard = ['g1'];
      const before = fullSnapshot(state);
      const ctx = makeCtx(state);

      const ok = await resolveActions(ctx, player, returnAction);

      expect(ok).toBe(false);
      expect(player.hand).toEqual([]);
      expect(fullSnapshot(state)).toBe(before);
      expect(player.discard).toEqual(['g1']);
    });

    it('пустой сброс: false, состояние не меняется, предупреждения о виде нет', async () => {
      const { state, player } = makeState(0, ['h1']);
      const before = fullSnapshot(state);
      const ctx = makeCtx(state);

      const ok = await resolveActions(ctx, player, returnAction);

      expect(ok).toBe(false);
      expect(fullSnapshot(state)).toBe(before);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('unhandled action kind'));
    });
  });
});
