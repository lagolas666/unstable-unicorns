import request from 'supertest';
import app from '../src/testApp';
import { games } from '../src/gameStore';
import { createGame, playWithTargets, resolvePending, getState } from './helpers/api';
import { destroyMagic, simpleUpgrade, unicorn } from './helpers/cards';

// Единорог-Архангел (archangel_unicorn_ultimate), UNICORNS.md п.78.
// Замена уничтожения — выбор владельца, а не автоматика:
//   выбор карты  → карта из руки в сброс, цель остаётся в стойле;
//   отказ        → уничтожение проходит штатно;
//   пустая рука  → платить нечем, окно не открывается, уничтожение сразу.
// Окно живёт в gameService.resolveArchangelWindow (L2075-2094), открывается
// в executor.resolveDestroyReplacement (L141-158) с purpose 'archangel_prevent'.
// Ответ владельца приходит через POST /api/game/:id/resolvePending.

const ARCH = 'archangel_unicorn_ultimate';

function archangel(cardId: string) {
  return {
    id: cardId,
    type: 'ultimate_unicorn',
    name: 'Единорог-Архангел',
    effects: [
      {
        trigger: 'on_would_be_destroyed_or_sacrificed',
        optional: true,
        actions: [
          {
            kind: 'discard',
            target: {
              scope: 'self',
              zone: 'hand',
              filters: { card_group: 'any' },
              quantity: { value: 1 },
            },
          },
          { kind: 'prevent', prevented_action: 'destroy_or_sacrifice' },
        ],
      },
    ],
  } as any;
}

const OWNER = 'P1'; // владелец Архангела
const ATTACKER = 'P2'; // играет уничтожение, поэтому цель принадлежит сопернику

function buildGame(hand: string[]) {
  const cards: Record<string, any> = {
    C_smash: destroyMagic('C_smash'),
    H_keep: simpleUpgrade('H_keep'),
    H_two: simpleUpgrade('H_two'),
    U_spare: unicorn('U_spare', 'Spare Unicorn'),
    [ARCH]: archangel(ARCH),
  };
  return {
    players: [
      { id: OWNER, hand: hand.slice(), stable: [ARCH, 'U_spare'], discard: [], nursery: [], flags: {} },
      { id: ATTACKER, hand: ['C_smash'], stable: [], discard: [], nursery: [], flags: {} },
    ],
    cards,
    turn: { number: 1, currentPlayerId: ATTACKER, phase: 'action', action_points: 1, has_drawn: true, skippedPhases: [] },
    deck: ['dk1', 'dk2'],
    discard: [],
    nursery: [],
    flags: {},
  };
}

const playerIn = (state: any, id: string) => state.players.find((p: any) => p.id === id);

// pending читаем из стора: состояние окна не выводится из состояния партии.
const pendingOf = (gameId: string) => (games.get(gameId) as any)?.pending;

// Разыгрывает Smash в Архангела и закрывает окно реакции на розыгрыш (kind 'play').
async function playSmashIntoArchangel(hand: string[]) {
  const gameId = await createGame(buildGame(hand));
  const played = await playWithTargets(gameId, { cardId: 'C_smash', targets: [ARCH] });
  expect(played.status).toBe(200);
  const closed = await resolvePending(gameId);
  expect(closed.status).toBe(200);
  return gameId;
}

describe('Окно замены Архангела (purpose archangel_prevent)', () => {
  test('W1: владелец выбрал карту — карта из руки в сброс, Архангел остаётся в стойле', async () => {
    const gameId = await playSmashIntoArchangel(['H_keep', 'H_two']);

    // Окно открыто и адресовано владельцу карты.
    const opened: any = pendingOf(gameId);
    expect(opened).toBeTruthy();
    expect(opened.kind).toBe('await_choice');
    expect(opened.purpose).toBe('archangel_prevent');
    expect(opened.chooserId).toBe(OWNER);
    expect(opened.actorId).toBe(ATTACKER);
    expect(opened.sourceCardId).toBe(ARCH);
    expect(opened.options).toEqual(['H_keep', 'H_two']);
    expect(opened.deferred).toEqual({ zone: 'stable', cardId: ARCH, kind: 'destroy' });

    // До ответа цель не мутирует — это и есть «выбор», а не автоматика.
    const before: any = await getState(gameId);
    expect(playerIn(before, OWNER).stable).toContain(ARCH);

    const chosen = await request(app)
      .post(`/api/game/${gameId}/resolvePending`)
      .send({ cardId: 'H_keep' });
    expect(chosen.status).toBe(200);

    const after: any = await getState(gameId);
    const owner = playerIn(after, OWNER);
    expect(owner.stable).toContain(ARCH);
    expect(owner.discard).toEqual(['H_keep']);
    expect(owner.hand).toEqual(['H_two']);
    expect(pendingOf(gameId)).toBeFalsy();
  });

  test('W2: владелец отказался — уничтожение проходит штатно, рука не тронута', async () => {
    const gameId = await playSmashIntoArchangel(['H_keep']);
    expect((pendingOf(gameId) as any).purpose).toBe('archangel_prevent');

    const declined = await request(app)
      .post(`/api/game/${gameId}/resolvePending`)
      .send({ decline: true });
    expect(declined.status).toBe(200);

    const after: any = await getState(gameId);
    const owner = playerIn(after, OWNER);
    expect(owner.stable).not.toContain(ARCH);
    expect(owner.discard).toContain(ARCH);
    expect(owner.hand).toEqual(['H_keep']);
    expect(pendingOf(gameId)).toBeFalsy();
  });

  test('W3: карту не из руки принять нельзя — 400, состояние и окно не меняются', async () => {
    const gameId = await playSmashIntoArchangel(['H_keep']);
    const before: any = await getState(gameId);
    const beforeJson = JSON.stringify(before);

    const res = await request(app)
      .post(`/api/game/${gameId}/resolvePending`)
      .send({ cardId: 'H_two' }); // H_two нет в руке владельца
    expect(res.status).toBe(400);

    const after: any = await getState(gameId);
    expect(JSON.stringify(after)).toBe(beforeJson);
    expect(playerIn(after, OWNER).stable).toContain(ARCH);
    expect((pendingOf(gameId) as any).purpose).toBe('archangel_prevent');
  });

  test('W4: пустая рука — замены нет, уничтожение сразу, окно Архангела не открывается', async () => {
    const gameId = await playSmashIntoArchangel([]);

    // Окно реакции на розыгрыш закрылось, окна замены не последовало.
    expect(pendingOf(gameId)).toBeFalsy();
    const after: any = await getState(gameId);
    const owner = playerIn(after, OWNER);
    expect(owner.stable).not.toContain(ARCH);
    expect(owner.discard).toContain(ARCH);
    expect(owner.hand).toEqual([]);
  });

  test('W5: контроль — без Архангела в стойле окна нет, цель уничтожается', async () => {
    const state: any = buildGame(['H_keep']);
    // Убираем Архангела из стойла: триггера замены нет.
    state.players[0].stable = ['U_spare'];
    const gameId = await createGame(state);
    const played = await playWithTargets(gameId, { cardId: 'C_smash', targets: ['U_spare'] });
    expect(played.status).toBe(200);
    await resolvePending(gameId);

    expect(pendingOf(gameId)).toBeFalsy();
    const after: any = await getState(gameId);
    const owner = playerIn(after, OWNER);
    expect(owner.stable).not.toContain('U_spare');
    expect(owner.discard).toContain('U_spare');
    expect(owner.hand).toEqual(['H_keep']);
  });
});
