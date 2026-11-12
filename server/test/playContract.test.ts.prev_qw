// Контракт сервиса игровых действий (задача 6b-3a): playCard и endTurn.
// Проверяем коды ошибок, HTTP-статусы, отсутствие мутаций при отказе и порядок
// побочных эффектов. REST-роуты /play и /endTurn — тонкая обёртка над сервисом,
// поэтому чужие ходы проверяются на уровне сервиса: роут /play подставляет
// state.turn.currentPlayerId и чужой playerId в теле запроса игнорирует.

import { games } from '../src/gameStore';
import { playCard, endTurn, checkWin } from '../src/gameService';
import { countUnicornsForWin } from '../src/engine/leader';
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
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
    ...over,
  } as any;
}

function entryOf(state: any) {
  const id = 'g-' + Math.random().toString(36).slice(2);
  games.set(id, { state, bus: new EventBus(), logs: [], pending: null as any } as any);
  return id;
}

// Снимок изменяемых частей состояния: при отказе он должен совпасть байт-в-байт.
function snapshot(entry: any) {
  const s = entry.state;
  return JSON.stringify({
    players: s.players.map((p: any) => ({
      id: p.id,
      hand: p.hand,
      stable: p.stable,
      discard: p.discard,
      deck: p.deck,
      action_points: p.action_points,
    })),
    deck: s.deck,
    discard: s.discard,
    phase: s.turn.phase,
    currentPlayerId: s.turn.currentPlayerId,
    has_drawn: s.turn.has_drawn,
    logs: entry.logs.length,
    pending: entry.pending,
  });
}

