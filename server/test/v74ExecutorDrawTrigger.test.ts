import { games } from '../src/gameStore';
import { createGame, getState, play, resolvePending } from './helpers/api';
import { baseTurn, gameState, player, unicorn } from './helpers/state';

const drawReaction = (id: string, trigger = 'on_opponent_would_draw', actions: any[] = []) => ({
  id,
  type: 'upgrade',
  effects: [{ trigger, optional: true, actions }],
} as any);

const pending = (gameId: string) => (games.get(gameId) as any)?.pending;

afterEach(() => {
  for (const entry of games.values()) {
    if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
  }
  games.clear();
});

describe('V7-4: serializable nested effect continuation', () => {
  test('JSON round-trip preserves the pending draw continuation and executes each next action once', async () => {
    const actor = 'ROUND_TRIP_ACTOR';
    const watcher = 'ROUND_TRIP_WATCHER';
    const action = 'ROUND_TRIP_SPELL';
    const first = 'ROUND_TRIP_FIRST';
    const second = 'ROUND_TRIP_SECOND';
    const state = gameState({
      players: [
        player({ id: actor, hand: [action] }),
        player({ id: 'ROUND_TRIP_OWNER', stable: [watcher] }),
      ],
      cards: {
        [action]: {
          id: action,
          type: 'magic',
          effects: [{ trigger: 'on_play', actions: [
            { kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 1 } } },
            { kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 1 } } },
          ] }],
        },
        [watcher]: drawReaction(watcher),
        [first]: unicorn(first),
        [second]: unicorn(second),
      },
      turn: baseTurn(actor),
      // The top of the deck is the end of the array (executor uses pop()).
      deck: [second, first],
    });
    const id = await createGame(state);

    let started = await play(id, action);
    expect(started.status).toBe(200);
    if (started.body?.pending?.kind === 'play') {
      started = await resolvePending(id, { byPlayerId: actor });
    }
    expect(started.status).toBe(200);
    expect(pending(id)?.kind).toBe('trigger_effect');

    const inMemory = games.get(id) as any;
    const restored = JSON.parse(JSON.stringify(inMemory));
    // Event bus/timer are process resources; only JSON game data is round-tripped.
    restored.bus = inMemory.bus;
    restored.pendingTimeout = undefined;
    games.set(id, restored);

    let current = await getState(id);
    expect(current.deck).toEqual([second, first]);
    expect(current.players.flatMap((p: any) => p.hand)).not.toContain(first);

    const firstResume = await resolvePending(id, { confirm: true, byPlayerId: 'ROUND_TRIP_OWNER' });
    expect(firstResume.status).toBe(200);
    expect(firstResume.body.pending?.kind).toBe('trigger_effect');
    current = await getState(id);
    expect(current.players.find((p: any) => p.id === actor).hand.filter((id: string) => id === first)).toHaveLength(1);
    expect(current.players.flatMap((p: any) => p.hand)).not.toContain(second);
    expect(current.deck).toEqual([second]);

    const secondResume = await resolvePending(id, { confirm: true, byPlayerId: 'ROUND_TRIP_OWNER' });
    expect(secondResume.status).toBe(200);
    expect(secondResume.body.pending ?? null).toBeNull();
    current = await getState(id);
    const actorHand = current.players.find((p: any) => p.id === actor).hand;
    expect(actorHand.filter((id: string) => id === first)).toHaveLength(1);
    expect(actorHand.filter((id: string) => id === second)).toHaveLength(1);
    expect(current.deck).toEqual([]);
  });

  test('nested sacrifice trigger draws once, then the suspended outer effect continues once', async () => {
    const actor = 'NESTED_ACTOR';
    const owner = 'NESTED_OWNER';
    const action = 'NESTED_SPELL';
    const sacrifice = 'NESTED_SACRIFICE';
    const sacrificeWatcher = 'NESTED_SACRIFICE_WATCHER';
    const drawWatcher = 'NESTED_DRAW_WATCHER';
    const nestedCard = 'NESTED_TRIGGER_DRAW';
    const outerCard = 'NESTED_OUTER_DRAW';
    const guardCard = 'NESTED_GUARD';
    const state = gameState({
      players: [
        player({ id: actor, hand: [action], stable: [sacrifice, drawWatcher] }),
        player({ id: owner, stable: [sacrificeWatcher, 'NESTED_OUTER_DRAW_WATCHER'] }),
      ],
      cards: {
        [action]: {
          id: action,
          type: 'magic',
          effects: [{ trigger: 'on_play', actions: [
            { kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', quantity: { value: 1 }, filters: { card_group: 'unicorn' } } },
            { kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 1 } } },
          ] }],
        },
        [sacrifice]: unicorn(sacrifice),
        [sacrificeWatcher]: drawReaction(sacrificeWatcher, 'on_opponent_sacrifices', [
          { kind: 'draw', targets: { scope: 'self', zone: 'deck', quantity: { value: 1 } } },
        ]),
        [drawWatcher]: drawReaction(drawWatcher),
        NESTED_OUTER_DRAW_WATCHER: drawReaction('NESTED_OUTER_DRAW_WATCHER'),
        [nestedCard]: unicorn(nestedCard),
        [outerCard]: unicorn(outerCard),
        [guardCard]: unicorn(guardCard),
      },
      turn: baseTurn(actor),
      // LIFO: nestedCard is drawn first, then outerCard; guardCard stays on top.
      deck: [guardCard, outerCard, nestedCard],
    });
    const id = await createGame(state);

    let started = await play(id, action, { targets: [sacrifice] });
    expect(started.status).toBe(200);
    if (started.body?.pending?.kind === 'play') {
      started = await resolvePending(id, { byPlayerId: actor });
    }
    expect(started.status).toBe(200);
    expect(pending(id)?.kind).toBe('trigger_effect');
    expect(pending(id)?.actorId).toBe(owner);
    let current = await getState(id);
    expect(current.players.find((p: any) => p.id === actor).stable).not.toContain(sacrifice);
    expect(current.deck).toEqual([guardCard, outerCard, nestedCard]);

    // Accept the on_opponent_sacrifices trigger; its own draw must suspend before moving a card.
    let answer = await resolvePending(id, { confirm: true, byPlayerId: owner });
    expect(answer.status).toBe(200);
    expect(pending(id)?.kind).toBe('trigger_effect');
    current = await getState(id);
    expect(current.deck).toEqual([guardCard, outerCard, nestedCard]);
    expect(current.players.flatMap((p: any) => p.hand)).not.toContain(nestedCard);

    // Drain nested draw reaction windows and then the outer draw's window(s).
    let windows = 1;
    while (pending(id)?.kind === 'trigger_effect') {
      const actorId = pending(id).actorId;
      answer = await resolvePending(id, { confirm: true, byPlayerId: actorId });
      expect(answer.status).toBe(200);
      windows += 1;
      expect(windows).toBeLessThanOrEqual(5);
      current = await getState(id);
    }

    const actorHand = current.players.find((p: any) => p.id === actor).hand;
    const ownerHand = current.players.find((p: any) => p.id === owner).hand;
    expect(actorHand.filter((id: string) => id === outerCard)).toHaveLength(1);
    expect(ownerHand.filter((id: string) => id === nestedCard)).toHaveLength(1);
    expect(actorHand).not.toContain(nestedCard);
    expect(current.deck).toEqual([guardCard]);
    expect((games.get(id) as any).pendingQueue ?? []).toHaveLength(0);
    expect(windows).toBeGreaterThan(1);
  });
});
