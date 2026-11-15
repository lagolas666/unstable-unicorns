import request from 'supertest';
import app from '../src/testApp';
import { games } from '../src/gameStore';
import { schedulePendingResolution } from '../src/gameService';
import { createGame, getState, play, playWithTargets, resolvePending, reactNeigh } from './helpers/api';
import { baseTurn, gameState, player, unicorn } from './helpers/state';

const noopEffect = (trigger: string, extra: Record<string, unknown> = {}) => ({
  trigger,
  optional: true,
  // Empty effect: proves the original event resumes without consuming its deck card.
  actions: [],
  ...extra,
});

const reactor = (id: string, trigger: string, effect: Record<string, unknown> = {}) => ({
  id,
  type: 'upgrade',
  effects: [noopEffect(trigger, effect)],
} as any);

const spell = (id: string, actions: any[], extra: Record<string, unknown> = {}) => ({
  id,
  type: 'magic',
  effects: [{ trigger: 'on_play', actions }],
  ...extra,
} as any);

const pendingKind = (response: any) => response.body?.pending?.kind ?? null;
const storedPendingKind = (gameId: string) => (games.get(gameId) as any)?.pending?.kind ?? null;

async function resolvePlayWindow(gameId: string, response: any) {
  return pendingKind(response) === 'play' ? resolvePending(gameId) : response;
}

afterEach(() => {
  for (const entry of games.values()) {
    if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
  }
  games.clear();
});

function stateWith(players: any[], cards: Record<string, any>, overrides: Record<string, any> = {}) {
  return { ...gameState({ players, cards, turn: baseTurn(players[0].id) }), ...overrides } as any;
}

