// Розыгрыш юнicорна из руки должен запускать хардкод-входы (triggerEnterEffectsFor) ровно один раз.
// Задача Аналитика (вход из руки): Americorn, Zombie Knight, Puppetmaster, Frankencorn, Chronocorn.
// Тесты через сервис playCard (тот же путь, что REST /play, тело запроса роут не меняет).

import { games } from '../src/gameStore';
import { playCard, resolvePendingNow } from '../src/gameService';
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
  const id = 'g-enter-' + Math.random().toString(36).slice(2);
  games.set(id, { state, bus: new EventBus(), logs: [], pending: null as any } as any);
  return id;
}

afterEach(() => {
  jest.useRealTimers();
});

function unicorn(id: string, name: string, effects: any[]) {
  return { id, type: 'basic_unicorn', name, effects };
}

describe('Вход в стойло из руки: playCard запускает хардкод-входы ровно один раз', () => {
  it('Americorn: p1 рука 1 (после розыгрыша +1 pull), p2 рука 2 -> 1', async () => {
    const state = mkState();
    state.cards.am = unicorn('am', 'Americorn', [
      { trigger: 'on_enter_stable', actions: [{ kind: 'pull', targets: { scope: 'other', zone: 'hand', quantity: { value: 1 } } }] },
    ]);
    state.cards.o1 = { id: 'o1', type: 'basic_unicorn', name: 'X', effects: [] };
    state.cards.o2 = { id: 'o2', type: 'basic_unicorn', name: 'Y', effects: [] };
    state.players[0].hand = ['am'];
    state.players[1].hand = ['o1', 'o2'];
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'am');
    expect(res.ok).toBe(true);
    const s = games.get(id)!.state;
    // Ожидание: p1 рука 1 (pull ровно одной карты), p2 рука 1. Баг сейчас: p1 рука 0 (хука нет).
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.players[1].hand).toHaveLength(1);
  });

  it('Zombie Knight: discard 4 ровно один раз (рука 5 -> 1)', async () => {
    const state = mkState();
    state.cards.zk = unicorn('zk', 'Zombie Knight Unicorn', []);
    state.players[0].hand = ['zk', 'a', 'b', 'c', 'd', 'e'];
    for (const k of ['a', 'b', 'c', 'd', 'e']) state.cards[k] = { id: k, type: 'basic_unicorn', name: k, effects: [] };
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'zk');
    expect(res.ok).toBe(true);
    const s = games.get(id)!.state;
    // Ожидание: на руке 5 -> discard 4 -> 1. Двойной вызов дал бы 0.
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('Puppetmaster: force_discard открывает окно выбора защитника (p2: 3 -> 2 после ответа)', async () => {
    const state = mkState();
    state.cards.pm = unicorn('pm', 'Puppetmaster Unicorn', []);
    state.players[0].hand = ['pm', 'a'];
    state.players[1].hand = ['x', 'y', 'z'];
    for (const k of ['a', 'x', 'y', 'z']) state.cards[k] = { id: k, type: 'basic_unicorn', name: k, effects: [] };
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'pm');
    expect(res.ok).toBe(true);

    // 1. Эффект остановлен: открыто окно выбора, рука защитника не тронута.
    //    Случайный сброс (chosenByPlayer=NO) — дефект TC-025, а не норма.
    const pend: any = games.get(id)!.pending;
    expect(pend).toBeTruthy();
    expect(pend.kind).toBe('await_choice');
    expect(pend.chooserId).toBe('p2');
    expect(pend.options).toHaveLength(3);
    expect([...pend.options].sort()).toEqual(['x', 'y', 'z']);

    const before = games.get(id)!.state;
    expect(before.players[1].hand).toHaveLength(3);
    expect(before.players[1].discard).toHaveLength(0);

    // 2. Защитник отвечает: выбранная карта в сбросе, эффект не повторяется.
    const r2 = await resolvePendingNow(id, { byPlayerId: 'p2', cardId: 'y' }, undefined as any);
    expect(r2.ok).toBe(true);

    const s = games.get(id)!.state;
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.players[1].hand).toHaveLength(2);
    expect(s.players[1].hand).not.toContain('y');
    expect(s.players[1].discard).toEqual(['y']);
    expect(games.get(id)!.pending).toBeNull();

    const logged = games.get(id)!.logs.some((l: any) => l?.details?.chosenByPlayer === true);
    expect(logged).toBe(true);

    // Окно с таймером не должно держать jest открытым.
    const ent: any = games.get(id)!;
    if (ent.pendingTimeout) {
      clearTimeout(ent.pendingTimeout);
      ent.pendingTimeout = null;
    }
  });

  it('Frankencorn: discard 1 ровно один раз (рука 2 -> 1)', async () => {
    const state = mkState();
    state.cards.fk = unicorn('fk', 'Frankencorn', []);
    state.cards.a = { id: 'a', type: 'basic_unicorn', name: 'a', effects: [] };
    state.cards.b = { id: 'b', type: 'basic_unicorn', name: 'b', effects: [] };
    state.players[0].hand = ['fk', 'a', 'b'];
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'fk');
    expect(res.ok).toBe(true);
    const s = games.get(id)!.state;
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('Chronocorn: discard 1 ровно один раз (рука 2 -> 1)', async () => {
    const state = mkState();
    state.cards.cc = unicorn('cc', 'Chronocorn', []);
    state.cards.a = { id: 'a', type: 'basic_unicorn', name: 'a', effects: [] };
    state.cards.b = { id: 'b', type: 'basic_unicorn', name: 'b', effects: [] };
    state.players[0].hand = ['cc', 'a', 'b'];
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'cc');
    expect(res.ok).toBe(true);
    const s = games.get(id)!.state;
    expect(s.players[0].hand).toHaveLength(1);
  });
});

