import { unicorn } from './helpers/cards';
import { player, baseTurn, gameState } from './helpers/state';
import { createGame, getState, play, playWithTargets, resolvePending } from './helpers/api';

// V7-4: контрактные тесты диспетчера реактивных триггеров on_opponent_* (dispatchTrigger).
// Источник контракта: docs/API_CONTRACT.md —
//   PendingAction.kind='trigger_effect' (+ optional, sourceCardId, effectIdx, actorId),
//   POST /resolvePending { confirm: true } от владельца окна; skip/таймаут = отказ без исполнения.

/** Простая карта без эффектов (безопасная для розыгрыша). */
function plain(id: string, type: string, extra: any = {}) {
  return { id, type, name: id, effects: [], ...extra } as any;
}

/** Действие «уничтожь 1 карту в стойле оппонента» (опасное => требует окно реакции). */
const DESTROY_ONE = {
  kind: 'destroy',
  targets: {
    scope: 'opponent',
    zone: 'stable',
    quantity: { value: 1 },
    filters: { card_group: 'any' },
  },
};

/** Безопасное действие «добери 1 карту из общей колоды в руку владельца». */
const DRAW_ONE = { kind: 'add', quantity: { value: 1 }, source: 'deck', destination: 'hand' };

/** Реактивная карта в стойле оппонента: один эффект с заданным trigger. */
function reactor(
  id: string,
  trigger: string,
  opts: { optional?: boolean; uncounterable?: boolean; whileSourceIn?: string; action?: any } = {}
) {
  return {
    id,
    type: 'upgrade',
    name: 'Opponent Reactor',
    effects: [
      {
        trigger,
        optional: opts.optional ?? true,
        ...(opts.uncounterable ? { uncounterable: true } : {}),
        ...(opts.whileSourceIn ? { while_source_in: opts.whileSourceIn } : {}),
        actions: [opts.action ?? DESTROY_ONE],
      },
    ],
  } as any;
}

/** Играет карту; если открылось окно розыгрыша (kind 'play') — резолвит его. */
async function playAndResolvePlayWindow(gameId: string, playFn: () => Promise<any>): Promise<any> {
  let res = await playFn();
  if (res.status === 200 && res.body?.pending?.kind === 'play') {
    res = await resolvePending(gameId);
  }
  return res;
}

function stableOf(state: any, playerId: string): string[] {
  return state.players.find((p: any) => p.id === playerId)!.stable;
}

/** Keep fixture games alive when an effect resolves; explicit deck fixtures stay unchanged. */
function addSafetyDeck(state: any) {
  if (!state.deck?.length) state.deck = ['DK1', 'DK2'];
  for (const cardId of ['DK1', 'DK2']) {
    if (state.deck.includes(cardId)) state.cards[cardId] ??= unicorn(cardId, `Safety Deck ${cardId}`);
  }
  return state;
}

