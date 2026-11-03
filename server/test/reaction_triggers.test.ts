import {
  instantRedirect,
  instantNeigh,
  instantCounterNeigh,
  instantIntercept,
  unicornWhenDestroyedDestroy,
  unicornImmediateStealAllowIntercept,
  unicornImmediateDestroyUncounterable,
  unicorn,
} from './helpers/cards';
import { player, baseTurn, gameState } from './helpers/state';
import { createGame, getState, playWithTargets, playWithWindow, resolvePending, reactRedirect, reactNeigh, reactCounterNeigh, reactInterceptSteal } from './helpers/api';

// Тесты окон реакций для триггеров when_destroyed и when_enters (immediate)

describe('Trigger windows: when_destroyed -> destroy (redirect allowed)', () => {
  test('redirect меняет цель уничтожения у эффекта when_destroyed', async () => {
    const A = 'P1';
    const B = 'P2';

    const destroySpell = 'C_destroy_play';
    const a1 = 'A1';
    const a2 = 'A2';
    const bUnicornWD = 'B_WD';
    const red = 'R_RED';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroySpell, red], stable: [a1, a2] }),
        player({ id: B, stable: [bUnicornWD] }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroySpell]: {
          id: destroySpell,
          type: 'magic',
          name: 'Destroy Target',
          effects: [
            {
              trigger: 'on_play',
              actions: [
                {
                  kind: 'destroy',
                  targets: {
                    scope: 'opponent',
                    zone: 'stable',
                    quantity: { value: 1 },
                    filters: { card_group: 'any' },
                  },
                },
              ],
            },
          ],
        } as any,
        [a1]: unicorn(a1, 'A1'),
        [a2]: unicorn(a2, 'A2'),
        [bUnicornWD]: unicornWhenDestroyedDestroy(bUnicornWD),
        [red]: instantRedirect(red),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    // A разрушает единорога B с триггером when_destroyed
    const resPlay = await playWithTargets(gameId, { cardId: destroySpell, targets: [bUnicornWD] });
    expect(resPlay.status).toBe(200);

    // Должно открыться окно реакции для when_destroyed эффекта B (destroy 1 в стойле A)
    // A реагирует редиректом на свою другую карту (переключаем цель уничтожения между a1 и a2)
    const rd = await reactRedirect(gameId, A, red, a2);
    expect(rd.status).toBe(200);
    expect(rd.body.pending?.redirects?.toTargetId).toBe(a2);

    // Резолвим pending (окно триггера)
    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const Astate = final.players.find((p: any) => p.id === A)!;
    // В стойле А должен остаться только один из a1/a2; редирект указывал на a2 => a2 должен быть уничтожен
    expect(Astate.stable).toContain(a1);
    expect(Astate.stable).not.toContain(a2);
  });
});

describe('Trigger windows: immediate (when_enters) -> steal with intercept', () => {
  test('intercept переназначает получателя украденной карты', async () => {
    const A = 'P1';
    const B = 'P2';

    const enterSteal = 'U_ENTER_STEAL';
    const target = 'B_T1';
    const inter = 'I_INT';

    const state = gameState({
      players: [
        player({ id: A, hand: [enterSteal] }),
        player({ id: B, hand: [inter], stable: [target] }),
      ],
      turn: baseTurn(A),
      cards: {
        [enterSteal]: unicornImmediateStealAllowIntercept(enterSteal),
        [target]: unicorn(target, 'BTarget'),
        [inter]: instantIntercept(inter),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    // Разыгрываем юнита с immediate steal — должно открыться окно trigger_effect
    const start = await playWithWindow(gameId, enterSteal);
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();

    // B перехватывает, назначая себя получателем (по сути карта остаётся у B)
    const ri = await reactInterceptSteal(gameId, B, inter, B);
    expect(ri.status).toBe(200);
    expect(ri.body.pending?.intercept?.receiverPlayerId).toBe(B);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const Astate = final.players.find((p: any) => p.id === A)!;
    const Bstate = final.players.find((p: any) => p.id === B)!;
    expect(Bstate.stable).toContain(target);
    expect(Astate.stable).toContain(enterSteal); // юнит A вошёл
    expect(Astate.stable).not.toContain(target);
  });
});

describe('Trigger windows: immediate uncounterable destroy blocks neigh/counter but allows redirect', () => {
  test('uncounterable блокирует neigh/counter, но redirect проходит', async () => {
    const A = 'P1';
    const B = 'P2';

    const enterDestroy = 'U_ENTER_DESTROY_UNC';
    const t1 = 'BT1';
    const t2 = 'BT2';
    const neigh = 'N';
    const cneigh = 'CN';
    const red = 'R';

    const state = gameState({
      players: [
        player({ id: A, hand: [enterDestroy] }),
        player({ id: B, hand: [neigh, cneigh, red], stable: [t1, t2] }),
      ],
      turn: baseTurn(A),
      cards: {
        [enterDestroy]: unicornImmediateDestroyUncounterable(enterDestroy),
        [t1]: unicorn(t1, 'T1'),
        [t2]: unicorn(t2, 'T2'),
        [neigh]: instantNeigh(neigh),
        [cneigh]: instantCounterNeigh(cneigh),
        [red]: instantRedirect(red),
      },
      deck: [],
      discard: [],
    });

    const gameId = await createGame(state);

    const start = await playWithWindow(gameId, enterDestroy);
    expect(start.status).toBe(200);
    expect(start.body.pending?.uncounterable).toBe(true);

    // Попытка neigh должна дать 400
    const r1 = await reactNeigh(gameId, B, neigh);
    expect(r1.status).toBe(400);

    // Попытка counter_neigh тоже 400
    const r2 = await reactCounterNeigh(gameId, B, cneigh);
    expect(r2.status).toBe(400);

    // Redirect разрешён — перенаправляем с t1 на t2
    const rr = await reactRedirect(gameId, B, red, t2);
    expect(rr.status).toBe(200);

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const Bstate = final.players.find((p: any) => p.id === B)!;
    // Уничтожена должна быть t2 (после редиректа), t1 осталась
    expect(Bstate.stable).toContain(t1);
    expect(Bstate.stable).not.toContain(t2);
  });
});