const smashCard = (id: string) => ({
  id,
  type: 'magic',
  name: 'Smash',
  effects: [
    {
      trigger: 'on_play',
      actions: [
        {
          kind: 'destroy',
          targets: { scope: 'opponent', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'any' } },
        },
      ],
    },
  ],
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Service contract: playCard', () => {
  it('P1: неизвестная игра -> GAME_NOT_FOUND / 404', async () => {
    const res = await playCard('no-such-game', 'p1', 'c1');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('GAME_NOT_FOUND');
    expect(res.http).toBe(404);
    expect(res.message).toBe('Game not found');
  });

  it('P2: чужой playerId -> NOT_YOUR_TURN / 400 и состояние не изменилось', async () => {
    const state = mkState();
    state.cards.c1 = { id: 'c1', type: 'basic_unicorn', name: 'U', effects: [] };
    state.players[0].hand = ['c1'];
    const id = entryOf(state);
    const entry = games.get(id)!;
    const before = snapshot(entry);

    const res = await playCard(id, 'p2', 'c1');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('NOT_YOUR_TURN');
    expect(res.http).toBe(400);
    expect(snapshot(entry)).toBe(before);
    expect(entry.logs).toHaveLength(0);
  });

  it('P3: не фаза action -> WRONG_PHASE / 400 без мутаций', async () => {
    const state = mkState({ turn: { currentPlayerId: 'p1', phase: 'begin_turn', has_drawn: false } });
    state.cards.c1 = { id: 'c1', type: 'basic_unicorn', name: 'U', effects: [] };
    state.players[0].hand = ['c1'];
    const id = entryOf(state);
    const entry = games.get(id)!;
    const before = snapshot(entry);

    const res = await playCard(id, 'p1', 'c1');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('WRONG_PHASE');
    expect(res.http).toBe(400);
    expect(snapshot(entry)).toBe(before);
  });

  it('P4: карты нет в руке -> CARD_NOT_IN_HAND / 400 без мутаций', async () => {
    const state = mkState();
    state.cards.c1 = { id: 'c1', type: 'basic_unicorn', name: 'U', effects: [] };
    const id = entryOf(state);
    const entry = games.get(id)!;
    const before = snapshot(entry);

    const res = await playCard(id, 'p1', 'c1');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('CARD_NOT_IN_HAND');
    expect(res.http).toBe(400);
    expect(snapshot(entry)).toBe(before);
  });

  it('P5: нет очков действия -> NO_ACTION_POINTS / 400 без мутаций', async () => {
    const state = mkState();
    state.cards.c1 = { id: 'c1', type: 'basic_unicorn', name: 'U', effects: [] };
    state.players[0].hand = ['c1'];
    state.players[0].action_points = 0;
    const id = entryOf(state);
    const entry = games.get(id)!;
    const before = snapshot(entry);

    const res = await playCard(id, 'p1', 'c1');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('NO_ACTION_POINTS');
    expect(res.http).toBe(400);
    expect(snapshot(entry)).toBe(before);
  });

  it('P6: единорог разыгран -> рука-1, стойло+1, очко потрачено, запись в журнале', async () => {
    const state = mkState();
    state.cards.c1 = { id: 'c1', type: 'basic_unicorn', name: 'Basic Unicorn', effects: [] };
    state.players[0].hand = ['c1'];
    const id = entryOf(state);
    const entry = games.get(id)!;

    const res = await playCard(id, 'p1', 'c1');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(JSON.stringify(res));
    expect(entry.state.players[0].hand).toEqual([]);
    expect(entry.state.players[0].stable).toEqual(['c1']);
    expect(entry.state.players[0].action_points).toBe(0);
    expect(entry.logs).toHaveLength(1);
    expect(entry.logs[0].type).toBe('play');
    expect(entry.logs[0].playerId).toBe('p1');
    expect(entry.pending).toBeNull();
    expect(res.openedWindow).toBe(false);
  });

  it('P7: magic-карта уходит в общий сброс, а не аннигилируется', async () => {
    const state = mkState();
    state.cards.c1 = { id: 'c1', type: 'magic', name: 'Simple Magic', effects: [] };
    state.players[0].hand = ['c1'];
    const id = entryOf(state);
    const entry = games.get(id)!;

    const res = await playCard(id, 'p1', 'c1');
    expect(res.ok).toBe(true);
    expect(entry.state.players[0].stable).toEqual([]);
    expect(entry.state.discard).toEqual(['c1']);
  });

  it('P8: destroy без цели -> 409 с флагом needTargets, карта остаётся в руке', async () => {
    const state = mkState();
    state.cards.c1 = smashCard('c1');
    state.cards.enemy1 = { id: 'enemy1', type: 'basic_unicorn', name: 'Enemy', effects: [] };
    state.players[1].stable = ['enemy1'];
    state.players[0].hand = ['c1'];
    const id = entryOf(state);
    const entry = games.get(id)!;

    const res = await playCard(id, 'p1', 'c1');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('BAD_REQUEST');
    expect(res.http).toBe(409);
    expect(res.extra?.needTargets).toBe(true);
    expect(res.extra?.options?.targets).toContain('enemy1');
    expect(entry.state.players[0].hand).toEqual(['c1']);
    expect(entry.state.players[0].action_points).toBe(1);
    expect(entry.pending).toBeNull();
  });

  // ДЕФЕКТ DEF-06 (High, зона Бэкенда: src/gameService.ts:567-591).
  // Ветка needsTargetEffect делает безусловный return 409 и никогда не читает opts.targets,
  // поэтому карта с destroy/steal/sacrifice НЕ разыгрывается через playCard ни с целью, ни без.
  // Тест-эталон написан заранее и включается после фикса (снять .skip).
  it('P9 [DEF-06]: destroy с явной целью должен открывать окно реакций', async () => {
    jest.useFakeTimers();
    const state = mkState();
    state.cards.c1 = smashCard('c1');
    state.cards.enemy1 = { id: 'enemy1', type: 'basic_unicorn', name: 'Enemy', effects: [] };
    state.players[1].stable = ['enemy1'];
    state.players[0].hand = ['c1'];
    const id = entryOf(state);
    const entry = games.get(id)!;

    const res = await playCard(id, 'p1', 'c1', { targets: ['enemy1'] });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(JSON.stringify(res));
    expect(res.openedWindow).toBe(true);
    expect((entry.pending as any).kind).toBe('play');
    expect(entry.state.players[0].hand).toEqual(['c1']);
    expect(entry.state.players[0].action_points).toBe(1);
    expect(entry.state.players[1].stable).toEqual(['enemy1']);
    jest.clearAllTimers();
  });

});

