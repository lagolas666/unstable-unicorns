// Guard'ы окна await_choice (файл Тестировщика, задача Аналитика от 31.10.2026).
// Цель: дать мутациям TM1 (L1963), TM2 (L71), TM3 (L2048) цель, которую они обязаны покраснить.
// До появления этого файла до L2048 доходил только Puppetmaster с валидным cardId (happy path),
// а до L1963 и L71 не доходил ни один тест в server/test.

import { games } from '../src/gameStore';
import { playCard, resolvePendingNow, schedulePendingResolution } from '../src/gameService';
import { EventBus } from '../src/engine/events';

function mkState(over: any = {}) {
  const mkPlayer = (id: string, extra: any = {}) => ({
    id,
    deck: [],
    hand: [],
    discard: [],
    stable: [],
    nursery: [],
    field: [],
    action_points: 1,
    ...extra,
  });
  return {
    players: [mkPlayer('p1'), mkPlayer('p2')],
    cards: {} as Record<string, any>,
    // D1b: непустая колода — иначе фоллбек «колода И сброс пусты» сразу объявляет партию оконченной
    deck: ['z1', 'z2'] as string[],
    discard: [] as string[],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    ...over,
  } as any;
}

function entryOf(state: any) {
  const id = 'g-guard-' + Math.random().toString(36).slice(2);
  games.set(id, { state, bus: new EventBus(), logs: [], pending: null as any } as any);
  return id;
}

// Puppetmaster в руке p1 + три карты у p2: тот же расклад, что в enterHook.test.ts.
function puppetState() {
  const state = mkState();
  // Две ступени как в хардкоде: discard 1 себе, и только при успехе — force_discard 2 соперникам.
  state.cards.pm = {
    id: 'pm',
    type: 'basic_unicorn',
    name: 'Кукловод',
    effects: [
      {
        trigger: 'on_enter_stable',
        actions: [
          { kind: 'discard', target: { scope: 'self', zone: 'hand', quantity: { value: 1 } } },
          {
            kind: 'force_discard',
            requires_success_of_previous: true,
            target: { scope: 'other', zone: 'hand', quantity: { value: 2 } },
          },
        ],
      },
    ],
  };
  for (const k of ['a', 'x', 'y', 'z']) state.cards[k] = { id: k, type: 'basic_unicorn', name: k, effects: [] };
  state.players[0].hand = ['pm', 'a'];
  state.players[1].hand = ['x', 'y', 'z'];
  return state;
}

function killTimer(id: string) {
  const ent: any = games.get(id);
  if (ent?.pendingTimeout) {
    clearTimeout(ent.pendingTimeout);
    ent.pendingTimeout = null;
  }
}

afterEach(() => {
  jest.useRealTimers();
});