describe('V7-4 dispatchTrigger: on_opponent_play — окно реакции', () => {
  test('у оппонента открывается optional-окно trigger_effect без автоисполнения', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const a1 = 'A_1';
    const a2 = 'A_2';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard], stable: [a1, a2] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play'),
        [a1]: unicorn(a1, 'A1'),
        [a2]: unicorn(a2, 'A2'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.status).toBe(200);

    const pending = res.body?.pending ?? null;
    expect(pending?.kind).toBe('trigger_effect');
    expect(pending?.sourceCardId).toBe(reactorCard);
    expect(pending?.actorId).toBe(B);
    expect(pending?.optional).toBe(true);

    // До подтверждения владельцем ничего не уничтожено
    const mid = await getState(gameId);
    expect(stableOf(mid, A)).toHaveLength(3);
    expect(stableOf(mid, A)).toEqual(expect.arrayContaining([a1, a2, actorCard]));
  });

  test('skip закрывает окно без исполнения эффекта', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const a1 = 'A_1';
    const a2 = 'A_2';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard], stable: [a1, a2] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play'),
        [a1]: unicorn(a1, 'A1'),
        [a2]: unicorn(a2, 'A2'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.body?.pending?.kind).toBe('trigger_effect');

    const skipped = await resolvePending(gameId, { skip: true, byPlayerId: B });
    expect(skipped.status).toBe(200);
    expect(skipped.body?.pending ?? null).toBeNull();

    const after = await getState(gameId);
    expect(stableOf(after, A)).toHaveLength(3);
    expect(stableOf(after, A)).toEqual(expect.arrayContaining([a1, a2, actorCard]));
  });

  test('confirm:true от владельца исполняет эффект', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const a1 = 'A_1';
    const a2 = 'A_2';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard], stable: [a1, a2] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play'),
        [a1]: unicorn(a1, 'A1'),
        [a2]: unicorn(a2, 'A2'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.body?.pending?.kind).toBe('trigger_effect');

    const confirmed = await resolvePending(gameId, { confirm: true, byPlayerId: B });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body?.pending ?? null).toBeNull();

    const after = await getState(gameId);
    // Эффект Reactor: destroy 1 карты в стойле оппонента (A)
    expect(stableOf(after, A)).toHaveLength(2);
    // Свой реактор B не пострадал
    expect(stableOf(after, B)).toEqual([reactorCard]);
  });

  test('confirm от чужого byPlayerId эффект не исполняет', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const a1 = 'A_1';
    const a2 = 'A_2';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard], stable: [a1, a2] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play'),
        [a1]: unicorn(a1, 'A1'),
        [a2]: unicorn(a2, 'A2'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.body?.pending?.kind).toBe('trigger_effect');

    // Окно принадлежит B; подтверждение от A не должно исполнять эффект
    const missingOwner = await resolvePending(gameId, { confirm: true });
    expect(missingOwner.status).toBe(400);

    const wrong = await resolvePending(gameId, { confirm: true, byPlayerId: A });
    expect(wrong.status).toBe(400);

    // Окно осталось доступным после обоих отказов: владелец может подтвердить его.
    const accepted = await resolvePending(gameId, { confirm: true, byPlayerId: B });
    expect(accepted.status).toBe(200);
    expect(accepted.body?.pending ?? null).toBeNull();

    const after = await getState(gameId);
    expect(stableOf(after, A)).toHaveLength(2);
  });

  test('неопасный optional:false эффект исполняется немедленно, без окна', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const deckTop = 'DK_TOP';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play', {
          optional: false,
          action: DRAW_ONE,
        }),
        [deckTop]: unicorn(deckTop, 'DeckTop'),
      },
      deck: ['DK1', 'DK2', deckTop],
      discard: [],
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.status).toBe(200);
    // Окно реакции не требуется для безопасного необязательного эффекта
    expect(res.body?.pending?.kind ?? null).not.toBe('trigger_effect');

    const after = await getState(gameId);
    // B добрал верхнюю карту общей колоды
    expect(after.players.find((p: any) => p.id === B)!.hand).toContain(deckTop);
    expect(after.deck).toEqual(['DK1', 'DK2']);
  });
});

