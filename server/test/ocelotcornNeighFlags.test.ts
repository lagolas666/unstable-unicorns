import { loadCatalogFixture } from '../src/data/catalog';
import { games } from '../src/gameStore';
import {
  createGame,
  getState,
  playWithWindow,
  reactNeigh,
} from './helpers/api';
import { baseTurn, gameState, player } from './helpers/state';

afterEach(() => {
  for (const entry of games.values()) {
    if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
  }
  games.clear();
});

function reactionScenario(options: {
  playedCard?: Record<string, any>;
  blocker?: Record<string, any>;
}) {
  const actor = 'ACTOR';
  const opponent = 'OPPONENT';
  const action = 'ACTION_CARD';
  const neigh = 'NEIGH_CARD';
  const blocker = options.blocker ? String(options.blocker.id || 'BLOCKER_CARD') : undefined;
  const cards: Record<string, any> = {
    [action]: options.playedCard || { id: action, type: 'upgrade', name: 'Ordinary Upgrade', effects: [] },
    [neigh]: { id: neigh, type: 'instant', name: 'Neigh', instant_subtype: 'neigh' },
  };
  if (blocker) cards[blocker] = options.blocker;

  const state = gameState({
    players: [
      player({ id: actor, hand: [action], stable: blocker ? [blocker] : [] }),
      player({ id: opponent, hand: [neigh], action_points: 0 }),
    ],
    turn: baseTurn(actor),
    cards,
  });
  return { state, actor, opponent, action, neigh };
}

describe('Ocelotcorn Neigh protection is data-driven over HTTP', () => {
  test.each([
    ['top-level cannot_be_neighed', { cannot_be_neighed: true }],
    ['static_properties.cannot_be_neighed', { static_properties: { cannot_be_neighed: true } }],
  ])('%s makes /playWithWindow uncounterable', async (_label, properties) => {
    const action = 'ACTION_CARD';
    const { state, actor, opponent, neigh } = reactionScenario({
      playedCard: {
        id: action,
        type: 'upgrade',
        name: 'A card with no special name',
        effects: [],
        ...properties,
      },
    });
    state.players[1].hand = [neigh];
    const gameId = await createGame(state);

    const opened = await playWithWindow(gameId, action);
    expect(opened.status).toBe(200);
    expect(opened.body.pending?.actorId).toBe(actor);
    expect(opened.body.pending?.uncounterable).toBe(true);

    const rejected = await reactNeigh(gameId, opponent, neigh);
    expect(rejected.status).toBe(400);
    expect((await getState(gameId)).players.find((p: any) => p.id === opponent).hand).toContain(neigh);
  });

  test.each([
    ['top-level blocks_neigh_for_others', { blocks_neigh_for_others: true }],
    ['static_properties.blocks_neigh_for_others', { static_properties: { blocks_neigh_for_others: true } }],
  ])('%s blocks opponent Neigh through /react/neigh', async (_label, properties) => {
    const { state, actor, opponent, action, neigh } = reactionScenario({
      blocker: {
        id: 'generic_flagged_blocker',
        type: 'upgrade',
        name: 'Generic blocker, unrelated to Ocelotcorn',
        effects: [],
        ...properties,
      },
    });
    const gameId = await createGame(state);

    const opened = await playWithWindow(gameId, action);
    expect(opened.status).toBe(200);
    expect(opened.body.pending?.actorId).toBe(actor);

    const rejected = await reactNeigh(gameId, opponent, neigh);
    expect(rejected.status).toBe(400);
    expect((await getState(gameId)).players.find((p: any) => p.id === opponent).hand).toContain(neigh);
  });

  test('actual catalog Ocelotcorn static_properties flags prevent Neigh without relying on its name', async () => {
    const catalogCard = loadCatalogFixture().find((card: any) => card.id === 'elusive_ocelotcorn_ultimate') as any;
    expect(catalogCard?.static_properties?.cannot_be_neighed).toBe(true);
    expect(catalogCard?.static_properties?.blocks_neigh_for_others).toBe(true);

    const { state, opponent, action, neigh } = reactionScenario({
      blocker: { ...catalogCard, id: 'elusive_ocelotcorn_ultimate' },
    });
    const gameId = await createGame(state);

    const opened = await playWithWindow(gameId, action);
    expect(opened.status).toBe(200);
    const rejected = await reactNeigh(gameId, opponent, neigh);
    expect(rejected.status).toBe(400);
  });

  test('a card named Oceloticorn without either flag does not protect itself or block others', async () => {
    const action = 'ACTION_CARD';
    const { state, opponent, neigh } = reactionScenario({
      playedCard: {
        id: action,
        type: 'upgrade',
        name: 'Elusive oceloticorn imitation',
        effects: [],
      },
      blocker: {
        id: 'ocelotcorn_named_but_unflagged',
        type: 'upgrade',
        name: 'Oceloticorn named card, no protection flags',
        effects: [],
      },
    });
    // The card under test is the played card; the other player's card also carries
    // the legacy name pattern but intentionally has no blocking flag.
    const gameId = await createGame(state);

    const opened = await playWithWindow(gameId, action);
    expect(opened.status).toBe(200);
    expect(opened.body.pending?.uncounterable).not.toBe(true);

    const accepted = await reactNeigh(gameId, opponent, neigh);
    expect(accepted.status).toBe(200);
    expect((await getState(gameId)).players.find((p: any) => p.id === opponent).hand).not.toContain(neigh);
  });
});