describe('Guard окна await_choice: карта обязана быть в options и в руке защитника', () => {
  // F3 -> убивает TM3 (gameService.ts L2048: убраны includes по hand/options).
  it('F3: cardId вне options -> 400, окно и рука защитника не изменены', async () => {
    const state = puppetState();
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'pm');
    expect(res.ok).toBe(true);

    const pend: any = games.get(id)!.pending;
    expect(pend).toBeTruthy();
    expect(pend.kind).toBe('await_choice');
    expect(pend.chooserId).toBe('p2');
    expect([...pend.options].sort()).toEqual(['x', 'y', 'z']);

    // Ключ фикстуры: карта 'w' лежит в руке защитника, но её НЕТ в options.
    // Проверка hand.includes её пропустит, поэтому поймать ослабление может только options.
    (state.cards as any).w = { id: 'w', type: 'basic_unicorn', name: 'w', effects: [] };
    games.get(id)!.state.players[1].hand.push('w');
    expect(games.get(id)!.state.players[1].hand).toHaveLength(4);

    const snapshot = JSON.stringify({
      state: games.get(id)!.state,
      pending: games.get(id)!.pending,
      logs: games.get(id)!.logs.length,
    });

    const r = await resolvePendingNow(id, { byPlayerId: 'p2', cardId: 'w' }, undefined as any);

    // С guard'ом: отказ, состояние побайтово прежнее.
    expect(r.ok).toBe(false);
    expect(String((r as any).http ?? '')).toBe('400');
    expect(JSON.stringify({
      state: games.get(id)!.state,
      pending: games.get(id)!.pending,
      logs: games.get(id)!.logs.length,
    })).toBe(snapshot);

    expect(games.get(id)!.state.players[1].hand).toContain('w');
    expect(games.get(id)!.state.players[1].discard).toEqual([]);
    expect((games.get(id)!.pending as any).kind).toBe('await_choice');
    const chosen = games.get(id)!.logs.some((l: any) => l?.details?.chosenByPlayer === true);
    expect(chosen).toBe(false);

    killTimer(id);
  });

  // F1 -> убивает TM1 (gameService.ts L1963: снят guard `entry.pending === pending`).
  it('F1: ветка play в resolvePendingNow не затирает окно await_choice, открытое эффектом', async () => {
    const state = puppetState();
    const id = entryOf(state);

    // Ручная инъекция окна реакции вместо гонки с таймером: play-окно для Puppetmaster.
    games.get(id)!.pending = {
      kind: 'play',
      actorId: 'p1',
      byPlayerId: 'p1',
      cardId: 'pm',
      uncounterable: false,
      cancelLevel: 0,
      expiresAt: Date.now() + 60000,
    } as any;

    const r = await resolvePendingNow(id, { byPlayerId: 'p1' }, undefined as any);

    // performPlayNow сработал: pm ушёл из руки в стойло.
    expect(r.ok).toBe(true);
    const s = games.get(id)!.state;
    expect(s.players[0].stable).toContain('pm');
    expect(s.players[0].hand).not.toContain('pm');

    // Главное: force_discard по p2 (3 карты) открыл await_choice, и старое окно его не затёрло.
    const pend: any = games.get(id)!.pending;
    expect(pend).not.toBeNull();
    expect(pend?.kind).toBe('await_choice');
    expect(pend?.chooserId).toBe('p2');
    expect(games.get(id)!.state.players[1].hand).toHaveLength(3);
    expect(games.get(id)!.state.players[1].discard).toEqual([]);

    killTimer(id);
  });

  // F2 -> убивает TM2 (gameService.ts L71: снят guard `e.pending === p` в таймере).
  it('F2: таймер schedulePendingResolution не затирает окно await_choice, открытое эффектом', async () => {
    const state = puppetState();
    const id = entryOf(state);

    games.get(id)!.pending = {
      kind: 'play',
      actorId: 'p1',
      byPlayerId: 'p1',
      cardId: 'pm',
      uncounterable: false,
      cancelLevel: 0,
      expiresAt: Date.now() + 60000,
    } as any;

    // Таймер сам проставит expiresAt = now + delayMs и вызовет performPlayNow.
    schedulePendingResolution(id, 20);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const s = games.get(id)!.state;
    expect(s.players[0].stable).toContain('pm');

    const pend: any = games.get(id)!.pending;
    expect(pend).not.toBeNull();
    expect(pend?.kind).toBe('await_choice');
    expect(pend?.chooserId).toBe('p2');
    expect(s.players[1].hand).toHaveLength(3);

    killTimer(id);
  });

  // F4 -> убивает AN-M4 (L2048: снят ТОЛЬКО chooser.hand.includes, options оставлен).
  it('F4: cardId есть в options, но уже не в руке защитника -> 400 и выбора не происходит', async () => {
    const state = puppetState();
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'pm');
    expect(res.ok).toBe(true);

    const pend: any = games.get(id)!.pending;
    expect(pend.kind).toBe('await_choice');
    expect([...pend.options].sort()).toEqual(['x', 'y', 'z']);

    // Ключ фикстуры: 'y' остаётся валидным option, но физически отсутствует в руке.
    // Проверка hand.includes обязана отклонить выбор; ослабление только этой проверки
    // пропускает options.includes и исполняет выбор.
    const defender = games.get(id)!.state.players[1];
    expect(defender.hand).toContain('y');
    defender.hand = defender.hand.filter((c: string) => c !== 'y');
    expect(defender.hand).toHaveLength(2);
    expect(defender.discard).toEqual([]);
    expect((games.get(id)!.pending as any).options).toContain('y');

    const snapshot = JSON.stringify({
      state: games.get(id)!.state,
      pending: games.get(id)!.pending,
      logs: games.get(id)!.logs.length,
    });

    const r = await resolvePendingNow(id, { byPlayerId: 'p2', cardId: 'y' }, undefined as any);

    expect(r.ok).toBe(false);
    expect(String((r as any).http ?? '')).toBe('400');
    expect(JSON.stringify({
      state: games.get(id)!.state,
      pending: games.get(id)!.pending,
      logs: games.get(id)!.logs.length,
    })).toBe(snapshot);

    const after = games.get(id)!.state.players[1];
    expect(after.hand).not.toContain('y');
    expect(after.discard).toEqual([]);
    expect(after.hand).toHaveLength(2);
    expect((games.get(id)!.pending as any).kind).toBe('await_choice');
    const chosen = games.get(id)!.logs.some((l: any) => l?.details?.chosenByPlayer === true);
    expect(chosen).toBe(false);

    killTimer(id);
  });
});
