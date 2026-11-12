// Малыш уходит в Ясли (state.nursery), а не в сброс/руку (шаг 2, sendCardTo в executor.ts).
// Тест идёт через публичный resolveActions и реальный EventBus, без моков.
// Определение Малыша — строго source_zone === 'nursery_only' (engine/unicornTypes.ts isNurseryOnly).
// Малыш в руке или в колоде в фикстурах НЕ появляется: он стоит в стойле (путь Ясли → стойло).

import { resolveActions, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { Action } from '../../shared/src/types';

function baby(id: string) {
  return { id, name: id, type: 'baby_unicorn', source_zone: 'nursery_only', effects: [] } as any;
}
function unicorn(id: string, name = id) {
  return { id, name, type: 'basic_unicorn', effects: [] } as any;
}
function zombieKnight(id: string) {
  return { id, name: 'Zombie Knight Unicorn', type: 'basic_unicorn', effects: [] } as any;
}

// p1 держит свою карту в стойле; p2 — цель уничтожения/жертвы.
// nursery: если передан undefined — поле state.nursery не создаётся вовсе (опционально в типе).
function makeState(opts: {
  p1Stable: string[];
  p2Stable: string[];
  p1Discard?: string[];
  p1Hand?: string[];
  cards: Record<string, any>;
  nursery?: string[] | undefined;
}) {
  const mkPlayer = (id: string, stable: string[], hand: string[], discard: string[]) =>
    ({ id, deck: [], hand: [...hand], discard: [...discard], stable: [...stable], nursery: [], field: [], action_points: 1 }) as any;
  const state: any = {
    players: [
      mkPlayer('p1', opts.p1Stable, opts.p1Hand ?? [], opts.p1Discard ?? []),
      mkPlayer('p2', opts.p2Stable, [], []),
    ],
    cards: opts.cards,
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    deck: ['d1'],
    discard: [],
  };
  if (opts.nursery !== undefined) state.nursery = [...opts.nursery];
  return state;
}

function makeCtx(state: any, selected: Record<string, string[]>): ResolveContext {
  return { state, bus: new EventBus(), selectedTargets: selected, currentSourceId: 'src' } as any;
}

// destroy одного единорога у соперника, цель выбрана явно через selectedTargets.
const destroyOne = [
  { kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'any' } } },
] as unknown as Action[];

// sacrifice одного из своего стойла (scope self) — явная цель.
const sacrificeOne = [
  { kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'any' } } },
] as unknown as Action[];

// return_to_hand: вернуть 1 единорога из сброса владельца в руку (Zombie Knight).
const returnOne = [
  { kind: 'return_to_hand', targets: { scope: 'self', zone: 'discard', quantity: { value: 1 }, filters: { card_group: 'unicorn' } } },
] as unknown as Action[];