describe('V7-4 dispatchTrigger: дискриминация событий по типу карты', () => {
  test('on_opponent_plays_unicorn: upgrade не триггерит, unicorn триггерит', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const upg = 'A_UPG';
    const reactorCard = 'B_REACT';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard, upg], action_points: 2 }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [upg]: plain(upg, 'upgrade'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_plays_unicorn'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    // 1) upgrade — не юникорн: окна быть не должно
    const res1 = await playAndResolvePlayWindow(gameId, () =>
      playWithTargets(gameId, { cardId: upg, targetPlayerId: A })
    );
    expect(res1.status).toBe(200);
    expect(res1.body?.pending?.kind ?? null).not.toBe('trigger_effect');

    // 2) Проверяем именно прямой REST-маршрут /playWithTargets для unicorn,
    // а не сервисный путь /play: карта должна вызвать on_opponent_plays_unicorn.
    const res2 = await playAndResolvePlayWindow(gameId, () =>
      playWithTargets(gameId, { cardId: actorCard })
    );
    expect(res2.status).toBe(200);
    expect(res2.body?.pending?.kind).toBe('trigger_effect');
    expect(res2.body?.pending?.sourceCardId).toBe(reactorCard);
    expect(res2.body?.pending?.actorId).toBe(B);
  });

  test('on_opponent_plays_spell: unicorn не триггерит, magic триггерит', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const magicCard = 'A_MAGIC';
    const reactorCard = 'B_REACT';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard, magicCard], action_points: 2 }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [magicCard]: plain(magicCard, 'magic'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_plays_spell'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res1 = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res1.status).toBe(200);
    expect(res1.body?.pending?.kind ?? null).not.toBe('trigger_effect');

    const res2 = await playAndResolvePlayWindow(gameId, () => play(gameId, magicCard));
    expect(res2.status).toBe(200);
    expect(res2.body?.pending?.kind).toBe('trigger_effect');
    expect(res2.body?.pending?.sourceCardId).toBe(reactorCard);
  });

  test('on_opponent_plays_upgrade_downgrade: upgrade триггерит', async () => {
    const A = 'P1';
    const B = 'P2';
    const upg = 'A_UPG';
    const reactorCard = 'B_REACT';

    const state = gameState({
      players: [
        player({ id: A, hand: [upg] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [upg]: plain(upg, 'upgrade'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_plays_upgrade_downgrade'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () =>
      playWithTargets(gameId, { cardId: upg, targetPlayerId: A })
    );
    expect(res.status).toBe(200);
    expect(res.body?.pending?.kind).toBe('trigger_effect');
    expect(res.body?.pending?.sourceCardId).toBe(reactorCard);
    expect(res.body?.pending?.actorId).toBe(B);
  });
});

describe('V7-4 dispatchTrigger: границы срабатывания', () => {
  test('актор не триггерит собственные on_opponent_* эффекты', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'A_REACT'; // реактор в стойле самого актора
    const a1 = 'A_1';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard], stable: [reactorCard, a1] }),
        player({ id: B, stable: [] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play'),
        [a1]: unicorn(a1, 'A1'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.status).toBe(200);
    expect(res.body?.pending?.kind ?? null).not.toBe('trigger_effect');

    const after = await getState(gameId);
    // Ничего не уничтожено: реактор актора не сработал на его же ход
    expect(stableOf(after, A)).toHaveLength(3);
  });

  test('while_source_in: эффект вне указанной зоны не срабатывает', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        // Карта в stable, но эффект требует, чтобы источник был в hand
        [reactorCard]: reactor(reactorCard, 'on_opponent_play', { whileSourceIn: 'hand' }),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.status).toBe(200);
    expect(res.body?.pending?.kind ?? null).not.toBe('trigger_effect');
  });

  test('while_source_in: эффект в указанной зоне срабатывает', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const a1 = 'A_1';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard], stable: [a1] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play', { whileSourceIn: 'stable' }),
        [a1]: unicorn(a1, 'A1'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.status).toBe(200);
    expect(res.body?.pending?.kind).toBe('trigger_effect');
    expect(res.body?.pending?.sourceCardId).toBe(reactorCard);
  });

  test('два оппонента с реакторами: одновременно открыто максимум одно окно', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const actorCard = 'A_UNI';
    const reactorB = 'B_REACT';
    const reactorC = 'C_REACT';
    const a1 = 'A_1';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard], stable: [a1] }),
        player({ id: B, stable: [reactorB] }),
        player({ id: C, stable: [reactorC] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorB]: reactor(reactorB, 'on_opponent_play'),
        [reactorC]: reactor(reactorC, 'on_opponent_play'),
        [a1]: unicorn(a1, 'A1'),
      },
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.status).toBe(200);

    const pending = res.body?.pending ?? null;
    expect(pending?.kind).toBe('trigger_effect');
    const firstSource = pending?.sourceCardId as string;
    expect([reactorB, reactorC]).toContain(firstSource);
    expect(pending?.actorId).toBe(firstSource === reactorB ? B : C);

    // Подтверждаем первое окно; если механизм очереди откроет второе —
    // оно обязано принадлежать другому реактору
    const firstOwner = pending.actorId as string;
    const confirmed = await resolvePending(gameId, { confirm: true, byPlayerId: firstOwner });
    expect(confirmed.status).toBe(200);
    const next = confirmed.body?.pending ?? null;
    expect(next?.kind).toBe('trigger_effect');
    expect([reactorB, reactorC]).toContain(next?.sourceCardId);
    expect(next?.sourceCardId).not.toBe(firstSource);
    expect(next?.actorId).toBe(next?.sourceCardId === reactorB ? B : C);

    const drained = await resolvePending(gameId, { confirm: true, byPlayerId: next?.actorId });
    expect(drained.status).toBe(200);
    expect(drained.body?.pending ?? null).toBeNull();
    expect(stableOf(await getState(gameId), A)).toHaveLength(0);
  });
});

