import { destroyMagic, unicornWhenDestroyedDraw, simpleUpgrade, unicorn } from './helpers/cards';
import { player, baseTurn, gameState } from './helpers/state';
import { createGame, playWithTargets, resolvePending, getState } from './helpers/api';

describe('Trigger: when_destroyed', () => {
  test('owner draws 1 from shared deck when their unicorn is destroyed', async () => {
    const A = 'P1';
    const B = 'P2';
    const destroy = 'C_destroy_wd';
    const victim = 'U_wd_draw1';
    const deckTop = 'DK_TOP';
    const deckNext = 'DK_NEXT';

    const state = gameState({
      players: [
        player({ id: A, hand: [destroy] }),
        player({ id: B, stable: [victim] }),
      ],
      turn: baseTurn(A),
      cards: {
        [destroy]: destroyMagic(destroy),
        [victim]: unicornWhenDestroyedDraw(victim),
        [deckTop]: simpleUpgrade(deckTop), // просто валидная карта для руки
        [deckNext]: unicorn(deckNext, 'Next'),
      },
      // Верх колоды — последний элемент массива (см. executor add: pop из deck)
      deck: [deckNext, deckTop],
      discard: [],
    });

    const gameId = await createGame(state);

    const start = await playWithTargets(gameId, { cardId: destroy, targets: [victim] });
    expect(start.status).toBe(200);
    expect(start.body.pending).toBeTruthy();

    const resolved = await resolvePending(gameId);
    expect(resolved.status).toBe(200);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === A)!;
    const b = final.players.find((p: any) => p.id === B)!;

    // Жертва уничтожена: уходит в личный сброс владельца
    expect(b.stable).not.toContain(victim);
    expect(b.discard).toContain(victim);
    // when_destroyed сработал: верхняя карта общей колоды (deckTop) ушла в руку владельца
    expect(b.hand).toContain(deckTop);
    // Колода уменьшилась и осталась следующая карта
    expect(final.deck).toContain(deckNext);
    expect(final.deck).not.toContain(deckTop);

    // Магическая карта разрушения ушла в общий discard
    expect(final.discard).toContain(destroy);
    // Рука актёра не содержит destroy
    expect(a.hand).not.toContain(destroy);
  });
});
