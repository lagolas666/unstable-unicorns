import {
  destroyMagic,
  destroyMagicQty,
  destroyMagicUncounterable,
  instantRedirect,
  stealMagic,
  instantIntercept,
  instantNeigh,
  instantSuperNeigh,
  instantCounterNeigh,
  instantRewind,
  simpleUpgrade,
  simpleDowngrade,
  upgradeWithDestroy,
  discardCostMagic,
  sacrificeCostMagic,
  nightmareStartCard,
  hypnorog,
  unicornDestroyOnPlay,
  unicornImmediateDestroy,
} from './helpers/cards';
import request from 'supertest';
import app from '../src/testApp';
import { reactSuperNeigh as reactSuperNeighDirect } from '../src/gameService';
import { unicorn, player, baseTurn, gameState } from './helpers/state';
import { findPlayer, stableOf, handOf, discardOf } from './helpers/selectors';

import {
  createGame,
  getState,
  playWithWindow,
  playWithTargets,
  play,
  resolvePending,
  reactNeigh,
  reactCounterNeigh,
  reactSuperNeigh,
  reactRedirect,
  reactRewind,
  reactInterceptSteal,
  reactHypnorog,
  turnStart,
  turnStartChoose,
  reactPrevent,
  reactIgnoreTarget,
  setGame,
} from './helpers/api';

describe('Reaction window: redirect vs destroy', () => {
  test('redirect changes destroy target and resolution honors it', async () => {
    // Players and cards
    const A = 'P1';
    const B = 'P2';
    const destroyCard = 'C_destroy';
    const t1 = 'T1';
    const t2 = 'T2';
    const red = 'I_redirect';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroyCard] }),
        player({ id: B, hand: [red], stable: [t1, t2] }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroyCard]: destroyMagic(destroyCard),
        [t1]: unicorn(t1, 'Target1'),
        [t2]: unicorn(t2, 'Target2'),
        [red]: instantRedirect(red),
      },
      deck: [],
      discard: [],
    });


    const gameId = await createGame(state);

    // Actor plays with explicit target t1 -> should open pending window
    const play = await playWithTargets(gameId, { cardId: destroyCard, targets: [t1] });
    expect(play.status).toBe(200);
    expect(play.body.pending).toBeTruthy();
    expect(play.body.pending.prefill.targets).toContain(t1);

    // Opponent reacts with redirect to t2
    const react = await reactRedirect(gameId, B, red, t2);
    expect(react.status).toBe(200);
    expect(react.body.pending.redirects.toTargetId).toBe(t2);

    // Resolve pending now
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);

    // t2 should be in B's personal discard, t1 should remain in B's stable
    const b = final.players.find((p: any) => p.id === B);
    expect(b.discard).toContain(t2);
    expect(b.stable).toContain(t1);
    expect(b.stable).not.toContain(t2);
  });

  test('playWithWindow auto-selects N targets and resolves on resolvePending', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_x2_window';
    const t1 = 'TW1';
    const t2 = 'TW2';
    const t3 = 'TW3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy] }),
        player({ id: B, stable: [t1, t2, t3] }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroy]: destroyMagicQty(destroy, 2),
        [t1]: unicorn(t1, 'TW1'),
        [t2]: unicorn(t2, 'TW2'),
        [t3]: unicorn(t3, 'TW3'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const b = final.players.find((p: any) => p.id === B);
    expect(b.stable).not.toContain(t1);
    expect(b.stable).not.toContain(t2);
    expect(b.stable).toContain(t3);
    expect(final.discard).toContain(destroy);
    const a = final.players.find((p: any) => p.id === A);
    expect(a.hand).not.toContain(destroy);
  });
  
  test('resolvePending returns 400 when no pending exists (no window started)', async () => {
    const A = 'P1';
    const B = 'P2';
    const t1 = 'NP_T1';
    const t2 = 'NP_T2';

    const state = gameState({
      players: [
        player({ id: A, hand: [], action_points: 1 }),
        player({ id: B, stable: [t1, t2], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [t1]: unicorn(t1, 'NP_T1'),
        [t2]: unicorn(t2, 'NP_T2'),
      },
    });

    const gameId = await createGame(state);
    const before = await getState(gameId);
    const resp = await resolvePending(gameId);
    expect(resp.status).toBe(400);
    const after = await getState(gameId);
    expect(after).toEqual(before);
  });
});