describe('Малыш уходит в Ясли при уничтожении / жертве / возврате (sendCardTo)', () => {
  it('1. destroy Малыша у соперника → state.nursery, в сбросе владельца его нет, из стойла убран', async () => {
    const state = makeState({
      p1Stable: ['a1'],
      p2Stable: ['b1'],
      cards: { a1: unicorn('a1'), b1: baby('b1') },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['b1'] });
    const ok = await resolveActions(ctx, state.players[0], destroyOne);
    expect(ok).toBe(true);
    expect(state.nursery).toEqual(['b1']);
    expect(state.players[1].discard).not.toContain('b1');
    expect(state.players[1].stable).not.toContain('b1');
  });

  it('2. destroy обычного единорога → в сброс владельца, в Ясли ничего не попало (контроль)', async () => {
    const state = makeState({
      p1Stable: ['a1'],
      p2Stable: ['b1'],
      cards: { a1: unicorn('a1'), b1: unicorn('b1') },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['b1'] });
    const ok = await resolveActions(ctx, state.players[0], destroyOne);
    expect(ok).toBe(true);
    expect(state.players[1].discard).toEqual(['b1']);
    expect(state.nursery).toEqual([]);
  });

  it('3. sacrifice Малыша из своего стойла → state.nursery, в сбросе его нет', async () => {
    const state = makeState({
      p1Stable: ['bb'],
      p2Stable: [],
      cards: { bb: baby('bb') },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['bb'] });
    const ok = await resolveActions(ctx, state.players[0], sacrificeOne);
    expect(ok).toBe(true);
    expect(state.nursery).toEqual(['bb']);
    expect(state.players[0].discard).not.toContain('bb');
    expect(state.players[0].stable).not.toContain('bb');
  });

  it('4. sacrifice обычного единорога → в сброс, в Ясли пусто (контроль)', async () => {
    const state = makeState({
      p1Stable: ['a1'],
      p2Stable: [],
      cards: { a1: unicorn('a1') },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['a1'] });
    const ok = await resolveActions(ctx, state.players[0], sacrificeOne);
    expect(ok).toBe(true);
    expect(state.players[0].discard).toEqual(['a1']);
    expect(state.nursery).toEqual([]);
  });

  it('5. return_to_hand Малыша из сброса → state.nursery, в руке и сбросе его нет', async () => {
    // Малыш физически в сбросе владельца по данным (source_zone nursery_only) — возврат должен увести его в Ясли.
    const state = makeState({
      p1Stable: [],
      p2Stable: [],
      p1Discard: ['bb'],
      cards: { bb: baby('bb') },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['bb'] });
    const ok = await resolveActions(ctx, state.players[0], returnOne);
    expect(ok).toBe(true);
    expect(state.nursery).toEqual(['bb']);
    expect(state.players[0].hand).not.toContain('bb');
    expect(state.players[0].discard).not.toContain('bb');
  });

  it('6. return_to_hand обычного единорога → в руку (контроль)', async () => {
    const state = makeState({
      p1Stable: [],
      p2Stable: [],
      p1Discard: ['u1'],
      cards: { u1: unicorn('u1') },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['u1'] });
    const ok = await resolveActions(ctx, state.players[0], returnOne);
    expect(ok).toBe(true);
    expect(state.players[0].hand).toEqual(['u1']);
    expect(state.nursery).toEqual([]);
  });

  it('7. destroy Малыша при активном Zombie Knight у владельца → Ясли, в руке пусто', async () => {
    // Zombie Knight у владельца жертвы (p2) — без правила Малыша хелпер вернул бы его в руку.
    const state = makeState({
      p1Stable: ['a1'],
      p2Stable: ['zk', 'b1'],
      cards: { a1: unicorn('a1'), zk: zombieKnight('zk'), b1: baby('b1') },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['b1'] });
    const ok = await resolveActions(ctx, state.players[0], destroyOne);
    expect(ok).toBe(true);
    expect(state.nursery).toEqual(['b1']);
    expect(state.players[1].hand).not.toContain('b1');
    expect(state.players[1].discard).not.toContain('b1');
  });

  it('8. state без поля nursery: destroy Малыша не падает и кладёт его в Ясли (опциональное поле)', async () => {
    const state = makeState({
      p1Stable: ['a1'],
      p2Stable: ['b1'],
      cards: { a1: unicorn('a1'), b1: baby('b1') },
      nursery: undefined,
    });
    expect(state.nursery).toBeUndefined();
    const ctx = makeCtx(state, { src: ['b1'] });
    const ok = await resolveActions(ctx, state.players[0], destroyOne);
    expect(ok).toBe(true);
    expect(state.nursery).toEqual(['b1']);
  });

  it('9. карта type:baby_unicorn БЕЗ source_zone (тип не равен флагу): destroy → в сброс владельца, Ясли пусты', async () => {
    const legacy = { id: 'bl', name: 'bl', type: 'baby_unicorn', effects: [] } as any;
    const state = makeState({
      p1Stable: ['a1'],
      p2Stable: ['bl'],
      cards: { a1: unicorn('a1'), bl: legacy },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['bl'] });
    const ok = await resolveActions(ctx, state.players[0], destroyOne);
    expect(ok).toBe(true);
    expect(state.players[1].discard).toEqual(['bl']);
    expect(state.nursery).toEqual([]);
  });

  it('10. source_zone:nursery_only при type:basic_unicorn → destroy → в Ясли (предикат по флагу, не по типу)', async () => {
    const flagged = { id: 'bf', name: 'bf', type: 'basic_unicorn', source_zone: 'nursery_only', effects: [] } as any;
    const state = makeState({
      p1Stable: ['a1'],
      p2Stable: ['bf'],
      cards: { a1: unicorn('a1'), bf: flagged },
      nursery: [],
    });
    const ctx = makeCtx(state, { src: ['bf'] });
    const ok = await resolveActions(ctx, state.players[0], destroyOne);
    expect(ok).toBe(true);
    expect(state.nursery).toEqual(['bf']);
    expect(state.players[1].discard).not.toContain('bf');
  });
});
