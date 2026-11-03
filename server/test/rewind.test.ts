// Rewind (perемотка) by customer rule (Daniil, 29.10.2026):
// - Rewind may send ANY playable instant card to the top of the draw deck;
// - all effects of that card are cancelled;
// - Rewind itself can be cancelled by a cancel card (Neigh/Super Neigh) or by another Rewind.
// Variant B (customer ruling): Rewind on Rewind cancels the first Rewind (it goes to the top of
// the deck, its cancellation is undone) and the original card's effect is kept (it resolves).

import { destroyMagic, instantNeigh, instantSuperNeigh, instantRewind } from './helpers/cards';
import { unicorn, player, baseTurn, gameState } from './helpers/state';
import { createGame, getState, playWithWindow, reactNeigh, reactSuperNeigh, reactRewind, resolvePending } from './helpers/api';
import { schedulePendingResolution } from '../src/gameService';

const A = 'P1';
const B = 'P2';

describe('Rewind: return card to top of deck', () => {
  test('Rewind on a plain played card returns it to top of deck and cancels its effect', async () => {
    const destroy = 'C_destroy_rw1';
    const target = 'T_rw1';
    const rewind = 'I_rewind_rw1';
    const deckTop = 'D_top_rw1';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [rewind], stable: [target], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      deck: [deckTop],
      cards: {
        [destroy]: destroyMagic(destroy),
        [rewind]: instantRewind(rewind),
        [target]: unicorn(target),
      },
    });
    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);

    const r = await reactRewind(gameId, B, rewind);
    expect(r.status).toBe(200);

    await resolvePending(gameId);
    const s = await getState(gameId);
    // The played card goes to the top of the deck (end of array, deck.pop()), not to discard.
    expect(s.deck[s.deck.length - 1]).toBe(destroy);
    expect(s.players.find((p: any) => p.id === A).discard).not.toContain(destroy);
    // Effect cancelled: the target is still in place.
    expect(s.players.find((p: any) => p.id === B).stable).toContain(target);
  });

  test('Rewind on Neigh: Neigh goes to top of deck, cancelLevel -1, original card resolves', async () => {
    const destroy = 'C_destroy_rw2';
    const target = 'T_rw2';
    const neigh = 'I_neigh_rw2';
    const rewind = 'I_rewind_rw2';
    const deckTop = 'D_top_rw2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy, rewind], action_points: 1 }),
        player({ id: B, hand: [neigh], stable: [target], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      deck: [deckTop],
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [rewind]: instantRewind(rewind),
        [target]: unicorn(target),
      },
    });
    const gameId = await createGame(state);

    await playWithWindow(gameId, destroy);
    const n = await reactNeigh(gameId, B, neigh);
    expect(n.status).toBe(200);
    expect(n.body.pending.cancelLevel).toBe(1);

    const r = await reactRewind(gameId, A, rewind);
    expect(r.status).toBe(200);
    expect(r.body.pending.cancelLevel).toBe(0);

    await resolvePending(gameId);
    const s = await getState(gameId);
    expect(s.deck).toEqual([deckTop, neigh]);
    // Original card resolved: the target was destroyed.
    expect(s.players.find((p: any) => p.id === B).stable).not.toContain(target);
  });

  test('Rewind on Super Neigh: Super Neigh goes to top of deck, cancelLevel -2', async () => {
    const destroy = 'C_destroy_rw3';
    const target = 'T_rw3';
    const superNeigh = 'I_superneigh_rw3';
    const rewind = 'I_rewind_rw3';
    const deckTop = 'D_top_rw3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy, rewind], action_points: 1 }),
        player({ id: B, hand: [superNeigh], stable: [target], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      deck: [deckTop],
      cards: {
        [destroy]: destroyMagic(destroy),
        [superNeigh]: instantSuperNeigh(superNeigh),
        [rewind]: instantRewind(rewind),
        [target]: unicorn(target),
      },
    });
    const gameId = await createGame(state);

    await playWithWindow(gameId, destroy);
    const sn = await reactSuperNeigh(gameId, B, superNeigh);
    expect(sn.status).toBe(200);
    expect(sn.body.pending.cancelLevel).toBe(2);

    const r = await reactRewind(gameId, A, rewind);
    expect(r.status).toBe(200);
    expect(r.body.pending.cancelLevel).toBe(0);

    await resolvePending(gameId);
    const s = await getState(gameId);
    expect(s.deck).toEqual([deckTop, superNeigh]);
    expect(s.players.find((p: any) => p.id === B).stable).not.toContain(target);
  });

  test('Rewind on Rewind (variant B): first Rewind goes to top of deck, original card effect resolves', async () => {
    const destroy = 'C_destroy_rw4';
    const target = 'T_rw4';
    const rewind1 = 'I_rewind1_rw4';
    const rewind2 = 'I_rewind2_rw4';
    const deckTop = 'D_top_rw4';
    const C = 'P3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [rewind1], stable: [target], action_points: 0 }),
        player({ id: C, hand: [rewind2], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      deck: [deckTop],
      cards: {
        [destroy]: destroyMagic(destroy),
        [rewind1]: instantRewind(rewind1),
        [rewind2]: instantRewind(rewind2),
        [target]: unicorn(target),
      },
    });
    const gameId = await createGame(state);

    await playWithWindow(gameId, destroy);
    // B cancels the destroy with Rewind 1 (cancelLevel 1).
    const r1 = await reactRewind(gameId, B, rewind1);
    expect(r1.status).toBe(200);
    expect(r1.body.pending.cancelLevel).toBe(1);

    // C cancels Rewind 1 with Rewind 2: Rewind 1 goes to top of deck, its cancellation is undone.
    const r2 = await reactRewind(gameId, C, rewind2);
    expect(r2.status).toBe(200);
    expect(r2.body.pending.cancelLevel).toBe(0);

    await resolvePending(gameId);
    const s = await getState(gameId);
    // Rewind 1 is on top of the deck.
    expect(s.deck).toEqual([deckTop, rewind1]);
    // Rewind 2 is in the discard of C.
    expect(s.players.find((p: any) => p.id === C).discard).toContain(rewind2);
    // Original card (destroy) resolves: the target is destroyed.
    expect(s.players.find((p: any) => p.id === B).stable).not.toContain(target);
  });

  test('Rewind unanswered: reaction window expires, card goes to top of deck, effect cancelled', async () => {
    const destroy = 'C_destroy_rw5';
    const target = 'T_rw5';
    const rewind = 'I_rewind_rw5';
    const deckTop = 'D_top_rw5';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [rewind], stable: [target], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      deck: [deckTop],
      cards: {
        [destroy]: destroyMagic(destroy),
        [rewind]: instantRewind(rewind),
        [target]: unicorn(target),
      },
    });
    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);

    const r = await reactRewind(gameId, B, rewind);
    expect(r.status).toBe(200);

    // Nobody answers the rewind: the window expires (timer path in gameService, not resolvePendingNow).
    schedulePendingResolution(gameId, 0);
    await new Promise((res) => setTimeout(res, 50));

    const s = await getState(gameId);
    // Cancelled card is on top of the deck, above the previous top card.
    expect(s.deck).toEqual([deckTop, destroy]);
    expect(s.players.find((p: any) => p.id === A).discard).not.toContain(destroy);
    expect(s.players.find((p: any) => p.id === A).hand).not.toContain(destroy);
    // Effect cancelled: the target is still in place.
    expect(s.players.find((p: any) => p.id === B).stable).toContain(target);
  });
});