describe('Путь через окно реакций (performPlayNow / resolvePendingNow)', () => {
  it('Americorn: хардкод-вход срабатывает и после resolvePendingNow', async () => {
    const state = mkState();
    // Юникорн с on_play в данных -> playCard открывает окно реакций вместо немедленного розыгрыша
    state.cards.am = unicorn('am', 'Americorn', [
      { trigger: 'on_play', actions: [{ kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { value: 1 } } }] },
    ]);
    state.cards.a = { id: 'a', type: 'basic_unicorn', name: 'a', effects: [] };
    state.cards.x = { id: 'x', type: 'basic_unicorn', name: 'x', effects: [] };
    state.cards.y = { id: 'y', type: 'basic_unicorn', name: 'y', effects: [] };
    state.players[0].hand = ['am', 'a'];
    state.players[1].hand = ['x', 'y'];
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'am');
    expect(res.ok).toBe(true);
    expect((res as any).openedWindow).toBe(true);
    expect(games.get(id)!.pending).toBeTruthy();

    const r2 = await resolvePendingNow(id, {}, undefined as any);
    expect(r2.ok).toBe(true);
    const s = games.get(id)!.state;
    // on_play сбросил 1 карту (a), хардкод-вход забрал 1 карту у p2
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.players[1].hand).toHaveLength(1);
  });

  it('двойной on_play: юникорн с on_play в данных добирает ровно 1 карту (generic-цикл пропущен)', async () => {
    const state = mkState();
    state.cards.td = unicorn('td', 'Testdoublecorn', [
      { trigger: 'on_play', actions: [{ kind: 'draw', targets: { quantity: { value: 1 } } }] },
    ]);
    state.cards.d1 = { id: 'd1', type: 'basic_unicorn', name: 'd1', effects: [] };
    state.cards.d2 = { id: 'd2', type: 'basic_unicorn', name: 'd2', effects: [] };
    state.players[0].hand = ['td'];
    // Колода общая: executor читает ctx.state.deck (getZoneArrayWithShared), не player.deck
    (state as any).deck = ['d1', 'd2'];
    const id = entryOf(state);

    const res = await playCard(id, 'p1', 'td');
    expect(res.ok).toBe(true);
    const r2 = await resolvePendingNow(id, {}, undefined as any);
    expect(r2.ok).toBe(true);
    const s = games.get(id)!.state;
    // Ровно один добор: без skipGenericLoop было бы 2
    expect(s.players[0].hand).toHaveLength(1);
  });
});
