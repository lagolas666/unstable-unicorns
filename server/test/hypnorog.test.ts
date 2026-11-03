import { createGame, getState, turnStart, turnStartChoose } from './helpers/api';
import { geminiUnicorn, hypnorog, simpleUpgrade } from './helpers/cards';

describe('Hypnorog - cancels opponent unicorn effects by discarding a card', () => {
  test('opponent with Hypnorog and a card in hand cancels Gemini Unicorn start effect', async () => {
    const gState = {
      players: [
        { id: 'A', hand: ['a1','a2'], stable: ['gem'], discard: [], deck: [], nursery: [], field: [], action_points: 1 },
        { id: 'B', hand: ['b1'], stable: ['hyp'], discard: [], deck: [], nursery: [], field: [], action_points: 1 },
      ],
      turn: { currentPlayerId: 'A', phase: 'begin_turn', has_drawn: false },
      cards: {
        gem: geminiUnicorn('gem'),
        hyp: hypnorog('hyp'),
        a1: simpleUpgrade('a1'),
        a2: simpleUpgrade('a2'),
        b1: simpleUpgrade('b1'),
      },
      // D1b: непустая колода — иначе партия сразу окончена фоллбеком (колода И сброс пусты)
      deck: ['z1', 'z2'],
      discard: [],
    } as any;

    const gameId = await createGame(gState);

    // Trigger start -> prompt from Gemini
    let res = await turnStart(gameId);
    expect(res.status).toBe(200);
    expect(res.body.pending?.kind).toBe('prompt');

    // Choose to use Gemini effect (discard from A), but Hypnorog on B should cancel by discarding b1 automatically
    res = await turnStartChoose(gameId, { choice: 'use', targets: ['a1'] });
    expect(res.status).toBe(200);

    const state = await getState(gameId);
    const A = state.players.find((p: any) => p.id === 'A');
    const B = state.players.find((p: any) => p.id === 'B');

    // Инициация эффекта была отменена до исполнения действий: A не платит discard, AP остаются 1
    expect(A.hand).toEqual(['a1','a2']);
    expect(A.discard).toEqual([]);
    expect(A.action_points).toBe(1);

    // B discarded b1 to cancel
    expect(B.hand).toEqual([]);
    expect(B.discard).toEqual(['b1']);
  });

  test('if opponent has Hypnorog but no cards in hand, cannot cancel -> effect proceeds', async () => {
    const gState = {
      players: [
        { id: 'A', hand: ['a1','a2'], stable: ['gem'], discard: [], deck: [], nursery: [], field: [], action_points: 1 },
        { id: 'B', hand: [], stable: ['hyp'], discard: [], deck: [], nursery: [], field: [], action_points: 1 },
      ],
      turn: { currentPlayerId: 'A', phase: 'begin_turn', has_drawn: false },
      cards: { gem: geminiUnicorn('gem'), hyp: hypnorog('hyp'), a1: simpleUpgrade('a1'), a2: simpleUpgrade('a2') },
      // D1b: непустая колода — иначе партия сразу окончена фоллбеком (колода И сброс пусты)
      deck: ['z1', 'z2'],
      discard: [],
    } as any;

    const gameId = await createGame(gState);
    let res = await turnStart(gameId);
    expect(res.status).toBe(200);
    expect(res.body.pending?.kind).toBe('prompt');
    res = await turnStartChoose(gameId, { choice: 'use', targets: ['a1'] });
    expect(res.status).toBe(200);
    const state = await getState(gameId);
    const A = state.players.find((p: any) => p.id === 'A');
    expect(A.action_points).toBe(2);
  });

  test('cannot cancel your own unicorn effects (only opponents react)', async () => {
    const gState = {
      players: [
        { id: 'A', hand: ['a1','a2'], stable: ['gem','hyp'], discard: [], deck: [], nursery: [], field: [], action_points: 1 },
        { id: 'B', hand: ['b1'], stable: [], discard: [], deck: [], nursery: [], field: [], action_points: 1 },
      ],
      turn: { currentPlayerId: 'A', phase: 'begin_turn', has_drawn: false },
      cards: { gem: geminiUnicorn('gem'), hyp: hypnorog('hyp'), a1: simpleUpgrade('a1'), a2: simpleUpgrade('a2'), b1: simpleUpgrade('b1') },
      // D1b: непустая колода — иначе партия сразу окончена фоллбеком (колода И сброс пусты)
      deck: ['z1', 'z2'],
      discard: [],
    } as any;

    const gameId = await createGame(gState);
    let res = await turnStart(gameId);
    expect(res.status).toBe(200);
    expect(res.body.pending?.kind).toBe('prompt');
    res = await turnStartChoose(gameId, { choice: 'use', targets: ['a1'] });
    expect(res.status).toBe(200);
    const state = await getState(gameId);
    const A = state.players.find((p: any) => p.id === 'A');
    expect(A.action_points).toBe(2);
  });
});