describe('V7-4 follow-up: event source contracts', () => {
  test('official draw opens would-draw reaction before hand/deck mutation, then continues after non-canceling answer', async () => {
    const actor = 'DRAWER';
    const owner = 'REACTOR';
    const reaction = 'DRAW_REACTOR';
    const top = 'TOP_CARD';
    const state = stateWith(
      [player({ id: actor }), player({ id: owner, stable: [reaction] })],
      { [reaction]: reactor(reaction, 'on_opponent_would_draw'), [top]: unicorn(top) },
      { deck: [top] },
    );
    state.turn.phase = 'begin_turn';
    state.turn.has_drawn = false;
    const id = await createGame(state);

    const response = await request(app).post(`/api/game/${id}/draw`).send({ playerId: actor });
    expect(response.status).toBe(200);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    expect((games.get(id) as any).pending.actorId).toBe(owner);
    let after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).hand).toHaveLength(0);
    expect(after.deck).toEqual([top]);

    const answered = await resolvePending(id, { confirm: true, byPlayerId: owner });
    expect(answered.status).toBe(200);
    after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).hand).toContain(top);
    expect(after.deck).toEqual([]);
  });

  test('Neigh cannot cancel a pending would-draw trigger; confirming it continues the original draw', async () => {
    const actor = 'DRAWER';
    const owner = 'REACTOR';
    const reaction = 'DRAW_REACTOR';
    const neigh = 'NEIGH_CARD';
    const top = 'TOP_CARD';
    const state = stateWith(
      [player({ id: actor }), player({ id: owner, hand: [neigh], stable: [reaction] })],
      {
        [reaction]: reactor(reaction, 'on_opponent_would_draw'),
        [neigh]: { id: neigh, type: 'instant', instant_subtype: 'neigh' },
        [top]: unicorn(top),
      },
      { deck: [top] },
    );
    state.turn.phase = 'begin_turn';
    state.turn.has_drawn = false;
    const id = await createGame(state);
    const response = await request(app).post(`/api/game/${id}/draw`).send({ playerId: actor });
    expect(storedPendingKind(id)).toBe('trigger_effect');
    // trigger_effect is not a card-play window: Neigh cannot cancel it.
    const rejectedNeigh = await reactNeigh(id, owner, neigh);
    expect(rejectedNeigh.status).toBe(400);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    expect((await getState(id)).players.find((p: any) => p.id === owner).hand).toContain(neigh);

    const confirmed = await resolvePending(id, { confirm: true, byPlayerId: owner });
    expect(confirmed.status).toBe(200);
    const after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).hand).toContain(top);
    expect(after.deck).toEqual([]);
  });

  test('confirmed cancel effect on would-draw cancels the original draw', async () => {
    const actor = 'DRAWER';
    const owner = 'REACTOR';
    const reaction = 'DRAW_CANCEL_REACTOR';
    const top = 'TOP_CARD';
    const state = stateWith(
      [player({ id: actor }), player({ id: owner, stable: [reaction] })],
      {
        [reaction]: reactor(reaction, 'on_opponent_would_draw', {
          actions: [{ kind: 'cancel', targets: { scope: 'stack', zone: 'any' } }],
        }),
        [top]: unicorn(top),
      },
      { deck: [top] },
    );
    state.turn.phase = 'begin_turn';
    state.turn.has_drawn = false;
    const id = await createGame(state);

    const response = await request(app).post(`/api/game/${id}/draw`).send({ playerId: actor });
    expect(response.status).toBe(200);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    const beforeConfirm = await getState(id);
    expect(beforeConfirm.players.find((p: any) => p.id === actor).hand).toHaveLength(0);
    expect(beforeConfirm.deck).toEqual([top]);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const confirmed = await resolvePending(id, { confirm: true, byPlayerId: owner });
      expect(confirmed.status).toBe(200);
      const after = await getState(id);
      expect(after.players.find((p: any) => p.id === actor).hand).toHaveLength(0);
      expect(after.deck).toEqual([top]);
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('unhandled action kind: cancel'));
    } finally {
      warn.mockRestore();
    }
  });

  test('declining optional would-draw reaction resumes the deferred official draw without executing the effect', async () => {
    const actor = 'DRAWER';
    const owner = 'REACTOR';
    const reaction = 'DRAW_REACTOR';
    const top = 'TOP_CARD';
    const state = stateWith(
      [player({ id: actor }), player({ id: owner, stable: [reaction] })],
      { [reaction]: reactor(reaction, 'on_opponent_would_draw'), [top]: unicorn(top) },
      { deck: [top] },
    );
    state.turn.phase = 'begin_turn';
    state.turn.has_drawn = false;
    const id = await createGame(state);

    const opened = await request(app).post(`/api/game/${id}/draw`).send({ playerId: actor });
    expect(opened.status).toBe(200);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    const declined = await resolvePending(id, { byPlayerId: owner });

    expect(declined.status).toBe(200);
    expect(declined.body.pending ?? null).toBeNull();
    const after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).hand).toContain(top);
    expect(after.deck).toEqual([]);
    expect((games.get(id) as any).deferredDraw).toBeUndefined();
  });

  test('timed-out optional would-draw reaction closes pending and resumes the deferred official draw', async () => {
    const actor = 'DRAWER';
    const owner = 'REACTOR';
    const reaction = 'DRAW_REACTOR';
    const top = 'TOP_CARD';
    const state = stateWith(
      [player({ id: actor }), player({ id: owner, stable: [reaction] })],
      { [reaction]: reactor(reaction, 'on_opponent_would_draw'), [top]: unicorn(top) },
      { deck: [top] },
    );
    state.turn.phase = 'begin_turn';
    state.turn.has_drawn = false;
    const id = await createGame(state);

    const opened = await request(app).post(`/api/game/${id}/draw`).send({ playerId: actor });
    expect(opened.status).toBe(200);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    expect((games.get(id) as any).pending.optional).toBe(true);
    expect((await getState(id)).deck).toEqual([top]);

    // Перепланируем только тестовый таймер на 0 ms: выполняется тот же production timeout-handler.
    schedulePendingResolution(id, 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(storedPendingKind(id)).toBeNull();
    expect((games.get(id) as any).deferredDraw).toBeUndefined();
    const after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).hand).toContain(top);
    expect(after.deck).toEqual([]);
    expect((games.get(id) as any).logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'debug', details: expect.objectContaining({ event: 'optional_declined' }) }),
    ]));
  });

  test('pending confirmations and queued reactions drain before empty-pile game over is evaluated', async () => {
    const actor = 'DRAWER';
    const ownerA = 'REACTOR_A';
    const ownerB = 'REACTOR_B';
    const reactionA = 'DRAW_REACTOR_A';
    const reactionB = 'DRAW_REACTOR_B';
    const actorUniA = 'ACTOR_UNI_A';
    const actorUniB = 'ACTOR_UNI_B';
    const actorUniC = 'ACTOR_UNI_C';
    const state = stateWith(
      [
        player({ id: actor, stable: [actorUniA, actorUniB, actorUniC] }),
        player({ id: ownerA, stable: [reactionA, 'OWNER_A_UNI'] }),
        player({ id: ownerB, stable: [reactionB, 'OWNER_B_UNI'] }),
      ],
      {
        [reactionA]: reactor(reactionA, 'on_opponent_would_draw'),
        [reactionB]: reactor(reactionB, 'on_opponent_would_draw'),
        [actorUniA]: unicorn(actorUniA),
        [actorUniB]: unicorn(actorUniB),
        [actorUniC]: unicorn(actorUniC),
        OWNER_A_UNI: unicorn('OWNER_A_UNI'),
        OWNER_B_UNI: unicorn('OWNER_B_UNI'),
      },
      { deck: [], discard: [] },
    );
    state.turn.phase = 'begin_turn';
    state.turn.has_drawn = false;
    const id = await createGame(state);

    const opened = await request(app).post(`/api/game/${id}/draw`).send({ playerId: actor });
    expect(opened.status).toBe(200);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    const firstPending = (games.get(id) as any).pending;
    expect([ownerA, ownerB]).toContain(firstPending.actorId);

    const first = await resolvePending(id, { confirm: true, byPlayerId: firstPending.actorId });
    expect(first.status).toBe(200);
    expect(first.body.pending?.kind).toBe('trigger_effect');
    expect(first.body.pending.actorId).not.toBe(firstPending.actorId);

    const second = await resolvePending(id, { confirm: true, byPlayerId: first.body.pending.actorId });
    expect(second.status).toBe(200);
    expect(second.body.pending ?? null).toBeNull();
    expect((await getState(id)).winnerId).toBe(actor);
  });

  test('queued would-draw windows for multiple owners all resolve before the official card is drawn', async () => {
    const actor = 'DRAWER';
    const ownerA = 'REACTOR_A';
    const ownerB = 'REACTOR_B';
    const reactionA = 'DRAW_REACTOR_A';
    const reactionB = 'DRAW_REACTOR_B';
    const top = 'TOP_CARD';
    const state = stateWith(
      [
        player({ id: actor }),
        player({ id: ownerA, stable: [reactionA] }),
        player({ id: ownerB, stable: [reactionB] }),
      ],
      {
        [reactionA]: reactor(reactionA, 'on_opponent_would_draw'),
        [reactionB]: reactor(reactionB, 'on_opponent_would_draw'),
        [top]: unicorn(top),
      },
      { deck: [top] },
    );
    state.turn.phase = 'begin_turn';
    state.turn.has_drawn = false;
    const id = await createGame(state);

    const opened = await request(app).post(`/api/game/${id}/draw`).send({ playerId: actor });
    expect(opened.status).toBe(200);
    const firstPending = (games.get(id) as any).pending;
    expect(firstPending.kind).toBe('trigger_effect');
    expect([ownerA, ownerB]).toContain(firstPending.actorId);
    expect((await getState(id)).deck).toEqual([top]);

    const first = await resolvePending(id, { confirm: true, byPlayerId: firstPending.actorId });
    expect(first.status).toBe(200);
    expect(first.body.pending?.kind).toBe('trigger_effect');
    expect(first.body.pending.actorId).not.toBe(firstPending.actorId);
    expect((await getState(id)).deck).toEqual([top]);
    expect((await getState(id)).players.find((p: any) => p.id === actor).hand).toHaveLength(0);

    const secondOwner = first.body.pending.actorId;
    const second = await resolvePending(id, { confirm: true, byPlayerId: secondOwner });
    expect(second.status).toBe(200);
    expect(second.body.pending ?? null).toBeNull();
    const after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).hand).toContain(top);
    expect(after.deck).toEqual([]);
    expect((games.get(id) as any).deferredDraw).toBeUndefined();
  });

  test('gameplay pull from shared nursery dispatches on_opponent_pull_baby; initial deal and hand-pull do not', async () => {
    const actor = 'PULLER';
    const owner = 'WATCHER';
    const action = 'PULL_ACTION';
    const baby = 'NURSERY_BABY';
    const reaction = 'BABY_REACTOR';
    const state = stateWith(
      [player({ id: actor, hand: [action] }), player({ id: owner, stable: [reaction] })],
      {
        [action]: spell(action, [{ kind: 'pull', targets: { scope: 'self', zone: 'nursery', quantity: { value: 1 }, filters: { card_group: 'unicorn' } } }]),
        [baby]: { id: baby, type: 'basic_unicorn', source_zone: 'nursery_only', effects: [] },
        [reaction]: reactor(reaction, 'on_opponent_pull_baby'),
      },
      { nursery: [baby] },
    );
    const id = await createGame(state);
    const played = await play(id, action);
    expect(played.status).toBe(200);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    expect((games.get(id) as any).pending.actorId).toBe(owner);
    const after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).stable).toContain(baby);
    expect(after.nursery).not.toContain(baby);

    const startup = await request(app).post('/api/game').send({ players: [{ id: 'S1' }, { id: 'S2' }] });
    expect(startup.status).toBe(201);
    expect(startup.body.pending ?? null).toBeNull();
    expect((games.get(startup.body.id) as any).logs.filter((entry: any) => entry.type === 'trigger_effect')).toEqual([]);

    const handTheft = 'HAND_THEFT';
    const handState = stateWith(
      [player({ id: actor, hand: [baby, handTheft] }), player({ id: owner, stable: [reaction] })],
      {
        [baby]: { id: baby, type: 'basic_unicorn', source_zone: 'nursery_only', effects: [] },
        [handTheft]: spell(handTheft, [{ kind: 'pull', targets: { scope: 'opponent', zone: 'hand', quantity: { value: 1 }, filters: { card_group: 'any' } } }]),
        [reaction]: reactor(reaction, 'on_opponent_pull_baby'),
      },
    );
    const theftGame = await createGame(handState);
    const theft = await play(theftGame, handTheft);
    expect(theft.status).toBe(200);
    expect(pendingKind(theft)).not.toBe('trigger_effect');
  });

  test.each([
    ['effect', (id: string) => spell(id, [{ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'unicorn' } } }])],
    ['cost', (id: string) => ({ id, type: 'magic', play_requirements: { costs: [{ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'unicorn' } } }] }, effects: [] })],
  ])('successful sacrifice %s dispatches only after a card moves', async (_label, makeActionCard) => {
    const actor = 'SACRIFICER';
    const owner = 'WATCHER';
    const card = 'SACRIFICE_ACTION';
    const victim = 'VICTIM';
    const reaction = 'SAC_REACTOR';
    const state = stateWith(
      [player({ id: actor, hand: [card], stable: [victim] }), player({ id: owner, stable: [reaction] })],
      {
        [card]: makeActionCard(card),
        [victim]: unicorn(victim),
        [reaction]: reactor(reaction, 'on_opponent_sacrifices'),
      },
    );
    const id = await createGame(state);
    const opened = await play(id, card, _label === 'cost' ? { chosenCostTargets: [victim] } : { targets: [victim] });
    expect(opened.status).toBe(200);
    const played = await resolvePlayWindow(id, opened);
    expect(played.status).toBe(200);
    const after = await getState(id);
    expect(after.players.find((p: any) => p.id === actor).stable).not.toContain(victim);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    expect((games.get(id) as any).pending.actorId).toBe(owner);
  });

  test('failed/zero-card sacrifice does not dispatch on_opponent_sacrifices', async () => {
    const action = 'NOOP_SACRIFICE';
    const reaction = 'SAC_REACTOR';
    const state = stateWith(
      [player({ id: 'P1', hand: [action] }), player({ id: 'P2', stable: [reaction] })],
      {
        [action]: spell(action, [{ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'unicorn' } } }]),
        [reaction]: reactor(reaction, 'on_opponent_sacrifices'),
      },
    );
    const id = await createGame(state);
    const played = await play(id, action);
    expect([200, 400, 409]).toContain(played.status);
    expect(pendingKind(played)).not.toBe('trigger_effect');
  });

  test('successful unicorn-card effect dispatches once; canceled play and failed play do not dispatch', async () => {
    const actor = 'UNICORN_PLAYER';
    const owner = 'WATCHER';
    const unicornCard = 'EFFECT_UNICORN';
    const reactorId = 'UNICORN_REACTOR';
    const target = 'UNICORN_TARGET';
    const state = stateWith(
      [player({ id: actor, hand: [unicornCard] }), player({ id: owner, stable: [reactorId, target] })],
      {
        [unicornCard]: { ...unicorn(unicornCard), effects: [{ trigger: 'on_play', actions: [{ kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'any' } } }] }] },
        [reactorId]: { ...unicorn(reactorId), effects: [noopEffect('on_opponent_unicorn_effect')] },
        [target]: unicorn(target),
        SAFE_DECK_CARD: unicorn('SAFE_DECK_CARD'),
      },
      { deck: ['SAFE_DECK_CARD'] },
    );
    const id = await createGame(state);
    const canceledPlayState = stateWith(
      [player({ id: actor, hand: [unicornCard] }), player({ id: owner, hand: ['CANCEL'], stable: [reactorId, target] })],
      {
        [unicornCard]: { ...unicorn(unicornCard), effects: [{ trigger: 'on_play', actions: [{ kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'any' } } }] }] },
        TOP_CARD: unicorn('TOP_CARD'),
        CANCEL: { id: 'CANCEL', type: 'instant', instant_subtype: 'neigh' },
        [reactorId]: { ...unicorn(reactorId), effects: [noopEffect('on_opponent_unicorn_effect')] },
      },
      { deck: ['TOP_CARD'] },
    );
    const canceledId = await createGame(canceledPlayState);
    const canceledStart = await playWithTargets(canceledId, { cardId: unicornCard, targets: [target] });
    expect(canceledStart.status).toBe(200);
    const canceled = await reactNeigh(canceledId, owner, 'CANCEL');
    expect(canceled.status).toBe(200);
    const canceledResolution = await resolvePending(canceledId);
    expect(canceledResolution.status).toBe(200);
    expect(pendingKind(canceledResolution)).not.toBe('trigger_effect');
    const another = await play(id, 'NO_SUCH_CARD');
    expect(another.status).toBe(400);
    expect(pendingKind(another)).not.toBe('trigger_effect');

    const initial = await playWithTargets(id, { cardId: unicornCard, targets: [target] });
    const resolvedPlay = await resolvePlayWindow(id, initial);
    expect(resolvedPlay.status).toBe(200);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    expect((games.get(id) as any).pending.actorId).toBe(owner);

    const confirmed = await resolvePending(id, { confirm: true, byPlayerId: owner });
    expect(confirmed.status).toBe(200);
    expect(pendingKind(confirmed)).not.toBe('trigger_effect');
  });

  test('accepted Neigh reaction is paid and dispatches on_opponent_plays_neigh via /react/neigh', async () => {
    const actor = 'ACTOR';
    const reactorOwner = 'WATCHER';
    const spellId = 'PENDING_SPELL';
    const neighId = 'NEIGH_CARD';
    const reactionId = 'NEIGH_REACTOR';
    const victim = 'VICTIM';
    const state = stateWith(
      [player({ id: actor, hand: [spellId], stable: [] }), player({ id: 'REACTOR', hand: [neighId] }), player({ id: reactorOwner, stable: [reactionId, victim] })],
      {
        [spellId]: spell(spellId, [{ kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'any' } } }]),
        [neighId]: { id: neighId, type: 'instant', instant_subtype: 'neigh' },
        [reactionId]: reactor(reactionId, 'on_opponent_plays_neigh'),
        [victim]: unicorn(victim),
      },
    );
    const id = await createGame(state);
    const opened = await playWithTargets(id, { cardId: spellId, targets: [victim] });
    expect(opened.status).toBe(200);
    expect(opened.body.pending?.kind).toBe('play');
    const accepted = await reactNeigh(id, 'REACTOR', neighId);
    expect(accepted.status).toBe(200);
    // Реакция Neigh отмечает pending play отменённым; завершаем его, чтобы открыть
    // следующую реакцию из очереди (если dispatch после принятой Neigh произошёл).
    await resolvePending(id);
    expect(storedPendingKind(id)).toBe('trigger_effect');
    expect((games.get(id) as any).pending.actorId).toBe(reactorOwner);
    const after = await getState(id);
    expect(after.players.find((p: any) => p.id === 'REACTOR').hand).not.toContain(neighId);
    expect(after.players.find((p: any) => p.id === 'REACTOR').discard).toContain(neighId);
  });

  test('blocks_neigh_for_others is data-driven: true blocks generic opponent; missing flag allows play', async () => {
    async function attempt(blocked: boolean) {
      const owner = 'OWNER';
      const opponent = 'OPPONENT';
      const action = 'ACTION';
      const neigh = 'NEIGH';
      const blocker = 'DATA_FLAG_CARD';
      const victim = 'TARGET';
      const state = stateWith(
        [player({ id: owner, hand: [action], stable: blocked ? [blocker] : [] }), player({ id: opponent, hand: [neigh], stable: [victim] })],
        {
          [action]: spell(action, [{ kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'any' } } }]),
          [neigh]: { id: neigh, type: 'instant', instant_subtype: 'neigh' },
          [blocker]: { id: blocker, type: 'upgrade', static_properties: { blocks_neigh_for_others: true }, effects: [] },
          [victim]: unicorn(victim),
        },
      );
      const id = await createGame(state);
      await playWithTargets(id, { cardId: action });
      return reactNeigh(id, opponent, neigh);
    }

    const blocked = await attempt(true);
    expect(blocked.status).toBe(400);
    const allowed = await attempt(false);
    expect(allowed.status).toBe(200);
  });
});