// V7-4 дефект-1 (отчёт Аналитика): optional-эффект БЕЗ опасных действий не открывал
// trigger_effect-окно, из-за чего confirm:true был недостижим. Контракт требует окно
// для ЛЮБОГО optional-эффекта on_opponent_* (исполнение только по confirm владельца).
describe('V7-4 dispatchTrigger: optional эффект с безопасным действием (RED дефект-1)', () => {
  test('optional on_opponent_play с draw открывает окно, confirm:true исполняет', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const deckTop = 'DK_TOP';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        // Безопасное действие (draw), но optional => окно ОБЯЗАНО открыться
        [reactorCard]: reactor(reactorCard, 'on_opponent_play', {
          optional: true,
          action: DRAW_ONE,
        }),
        [deckTop]: unicorn(deckTop, 'DeckTop'),
      },
      deck: ['DK1', 'DK2', deckTop],
      discard: [],
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.status).toBe(200);
    // Дефект-1: окно для безопасного optional-эффекта должно открываться
    expect(res.body?.pending?.kind).toBe('trigger_effect');
    expect(res.body?.pending?.optional).toBe(true);
    expect(res.body?.pending?.sourceCardId).toBe(reactorCard);
    expect(res.body?.pending?.actorId).toBe(B);

    // Владелец подтверждает => эффект исполняется
    const confirmed = await resolvePending(gameId, { confirm: true, byPlayerId: B });
    expect(confirmed.status).toBe(200);

    const after = await getState(gameId);
    expect(after.players.find((p: any) => p.id === B)!.hand).toContain(deckTop);
    expect(after.deck).toEqual(['DK1', 'DK2']);
  });

  test('skip того же окна: эффект не исполняется, карта остаётся в колоде', async () => {
    const A = 'P1';
    const B = 'P2';
    const actorCard = 'A_UNI';
    const reactorCard = 'B_REACT';
    const deckTop = 'DK_TOP';

    const state = gameState({
      players: [
        player({ id: A, hand: [actorCard] }),
        player({ id: B, stable: [reactorCard] }),
      ],
      turn: baseTurn(A),
      cards: {
        [actorCard]: unicorn(actorCard, 'Plain Unicorn'),
        [reactorCard]: reactor(reactorCard, 'on_opponent_play', {
          optional: true,
          action: DRAW_ONE,
        }),
        [deckTop]: unicorn(deckTop, 'DeckTop'),
      },
      deck: ['DK1', 'DK2', deckTop],
      discard: [],
    });
    const gameId = await createGame(addSafetyDeck(state));

    const res = await playAndResolvePlayWindow(gameId, () => play(gameId, actorCard));
    expect(res.body?.pending?.kind).toBe('trigger_effect');

    const skipped = await resolvePending(gameId, { skip: true, byPlayerId: B });
    expect(skipped.status).toBe(200);

    const after = await getState(gameId);
    // Ничего не исполнено: добора нет, карта осталась в колоде
    expect(after.players.find((p: any) => p.id === B)!.hand).not.toContain(deckTop);
    expect(after.deck).toEqual(['DK1', 'DK2', deckTop]);
  });
});
