// BUG-NM-EXSELF, ветка АВТОПРОХОДА sacrifice (executor.ts L972-996, фильтр на L979).
// Дыра в покрытии: мутация M-E2 (снять ctx.currentSourceId с L979) проходила гейт ЗЕЛЁНОЙ.
// Ветку выбора игрока сторожат E1 (excludeSelf.test.ts) и D4 (enterHook.test.ts), а автопроход — никто.
// Сценарий настоящий: nightmare_unicorn_ultimate входит в стойло и жертвует 3 карты,
// игрок цель не выбирал (selectedTargets пуст) — исполнение уходит в автопроход.
// Автопроход берёт карты с ВЕРХА стойла (srcArr[srcArr.length - 1]), поэтому источник
// намеренно поставлен последним: без exclude_self он падал бы первым.
// Фикстуры — только данные (kind / target / filters), сравнений по имени карты нет.

import { resolveActions, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { Action } from '../../shared/src/types';

function unicorn(id: string) {
  return { id, name: id, type: 'basic_unicorn', effects: [] } as any;
}

function makeState(opts: { p1Stable: string[]; cards: Record<string, any> }) {
  const mkPlayer = (id: string, stable: string[]) =>
    ({ id, deck: [], hand: [], discard: [], stable: [...stable], nursery: [], field: [], action_points: 1 }) as any;
  return {
    players: [mkPlayer('p1', opts.p1Stable), mkPlayer('p2', [])],
    cards: opts.cards,
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    deck: ['d1'],
    discard: [],
    nursery: [],
  } as any;
}

// selectedTargets ПУСТ намеренно: именно пустой выбор заводит исполнение в автопроход L976.
function makeAutoCtx(state: any, sourceId: string): ResolveContext {
  return { state, bus: new EventBus(), selectedTargets: {}, currentSourceId: sourceId } as any;
}

// sacrifice 3 из своего стойла, источник исключён по данным (флаг exclude_self).
const sacrificeThreeExcludeSelf = [
  { kind: 'sacrifice', target: { scope: 'self', zone: 'stable', quantity: { value: 3 }, filters: { card_group: 'any', exclude_self: true } } },
] as unknown as Action[];

// Тот же sacrifice без флага — контроль, что автопроход вообще исполняется и идёт с конца стойла.
const sacrificeThreePlain = [
  { kind: 'sacrifice', target: { scope: 'self', zone: 'stable', quantity: { value: 3 }, filters: { card_group: 'any' } } },
] as unknown as Action[];

describe('BUG-NM-EXSELF: exclude_self в ветке автопрохода sacrifice', () => {
  it('A1. автопроход уважает exclude_self: источник последним в стойле, но не жертвуется', async () => {
    const state = makeState({
      p1Stable: ['u1', 'u2', 'u3', 'nm'],
      cards: { nm: unicorn('nm'), u1: unicorn('u1'), u2: unicorn('u2'), u3: unicorn('u3') },
    });
    const ctx = makeAutoCtx(state, 'nm');
    const ok = await resolveActions(ctx, state.players[0], sacrificeThreeExcludeSelf);

    expect(ok).toBe(true);
    // Источник остался в стойле и не ушёл в сброс — проверка ровно того, что делает L979.
    expect(state.players[0].stable).toEqual(['nm']);
    expect(state.players[0].discard).not.toContain('nm');
    // Квота добита обычными единорогами: автопроход не сдался на первом пропуске.
    expect(state.players[0].discard).toEqual(expect.arrayContaining(['u1', 'u2', 'u3']));
    expect(state.players[0].discard).toHaveLength(3);
    // Ловушка «вернуть всё на место и ничего не пожертвовать» тоже отсекается: стабильно один.
    expect(state.players[0].stable).toHaveLength(1);
  });

  it('A2. контроль: без exclude_self автопроход идёт с конца стойла и забирает источник', async () => {
    const state = makeState({
      p1Stable: ['u1', 'u2', 'u3', 'nm'],
      cards: { nm: unicorn('nm'), u1: unicorn('u1'), u2: unicorn('u2'), u3: unicorn('u3') },
    });
    const ctx = makeAutoCtx(state, 'nm');
    const ok = await resolveActions(ctx, state.players[0], sacrificeThreePlain);

    expect(ok).toBe(true);
    // Порядок снятия с верха стойла: nm → u3 → u2. Доказывает, что автопроход реально сработал,
    // иначе A1 был бы зелёным просто потому, что ветка не исполнялась.
    expect(state.players[0].discard).toEqual(['nm', 'u3', 'u2']);
    expect(state.players[0].stable).toEqual(['u1']);
  });
});