describe('Service contract: endTurn', () => {
  it('E1: неизвестная игра -> GAME_NOT_FOUND / 404', async () => {
    const res = await endTurn('no-such-game');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('GAME_NOT_FOUND');
    expect(res.http).toBe(404);
  });

  it('E2: ход переходит следующему, фаза begin_turn, очко выдано, флаг добора снят', async () => {
    const state = mkState();
    state.turn = { currentPlayerId: 'p1', phase: 'action', has_drawn: true };
    state.players[1].action_points = 0;
    const id = entryOf(state);
    const entry = games.get(id)!;

    const res = await endTurn(id);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(JSON.stringify(res));
    expect(entry.state.turn.currentPlayerId).toBe('p2');
    expect(entry.state.turn.phase).toBe('begin_turn');
    expect(entry.state.turn.has_drawn).toBe(false);
    expect(entry.state.players[1].action_points).toBe(1);
    expect(entry.logs).toHaveLength(1);
    expect(entry.logs[0].type).toBe('end');
    expect(entry.logs[0].playerId).toBe('p1');
  });

  it('E3: рука сверх лимита (8/7) -> 400 с прежним текстом, ход не передан', async () => {
    const state = mkState();
    state.players[0].hand = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const id = entryOf(state);
    const entry = games.get(id)!;

    const res = await endTurn(id);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('ожидался отказ');
    expect(res.code).toBe('BAD_REQUEST');
    expect(res.http).toBe(400);
    expect(res.message).toBe('Hand limit exceeded: 8/7');
    expect(entry.state.turn.currentPlayerId).toBe('p1');
    expect(entry.logs).toHaveLength(0);
  });

  it('E4: ровно 7 карт в руке — ход завершается (граница лимита)', async () => {
    const state = mkState();
    state.players[0].hand = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const id = entryOf(state);
    const entry = games.get(id)!;

    const res = await endTurn(id);
    expect(res.ok).toBe(true);
    expect(entry.state.turn.currentPlayerId).toBe('p2');
  });

  it('E5: 2 игрока, 7 единорогов и непустая колода — победа по порогу, winnerId выставляется', async () => {
    const state = mkState();
    for (let i = 1; i <= 7; i++) {
      state.cards['u' + i] = { id: 'u' + i, type: 'basic_unicorn', name: 'U' + i, effects: [] };
      state.players[0].stable.push('u' + i);
    }
    // Непустая колода отключает обходной путь checkWin через leaderByUnicorns:
    // победа обязана прийти из порога getWinningScore(2) === 7, а не из «колода пуста».
    state.cards.filler = { id: 'filler', type: 'magic', name: 'Filler', effects: [] };
    state.deck = ['filler'];
    const id = entryOf(state);
    const entry = games.get(id)!;

    expect(countUnicornsForWin(entry.state, entry.state.players[0])).toBe(7);
    expect(checkWin(entry.state)).toBe('p1');
    const res = await endTurn(id);
    expect(res.ok).toBe(true);
    expect((entry.state as any).winnerId).toBe('p1');
  });

  it('E6: 6 игроков — порог победы 6 единорогов, а не 7', async () => {
    const sixPlayers = () =>
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((pid) => ({
        id: pid,
        deck: [],
        hand: [],
        discard: [],
        stable: [],
        nursery: [],
        field: [],
        action_points: 1,
      }));

    // Колода непустая во всех случаях: иначе checkWin уходит в leaderByUnicorns
    // и порог не проверяется вообще (это и маскировало дефект раньше).
    const stateWith = (n: number) => {
      const state = mkState({ players: sixPlayers() });
      for (let i = 1; i <= n; i++) {
        state.cards['u' + i] = { id: 'u' + i, type: 'basic_unicorn', name: 'U' + i, effects: [] };
        state.players[0].stable.push('u' + i);
      }
      state.cards.filler = { id: 'filler', type: 'magic', name: 'Filler', effects: [] };
      state.deck = ['filler'];
      return state;
    };

    // 6 игроков: getWinningScore(6) === 6. Прежняя константа 7 дала бы здесь null.
    const six = stateWith(6);
    expect(countUnicornsForWin(six, six.players[0])).toBe(6);
    expect(checkWin(six)).toBe('p1');

    const id = entryOf(six);
    const entry = games.get(id)!;
    const res = await endTurn(id);
    expect(res.ok).toBe(true);
    expect((entry.state as any).winnerId).toBe('p1');

    // Обратный случай: на 6 игроках пяти единорогов для победы мало.
    const five = stateWith(5);
    expect(countUnicornsForWin(five, five.players[0])).toBe(5);
    expect(checkWin(five)).toBeNull();
  });
});
