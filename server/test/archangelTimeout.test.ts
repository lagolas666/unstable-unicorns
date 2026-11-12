import { games } from '../src/gameStore';
import { createGame, playWithTargets, getState } from './helpers/api';
import { destroyMagic, simpleUpgrade, unicorn } from './helpers/cards';

// Таймаут окна замены Архангела (gameService.schedulePendingResolution L72-76).
// Владелец не ответил за окно → отказ: цель уничтожается штатно через
// completeDeferredDestroy (executor.ts L161-172), его рука не тронута.
//
// Окон здесь ДВА подряд: сначала 5 с окно реакции на розыгрыш (kind 'play'),
// после его закрытия открывается окно замены ещё на 5 с. Поэтому ждать нужно
// не меньше 10 с — иначе тест проверял бы живое окно, а не таймаут.

const ARCH = 'archangel_unicorn_ultimate';
const OWNER = 'P1';
const ATTACKER = 'P2';

jest.setTimeout(40000);

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
            target: { scope: 'self', zone: 'hand', filters: { card_group: 'any' }, quantity: { value: 1 } },
          },
          { kind: 'prevent', prevented_action: 'destroy_or_sacrifice' },
        ],
      },
    ],
  } as any;
}

function buildGame() {
  const cards: Record<string, any> = {
    C_smash: destroyMagic('C_smash'),
    H_keep: simpleUpgrade('H_keep'),
    U_spare: unicorn('U_spare', 'Spare Unicorn'),
    [ARCH]: archangel(ARCH),
  };
  return {
    players: [
      { id: OWNER, hand: ['H_keep'], stable: [ARCH, 'U_spare'], discard: [], nursery: [], flags: {} },
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pendingOf = (gameId: string) => (games.get(gameId) as any)?.pending;

// Ждём, пока окно закроется само, но не дольше maxMs. Возвращаем, сколько ждали.
async function waitPendingGone(gameId: string, maxMs: number): Promise<number> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (!pendingOf(gameId)) return Date.now() - started;
    await sleep(250);
  }
  return Date.now() - started;
}

describe('Таймаут окна Архангела', () => {
  test('T1: владелец не ответил — уничтожение проходит, рука не тронута, окно закрыто', async () => {
    const gameId = await createGame(buildGame());
    const played = await playWithTargets(gameId, { cardId: 'C_smash', targets: [ARCH] });
    expect(played.status).toBe(200);

    // Первое окно — реакция на розыгрыш. Через 5 с его таймер исполняет розыгрыш,
    // и эффект уничтожения открывает окно замены.
    expect((pendingOf(gameId) as any)?.kind).toBe('play');
    await sleep(6000);
    const second: any = pendingOf(gameId);
    expect(second).toBeTruthy();
    expect(second.kind).toBe('await_choice');
    expect(second.purpose).toBe('archangel_prevent');
    expect(second.chooserId).toBe(OWNER);

    // Цель жива, пока окно открыто: таймаут ещё не наступил.
    const mid: any = await getState(gameId);
    expect(mid.players.find((p: any) => p.id === OWNER).stable).toContain(ARCH);

    // Второе окно — тоже 5 с. Ждём его закрытия по таймауту.
    const waited = await waitPendingGone(gameId, 12000);
    expect(waited).toBeLessThan(12000);
    expect(pendingOf(gameId)).toBeFalsy();

    const after: any = await getState(gameId);
    const owner = after.players.find((p: any) => p.id === OWNER);
    expect(owner.stable).not.toContain(ARCH);
    expect(owner.discard).toContain(ARCH);
    // Ключевое: таймаут — это отказ, карту за игрока не сбрасывают.
    expect(owner.hand).toEqual(['H_keep']);
    expect(owner.discard).not.toContain('H_keep');
  });

  test('T2: таймаут не дублирует уничтожение — цель ровно однажды в сбросе', async () => {
    const gameId = await createGame(buildGame());
    await playWithTargets(gameId, { cardId: 'C_smash', targets: [ARCH] });
    await waitPendingGone(gameId, 20000);

    const after: any = await getState(gameId);
    const owner = after.players.find((p: any) => p.id === OWNER);
    expect(owner.discard.filter((c: string) => c === ARCH)).toHaveLength(1);
    expect(owner.stable).toEqual(['U_spare']);
    expect(owner.hand).toEqual(['H_keep']);
  });
});
