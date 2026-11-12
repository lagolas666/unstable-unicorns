// Страж DEF-07 (Аналитик, 31.10.2026): окно await_choice открывается ВНУТРИ розыгрыша карты
// (enter-хук triggerEnterEffectsFor -> ctx.requestChoice), поэтому outcome playCard обязан
// вернуть это окно наружу. Иначе транспорты (socket handlers.ts L186-190 и REST routes/game.ts
// L891-897) видят result.pending === undefined, уходят в ветку state_update, и клиент
// никогда не узнаёт про открытое окно выбора карты защитника.
//
// До фикса: playCard(...).pending === undefined при entry.pending.kind === 'await_choice' -> тест красный.
// После фикса: outcome несёт то же окно, что лежит в сторе.

import { games } from '../src/gameStore';
import { playCard } from '../src/gameService';
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
    deck: [] as string[],
    discard: [] as string[],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true },
    ...over,
  } as any;
}

function entryOf(state: any) {
  const id = 'g-def07-' + Math.random().toString(36).slice(2);
  games.set(id, { state, bus: new EventBus(), logs: [], pending: null as any } as any);
  return id;
}

// Puppetmaster в руке p1 и три карты у p2 — расклад из awaitChoiceGuard.test.ts.
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

describe('DEF-07: playCard возвращает окно, открытое внутри резолва', () => {
  // D1 — основная проверка. Убивает возврат outcome без entry.pending.
  it('D1: playCard отдаёт pending=await_choice, если окно открылось в enter-хуке', async () => {
    const id = entryOf(puppetState());

    const res: any = await playCard(id, 'p1', 'pm');
    expect(res.ok).toBe(true);

    const stored: any = games.get(id)!.pending;
    expect(stored).toBeTruthy();
    expect(stored.kind).toBe('await_choice');

    // Дефект: до фикса здесь undefined, потому что outcome собран без pending.
    expect(res.pending).toBeTruthy();
    expect(res.pending.kind).toBe('await_choice');
    // Транспорт должен отдать именно то окно, что лежит в сторе (тот же объект или его копия).
    expect(res.pending.chooserId).toBe('p2');
    expect(res.pending.actorId).toBe('p1');
    expect([...res.pending.options].sort()).toEqual(['x', 'y', 'z']);

    killTimer(id);
  });

  // D2 — защита от «фикса на слово»: если окна нет, pending остаётся пустым,
  // то есть ветка state_update продолжает работать для обычного розыгрыша.
  it('D2: без открытого окна playCard не выдумывает pending', async () => {
    const state = mkState();
    state.cards.plain = { id: 'plain', type: 'basic_unicorn', name: 'Plain', effects: [] };
    state.players[0].hand = ['plain'];
    const id = entryOf(state);

    const res: any = await playCard(id, 'p1', 'plain');
    expect(res.ok).toBe(true);
    expect(games.get(id)!.pending).toBeFalsy();
    expect(res.pending).toBeFalsy();

    killTimer(id);
  });
});