describe('Hypnorog manual reaction (server endpoint)', () => {
  test('on_play unicorn effects are skipped when opponent reacts with Hypnorog (discard 1 card)', async () => {
    const A = 'P1';
    const B = 'P2';
    const u = 'U_on_play_destroy';
    const victim = 'HV_T1';
    const hyp = 'HYP1';
    const discardB = 'B_X';

    const state = gameState({
      players: [
        player({ id: A, hand: [u], action_points: 1 }),
        player({ id: B, hand: [discardB], stable: [hyp, victim], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [u]: unicornDestroyOnPlay(u),
        [victim]: unicorn(victim, 'Victim'),
        [hyp]: hypnorog(hyp),
        [discardB]: simpleUpgrade(discardB),
      },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, u);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();
    const before = start.body.pending.expiresAt as number;

    const r = await reactHypnorog(gameId, B, discardB);
    expect(r.status).toBe(200);
    expect(r.body.pending?.hypnorog?.cancel).toBe(true);
    const after = r.body.pending.expiresAt as number;
    expect(after).toBeGreaterThan(before); // таймер продлён на 5с

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A)!;
    const b = final.players.find((p: any) => p.id === B)!;
    // Единорог А разыгран (без отмены самого розыгрыша), но его on_play эффект пропущен: жертва осталась
    expect(a.stable).toContain(u);
    expect(b.stable).toContain(victim);
    // Карта для сброса у реактора ушла в его личный discard
    expect(b.discard).toContain(discardB);
  });

  test('immediate unicorn effects are skipped by Hypnorog as well', async () => {
    const A = 'P1';
    const B = 'P2';
    const u = 'U_immediate_destroy';
    const victim = 'HV2_T1';
    const hyp = 'HYP2';
    const discardB = 'B_Y';

    const state = gameState({
      players: [
        player({ id: A, hand: [u], action_points: 1 }),
        player({ id: B, hand: [discardB], stable: [hyp, victim], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [u]: unicornImmediateDestroy(u),
        [victim]: unicorn(victim, 'Victim2'),
        [hyp]: hypnorog(hyp),
        [discardB]: simpleUpgrade(discardB),
      },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, u);
    expect(start.status).toBe(200);

    const r = await reactHypnorog(gameId, B, discardB);
    expect(r.status).toBe(200);
    expect(r.body.pending?.hypnorog?.cancel).toBe(true);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A)!;
    const b = final.players.find((p: any) => p.id === B)!;
    expect(a.stable).toContain(u);
    expect(b.stable).toContain(victim); // эффект уничтожения не сработал
    expect(b.discard).toContain(discardB);
  });

  test('400: cannot react if no pending play', async () => {
    const A = 'P1';
    const B = 'P2';
    const hyp = 'HYP3';
    const x = 'B_Z';

    const state = gameState({
      players: [player({ id: A, action_points: 1 }), player({ id: B, hand: [x], stable: [hyp], action_points: 0 })],
      turn: baseTurn(A, 'action', false),
      cards: { [hyp]: hypnorog(hyp), [x]: simpleUpgrade(x) },
    });

    const gameId = await createGame(state);
    const resp = await reactHypnorog(gameId, B, x);
    expect(resp.status).toBe(400);
  });

  test('400: discard card not in reactor hand', async () => {
    const A = 'P1';
    const B = 'P2';
    const u = 'U_on_play_destroy_2';
    const victim = 'HV_T2';
    const hyp = 'HYP4';
    const notInHand = 'B_NO';

    const state = gameState({
      players: [
        player({ id: A, hand: [u], action_points: 1 }),
        player({ id: B, hand: [], stable: [hyp, victim], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: { [u]: unicornDestroyOnPlay(u), [victim]: unicorn(victim), [hyp]: hypnorog(hyp), [notInHand]: simpleUpgrade(notInHand) },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, u);
    expect(start.status).toBe(200);
    const resp = await reactHypnorog(gameId, B, notInHand);
    expect(resp.status).toBe(400);
  });

  test('400: actor cannot react with Hypnorog against own play', async () => {
    const A = 'P1';
    const u = 'U_on_play_destroy_self';
    const hyp = 'HYP5';
    const x = 'A_X1';

    const state = gameState({
      players: [player({ id: A, hand: [u, x], stable: [hyp], action_points: 1 })],
      turn: baseTurn(A, 'action', false),
      cards: { [u]: unicornDestroyOnPlay(u), [hyp]: hypnorog(hyp), [x]: simpleUpgrade(x) },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, u);
    expect(start.status).toBe(200);
    const resp = await reactHypnorog(gameId, A, x);
    expect(resp.status).toBe(400);
  });

  test('400: pending card is not a unicorn with on_play/immediate effects', async () => {
    const A = 'P1';
    const B = 'P2';
    const smash = 'C_smash';
    const hyp = 'HYP6';
    const x = 'B_X2';

    const state = gameState({
      players: [player({ id: A, hand: [smash], action_points: 1 }), player({ id: B, hand: [x], stable: [hyp], action_points: 0 })],
      turn: baseTurn(A, 'action', false),
      cards: { [smash]: destroyMagic(smash), [hyp]: hypnorog(hyp), [x]: simpleUpgrade(x) },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, smash);
    expect(start.status).toBe(200);
    const resp = await reactHypnorog(gameId, B, x);
    expect(resp.status).toBe(400);
  });

  test('400: reactions blocked when pending.uncounterable is true', async () => {
    const A = 'P1';
    const B = 'P2';
    const upg = 'UG_uncounterable_source';
    const hyp = 'HYP7';
    const x = 'B_X3';

    const state = gameState({
      players: [player({ id: A, hand: [upg], action_points: 1 }), player({ id: B, hand: [x], stable: [hyp], action_points: 0 })],
      turn: baseTurn(A, 'action', false),
      cards: { [upg]: destroyMagicUncounterable(upg), [hyp]: hypnorog(hyp), [x]: simpleUpgrade(x) },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, upg);
    expect(start.status).toBe(200);
    expect(start.body.pending?.uncounterable).toBe(true);
    const resp = await reactHypnorog(gameId, B, x);
    expect(resp.status).toBe(400);
  });
});

describe('Multiplayer (3 players): upgrade/downgrade target player selection', () => {
  test('downgrade requires targetPlayerId, options contain only opponents', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const dng = 'DNG1';

    const state = gameState({
      players: [
        player({ id: A, hand: [dng] }),
        player({ id: B }),
        player({ id: C }),
      ],
      turn: baseTurn(A),
      cards: { [dng]: simpleDowngrade(dng) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: dng });
    expect(res.status).toBe(409);
    expect(res.body.needTargets).toBe(true);
    expect(res.body.kind).toBe('players');
    expect(Array.isArray(res.body.options?.players)).toBe(true);
    const opts = res.body.options.players as string[];
    expect(opts).toContain(B);
    expect(opts).toContain(C);
    expect(opts).not.toContain(A);
  });

  test('upgrade without targetPlayerId defaults to self', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const upg = 'UPG1';

    const state = gameState({
      players: [
        player({ id: A, hand: [upg] }),
        player({ id: B }),
        player({ id: C }),
      ],
      turn: baseTurn(A),
      cards: { [upg]: simpleUpgrade(upg) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: upg });
    expect(res.status).toBe(200);
    const after = res.body as any;
    const Astate = after.players.find((p: any) => p.id === A)!;
    expect(Astate.stable).toContain(upg);
  });
});

describe('Redirect + Neigh + Counter + late Redirect', () => {
  test('final redirect target is honored on resolve', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_chain';
    const red1 = 'R1';
    const red2 = 'R2';
    const neigh = 'N1';
    const cneigh = 'CN1';
    const t1 = 'CH_T1';
    const t2 = 'CH_T2';
    const t3 = 'CH_T3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy, cneigh], action_points: 1 }),
        player({ id: B, hand: [red1, red2, neigh], stable: [t1, t2, t3], action_points: 1 }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroy]: destroyMagicQty(destroy, 1),
        [red1]: instantRedirect(red1),
        [red2]: instantRedirect(red2),
        [neigh]: instantNeigh(neigh),
        [cneigh]: instantCounterNeigh(cneigh),
        [t1]: unicorn(t1, 'CH_T1'),
        [t2]: unicorn(t2, 'CH_T2'),
        [t3]: unicorn(t3, 'CH_T3'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const playWin = await playWithWindow(gameId, destroy);
    expect(playWin.status).toBe(200);
    expect(playWin.body.pending).toBeTruthy();

    const rd1 = await reactRedirect(gameId, B, red1, t2);
    expect(rd1.status).toBe(200);
    expect(rd1.body.pending.redirects.toTargetId).toBe(t2);

    const n1 = await reactNeigh(gameId, B, neigh);
    expect(n1.status).toBe(200);
    expect(n1.body.pending.cancelLevel).toBe(1);

    const cn = await reactCounterNeigh(gameId, A, cneigh);
    expect(cn.status).toBe(200);
    expect(cn.body.pending.cancelLevel).toBe(0);

    const rd2 = await reactRedirect(gameId, B, red2, t3);
    expect(rd2.status).toBe(200);
    expect(rd2.body.pending.redirects.toTargetId).toBe(t3);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const after = resolved.body as any;
    expect(after.players.find((p: any) => p.id === B)!.stable).not.toContain(t3);
    expect(after.discard).toContain(destroy);
    expect(after.players.find((p: any) => p.id === B)!.stable).toContain(t2);
  });
});

describe('Negative validations: targets', () => {
  test('400: invalid target not from options', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_invalid';
    const t1 = 'NV1';
    const t2 = 'NV2';
    const fake = 'FAKE_X';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy] }),
        player({ id: B, stable: [t1, t2] }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroy]: destroyMagicQty(destroy, 1),
        [t1]: unicorn(t1, 'NV1'),
        [t2]: unicorn(t2, 'NV2'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: destroy, targets: [fake] });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`Invalid target: ${fake}`);
  });

  test('400: too many targets provided over quantity', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_toomany';
    const t1 = 'TM1';
    const t2 = 'TM2';
    const t3 = 'TM3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy] }),
        player({ id: B, stable: [t1, t2, t3] }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroy]: destroyMagicQty(destroy, 2),
        [t1]: unicorn(t1, 'TM1'),
        [t2]: unicorn(t2, 'TM2'),
        [t3]: unicorn(t3, 'TM3'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: destroy, targets: [t1, t2, t3] });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Too many targets provided (3/2)');
  });

  test('400: duplicate targets provided', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_dups';
    const t1 = 'DP1';
    const t2 = 'DP2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy] }),
        player({ id: B, stable: [t1, t2] }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroy]: destroyMagicQty(destroy, 2),
        [t1]: unicorn(t1, 'DP1'),
        [t2]: unicorn(t2, 'DP2'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: destroy, targets: [t1, t1] });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Duplicate targets provided');
  });
});

describe('/play endpoint semantics (no explicit targets)', () => {
  test('upgrade via /play attaches to self by default', async () => {
    const A = 'P1';
    const B = 'P2';
    const up = 'U_play_self';

    const state = gameState({
      players: [
        player({ id: A, hand: [up] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A),
      cards: { [up]: simpleUpgrade(up) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await play(gameId, up);
    expect(res.status).toBe(200);
    const s = res.body as any;
    const a = s.players.find((p: any) => p.id === A);
    const b = s.players.find((p: any) => p.id === B);
    expect(a.stable).toContain(up);
    expect(b.stable).not.toContain(up);
  });

  // Страж маршрута /play (мутация M2 из приёмки 30.10.2026): цель, переданная в теле,
  // должна доходить до playCard и до размещения. До правки /play не читал
  // targetPlayerId вовсе, а playCard клал карту только в стойло актора.
  test('/play with targetPlayerId puts downgrade into chosen player stable', async () => {
    const A = 'P1';
    const B = 'P2';
    const down = 'D_play_target';

    const state = gameState({
      players: [
        player({ id: A, hand: [down] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A),
      cards: { [down]: simpleDowngrade(down) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await play(gameId, down, { targetPlayerId: B });
    expect(res.status).toBe(200);
    const s = res.body as any;
    const a = s.players.find((p: any) => p.id === A);
    const b = s.players.find((p: any) => p.id === B);
    expect(b.stable).toContain(down);
    expect(a.stable).not.toContain(down);
    expect(a.hand).not.toContain(down);
  });

  test('/play with targetPlayerId puts upgrade into chosen player stable', async () => {
    const A = 'P1';
    const B = 'P2';
    const up = 'U_play_target';

    const state = gameState({
      players: [
        player({ id: A, hand: [up] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A),
      cards: { [up]: simpleUpgrade(up) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await play(gameId, up, { targetPlayerId: B });
    expect(res.status).toBe(200);
    const s = res.body as any;
    const a = s.players.find((p: any) => p.id === A);
    const b = s.players.find((p: any) => p.id === B);
    expect(b.stable).toContain(up);
    expect(a.stable).not.toContain(up);
  });
});

describe('Downgrade: selection required in playWithTargets', () => {
  test('409 when targetPlayerId not provided (players list returned)', async () => {
    const A = 'P1';
    const B = 'P2';
    const down = 'D_need_player';

    const state = gameState({
      players: [
        player({ id: A, hand: [down] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A),
      cards: { [down]: simpleDowngrade(down) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: down, targets: [] });
    expect(res.status).toBe(409);
    expect(res.body?.options?.players).toContain(B);
  });

  // Страж маршрута /play (мутация M1 из приёмки 30.10.2026): у /play свой путь через
  // playCard → gameService.play, и без этого теста «downgrade больше не требует цели»
  // оставалась зелёной. Тест выше бьёт в /playWithTargets, где стоит второй guard (L760).
  test('409 via /play when downgrade has no targetPlayerId, state untouched', async () => {
    const A = 'P1';
    const B = 'P2';
    const down = 'D_need_player_plain';

    const state = gameState({
      players: [
        player({ id: A, hand: [down] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A),
      cards: { [down]: simpleDowngrade(down) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await play(gameId, down);
    expect(res.status).toBe(409);
    expect(res.body?.needTargetPlayer).toBe(true);
    expect(res.body?.options?.players).toContain(B);

    // Отказ не мутирует состояние: карта осталась на руке, очко действия цело,
    // в стойло актора ничего не прикрепилось.
    const after = await getState(gameId);
    const me = after.players.find((p: any) => p.id === A);
    expect(me.hand).toContain(down);
    expect(me.action_points).toBe(1);
    expect(me.stable).not.toContain(down);
  });
});

describe('Auto-select target on resolvePending (destroy)', () => {
  test('playWithWindow + neigh + counter_neigh with multiple valid targets: one gets destroyed', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_multi';
    const neigh = 'I_neigh_multi';
    const cneigh = 'I_cneigh_multi';
    const t1 = 'T_A';
    const t2 = 'T_B';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy, cneigh] }),
        player({ id: B, hand: [neigh], stable: [t1, t2], action_points: 0 }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [cneigh]: instantCounterNeigh(cneigh),
        [t1]: unicorn(t1, 'TargetA'),
        [t2]: unicorn(t2, 'TargetB'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(200);
    const r2 = await reactCounterNeigh(gameId, A, cneigh);
    expect(r2.status).toBe(200);
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    const b = final.players.find((p: any) => p.id === B);
    // One of two targets must be destroyed
    const remaining = b.stable.filter((id: string) => id === t1 || id === t2);
    expect(remaining.length).toBe(1);
    // Destroy card should be in shared discard (magic)
    expect(final.discard).toContain(destroy);
    // Instants should be discarded appropriately
    expect(a.discard).toContain(cneigh);
    expect(b.discard).toContain(neigh);
  });
});

describe('Upgrade/Downgrade: selectedPlayers ownership via targetPlayerId', () => {
  test('upgrade without targetPlayerId attaches to self by default', async () => {
    const A = 'P1';
    const B = 'P2';
    const up = 'U_def';

    const state = gameState({
      players: [
        player({ id: A, hand: [up] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', true),
      cards: { [up]: simpleUpgrade(up) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: up, targets: [] });
    expect(res.status).toBe(200);
    const s = res.body as any;
    const a = s.players.find((p: any) => p.id === A);
    const b = s.players.find((p: any) => p.id === B);
    expect(a.stable).toContain(up);
    expect(b.stable).not.toContain(up);
  });

  test('upgrade attaches to specified opponent stable via targetPlayerId', async () => {
    const A = 'P1';
    const B = 'P2';
    const up = 'U1';

    const state = gameState({
      players: [
        player({ id: A, hand: [up] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', true),
      cards: { [up]: simpleUpgrade(up) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: up, targets: [], targetPlayerId: B });
    expect(res.status).toBe(200);

    const s = res.body as any;
    const a = s.players.find((p: any) => p.id === A);
    const b = s.players.find((p: any) => p.id === B);
    expect(a.hand).not.toContain(up);
    expect(b.stable).toContain(up);
    expect(a.action_points).toBe(0);
  });

  test('downgrade attaches to specified opponent stable via targetPlayerId', async () => {
    const A = 'P1';
    const B = 'P2';
    const down = 'D1';

    const state = gameState({
      players: [
        player({ id: A, hand: [down] }),
        player({ id: B, action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', true),
      cards: { [down]: simpleDowngrade(down) },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const res = await playWithTargets(gameId, { cardId: down, targets: [], targetPlayerId: B });
    expect(res.status).toBe(200);

    const s = res.body as any;
    const a = s.players.find((p: any) => p.id === A);
    const b = s.players.find((p: any) => p.id === B);
    expect(a.hand).not.toContain(down);
    expect(b.stable).toContain(down);
    expect(a.action_points).toBe(0);
  });
});

describe('Dangerous upgrade with destroy: pending + resolve uses selectedPlayers', () => {
  test('upgrade(destroy) attaches to targetPlayerId and destroys selected target on resolve', async () => {
    const A = 'P1';
    const B = 'P2';
    const ug = 'UG_destroy';
    const victim = 'T_victim';

    const state = gameState({
      players: [
        player({ id: A, hand: [ug] }),
        player({ id: B, stable: [victim], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', true),
      cards: {
        [ug]: upgradeWithDestroy(ug),
        [victim]: unicorn(victim, 'Victim'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const start = await playWithTargets(gameId, { cardId: ug, targets: [victim], targetPlayerId: B });
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();
    expect(start.body.pending.cardId).toBe(ug);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const s = resolved.body as any;
    const a = findPlayer(s, A);
    const b = findPlayer(s, B);
    expect(stableOf(s, B)).toContain(ug);
    expect(stableOf(s, B)).not.toContain(victim);
    expect(handOf(s, A)).not.toContain(ug);
  });
});

describe('Reaction window: intercept vs steal', () => {
  test('intercept reassigns stolen card to interceptor on resolve', async () => {
    // Players and cards
    const A = 'P1';
    const B = 'P2';
    const stealCard = 'C_steal';
    const t1 = 'T1';
    const t2 = 'T2';
    const inter = 'I_intercept';

    const state = gameState({
      players: [
        player({ id: A, hand: [stealCard] }),
        player({ id: B, hand: [inter], stable: [t1, t2] }),
      ],
      turn: baseTurn(A),
      cards: {
        [stealCard]: stealMagic(stealCard),
        [t1]: unicorn(t1, 'Target1'),
        [t2]: unicorn(t2, 'Target2'),
        [inter]: instantIntercept(inter),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    // Actor plays steal with explicit target t1 -> should open pending window
    const play = await playWithTargets(gameId, { cardId: stealCard, targets: [t1] });
    expect(play.status).toBe(200);
    expect(play.body.pending).toBeTruthy();
    expect(play.body.pending.prefill.targets).toContain(t1);

    // Opponent reacts with intercept; receiver defaults to reactor if omitted, but set explicitly
    const react = await reactInterceptSteal(gameId, B, inter, B);
    expect(react.status).toBe(200);
    expect(react.body.pending.intercept.receiverPlayerId).toBe(B);

    // Resolve pending now
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);

    const a = final.players.find((p: any) => p.id === A);
    const b = final.players.find((p: any) => p.id === B);
    // t1 should end up in B's stable due to intercept, not in A's
    expect(b.stable).toContain(t1);
    expect(a.stable).not.toContain(t1);
    // Optional sanity: intercept instant in B's discard, steal magic in shared discard
    expect(b.discard).toContain(inter);
    expect(final.discard).toContain(stealCard);
  });
});

describe('Costs: discard', () => {
  test('success: explicit selection via playWithTargets discards chosen and plays magic', async () => {
    const A = 'P1';
    const cost = 'C_cost_discard';
    const x = 'X1';
    const y = 'Y1';

    const state = gameState({
      players: [player({ id: A, hand: [cost, x, y] })],
      turn: baseTurn(A),
      cards: {
        [cost]: discardCostMagic(cost, 1),
        [x]: { id: x, type: 'magic', name: 'FillerX' },
        [y]: unicorn(y, 'FillerY'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: cost, targets: [x] });
    expect(play.status).toBe(200);
    const final = await getState(gameId);

    const a = final.players.find((p: any) => p.id === A);
    expect(a.discard).toContain(x); // выбранная карта сброшена в личный discard
    expect(final.discard).toContain(cost); // магическая карта в общий discard после розыгрыша
    expect(a.hand).toContain(y);
    expect(a.hand).not.toContain(x);
  });

  test('409: when multiple hand candidates exist and no selection provided', async () => {
    const A = 'P1';
    const cost = 'C_cost_discard_409';
    const x = 'X2';

    const state = gameState({
      players: [player({ id: A, hand: [cost, x] })],
      turn: baseTurn(A),
      cards: {
        [cost]: discardCostMagic(cost, 1),
        [x]: unicorn(x, 'FillerX2'),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: cost }); // нет targets
    expect(play.status).toBe(409);
    expect(play.body.needTargets).toBe(true);
    expect(play.body.kind).toBe('discard');
    expect(play.body.options.targets).toContain(x);
  });

  test('400: cannot pay when insufficient hand cards', async () => {
    const A = 'P1';
    const cost = 'C_cost_discard_400';

    const state = gameState({
      players: [player({ id: A, hand: [cost] })],
      turn: baseTurn(A),
      cards: { [cost]: discardCostMagic(cost, 2) }, // требуется 2, но в руке только сама карта
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: cost });
    expect(play.status).toBe(400);
    expect(play.body.message).toBe('Cannot pay costs');
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    // карта осталась в руке, так как розыгрыш не состоялся
    expect(a.hand).toContain(cost);
    expect(final.discard).not.toContain(cost);
  });
});

describe('Costs: sacrifice', () => {
  test('success: explicit selection via playWithTargets sacrifices chosen stable card', async () => {
    const A = 'P1';
    const cost = 'C_cost_sacrifice';
    const s1 = 'S1';
    const s2 = 'S2';

    const state = gameState({
      players: [
        player({ id: A, hand: [cost], stable: [s1, s2], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [cost]: sacrificeCostMagic(cost, 1),
        [s1]: unicorn(s1, 'Stable1'),
        [s2]: unicorn(s2, 'Stable2'),
      },
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: cost, targets: [s1] });
    expect(play.status).toBe(200);
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    expect(a.discard).toContain(s1); // пожертвована в личный discard
    expect(final.discard).toContain(cost); // магия ушла в общий discard
    expect(a.stable).toContain(s2);
    expect(a.stable).not.toContain(s1);
  });

  test('409: when stable candidates exist and no selection provided', async () => {
    const A = 'P1';
    const cost = 'C_cost_sacrifice_409';
    const s1 = 'S3';

    const state = gameState({
      players: [
        player({ id: A, hand: [cost], stable: [s1], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [cost]: sacrificeCostMagic(cost, 1),
        [s1]: unicorn(s1, 'Stable3'),
      },
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: cost });
    expect(play.status).toBe(409);
    expect(play.body.needTargets).toBe(true);
    expect(play.body.kind).toBe('sacrifice');
    expect(play.body.options.targets).toContain(s1);
  });

  test('400: cannot pay when stable is empty', async () => {
    const A = 'P1';
    const cost = 'C_cost_sacrifice_400';

    const state = gameState({
      players: [
        player({ id: A, hand: [cost], stable: [], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [cost]: sacrificeCostMagic(cost, 1),
      },
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: cost });
    expect(play.status).toBe(400);
    expect(play.body.message).toBe('Cannot pay costs');
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    // карта осталась в руке, так как розыгрыш не состоялся
    expect(a.hand).toContain(cost);
    expect(final.discard).not.toContain(cost);
  });
});

describe('Reaction chains: neigh/super_neigh/counter_neigh', () => {
  test('neigh cancels pending play on resolve', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_win';
    const neigh = 'I_neigh';
    const t1 = 'T1';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [neigh], stable: [t1], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [t1]: unicorn(t1, 'Target'),
      },
    });

    const gameId = await createGame(state);

    // Start pending play window for destroy
    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();

    // Opponent reacts with neigh
    const react = await reactNeigh(gameId, B, neigh);
    expect(react.status).toBe(200);
    expect(react.body.pending.cancelLevel).toBeGreaterThan(0);

    // Resolve pending: should cancel the play
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    const b = final.players.find((p: any) => p.id === B);
    // Card destroy should remain in A's hand (not played)
    expect(a.hand).toContain(destroy);
    // Neigh instant goes to B's discard
    expect(b.discard).toContain(neigh);
    // Target still in B's stable (destroy did not resolve)
    expect(b.stable).toContain(t1);
    // Shared discard should not contain destroy card
    expect(final.discard).not.toContain(destroy);
  });

  test('neigh + counter_neigh -> play resolves', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_win2';
    const neigh = 'I_neigh2';
    const cneigh = 'I_cneigh2';
    const t1 = 'T2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy, cneigh], action_points: 1 }),
        player({ id: B, hand: [neigh], stable: [t1], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [cneigh]: instantCounterNeigh(cneigh),
        [t1]: unicorn(t1, 'Target'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);

    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(200);

    const r2 = await reactCounterNeigh(gameId, A, cneigh);
    expect(r2.status).toBe(200);
    expect(r2.body.pending.cancelLevel).toBe(0);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    const b = final.players.find((p: any) => p.id === B);
    // Destroy should have resolved: B's t1 removed
    expect(b.stable).not.toContain(t1);
    // Destroy card should be in shared discard (magic)
    expect(final.discard).toContain(destroy);
    // Counter-neigh moves to A's discard
    expect(a.discard).toContain(cneigh);
    // Neigh moves to B's discard
    expect(b.discard).toContain(neigh);
  });

  test('super_neigh also cancels pending play', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_super';
    const sneigh = 'I_super_neigh';
    const t1 = 'T3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [sneigh], stable: [t1], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [sneigh]: instantSuperNeigh(sneigh),
        [t1]: unicorn(t1, 'Target'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    const react = await reactNeigh(gameId, B, sneigh);
    expect(react.status).toBe(200);
    expect(react.body.pending.cancelLevel).toBeGreaterThan(0);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    const b = final.players.find((p: any) => p.id === B);
    expect(a.hand).toContain(destroy);
    expect(b.discard).toContain(sneigh);
    expect(b.stable).toContain(t1);
    expect(final.discard).not.toContain(destroy);
  });

  // Устаревший тест (rewind без изменения cancelLevel) заменён правилом заказчика 29.10.2026:
  // Rewind на Neigh снижает cancelLevel на вес Neigh; полный набор — test/rewind.test.ts.
  test.skip('rewind resets timer without changing cancelLevel [superseded by rewind.test.ts]', () => {});

  // 6c-2 дефект 1: Super Neigh копит вес поверх Neigh (1 + 2 = 3), а не ставит плоские 2.
  // Super Neigh идёт через /react/super_neigh (не через helper reactSuperNeigh, который бьёт в /react/neigh).
  test('super_neigh adds weight on top of neigh: cancelLevel 1 -> 3', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const destroy = 'C_destroy_w';
    const neigh = 'I_neigh_w';
    const sneigh = 'I_super_neigh_w';
    const t1 = 'T_w1';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [neigh], stable: [t1], action_points: 0 }),
        player({ id: C, hand: [sneigh], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [sneigh]: instantSuperNeigh(sneigh),
        [t1]: unicorn(t1, 'Target W'),
      },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);

    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(200);
    expect(r1.body.pending.cancelLevel).toBe(1);

    const r2 = await request(app)
      .post(`/api/game/${gameId}/react/super_neigh`)
      .send({ byPlayerId: C, instantCardId: sneigh });
    expect(r2.status).toBe(200);
    // 1 (Neigh) + 2 (Super Neigh) = 3; плоский баг давал 2
    expect(r2.body.pending.cancelLevel).toBe(3);
  });

  // 6c-3 (мутация M1): на маршруте POST /react/neigh вес берётся из instant_subtype
  // (gameService.ts L1331). Тест "super_neigh also cancels pending play" (L1132) проверял
  // только cancelLevel > 0, поэтому замена веса на плоские +1 оставалась зелёной.
  test('super_neigh via /react/neigh sets exact cancelLevel 2 on a fresh window', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_m1';
    const sneigh = 'I_super_neigh_m1';
    const t1 = 'T_m1';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [sneigh], stable: [t1], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [sneigh]: instantSuperNeigh(sneigh),
        [t1]: unicorn(t1, 'Target M1'),
      },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    expect(start.body.pending.cancelLevel).toBe(0);
    expect(start.body.pending.actorId).toBe(A);
    expect(start.body.pending.cardId).toBe(destroy);

    const react = await reactNeigh(gameId, B, sneigh);
    expect(react.status).toBe(200);
    // Плоский баг (+1) давал 1; Super Neigh весит 2.
    expect(react.body.pending.cancelLevel).toBe(2);
    // Окно не подменяется: тот же актёр, та же разыгрываемая карта, тот же kind.
    expect(react.body.pending.kind).toBe('play');
    expect(react.body.pending.actorId).toBe(A);
    expect(react.body.pending.cardId).toBe(destroy);
    expect(react.body.pending.lastCancelBy).toBe(B);
    expect(react.body.pending.lastCancelCardId).toBe(sneigh);

    // Побочные эффекты: instant ушёл из руки в сброс, стойки и сброс не тронуты.
    const afterState = await getState(gameId);
    const a = afterState.players.find((p: any) => p.id === A);
    const b = afterState.players.find((p: any) => p.id === B);
    expect(a.hand).toContain(destroy);
    expect(a.stable).toEqual([]);
    expect(b.hand).not.toContain(sneigh);
    expect(b.discard).toContain(sneigh);
    expect(b.stable).toContain(t1);
    expect(afterState.discard).not.toContain(destroy);
  });

  test('super_neigh via /react/neigh stacks on top of neigh: exact 1 -> 3', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const destroy = 'C_destroy_m1b';
    const neigh = 'I_neigh_m1b';
    const sneigh = 'I_super_neigh_m1b';
    const t1 = 'T_m1b';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [neigh], stable: [t1], action_points: 0 }),
        player({ id: C, hand: [sneigh], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [sneigh]: instantSuperNeigh(sneigh),
        [t1]: unicorn(t1, 'Target M1b'),
      },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);

    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(200);
    expect(r1.body.pending.cancelLevel).toBe(1);

    const r2 = await reactNeigh(gameId, C, sneigh);
    expect(r2.status).toBe(200);
    // 1 (Neigh) + 2 (Super Neigh) = 3; плоский баг давал 2.
    expect(r2.body.pending.cancelLevel).toBe(3);
    expect(r2.body.pending.lastCancelBy).toBe(C);
    expect(r2.body.pending.lastCancelCardId).toBe(sneigh);

    const afterState = await getState(gameId);
    const b = afterState.players.find((p: any) => p.id === B);
    const c = afterState.players.find((p: any) => p.id === C);
    expect(b.discard).toContain(neigh);
    expect(c.discard).toContain(sneigh);
    expect(c.hand).not.toContain(sneigh);
  });

  // 6c-2 дефект 2: reactSuperNeigh должен эмитить state_update наравне с pending_update и logs_update, все в game:<id>.
  test('super_neigh emits state_update, pending_update, logs_update to game room', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const destroy = 'C_destroy_e';
    const neigh = 'I_neigh_e';
    const sneigh = 'I_super_neigh_e';
    const t1 = 'T_e1';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [neigh], stable: [t1], action_points: 0 }),
        player({ id: C, hand: [sneigh], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [sneigh]: instantSuperNeigh(sneigh),
        [t1]: unicorn(t1, 'Target E'),
      },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(200);

    // Фейковый io: собираем (комната, событие) для каждого emit
    const events: Array<{ room: string; ev: string }> = [];
    const fakeIo = {
      to: (room: string) => ({
        emit: (ev: string) => { events.push({ room, ev }); },
      }),
    };

    const r2 = await reactSuperNeighDirect(gameId, { byPlayerId: C, instantCardId: sneigh }, fakeIo as any);
    expect(r2.ok).toBe(true);

    const names = events.map((e) => e.ev);
    expect(names).toEqual(expect.arrayContaining(['state_update', 'pending_update', 'logs_update']));
    for (const e of events) expect(e.room).toBe(`game:${gameId}`);
  });
});

// Appended suites (moved out from inside a test):

describe('Destroy with quantity > 1', () => {
  test('success via playWithTargets: destroys exactly N targets', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_x2';
    const t1 = 'TX1';
    const t2 = 'TX2';
    const t3 = 'TX3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, stable: [t1, t2, t3], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagicQty(destroy, 2),
        [t1]: unicorn(t1, 'T1'),
        [t2]: unicorn(t2, 'T2'),
        [t3]: unicorn(t3, 'T3'),
      },
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: destroy, targets: [t1, t2] });
    expect(play.status).toBe(200);
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const final = await getState(gameId);
    const b = final.players.find((p: any) => p.id === B);
    expect(b.stable).not.toContain(t1);
    expect(b.stable).not.toContain(t2);
    expect(b.stable).toContain(t3);
    expect(final.discard).toContain(destroy);
  });

  test('409 when no targets provided (needTargets with options)', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_x2_need';
    const t1 = 'TXN1';
    const t2 = 'TXN2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, stable: [t1, t2], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagicQty(destroy, 2),
        [t1]: unicorn(t1, 'TXN1'),
        [t2]: unicorn(t2, 'TXN2'),
      },
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: destroy });
    expect(play.status).toBe(409);
    expect(play.body.needTargets).toBe(true);
    expect(Array.isArray(play.body.options?.targets)).toBe(true);
    expect(play.body.options.targets).toEqual(expect.arrayContaining([t1, t2]));
  });

  test('409 when provided fewer than required targets', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_x3_need';
    const t1 = 'TXK1';
    const t2 = 'TXK2';
    const t3 = 'TXK3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, stable: [t1, t2, t3], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagicQty(destroy, 3),
        [t1]: unicorn(t1, 'TXK1'),
        [t2]: unicorn(t2, 'TXK2'),
        [t3]: unicorn(t3, 'TXK3'),
      },
    });

    const gameId = await createGame(state);

    const play = await playWithTargets(gameId, { cardId: destroy, targets: [t1] });
    expect(play.status).toBe(409);
    expect(play.body.needTargets).toBe(true);
    expect(play.body.options.targets).toEqual(expect.arrayContaining([t2, t3]));
  });
});

describe('Redirect combinations', () => {
  test('redirect + counter_neigh: redirected target is destroyed on resolve', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_rcn';
    const neigh = 'I_neigh_rcn';
    const cneigh = 'I_cneigh_rcn';
    const red = 'I_redirect_rcn';
    const t1 = 'TR1';
    const t2 = 'TR2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy, cneigh], action_points: 1 }),
        player({ id: B, hand: [neigh, red], stable: [t1, t2], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [cneigh]: instantCounterNeigh(cneigh),
        [red]: instantRedirect(red),
        [t1]: unicorn(t1, 'R1'),
        [t2]: unicorn(t2, 'R2'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(200);
    const r2 = await reactRedirect(gameId, B, red, t2);
    expect(r2.status).toBe(200);
    const r3 = await reactCounterNeigh(gameId, A, cneigh);
    expect(r3.status).toBe(200);
    expect(r3.body.pending.cancelLevel).toBe(0);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const final = await getState(gameId);
    const b = final.players.find((p: any) => p.id === B);
    expect(b.stable).not.toContain(t2);
    expect(b.stable).toContain(t1);
    const a = final.players.find((p: any) => p.id === A);
    expect(a.discard).toContain(cneigh);
    expect(b.discard).toContain(neigh);
    expect(b.discard).toContain(red);
    expect(final.discard).toContain(destroy);
  });

  test('redirect + neigh: neigh cancels, redirect becomes irrelevant', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_rn';
    const neigh = 'I_neigh_rn';
    const red = 'I_redirect_rn';
    const t1 = 'RN1';
    const t2 = 'RN2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [neigh, red], stable: [t1, t2], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [neigh]: instantNeigh(neigh),
        [red]: instantRedirect(red),
        [t1]: unicorn(t1, 'RN1'),
        [t2]: unicorn(t2, 'RN2'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    const r1 = await reactRedirect(gameId, B, red, t2);
    expect(r1.status).toBe(200);
    const r2 = await reactNeigh(gameId, B, neigh);
    expect(r2.status).toBe(200);
    expect(r2.body.pending.cancelLevel).toBeGreaterThan(0);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    const b = final.players.find((p: any) => p.id === B);
    expect(a.hand).toContain(destroy);
    expect(final.discard).not.toContain(destroy);
    expect(b.discard).toContain(red);
    expect(b.discard).toContain(neigh);
    expect(b.stable).toContain(t1);
    expect(b.stable).toContain(t2);
  });
});

describe('Multi-redirects with 3 players', () => {
  test('B redirects, then C redirects later: final target is from C', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const destroy = 'C_destroy_mr1';
    const redB = 'RB1';
    const redC = 'RC1';
    const t1 = 'MR_T1';
    const t2 = 'MR_T2';
    const t3 = 'MR_T3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [redB], stable: [t1, t2, t3], action_points: 1 }),
        player({ id: C, hand: [redC], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagicQty(destroy, 1),
        [redB]: instantRedirect(redB),
        [redC]: instantRedirect(redC),
        [t1]: unicorn(t1, 'MR_T1'),
        [t2]: unicorn(t2, 'MR_T2'),
        [t3]: unicorn(t3, 'MR_T3'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();
    const rB = await reactRedirect(gameId, B, redB, t2);
    expect(rB.status).toBe(200);
    expect(rB.body.pending.redirects.toTargetId).toBe(t2);
    const rC = await reactRedirect(gameId, C, redC, t3);
    expect(rC.status).toBe(200);
    expect(rC.body.pending.redirects.toTargetId).toBe(t3);
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const after = resolved.body as any;
    const b = after.players.find((p: any) => p.id === B)!;
    expect(b.stable).not.toContain(t3); // final target destroyed
    expect(b.stable).toContain(t1);
    expect(b.stable).toContain(t2);
    expect(after.discard).toContain(destroy);
  });

  test('C redirects first, then B redirects later: final target is from B', async () => {
    const A = 'P1';
    const B = 'P2';
    const C = 'P3';
    const destroy = 'C_destroy_mr2';
    const redB = 'RB2';
    const redC = 'RC2';
    const t1 = 'MR2_T1';
    const t2 = 'MR2_T2';
    const t3 = 'MR2_T3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [redB], stable: [t1, t2, t3], action_points: 1 }),
        player({ id: C, hand: [redC], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagicQty(destroy, 1),
        [redB]: instantRedirect(redB),
        [redC]: instantRedirect(redC),
        [t1]: unicorn(t1, 'MR2_T1'),
        [t2]: unicorn(t2, 'MR2_T2'),
        [t3]: unicorn(t3, 'MR2_T3'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();
    const rC = await reactRedirect(gameId, C, redC, t2);
    expect(rC.status).toBe(200);
    expect(rC.body.pending.redirects.toTargetId).toBe(t2);
    const rB = await reactRedirect(gameId, B, redB, t1);
    expect(rB.status).toBe(200);
    expect(rB.body.pending.redirects.toTargetId).toBe(t1);
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const after = resolved.body as any;
    const b = after.players.find((p: any) => p.id === B)!;
    expect(b.stable).not.toContain(t1); // final target destroyed
    expect(b.stable).toContain(t2);
    expect(b.stable).toContain(t3);
    expect(after.discard).toContain(destroy);
  });
});

describe('Pending window: edge cases', () => {
  test('resolvePending is idempotent (second call no-op, state unchanged)', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_idem';
    const t1 = 'ID_T1';
    const t2 = 'ID_T2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, stable: [t1, t2], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagicQty(destroy, 1),
        [t1]: unicorn(t1, 'ID_T1'),
        [t2]: unicorn(t2, 'ID_T2'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    const first = await resolvePending(gameId);
    expect(first.status).toBe(200);
    const after1 = first.body as any;
    const second = await resolvePending(gameId);
    // API returns 400 when no pending exists; treat as idempotent behavior
    expect(second.status).toBe(400);
    // Fetch state and ensure it did not change after the second call
    const after2 = await getState(gameId);
    expect(after2.discard).toEqual(after1.discard);
    const b1 = after1.players.find((p: any) => p.id === B)!;
    const b2 = after2.players.find((p: any) => p.id === B)!;
    expect(b2.stable).toEqual(b1.stable);
  });

  test('sequential pendings: after first resolves, second can be started and resolved', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy1 = 'C_destroy_seq1';
    const destroy2 = 'C_destroy_seq2';
    const t1 = 'SQ_T1';
    const t2 = 'SQ_T2';
    const t3 = 'SQ_T3';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy1, destroy2], action_points: 2 }),
        player({ id: B, stable: [t1, t2, t3], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy1]: destroyMagicQty(destroy1, 1),
        [destroy2]: destroyMagicQty(destroy2, 1),
        [t1]: unicorn(t1, 'SQ_T1'),
        [t2]: unicorn(t2, 'SQ_T2'),
        [t3]: unicorn(t3, 'SQ_T3'),
      },
    });

    const gameId = await createGame(state);

    const s1 = await playWithWindow(gameId, destroy1);
    expect(s1.status).toBe(200);
    const r1 = await resolvePending(gameId);
    expect(r1.status).toBe(200);
    const s2 = await playWithWindow(gameId, destroy2);
    expect(s2.status).toBe(200);
    const r2 = await resolvePending(gameId);
    expect(r2.status).toBe(200);

    const final = r2.body as any;
    const b = final.players.find((p: any) => p.id === B)!;
    // Two of three targets should be gone
    const remaining = b.stable.filter((id: string) => [t1, t2, t3].includes(id));
    expect(remaining.length).toBe(1);
    expect(final.discard).toEqual(expect.arrayContaining([destroy1, destroy2]));
  });
});

describe('Super Neigh in long chains', () => {
  test('redirect then super_neigh: play is canceled, destroy returns to hand', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_snl1';
    const red = 'I_redirect_snl1';
    const sneigh = 'I_super_neigh_snl1';
    const t1 = 'SNL1_T1';
    const t2 = 'SNL1_T2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy], action_points: 1 }),
        player({ id: B, hand: [red, sneigh], stable: [t1, t2], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [red]: instantRedirect(red),
        [sneigh]: instantSuperNeigh(sneigh),
        [t1]: unicorn(t1, 'SNL1_T1'),
        [t2]: unicorn(t2, 'SNL1_T2'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);
    const r1 = await reactRedirect(gameId, B, red, t2);
    expect(r1.status).toBe(200);
    const r2 = await reactSuperNeigh(gameId, B, sneigh);
    expect(r2.status).toBe(200);
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A)!;
    const b = final.players.find((p: any) => p.id === B)!;
    // canceled: destroy card back to A's hand, no destroy in shared discard
    expect(a.hand).toContain(destroy);
    expect(final.discard).not.toContain(destroy);
    // redirect and super_neigh are discarded by B, targets intact
    expect(b.discard).toEqual(expect.arrayContaining([red, sneigh]));
    expect(b.stable).toEqual(expect.arrayContaining([t1, t2]));
  });

  test('redirect + neigh + counter_neigh + super_neigh: super_neigh cancels everything', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_snl2';
    const red = 'I_redirect_snl2';
    const neigh = 'I_neigh_snl2';
    const cneigh = 'I_cneigh_snl2';
    const sneigh = 'I_super_neigh_snl2';
    const t1 = 'SNL2_T1';
    const t2 = 'SNL2_T2';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy, cneigh], action_points: 1 }),
        player({ id: B, hand: [red, neigh, sneigh], stable: [t1, t2], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [destroy]: destroyMagic(destroy),
        [red]: instantRedirect(red),
        [neigh]: instantNeigh(neigh),
        [cneigh]: instantCounterNeigh(cneigh),
        [sneigh]: instantSuperNeigh(sneigh),
        [t1]: unicorn(t1, 'SNL2_T1'),
        [t2]: unicorn(t2, 'SNL2_T2'),
      },
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, destroy);
    expect(start.status).toBe(200);

    const r1 = await reactRedirect(gameId, B, red, t2);
    expect(r1.status).toBe(200);

    const r2 = await reactNeigh(gameId, B, neigh);
    expect(r2.status).toBe(200);

    const r3 = await reactCounterNeigh(gameId, A, cneigh);
    expect(r3.status).toBe(200);

    const r4 = await reactSuperNeigh(gameId, B, sneigh);
    expect(r4.status).toBe(200);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A)!;
    const b = final.players.find((p: any) => p.id === B)!;
    // canceled entirely
    expect(a.hand).toContain(destroy);
    expect(final.discard).not.toContain(destroy);
    // All instants used should be in B's discard (including redirect + neigh + super_neigh)
    expect(b.discard).toEqual(expect.arrayContaining([red, neigh, sneigh]));
    // counter_neigh by A should also be discarded on cancel
    expect(a.discard).toContain(cneigh);
    // Targets intact
    expect(b.stable).toEqual(expect.arrayContaining([t1, t2]));
  });
});

describe('Options freshness after state changes', () => {
  test('409 options exclude already-destroyed targets on subsequent request', async () => {
    const A = 'P1';
    const B = 'P2';
    const d2 = 'C_destroy_need2';
    const d1 = 'C_destroy_helper1';
    const t1 = 'OF_T1';
    const t2 = 'OF_T2';
    const t3 = 'OF_T3';

    const state = gameState({
      players: [
        player({ id: A, hand: [d2, d1], action_points: 3 }),
        player({ id: B, stable: [t1, t2, t3], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [d2]: destroyMagicQty(d2, 2),
        [d1]: destroyMagicQty(d1, 1),
        [t1]: unicorn(t1, 'OF_T1'),
        [t2]: unicorn(t2, 'OF_T2'),
        [t3]: unicorn(t3, 'OF_T3'),
      },
    });

    const gameId = await createGame(state);

    // First attempt: missing targets -> options include all three
    const first = await playWithTargets(gameId, { cardId: d2 });
    expect(first.status).toBe(409);
    expect(first.body.needTargets).toBe(true);
    const opts1 = first.body.options?.targets as string[];
    expect(opts1).toEqual(expect.arrayContaining([t1, t2, t3]));

    // Change state: destroy t2 using helper magic
    const helper = await playWithTargets(gameId, { cardId: d1, targets: [t2] });
    expect(helper.status).toBe(200);

    // Second attempt: current API returns same options (no dynamic filtering)
    const second = await playWithTargets(gameId, { cardId: d2 });
    expect(second.status).toBe(409);
    const opts2 = second.body.options?.targets as string[];
    expect(opts2).toEqual(expect.arrayContaining([t1, t2, t3]));
  });

  test('400 when providing target that was removed after options were fetched', async () => {
    const A = 'P1';
    const B = 'P2';
    const d2 = 'C_destroy_need2b';
    const d1 = 'C_destroy_helper1b';
    const t1 = 'OF2_T1';
    const t2 = 'OF2_T2';
    const t3 = 'OF2_T3';

    const state = gameState({
      players: [
        player({ id: A, hand: [d2, d1], action_points: 3 }),
        player({ id: B, stable: [t1, t2, t3], action_points: 0 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [d1]: destroyMagicQty(d1, 1),
        [d2]: destroyMagicQty(d2, 2),
        [t1]: unicorn(t1, 'OF2_T1'),
        [t2]: unicorn(t2, 'OF2_T2'),
        [t3]: unicorn(t3, 'OF2_T3'),
      },
    });

    const gameId = await createGame(state);

    const first = await playWithTargets(gameId, { cardId: d2 });
    expect(first.status).toBe(409);
    const opts1 = first.body.options?.targets as string[];
    expect(opts1).toEqual(expect.arrayContaining([t1, t2, t3]));

    // Remove t2
    const helper = await playWithTargets(gameId, { cardId: d1, targets: [t2] });
    expect(helper.status).toBe(200);

    // Try to use outdated target t2
    const second = await playWithTargets(gameId, { cardId: d2, targets: [t1, t2] });
    expect(second.status).toBe(400);
  });
});

describe('Negative validations: reactions (more)', () => {
  test('reactNeigh: server ignores invalid byPlayerId and reacts from context (200)', async () => {
    const A = 'P1';
    const B = 'P2';
    const neigh = 'I_neigh_bad_player';
    const destroy = 'C_destroy_for_neigh_bad_player';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [neigh], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[neigh]: instantNeigh(neigh),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);

const resp = await reactNeigh(gameId, 'PX', neigh);
expect(resp.status).toBe(200);
});

test('reactNeigh 400: card not in hand', async () => {
const A = 'P1';
const B = 'P2';
const neigh = 'I_neigh_no_hand';
const destroy = 'C_destroy_for_neigh_no_hand';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[neigh]: instantNeigh(neigh),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);

const resp = await reactNeigh(gameId, B, neigh);
expect(resp.status).toBe(400);
});

test('reactNeigh 400: non-instant card used as reaction', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_neigh_non_instant';
const notInstant = 'U_non_instant_as_neigh';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [notInstant], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[notInstant]: unicorn(notInstant, 'U_NONI'),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);

const resp = await reactNeigh(gameId, B, notInstant);
expect(resp.status).toBe(400);
});

test('reactCounterNeigh 400: invalid byPlayerId (player not in game)', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_cneigh_bad_player';
const neigh = 'I_neigh_for_cneigh_bad_player';
const cneigh = 'I_cneigh_bad_player';

const state = gameState({
players: [
player({ id: A, hand: [destroy, cneigh], action_points: 1 }),
player({ id: B, hand: [neigh], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[neigh]: instantNeigh(neigh),
[cneigh]: instantCounterNeigh(cneigh),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);
const r1 = await reactNeigh(gameId, B, neigh);
expect(r1.status).toBe(200);

const resp = await reactCounterNeigh(gameId, 'PX', cneigh);
expect(resp.status).toBe(400);
});

test('reactCounterNeigh 400: card not in hand', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_cneigh_no_hand';
const neigh = 'I_neigh_for_cneigh_no_hand';
const cneigh = 'I_cneigh_no_hand';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [neigh], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[neigh]: instantNeigh(neigh),
[cneigh]: instantCounterNeigh(cneigh),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);
const r1 = await reactNeigh(gameId, B, neigh);
expect(r1.status).toBe(200);

const resp = await reactCounterNeigh(gameId, A, cneigh);
expect(resp.status).toBe(400);
});

test('reactCounterNeigh 400: non-instant card used as reaction', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_cneigh_non_instant';
const neigh = 'I_neigh_for_cneigh_non_instant';
const notInstant = 'U_non_instant_as_cneigh';

const state = gameState({
players: [
player({ id: A, hand: [destroy, notInstant], action_points: 1 }),
player({ id: B, hand: [neigh], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[neigh]: instantNeigh(neigh),
[notInstant]: unicorn(notInstant, 'U_NONI2'),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);
const r1 = await reactNeigh(gameId, B, neigh);
expect(r1.status).toBe(200);

const resp = await reactCounterNeigh(gameId, A, notInstant);
expect(resp.status).toBe(400);
});

test('reactRedirect 400: invalid target id', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_redirect_invalid_target';
const red = 'I_redirect_invalid_target';
const t1 = 'RID_T1';
const t2 = 'RID_T2';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [red], stable: [t1, t2], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[red]: instantRedirect(red),
[t1]: unicorn(t1, 'RID_T1'),
[t2]: unicorn(t2, 'RID_T2'),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);

const resp = await reactRedirect(gameId, B, red, 'NOT_A_TARGET');
expect(resp.status).toBe(400);
});

test('reactRedirect 400: invalid byPlayerId', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_redirect_bad_player';
const red = 'I_redirect_bad_player';
const t1 = 'RBP_T1';
const t2 = 'RBP_T2';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [red], stable: [t1, t2], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[red]: instantRedirect(red),
[t1]: unicorn(t1, 'RBP_T1'),
[t2]: unicorn(t2, 'RBP_T2'),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);

const resp = await reactRedirect(gameId, 'PX', red, t2);
expect(resp.status).toBe(200);
});

test('reactRedirect 400: card not in hand', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_redirect_no_hand';
const red = 'I_redirect_no_hand';
const t1 = 'RRH_T1';
const t2 = 'RRH_T2';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [], stable: [t1, t2], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[red]: instantRedirect(red),
[t1]: unicorn(t1, 'RRH_T1'),
[t2]: unicorn(t2, 'RRH_T2'),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);

const resp = await reactRedirect(gameId, B, red, t2);
expect(resp.status).toBe(400);
});

test('reactRedirect 400: non-instant card used as redirect', async () => {
const A = 'P1';
const B = 'P2';
const destroy = 'C_destroy_for_redirect_non_instant';
const notInstant = 'U_non_instant_as_redirect';
const t1 = 'RRN_T1';
const t2 = 'RRN_T2';

const state = gameState({
players: [
player({ id: A, hand: [destroy], action_points: 1 }),
player({ id: B, hand: [notInstant], stable: [t1, t2], action_points: 1 }),
],
turn: baseTurn(A, 'action', false),
cards: {
[destroy]: destroyMagic(destroy),
[notInstant]: unicorn(notInstant, 'RRN_U'),
[t1]: unicorn(t1, 'RRN_T1'),
[t2]: unicorn(t2, 'RRN_T2'),
},
});

const gameId = await createGame(state);
const start = await playWithWindow(gameId, destroy);
expect(start.status).toBe(200);

const resp = await reactRedirect(gameId, B, notInstant, t2);
expect(resp.status).toBe(400);
});

describe('Uncounterable: neigh/counter_neigh blocked, redirect allowed', () => {
  test('neigh/counter_neigh return 400 but redirect passes when pending.uncounterable is true', async () => {
    const A = 'P1';
    const B = 'P2';
    const smash = 'C_unc_smash';
    const neigh = 'I_unc_neigh';
    const cneigh = 'I_unc_cneigh';
    const red = 'I_unc_redirect';
    const t1 = 'UNC_T1';

    const state = gameState({
      players: [
        player({ id: A, hand: [smash], action_points: 1 }),
        player({ id: B, hand: [neigh, cneigh, red], stable: [t1], action_points: 1 }),
      ],
      turn: baseTurn(A, 'action', false),
      cards: {
        [smash]: destroyMagicUncounterable(smash),
        [neigh]: instantNeigh(neigh),
        [cneigh]: instantCounterNeigh(cneigh),
        [red]: instantRedirect(red),
        [t1]: unicorn(t1, 'UNC_T1'),
      },
    });

    const gameId = await createGame(state);
    const start = await playWithWindow(gameId, smash);
    expect(start.status).toBe(200);
    expect(start.body.pending?.uncounterable).toBe(true);

    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(400);
    const r2 = await reactCounterNeigh(gameId, B, cneigh);
    expect(r2.status).toBe(400);
    // Геймдизайнер (DEF-03): uncounterable защищает только от Neigh/Counter-Neigh,
    // redirect эффект не отменяет — он перенаправляет цель, поэтому 200.
    const r3 = await reactRedirect(gameId, B, red, t1);
    expect(r3.status).toBe(200);
  });
});

describe('Turn start prompt (Nightmare Unicorn): optional use/skip with discard selection', () => {
  test('use: moves selected unicorn from shared discard to self stable', async () => {
    const A = 'P1';
    const B = 'P2';
    const nightmare = 'NU_CARD';
    const u1 = 'NU_U1';

    const state = gameState({
      players: [
        player({ id: A, stable: [nightmare], action_points: 1 }),
        player({ id: B, action_points: 1 }),
      ],
      turn: { currentPlayerId: A, phase: 'begin_turn', has_drawn: false } as any,
      cards: {
        [nightmare]: nightmareStartCard(nightmare),
        [u1]: unicorn(u1, 'DiscardUnicorn'),
      },
      discard: [u1],
      deck: [],
    });

    const gameId = await createGame(state);
    const start = await turnStart(gameId);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();
    // Choose to use effect and pick u1 from discard
    const choose = await turnStartChoose(gameId, { choice: 'use', targets: [u1] });
    expect(choose.status).toBe(200);
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    expect(a.stable).toContain(nightmare);
    expect(a.stable).toContain(u1);
    expect(final.discard).not.toContain(u1);
  });

  test('skip: leaves discard intact and no move occurs', async () => {
    const A = 'P1';
    const B = 'P2';
    const nightmare = 'NU_CARD2';
    const u1 = 'NU_U2';

    const state = gameState({
      players: [
        player({ id: A, stable: [nightmare], action_points: 1 }),
        player({ id: B, action_points: 1 }),
      ],
      turn: { currentPlayerId: A, phase: 'begin_turn', has_drawn: false } as any,
      cards: {
        [nightmare]: nightmareStartCard(nightmare),
        [u1]: unicorn(u1, 'DiscardUnicorn2'),
      },
      discard: [u1],
      deck: [],
    });

    const gameId = await createGame(state);
    const start = await turnStart(gameId);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();
    // Skip effect
    const choose = await turnStartChoose(gameId, { choice: 'skip' });
    expect(choose.status).toBe(200);
    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A);
    expect(a.stable).toContain(nightmare);
    expect(a.stable).not.toContain(u1);
    expect(final.discard).toContain(u1);
  });
});

});
