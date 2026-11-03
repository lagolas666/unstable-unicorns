import { gameState, player, unicorn } from './helpers/state';
import { destroyMagic, instantRedirect, stealMagic, instantIntercept } from './helpers/cards';
import {
  createGame,
  getState,
  setGame,
  playWithTargets,
  resolvePending,
  reactPrevent,
  reactIgnoreTarget,
  reactRedirect,
  reactInterceptSteal,
} from './helpers/api';

describe('prevent/ignore reactions and preservation across interrupt windows', () => {
  test('react/prevent marks preventEffects for current pending source (play window)', async () => {
    const A = 'P1';
    const B = 'P2';
    const smash = 'C1';

    const state = gameState({
      players: [player({ id: A, hand: [smash], action_points: 1 }), player({ id: B })],
      turn: { currentPlayerId: A, phase: 'action', has_drawn: true } as any,
      cards: { [smash]: destroyMagic(smash) },
    });
    const gameId = await createGame(state);

    const start = await playWithTargets(gameId, { cardId: smash });
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();

    const r = await reactPrevent(gameId, B);
    expect(r.status).toBe(200);
    expect(r.body.pending.preventEffects).toEqual({ [smash]: true });
  });

  test('react/ignore_target appends target for current pending source (play window)', async () => {
    const A = 'P1';
    const B = 'P2';
    const smash = 'C2';
    const t1 = 'T1';

    const state = gameState({
      players: [player({ id: A, hand: [smash], action_points: 1 }), player({ id: B, stable: [t1] })],
      turn: { currentPlayerId: A, phase: 'action', has_drawn: true } as any,
      cards: { [smash]: destroyMagic(smash), [t1]: unicorn(t1, 'Victim') },
    });
    const gameId = await createGame(state);

    const start = await playWithTargets(gameId, { cardId: smash, targets: [t1] });
    expect(start.status).toBe(200);

    const r = await reactIgnoreTarget(gameId, B, t1);
    expect(r.status).toBe(200);
    expect(r.body.pending.ignoreTargets).toEqual({ [smash]: [t1] });
  });

  test('prevent/ignore preserved in trigger_effect window after redirect', async () => {
    const A = 'P1';
    const B = 'P2';
    const smash = 'C3';
    const red = 'R1';
    const t1 = 'T1';
    const t2 = 'T2';

    const state = gameState({
      players: [
        player({ id: A, hand: [smash], action_points: 1 }),
        player({ id: B, hand: [red], stable: [t1, t2] }),
      ],
      turn: { currentPlayerId: A, phase: 'action', has_drawn: true } as any,
      cards: { [smash]: destroyMagic(smash), [red]: instantRedirect(red), [t1]: unicorn(t1), [t2]: unicorn(t2) },
    });
    const gameId = await createGame(state);

    // Manually open a trigger_effect pending with prevent/ignore filled
    await setGame(gameId, {
      pending: {
        kind: 'trigger_effect',
        trigger: 'when_enters',
        actorId: A,
        sourceCardId: smash,
        effectIdx: 0,
        expiresAt: Date.now() + 5000,
        allow_intercept: true,
        preventEffects: { [smash]: true },
        ignoreTargets: { [smash]: [t1] },
      },
    });

    const r = await reactRedirect(gameId, B, red, t2);
    expect(r.status).toBe(200);
    const { pending } = r.body;
    expect(pending.kind).toBe('trigger_effect');
    expect(pending.redirects?.toTargetId).toBe(t2);
    expect(pending.preventEffects).toEqual({ [smash]: true });
    expect(pending.ignoreTargets).toEqual({ [smash]: [t1] });
  });

  test('prevent/ignore preserved in trigger_effect window after intercept (steal)', async () => {
    const A = 'P1';
    const B = 'P2';
    const steal = 'S1';
    const inter = 'I1';
    const t1 = 'T1';

    const state = gameState({
      players: [player({ id: A, hand: [steal] }), player({ id: B, hand: [inter], stable: [t1] })],
      turn: { currentPlayerId: A, phase: 'action', has_drawn: true } as any,
      cards: { [steal]: stealMagic(steal), [inter]: instantIntercept(inter), [t1]: unicorn(t1) },
    });
    const gameId = await createGame(state);

    await setGame(gameId, {
      pending: {
        kind: 'trigger_effect',
        trigger: 'when_enters',
        actorId: A,
        sourceCardId: steal,
        effectIdx: 0,
        expiresAt: Date.now() + 5000,
        allow_intercept: true,
        preventEffects: { [steal]: true },
        ignoreTargets: { [steal]: [t1] },
      },
    });

    const r = await reactInterceptSteal(gameId, B, inter, B);
    expect(r.status).toBe(200);
    const { pending } = r.body;
    expect(pending.kind).toBe('trigger_effect');
    expect(pending.intercept?.receiverPlayerId).toBe(B);
    expect(pending.preventEffects).toEqual({ [steal]: true });
    expect(pending.ignoreTargets).toEqual({ [steal]: [t1] });
  });

  test('resolvePending respects preventEffects: effect from source is skipped', async () => {
    const A = 'P1';
    const B = 'P2';
    const smash = 'C4';
    const t1 = 'T1';

    const state = gameState({
      players: [player({ id: A, hand: [smash] }), player({ id: B, stable: [t1] })],
      turn: { currentPlayerId: A, phase: 'action', has_drawn: true } as any,
      cards: { [smash]: destroyMagic(smash), [t1]: unicorn(t1) },
    });
    const gameId = await createGame(state);

    await setGame(gameId, {
      pending: {
        kind: 'trigger_effect',
        trigger: 'when_enters',
        actorId: A,
        sourceCardId: smash,
        effectIdx: 0,
        prefill: { targets: [t1] },
        expiresAt: Date.now() + 5000,
        allow_intercept: true,
        preventEffects: { [smash]: true },
      },
    });

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const s = await getState(gameId);
    // Target should remain since effect was prevented
    const bp2 = s.players.find((p: any) => p.id === B);
    expect(bp2.stable).toContain(t1);
  });
});

